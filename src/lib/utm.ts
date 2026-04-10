import slugify from "slugify";

/**
 * Generates a full UTM-tagged URL for tracking influencer campaign traffic.
 *
 * @param brandWebsite - The brand's base website URL
 * @param campaignName - Human-readable campaign name (will be slugified)
 * @param creatorHandle - Instagram handle of the creator
 * @param creatorTier - Creator tier (nano, micro, mid, macro, mega)
 * @returns Fully qualified URL with UTM parameters
 */
export function generateUTMLink(
  brandWebsite: string,
  campaignName: string,
  creatorHandle: string,
  creatorTier: string
): string {
  const baseUrl = brandWebsite.replace(/\/$/, "");
  const params = new URLSearchParams({
    utm_source: "instagram",
    utm_medium: "influencer",
    utm_campaign: slugify(campaignName, { lower: true, strict: true }),
    utm_content: creatorHandle,
    utm_term: creatorTier,
  });
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Generates a discount code from a creator handle and discount percentage.
 * Uppercases the handle, strips underscores, appends the discount number.
 *
 * @example generateDiscountCode("beauty_queen", 15) => "BEAUTYQUEEN15"
 */
export function generateDiscountCode(
  creatorHandle: string,
  discountPercent: number
): string {
  return `${creatorHandle.toUpperCase().replace(/_/g, "")}${discountPercent}`;
}

/**
 * Generates a random 6-character alphanumeric short code for URL shortening.
 */
export function generateShortCode(): string {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Builds a platform short URL from a short code.
 */
export function buildShortUrl(shortCode: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${appUrl}/api/link/${shortCode}`;
}
