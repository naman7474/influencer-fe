import type { SupabaseClient } from "@supabase/supabase-js";

export async function getGeoOverview(
  supabase: SupabaseClient,
  brandId: string
) {
  const [brandRes, geoRes, matchesRes] = await Promise.all([
    supabase
      .from("brands")
      .select(
        "shopify_connected, shopify_store_url, shopify_last_sync_at, top_order_cities, shopify_sync_status, shopify_sync_error"
      )
      .eq("id", brandId)
      .single(),
    supabase
      .from("brand_shopify_geo")
      .select("*")
      .eq("brand_id", brandId)
      .order("gap_score", { ascending: false }),
    supabase
      .from("creator_brand_matches")
      .select("creator_id, match_score, recommended_for, geo_match_regions")
      .eq("brand_id", brandId)
      .order("match_score", { ascending: false })
      .limit(30),
  ]);

  if (brandRes.error) throw brandRes.error;
  if (geoRes.error) throw geoRes.error;
  if (matchesRes.error) throw matchesRes.error;

  const geoRows = geoRes.data ?? [];
  const creatorIds = (matchesRes.data ?? []).map((row) => row.creator_id);
  const creatorsRes =
    creatorIds.length > 0
      ? await supabase
          .from("mv_creator_leaderboard")
          .select(
            "creator_id, handle, display_name, primary_niche, followers, audience_country"
          )
          .in("creator_id", creatorIds)
      : { data: [], error: null };

  if (creatorsRes.error) throw creatorsRes.error;

  const creatorMap = new Map(
    (creatorsRes.data ?? []).map((creator) => [creator.creator_id, creator])
  );

  const recommendations = geoRows.slice(0, 6).map((geoRow) => {
    const regionName =
      [geoRow.city, geoRow.state].filter(Boolean).join(", ") || "Unknown region";
    const regionMatches = (matchesRes.data ?? []).filter((match) =>
      Array.isArray(match.geo_match_regions)
        ? match.geo_match_regions.some((region) => {
            const candidate = String(
              (region as { region?: string }).region ?? ""
            ).toLowerCase();
            return candidate.includes(String(geoRow.city ?? "").toLowerCase()) ||
              candidate.includes(String(geoRow.state ?? "").toLowerCase());
          })
        : false
    );

    return {
      region_name: regionName,
      region: `${regionName} ${String(geoRow.problem_type).replace(/_/g, " ")}`,
      fit: creatorMap.get(regionMatches[0]?.creator_id)?.primary_niche
        ? `${creatorMap.get(regionMatches[0]?.creator_id)?.primary_niche} creators with strong match scores`
        : "No creator recommendations generated yet.",
      recommended_for: regionMatches[0]?.recommended_for ?? null,
      creators: regionMatches.slice(0, 3).map((match) => ({
        ...match,
        creator: creatorMap.get(match.creator_id) ?? null,
      })),
    };
  });

  return {
    shopify_connected: Boolean(brandRes.data.shopify_connected),
    store_url: brandRes.data.shopify_store_url,
    last_sync_at: brandRes.data.shopify_last_sync_at,
    sync_status: brandRes.data.shopify_sync_status ?? "idle",
    sync_error: brandRes.data.shopify_sync_error ?? null,
    rows: geoRows,
    regions: geoRows.slice(0, 6).map((row) => ({
      name: [row.city, row.state].filter(Boolean).join(", ") || "Unknown region",
      tone:
        row.problem_type === "awareness_gap"
          ? "bg-rose-100 text-rose-800"
          : row.problem_type === "conversion_gap"
            ? "bg-amber-100 text-amber-800"
            : "bg-emerald-100 text-emerald-800",
      value: Math.round(Number(row.gap_score ?? 0) * 100),
    })),
    recommendations,
  };
}
