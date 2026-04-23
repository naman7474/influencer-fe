/* ------------------------------------------------------------------ */
/*  Shopify Geo Sync                                                    */
/*                                                                      */
/*  Aggregates Shopify order data (and, where available, Storefront     */
/*  Analytics sessions) into per-(city,state) rows in brand_shopify_geo.*/
/*  Classifies each market as awareness_gap / conversion_gap /          */
/*  strong_market / untracked so the matching engine can route          */
/*  creators to the geographies where the brand actually needs lift.    */
/*                                                                      */
/*  Pure functions + orchestrator; no side-effects outside the          */
/*  provided Supabase client.                                           */
/* ------------------------------------------------------------------ */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { computePopulationWeight } from "@/lib/geo/india-population";

// ── Types ────────────────────────────────────────────────────────────

export type SyncMode = "initial" | "incremental" | "manual";

export type ProblemType =
  | "awareness_gap"
  | "conversion_gap"
  | "strong_market"
  | "untracked";

export interface ShopifyOrder {
  shippingCity: string | null;
  shippingState: string | null;
  shippingCountry: string | null;
  totalPrice: number;
  createdAt: string;
}

export interface ShopifySessions {
  city: string | null;
  state: string | null;
  country: string | null;
  sessions: number;
}

export interface AggregatedBucket {
  city: string | null;
  state: string | null;
  country: string;
  orders: number;
  revenue: number;
  /** null when Storefront Analytics sessions are unavailable (non-Plus shop). */
  sessions: number | null;
  conversion_rate: number | null;
}

export interface ClassifyInput {
  sessions: number | null;
  orders: number;
  conversion_rate: number | null;
  population_weight: number;
  session_share: number | null;
  /** Used in the sessions-free proxy; brand-total revenue share. */
  revenue_share: number;
  brand_median_conversion_rate: number | null;
}

export interface SyncResult {
  rows_upserted: number;
  rows_deleted: number;
  coverage: number;
  sessions_available: boolean;
  window_days: number;
}

// ── Constants ────────────────────────────────────────────────────────

const DEFAULT_WINDOW_DAYS: Record<SyncMode, number> = {
  initial: 180,
  incremental: 30,
  manual: 90,
};

const THROTTLE_PAUSE_MS = 5_000;
const PAGE_SIZE = 250;

/** Gemini/other population-weight thresholds for classifier. */
const POP_SIGNIFICANT = 0.1;
const AWARENESS_GAP_SHARE_RATIO = 0.3;
const STRONG_MARKET_SHARE_RATIO = 0.5;
const CONVERSION_GAP_CR_RATIO = 0.6;
const STRONG_MARKET_CR_RATIO = 0.8;

// ── Shopify GraphQL helpers ──────────────────────────────────────────

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
  extensions?: {
    cost?: {
      throttleStatus?: {
        currentlyAvailable?: number;
        restoreRate?: number;
      };
    };
  };
}

async function adminGraphQL<T>(
  storeUrl: string,
  accessToken: string,
  query: string,
  variables: Record<string, unknown> = {}
): Promise<GraphQLResponse<T>> {
  const res = await fetch(`${storeUrl}/admin/api/2024-07/graphql.json`, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    throw new Error(
      `Shopify Admin GraphQL ${res.status}: ${await res.text()}`
    );
  }
  return (await res.json()) as GraphQLResponse<T>;
}

