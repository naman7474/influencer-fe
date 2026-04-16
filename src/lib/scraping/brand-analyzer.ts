import FirecrawlApp from "@mendable/firecrawl-js";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { BrandExtractionSchema, type BrandExtraction } from "./types";

/**
 * Analyze a brand website and extract structured identity data.
 * Strategy: Firecrawl scrape → structured extraction via Claude fallback.
 */
export async function analyzeBrandWebsite(
  url: string
): Promise<{ data: BrandExtraction | null; error?: string }> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    return { data: null, error: "FIRECRAWL_API_KEY not configured" };
  }

  try {
    const firecrawl = new FirecrawlApp({ apiKey });

    // Step 1: Scrape the URL with Firecrawl
    const scrapeResult = await firecrawl.scrape(url, {
      formats: ["markdown"],
    });

    if (!scrapeResult.markdown) {
      return { data: null, error: "Failed to scrape website" };
    }

    const markdown = scrapeResult.markdown;

    // Step 2: Use Claude to extract structured brand data from the markdown
    const { object } = await generateObject({
      model: anthropic("claude-haiku-4-5-20251001"),
      schema: BrandExtractionSchema,
      prompt: `Analyze this website content and extract brand identity information. Return structured data about the brand.

Website URL: ${url}

Website content:
${markdown.slice(0, 8000)}

Extract:
- brand_name: The brand/company name
- description: A 1-2 sentence brand description/elevator pitch
- logo_url: URL of the brand logo if found (absolute URL)
- product_categories: List of product categories they sell
- brand_values: Core brand values or mission keywords (e.g., "sustainable", "premium", "family-friendly")
- industry: Primary industry (e.g., "health food", "fashion", "technology")
- target_audience: Brief description of target audience
- tone: Brand voice/tone (e.g., "professional", "casual", "luxury", "playful")
- price_range: Price range description if discernible (e.g., "premium", "budget", "mid-range")
- instagram_handle: The brand's Instagram handle without the "@" or URL prefix (e.g., "nike"). Usually found in the footer or header as a link to instagram.com/<handle>. Return only the handle string.

Only include fields you can confidently extract. Omit fields if unsure.`,
    });

    return { data: object };
  } catch (err) {
    console.error("[brand-analyzer] Error:", err);
    return {
      data: null,
      error: err instanceof Error ? err.message : "Failed to analyze website",
    };
  }
}
