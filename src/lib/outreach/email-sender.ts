/* ------------------------------------------------------------------ */
/*  Email Sender                                                       */
/*  Tracking pixel injection, HTML formatting, and plain text stripping*/
/* ------------------------------------------------------------------ */

const DEFAULT_TRACKING_BASE = "/api/track";

/**
 * Insert a 1x1 tracking pixel into HTML email body.
 */
export function insertTrackingPixel(
  html: string,
  messageId: string,
  trackingBaseUrl?: string
): string {
  const base = trackingBaseUrl || DEFAULT_TRACKING_BASE;
  const pixelUrl = `${base}/open/${messageId}`;
  const pixel = `<img src="${pixelUrl}" width="1" height="1" style="display:block;" alt="" />`;

  // Insert before </body> if present, otherwise append
  if (html.includes("</body>")) {
    return html.replace("</body>", `${pixel}</body>`);
  }
  return html + pixel;
}

/**
 * Strip HTML tags and return plain text.
 */
export function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/[^\S\n]+/g, " ")  // Collapse spaces/tabs but preserve newlines
    .replace(/^ +| +$/gm, "")   // Trim each line
    .trim();
}

/**
 * Build the full email HTML with brand wrapper, signature, and footer.
 */
export function buildEmailHtml(params: {
  body: string;
  senderName: string;
  brandName: string;
  brandWebsite: string | null;
  brandLogoUrl?: string | null;
  signature?: string | null;
  creatorId?: string | null;
}): string {
  const logoSection = params.brandLogoUrl
    ? `<img src="${params.brandLogoUrl}" alt="${params.brandName}" height="40" style="margin-bottom: 20px;" />`
    : "";

  const signatureSection = params.signature
    ? `<div style="margin-top: 16px; font-size: 13px; color: #666;">${params.signature}</div>`
    : "";

  const websiteDisplay = params.brandWebsite
    ? params.brandWebsite.replace(/^https?:\/\//, "")
    : "";

  const unsubscribeSection = params.creatorId
    ? `<div style="margin-top: 32px; font-size: 11px; color: #999; text-align: center;">
        You're receiving this because ${params.brandName} would like to collaborate with you.
        <a href="/unsubscribe/${params.creatorId}" style="color: #999;">Unsubscribe</a>
      </div>`
    : "";

  return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  ${logoSection}
  <div style="font-size: 15px; line-height: 1.6; color: #1a1a1a;">
    ${params.body}
  </div>
  <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e5e5; color: #666; font-size: 13px;">
    ${params.senderName}<br/>
    ${params.brandName}${websiteDisplay ? `<br/>${websiteDisplay}` : ""}
  </div>
  ${signatureSection}
  ${unsubscribeSection}
</div>`;
}
