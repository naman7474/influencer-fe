import { NextRequest, NextResponse } from "next/server";
import { analyzeBrandWebsite } from "@/lib/scraping/brand-analyzer";

/**
 * POST /api/scrape/website
 * Scrape a website URL and return structured brand identity data.
 * Used during onboarding auto-fill (brand may not exist yet).
 */
export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "url is required" },
        { status: 400 }
      );
    }

    // Basic URL validation
    try {
      new URL(url.startsWith("http") ? url : `https://${url}`);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL" },
        { status: 400 }
      );
    }

    const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;
    const result = await analyzeBrandWebsite(normalizedUrl);

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 502 }
      );
    }

    return NextResponse.json({ data: result.data });
  } catch (err) {
    console.error("[scrape/website] Error:", err);
    return NextResponse.json(
      { error: "Failed to scrape website" },
      { status: 500 }
    );
  }
}