const ORDERS_QUERY = /* GraphQL */ `
  query OrdersByGeo($first: Int!, $after: String, $query: String) {
    orders(first: $first, after: $after, query: $query, sortKey: CREATED_AT) {
      edges {
        cursor
        node {
          createdAt
          totalPriceSet { shopMoney { amount } }
          shippingAddress { city province countryCode }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

interface OrdersQueryData {
  orders: {
    edges: Array<{
      cursor: string;
      node: {
        createdAt: string;
        totalPriceSet: { shopMoney: { amount: string } };
        shippingAddress: {
          city: string | null;
          province: string | null;
          countryCode: string | null;
        } | null;
      };
    }>;
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
}

export async function fetchOrdersByGeo(
  storeUrl: string,
  accessToken: string,
  windowDays: number
): Promise<ShopifyOrder[]> {
  const since = new Date(Date.now() - windowDays * 86_400_000).toISOString();
  // Shopify search query syntax:
  const queryFilter = `created_at:>=${since}`;
  const orders: ShopifyOrder[] = [];
  let after: string | null = null;

  while (true) {
    const res: GraphQLResponse<OrdersQueryData> =
      await adminGraphQL<OrdersQueryData>(
        storeUrl,
        accessToken,
        ORDERS_QUERY,
        { first: PAGE_SIZE, after, query: queryFilter }
      );
    if (res.errors?.length) {
      throw new Error(`Shopify orders query: ${res.errors[0].message}`);
    }
    const data: OrdersQueryData["orders"] | undefined = res.data?.orders;
    if (!data) break;

    for (const edge of data.edges) {
      const node = edge.node;
      orders.push({
        shippingCity: node.shippingAddress?.city ?? null,
        shippingState: node.shippingAddress?.province ?? null,
        shippingCountry: node.shippingAddress?.countryCode ?? null,
        totalPrice: Number(node.totalPriceSet?.shopMoney?.amount ?? 0),
        createdAt: node.createdAt,
      });
    }

    if (!data.pageInfo.hasNextPage) break;
    after = data.pageInfo.endCursor;

    // Respect leaky-bucket cost throttle.
    const available =
      res.extensions?.cost?.throttleStatus?.currentlyAvailable ?? 1000;
    if (available < 200) {
      await new Promise((r) => setTimeout(r, THROTTLE_PAUSE_MS));
    }
  }

  return orders;
}

/**
 * Storefront Analytics sessions. Plus-only: non-Plus shops return null.
 *
 * Implementation note: the Admin GraphQL surface doesn't expose sessions
 * directly; we try the Analytics REST endpoint first and fall back to
 * null on any 403/404. Keep this wrapper narrow — if it's not available,
 * the classifier runs in its revenue-share variant.
 */
export async function fetchSessionsByGeo(
  storeUrl: string,
  accessToken: string,
  windowDays: number
): Promise<ShopifySessions[] | null> {
  const since = new Date(Date.now() - windowDays * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const url = `${storeUrl}/admin/api/2024-07/reports.json?kind=sessions_by_city&since=${since}`;
  try {
    const res = await fetch(url, {
      headers: { "X-Shopify-Access-Token": accessToken },
    });
    if (res.status === 403 || res.status === 404) return null;
    if (!res.ok) return null;
    // Shopify reports payload is not schema-stable; shape here is
    // best-effort. Pull the parts we need and ignore the rest.
    const body = (await res.json()) as {
      rows?: Array<{
        city?: string | null;
        province?: string | null;
        country?: string | null;
        sessions?: number | null;
      }>;
    };
    const rows = body.rows ?? [];
    return rows.map((r) => ({
      city: r.city ?? null,
      state: r.province ?? null,
      country: r.country ?? null,
      sessions: Number(r.sessions ?? 0),
    }));
  } catch {
    return null;
  }
}

// ── Aggregation ──────────────────────────────────────────────────────

function bucketKey(city: string | null, state: string | null): string {
  const c = (city ?? "").toLowerCase().trim();
  const s = (state ?? "").toLowerCase().trim();
  return `${c}|${s}`;
}

export function aggregateByCityState(
  orders: ShopifyOrder[],
  sessions: ShopifySessions[] | null
): AggregatedBucket[] {
  const buckets = new Map<string, AggregatedBucket>();

  for (const o of orders) {
    const city = o.shippingCity ?? null;
    const state = o.shippingState ?? null;
    const country = (o.shippingCountry ?? "IN").toUpperCase();
    if (!city && !state) continue; // No geo → skip
    const key = bucketKey(city, state);
    const existing = buckets.get(key);
    if (existing) {
      existing.orders += 1;
      existing.revenue += o.totalPrice;
    } else {
      buckets.set(key, {
        city,
        state,
        country,
        orders: 1,
        revenue: o.totalPrice,
        sessions: sessions ? 0 : null,
        conversion_rate: null,
      });
    }
  }

  if (sessions) {
    for (const s of sessions) {
      const city = s.city ?? null;
      const state = s.state ?? null;
      if (!city && !state) continue;
      const key = bucketKey(city, state);
      const existing = buckets.get(key);
      if (existing) {
        existing.sessions = (existing.sessions ?? 0) + s.sessions;
      } else {
        buckets.set(key, {
          city,
          state,
          country: (s.country ?? "IN").toUpperCase(),
          orders: 0,
          revenue: 0,
          sessions: s.sessions,
          conversion_rate: null,
        });
      }
    }

    for (const b of buckets.values()) {
      if (b.sessions != null && b.sessions > 0) {
        b.conversion_rate = b.orders / b.sessions;
      }
    }
  }

  return Array.from(buckets.values());
}

// ── Category relevance (scaffold) ────────────────────────────────────

/** Scaffold; returns 1.0 until we have a category × demographic lookup. */
export function computeCategoryRelevance(
  _brandCategories: string[],
  _cityOrState: string
): number {
  return 1.0;
}

// ── Classifier ───────────────────────────────────────────────────────

/**
 * Classifies a single bucket into a problem_type using either the
 * sessions-aware rule set (Plus shops) or the revenue-share proxy
 * (non-Plus shops).
 */
export function classifyProblemType(input: ClassifyInput): ProblemType {
  const {
    sessions,
    conversion_rate,
    population_weight,
    session_share,
    revenue_share,
    brand_median_conversion_rate,
  } = input;

  if (sessions == null) {
    // Revenue-share proxy: we only have orders + revenue.
    if (
      population_weight >= POP_SIGNIFICANT &&
      revenue_share < population_weight * AWARENESS_GAP_SHARE_RATIO
    ) {
      return "awareness_gap";
    }
    if (revenue_share >= population_weight * STRONG_MARKET_SHARE_RATIO) {
      return "strong_market";
    }
    return "untracked";
  }

  // Sessions-aware path.
  if (
    population_weight >= POP_SIGNIFICANT &&
    (session_share ?? 0) < population_weight * AWARENESS_GAP_SHARE_RATIO
  ) {
    return "awareness_gap";
  }
  if (
    (session_share ?? 0) >= population_weight * STRONG_MARKET_SHARE_RATIO &&
    conversion_rate != null &&
    brand_median_conversion_rate != null &&
    conversion_rate < brand_median_conversion_rate * CONVERSION_GAP_CR_RATIO
  ) {
    return "conversion_gap";
  }
  if (
    (session_share ?? 0) >= population_weight * STRONG_MARKET_SHARE_RATIO &&
    conversion_rate != null &&
    brand_median_conversion_rate != null &&
    conversion_rate >= brand_median_conversion_rate * STRONG_MARKET_CR_RATIO
  ) {
    return "strong_market";
  }
  return "untracked";
}

/** Gap score ∈ [-1, 1]. Positive = bigger gap (brand should invest). */
export function computeGapScore(input: {
  population_weight: number;
  category_relevance: number;
  session_share: number | null;
  revenue_share: number;
}): number {
  const share = input.session_share ?? input.revenue_share;
  const raw = input.population_weight * input.category_relevance - share;
  return Math.max(-1, Math.min(1, raw));
}

// ── Orchestrator ─────────────────────────────────────────────────────

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Runs the full sync for one brand. Idempotent: upserts by
 * (brand_id, lower(city), lower(state)), then hard-deletes rows from
 * prior runs that weren't reproduced this time.
 */
export async function syncBrandGeo(
  supabase: SupabaseClient<Database>,
  params: {
    brandId: string;
    storeUrl: string;
    accessToken: string;
    productCategories: string[];
    mode: SyncMode;
    windowDays?: number;
  }
): Promise<SyncResult> {
  const windowDays = params.windowDays ?? DEFAULT_WINDOW_DAYS[params.mode];
  const syncRunId = crypto.randomUUID();
  const syncStart = new Date();

  // Mark brand as running; ignore failures here (column may not be there
  // in a partial environment, but production migrations guarantee it).
  await supabase
    .from("brands")
    .update({
      shopify_geo_sync_status: "running",
      shopify_geo_sync_started_at: syncStart.toISOString(),
      shopify_geo_sync_error: null,
    } as never)
    .eq("id", params.brandId);

  try {
    const [orders, sessions] = await Promise.all([
      fetchOrdersByGeo(params.storeUrl, params.accessToken, windowDays),
      fetchSessionsByGeo(params.storeUrl, params.accessToken, windowDays),
    ]);

    const sessionsAvailable = sessions != null;
    const buckets = aggregateByCityState(orders, sessions);

    const totalSessions =
      sessions?.reduce((s, r) => s + (r.sessions ?? 0), 0) ?? 0;
    const totalRevenue = orders.reduce((s, o) => s + o.totalPrice, 0);
    const brandMedianCR = sessionsAvailable
      ? median(
          buckets
            .filter((b) => b.conversion_rate != null)
            .map((b) => b.conversion_rate as number)
        )
      : null;

    const periodStart = new Date(
      Date.now() - windowDays * 86_400_000
    )
      .toISOString()
      .slice(0, 10);
    const periodEnd = syncStart.toISOString().slice(0, 10);

    type GeoInsert =
      Database["public"]["Tables"]["brand_shopify_geo"]["Insert"];
    const rows: GeoInsert[] = buckets.map((b) => {
      const region = b.city ?? b.state ?? "";
      const populationWeight = computePopulationWeight(region);
      const categoryRelevance = computeCategoryRelevance(
        params.productCategories,
        region
      );
      const sessionShare =
        sessionsAvailable && totalSessions > 0 && b.sessions != null
          ? b.sessions / totalSessions
          : null;
      const revenueShare = totalRevenue > 0 ? b.revenue / totalRevenue : 0;

      const problemType = classifyProblemType({
        sessions: sessionsAvailable ? b.sessions : null,
        orders: b.orders,
        conversion_rate: b.conversion_rate,
        population_weight: populationWeight,
        session_share: sessionShare,
        revenue_share: revenueShare,
        brand_median_conversion_rate: brandMedianCR,
      });

      const gapScore = computeGapScore({
        population_weight: populationWeight,
        category_relevance: categoryRelevance,
        session_share: sessionShare,
        revenue_share: revenueShare,
      });

      return {
        brand_id: params.brandId,
        city: b.city,
        state: b.state,
        country: b.country,
        sessions: b.sessions ?? 0,
        orders: b.orders,
        revenue: b.revenue,
        conversion_rate: b.conversion_rate,
        population_weight: populationWeight,
        category_relevance: categoryRelevance,
        gap_score: gapScore,
        problem_type: problemType,
        period_start: periodStart,
        period_end: periodEnd,
        refreshed_at: syncStart.toISOString(),
        last_sync_run_id: syncRunId,
      } as unknown as GeoInsert;
    });

    let upserted = 0;
    if (rows.length) {
      const { error: upsertError } = await supabase
        .from("brand_shopify_geo")
        .upsert(rows as never[], {
          onConflict: "brand_id,city,state",
          ignoreDuplicates: false,
        });
      if (upsertError) {
        throw new Error(`Upsert geo rows: ${upsertError.message}`);
      }
      upserted = rows.length;
    }

    // Delete rows from prior runs that this run did not produce.
    const { data: deletedRows, error: deleteError } = await supabase
      .from("brand_shopify_geo")
      .delete()
      .eq("brand_id", params.brandId)
      .lt("refreshed_at", syncStart.toISOString())
      .select("id");
    if (deleteError) {
      // Non-fatal; log and continue.
      console.error("stale geo delete error:", deleteError);
    }
    const deleted = deletedRows?.length ?? 0;

    const coverage = buckets.length
      ? buckets.filter((b) => !!(b.city || b.state)).length / buckets.length
      : 0;

    await supabase
      .from("brands")
      .update({
        shopify_geo_sync_status: sessionsAvailable ? "succeeded" : "degraded",
        shopify_geo_sync_completed_at: new Date().toISOString(),
        shopify_geo_sessions_available: sessionsAvailable,
      } as never)
      .eq("id", params.brandId);

    return {
      rows_upserted: upserted,
      rows_deleted: deleted,
      coverage,
      sessions_available: sessionsAvailable,
      window_days: windowDays,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase
      .from("brands")
      .update({
        shopify_geo_sync_status: "failed",
        shopify_geo_sync_completed_at: new Date().toISOString(),
        shopify_geo_sync_error: msg,
      } as never)
      .eq("id", params.brandId);
    throw err;
  }
}
