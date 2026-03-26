export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function generateUtmLink(
  brandWebsite: string,
  campaignSlug: string,
  creatorHandle: string
): string {
  const url = new URL(brandWebsite);
  url.searchParams.set("utm_source", "influencer");
  url.searchParams.set("utm_medium", slugify(creatorHandle));
  url.searchParams.set("utm_campaign", slugify(campaignSlug));
  return url.toString();
}

export function parseUtmFromLandingPage(url: string | null | undefined): {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
} {
  if (!url) {
    return {
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
    };
  }

  try {
    const parsed = new URL(url);
    return {
      utm_source: parsed.searchParams.get("utm_source"),
      utm_medium: parsed.searchParams.get("utm_medium"),
      utm_campaign: parsed.searchParams.get("utm_campaign"),
    };
  } catch {
    return {
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
    };
  }
}
