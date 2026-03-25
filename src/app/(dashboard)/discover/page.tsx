import { getBrandContext } from "@/lib/queries/brand";
import type { CreatorFilters } from "@/lib/queries/creators";
import { createClient } from "@/lib/supabase/server";
import { searchCreators } from "@/lib/queries/creators";
import { DiscoverClient } from "./discover-client";

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const brand = await getBrandContext(supabase);

  const filters: CreatorFilters = {
    search: params.search,
    niche: params.niche,
    tone: params.tone,
    tier: params.tier,
    audienceCountry: params.audienceCountry,
    geoRegion: params.geoRegion,
    minFollowers: params.minFollowers ? Number(params.minFollowers) : undefined,
    maxFollowers: params.maxFollowers ? Number(params.maxFollowers) : undefined,
    minEngagement: params.minEngagement
      ? Number(params.minEngagement)
      : undefined,
    maxEngagement: params.maxEngagement
      ? Number(params.maxEngagement)
      : undefined,
    minCPI: params.minCPI ? Number(params.minCPI) : undefined,
    maxCPI: params.maxCPI ? Number(params.maxCPI) : undefined,
    minAuthenticity: params.minAuthenticity
      ? Number(params.minAuthenticity)
      : undefined,
    maxAuthenticity: params.maxAuthenticity
      ? Number(params.maxAuthenticity)
      : undefined,
    trend: params.trend,
    verified: params.verified === "true" ? true : undefined,
    sortBy: params.sortBy ?? "cpi",
    sortDir: (params.sortDir as "asc" | "desc") ?? "desc",
    page: params.page ? Number(params.page) : 1,
    pageSize: 24,
    view: params.view === "list" ? "list" : "grid",
    brandId: brand?.brand_id,
  };

  const { creators, total } = await searchCreators(supabase, filters);

  return (
    <DiscoverClient
      initialCreators={creators}
      initialTotal={total}
      initialFilters={filters}
    />
  );
}
