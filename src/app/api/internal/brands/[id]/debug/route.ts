import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireInternalAdmin } from "@/lib/internal/admin-guard";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteContext) {
  const admin = await requireInternalAdmin();
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const sb = createServiceRoleClient();

  const [
    brandRes,
    analysesRes,
    geoRes,
    gapsRes,
    matchesRes,
  ] = await Promise.all([
    sb.from("brands").select("*").eq("id", id).single(),
    sb
      .from("brand_platform_analyses")
      .select("*")
      .eq("brand_id", id),
    sb
      .from("brand_shopify_geo")
      .select("*")
      .eq("brand_id", id),
    sb
      .from("v_brand_geo_gaps" as never)
      .select("*")
      .eq("brand_id", id),
    sb
      .from("creator_brand_matches")
      .select(
        "creator_id, platform, match_score, niche_fit_score, audience_geo_score, engagement_score, brand_safety_score, content_style_score, confidence, coverage_percentage, missing_inputs, manual_review_required, match_reasoning, match_score_breakdown, percentile_in_brand_pool, computed_at, algorithm_version"
      )
      .eq("brand_id", id)
      .order("match_score", { ascending: false })
      .limit(30),
  ]);

  type MatchRow = Record<string, unknown> & {
    creator_id: string;
    missing_inputs?: string[] | null;
  };
  type AnalysisRow = Record<string, unknown> & {
    content_embedding?: unknown;
  };
  const rawMatches = (matchesRes.data ?? []) as unknown as MatchRow[];
  const rawAnalyses = (analysesRes.data ?? []) as unknown as AnalysisRow[];

  // Resolve creator handles for the top matches in one round trip.
  const creatorIds = rawMatches
    .map((m) => m.creator_id)
    .filter((v): v is string => !!v);
  const creatorsRes =
    creatorIds.length > 0
      ? await sb
          .from("creators")
          .select("id, handle, primary_niche, tier, followers")
          .in("id", creatorIds)
      : { data: [] as Array<Record<string, unknown>> };

  const creatorById = new Map<string, Record<string, unknown>>(
    ((creatorsRes.data ?? []) as Array<Record<string, unknown>>).map((c) => [
      c.id as string,
      c,
    ]),
  );

  const matches = rawMatches.map((m) => ({
    ...m,
    creator: creatorById.get(m.creator_id) ?? null,
  }));

  // Aggregate missing_inputs across the pool to surface systemic gaps.
  const missingHistogram: Record<string, number> = {};
  for (const m of rawMatches) {
    const arr = (m.missing_inputs ?? []) as string[];
    for (const reason of arr) {
      missingHistogram[reason] = (missingHistogram[reason] ?? 0) + 1;
    }
  }

  // Embedding presence — without exposing the raw 1536-dim vector.
  const analyses = rawAnalyses.map((a) => ({
    ...a,
    content_embedding_present: !!a.content_embedding,
    content_embedding_dim: Array.isArray(a.content_embedding)
      ? (a.content_embedding as unknown[]).length
      : typeof a.content_embedding === "string"
        ? "string-encoded"
        : 0,
    content_embedding: undefined,
  }));

  return NextResponse.json({
    brand: brandRes.data,
    brand_error: brandRes.error?.message,
    analyses,
    geo_rows: geoRes.data ?? [],
    geo_gaps: gapsRes.data ?? [],
    top_matches: matches,
    missing_inputs_histogram: missingHistogram,
  });
}
