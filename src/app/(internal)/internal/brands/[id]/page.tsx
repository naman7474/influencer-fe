import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Brand } from "@/lib/types/database";

type PageProps = { params: Promise<{ id: string }> };

type AnalysisRow = {
  platform: string | null;
  handle: string | null;
  analysis_status: string | null;
  analysis_completed_at: string | null;
  analysis_error: string | null;
  content_dna: Record<string, unknown> | null;
  audience_profile: Record<string, unknown> | null;
  collaborators: string[] | null;
  content_embedding: unknown;
};

type GeoRow = {
  state: string | null;
  city: string | null;
  source: string | null;
  population_weight: number | null;
  gap_score: number | null;
  problem_type: string | null;
  problem_type_current?: string | null;
  sessions: number | null;
  orders: number | null;
};

type MatchRow = {
  creator_id: string | null;
  platform: string | null;
  match_score: number | null;
  niche_fit_score: number | null;
  audience_geo_score: number | null;
  engagement_score: number | null;
  brand_safety_score: number | null;
  confidence: number | null;
  coverage_percentage: number | null;
  match_reasoning: string | null;
  match_score_breakdown: Record<string, unknown> | null;
};

export default async function InternalBrandDebugPage({ params }: PageProps) {
  const { id } = await params;
  const sb = createServiceRoleClient();

  const { data: brandData } = await sb
    .from("brands")
    .select("*")
    .eq("id", id)
    .single();

  if (!brandData) notFound();

  // Niche columns added in migration 20260502_brand_niche_columns; until
  // generated types are regenerated, widen explicitly so the page renders.
  const brand = brandData as unknown as Brand;
  const brandWithExtras = brand as Brand & {
    primary_niche?: string | null;
    secondary_niche?: string | null;
    niche_classified_at?: string | null;
    target_regions?: string[] | null;
    ig_audience_profile?: Record<string, unknown> | null;
  };

  const [analysesRes, geoRes, gapsRes, matchesRes] = await Promise.all([
    sb.from("brand_platform_analyses").select("*").eq("brand_id", id),
    sb.from("brand_shopify_geo").select("*").eq("brand_id", id),
    sb
      .from("v_brand_geo_gaps" as never)
      .select("*")
      .eq("brand_id", id),
    sb
      .from("creator_brand_matches")
      .select(
        "creator_id, platform, match_score, niche_fit_score, audience_geo_score, engagement_score, brand_safety_score, confidence, coverage_percentage, match_reasoning, match_score_breakdown",
      )
      .eq("brand_id", id)
      .order("match_score", { ascending: false })
      .limit(30),
  ]);

  const analyses = (analysesRes.data ?? []) as AnalysisRow[];
  const geoRows = (geoRes.data ?? []) as GeoRow[];
  const geoGaps = (gapsRes.data ?? []) as GeoRow[];
  const matches = (matchesRes.data ?? []) as MatchRow[];

  const creatorIds = matches
    .map((m) => m.creator_id)
    .filter((v): v is string => !!v);
  const creatorsRaw =
    creatorIds.length > 0
      ? (
          await sb
            .from("creators")
            .select("id, handle, primary_niche, tier, followers")
            .in("id", creatorIds)
        ).data ?? []
      : [];
  const creators = creatorsRaw as unknown as Array<Record<string, unknown>>;
  const creatorById = new Map<string, Record<string, unknown>>(
    creators.map((c) => [c.id as string, c]),
  );

  const embeddingDim = (v: unknown): string =>
    Array.isArray(v)
      ? `array(${(v as unknown[]).length})`
      : typeof v === "string" && v.startsWith("[")
        ? "string-encoded"
        : "missing";

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">
          {brand.brand_name}{" "}
          <span className="text-muted-foreground">@{brand.instagram_handle}</span>
        </h1>
        <p className="text-sm text-muted-foreground">id: {brand.id}</p>
      </header>

      <Card className="p-4 space-y-2">
        <h2 className="font-semibold">Niche & onboarding</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>industry: {brand.industry ?? "—"}</div>
          <div>
            shopify_connected:{" "}
            <Badge variant={brand.shopify_connected ? "default" : "secondary"}>
              {String(brand.shopify_connected ?? false)}
            </Badge>
          </div>
          <div>
            primary_niche:{" "}
            <Badge>{brandWithExtras.primary_niche ?? "(unset)"}</Badge>
          </div>
          <div>
            secondary_niche: {brandWithExtras.secondary_niche ?? "—"}
          </div>
          <div className="col-span-2">
            product_categories: {(brand.product_categories ?? []).join(", ") || "—"}
          </div>
          <div className="col-span-2">
            shipping_zones: {(brand.shipping_zones ?? []).join(", ") || "—"}
          </div>
          <div className="col-span-2">
            target_regions:{" "}
            {(brandWithExtras.target_regions ?? []).join(", ") || "—"}
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <h2 className="font-semibold">Platform analyses</h2>
        {analyses.length === 0 && (
          <p className="text-sm text-muted-foreground">No analyses yet.</p>
        )}
        {analyses.map((a) => (
          <div
            key={`${a.platform}-${a.handle}`}
            className="rounded border border-border p-3 text-sm space-y-1"
          >
            <div className="flex items-center gap-2">
              <Badge>{a.platform}</Badge>
              <Badge variant="outline">{a.analysis_status}</Badge>
              <span className="text-muted-foreground">@{a.handle}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                embedding: {embeddingDim(a.content_embedding)}
              </span>
            </div>
            {a.analysis_error && (
              <div className="text-destructive">error: {a.analysis_error}</div>
            )}
            <details>
              <summary className="cursor-pointer text-muted-foreground">
                content_dna
              </summary>
              <pre className="mt-1 max-h-64 overflow-auto rounded bg-muted/40 p-2 text-xs">
                {JSON.stringify(a.content_dna, null, 2)}
              </pre>
            </details>
            <details>
              <summary className="cursor-pointer text-muted-foreground">
                audience_profile
              </summary>
              <pre className="mt-1 max-h-64 overflow-auto rounded bg-muted/40 p-2 text-xs">
                {JSON.stringify(a.audience_profile, null, 2)}
              </pre>
            </details>
            <div className="text-muted-foreground">
              collaborators: {(a.collaborators ?? []).length}
            </div>
          </div>
        ))}
      </Card>

      <Card className="p-4 space-y-2">
        <h2 className="font-semibold">
          brand_shopify_geo ({geoRows.length} rows)
        </h2>
        {geoRows.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No geo rows. audience_geo will floor at 0.3.
          </p>
        )}
        {geoRows.length > 0 && (
          <div className="overflow-auto text-xs">
            <table className="w-full">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="text-left">state</th>
                  <th className="text-left">city</th>
                  <th>source</th>
                  <th>pop_weight</th>
                  <th>gap_score</th>
                  <th>problem_type</th>
                  <th>sessions</th>
                  <th>orders</th>
                </tr>
              </thead>
              <tbody>
                {geoRows.map((g, idx) => (
                  <tr key={idx} className="border-t border-border">
                    <td>{g.state ?? "—"}</td>
                    <td>{g.city ?? "—"}</td>
                    <td className="text-center">
                      <Badge variant="outline">{g.source ?? "shopify"}</Badge>
                    </td>
                    <td className="text-right">{g.population_weight ?? "—"}</td>
                    <td className="text-right">{g.gap_score ?? "—"}</td>
                    <td className="text-center">{g.problem_type ?? "—"}</td>
                    <td className="text-right">{g.sessions ?? 0}</td>
                    <td className="text-right">{g.orders ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-4 space-y-2">
        <h2 className="font-semibold">
          v_brand_geo_gaps ({geoGaps.length} after dedup)
        </h2>
        <div className="text-xs space-y-1">
          {geoGaps.slice(0, 20).map((g, idx) => (
            <div key={idx} className="flex gap-3">
              <span className="w-32">{g.state}</span>
              <span className="w-24 text-muted-foreground">
                {g.problem_type_current}
              </span>
              <span>gap={g.gap_score}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4 space-y-2">
        <h2 className="font-semibold">Top {matches.length} matches</h2>
        <div className="space-y-2">
          {matches.map((m) => {
            const c = m.creator_id ? creatorById.get(m.creator_id) : null;
            return (
              <div
                key={`${m.creator_id}-${m.platform}`}
                className="rounded border border-border p-3 text-sm"
              >
                <div className="flex items-center gap-2">
                  <Badge>{m.platform}</Badge>
                  <span className="font-medium">
                    @{(c?.handle as string) ?? m.creator_id}
                  </span>
                  <span className="text-muted-foreground">
                    {(c?.primary_niche as string) ?? "?"} · {(c?.tier as string) ?? "?"}
                  </span>
                  <span className="ml-auto font-mono">
                    score={(m.match_score ?? 0).toFixed(3)}
                  </span>
                </div>
                <div className="mt-1 grid grid-cols-5 gap-1 font-mono text-xs text-muted-foreground">
                  <div>niche {(m.niche_fit_score ?? 0).toFixed(2)}</div>
                  <div>geo {(m.audience_geo_score ?? 0).toFixed(2)}</div>
                  <div>eng {(m.engagement_score ?? 0).toFixed(2)}</div>
                  <div>safety {(m.brand_safety_score ?? 0).toFixed(2)}</div>
                  <div>
                    conf {(m.confidence ?? 0).toFixed(2)} · cov{" "}
                    {m.coverage_percentage ?? 0}%
                  </div>
                </div>
                {m.match_reasoning && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {m.match_reasoning}
                  </div>
                )}
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    breakdown
                  </summary>
                  <pre className="mt-1 max-h-48 overflow-auto rounded bg-muted/40 p-2 text-xs">
                    {JSON.stringify(m.match_score_breakdown, null, 2)}
                  </pre>
                </details>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
