import { z } from "zod";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

// ---------------------------------------------------------------------------
// BrightData dataset IDs (same as pipeline)
// ---------------------------------------------------------------------------
const DATASET_PROFILES = "gd_l1vikfch901nx3by4";
const DATASET_POSTS = "gd_lk5ns7kz21pck8jpis";

// ---------------------------------------------------------------------------
// Output schema
// ---------------------------------------------------------------------------
export const IgPreviewSchema = z.object({
  followers: z.number().optional(),
  following: z.number().optional(),
  posts_count: z.number().optional(),
  bio: z.string().optional(),
  category: z.string().optional(),
  is_verified: z.boolean().optional(),
  content_mix: z
    .object({
      reels_pct: z.number().optional(),
      carousels_pct: z.number().optional(),
      static_pct: z.number().optional(),
    })
    .optional(),
  posting_frequency: z.string().optional(),
  top_hashtags: z.array(z.string()).optional(),
  brand_mentions: z.array(z.string()).optional(),
  caption_tone: z.string().optional(),
  audience_signals: z.string().optional(),
  collaborator_handles: z.array(z.string()).optional(),
  avg_likes: z.number().optional(),
  avg_comments: z.number().optional(),
});

export type IgPreview = z.infer<typeof IgPreviewSchema>;

// ---------------------------------------------------------------------------
// BrightData helpers (thin TypeScript wrapper, same API as pipeline Python)
// ---------------------------------------------------------------------------

async function bdRequest(
  path: string,
  method: "GET" | "POST",
  params: Record<string, string>,
  body?: unknown
): Promise<Response> {
  const token = process.env.BRIGHTDATA_API_TOKEN;
  if (!token) throw new Error("BRIGHTDATA_API_TOKEN not configured");

  const url = new URL(`https://api.brightdata.com/datasets/v3${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  return fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function bdTriggerAndWait(
  datasetId: string,
  payload: unknown[],
  timeoutMs = 30_000
): Promise<unknown[]> {
  // Trigger
  const triggerRes = await bdRequest(
    "/trigger",
    "POST",
    { dataset_id: datasetId, format: "json" },
    payload
  );
  if (!triggerRes.ok) {
    const txt = await triggerRes.text();
    throw new Error(`BrightData trigger failed (${triggerRes.status}): ${txt}`);
  }
  const { snapshot_id } = (await triggerRes.json()) as {
    snapshot_id: string;
  };

  // Poll
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const progressRes = await bdRequest(
      `/progress/${snapshot_id}`,
      "GET",
      {}
    );
    if (progressRes.ok) {
      const progress = (await progressRes.json()) as { status: string };
      if (progress.status === "ready") break;
      if (progress.status === "failed")
        throw new Error(`BrightData snapshot ${snapshot_id} failed`);
    }
    await new Promise((r) => setTimeout(r, 3000));
  }

  // Download
  const dlRes = await bdRequest(`/snapshot/${snapshot_id}`, "GET", {
    format: "json",
  });
  if (!dlRes.ok) throw new Error("BrightData download failed");
  return (await dlRes.json()) as unknown[];
}

async function bdScrapeSync(
  datasetId: string,
  payload: unknown[],
  extraParams: Record<string, string> = {}
): Promise<unknown[]> {
  const params: Record<string, string> = {
    dataset_id: datasetId,
    notify: "false",
    include_errors: "true",
    ...extraParams,
  };

  const body = { input: payload };
  const res = await bdRequest("/scrape", "POST", params, body);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`BrightData scrape failed (${res.status}): ${txt}`);
  }

  const text = await res.text();
  // Try JSON array or object
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
    if (parsed.snapshot_id) {
      // Need to poll
      const start = Date.now();
      while (Date.now() - start < 30_000) {
        const p = await bdRequest(`/progress/${parsed.snapshot_id}`, "GET", {});
        if (p.ok) {
          const progress = (await p.json()) as { status: string };
          if (progress.status === "ready") break;
          if (progress.status === "failed") throw new Error("snapshot failed");
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
      const dlRes = await bdRequest(`/snapshot/${parsed.snapshot_id}`, "GET", {
        format: "json",
      });
      return (await dlRes.json()) as unknown[];
    }
    return [parsed];
  } catch {
    // NDJSON
    return text
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l));
  }
}

// ---------------------------------------------------------------------------
// Main: lightweight IG preview
// ---------------------------------------------------------------------------

export async function getIgPreview(handle: string): Promise<{
  data: IgPreview | null;
  error?: string;
}> {
  const cleanHandle = handle.replace(/^@/, "").trim().toLowerCase();
  if (!cleanHandle) return { data: null, error: "No handle provided" };

  // Provider routing — same env flag the Python pipeline reads.
  const provider = (process.env.SCRAPER_PROVIDER || "brightdata").toLowerCase();
  if (provider === "apify") {
    const { getIgPreviewApify } = await import("./ig-preview-apify");
    return getIgPreviewApify(cleanHandle);
  }

  const profileUrl = `https://www.instagram.com/${cleanHandle}/`;

  try {
    // Run profile + posts scrapes in parallel
    const [profileResults, postsResults] = await Promise.all([
      bdTriggerAndWait(DATASET_PROFILES, [{ url: profileUrl }], 20_000),
      bdScrapeSync(
        DATASET_POSTS,
        [
          {
            url: profileUrl,
            num_of_posts: 10,
          },
        ],
        { type: "discover_new", discover_by: "url" }
      ).catch(() => [] as unknown[]),
    ]);

    const profile = (profileResults[0] ?? {}) as Record<string, unknown>;
    const posts = postsResults as Record<string, unknown>[];

    // Feed to Claude Haiku for structured summary
    const profileSnippet = JSON.stringify(
      {
        account: profile.account,
        followers: profile.followers,
        following: profile.following,
        posts_count: profile.posts_count,
        biography: profile.biography,
        category: profile.category || profile.category_name,
        is_verified: profile.is_verified,
        avg_engagement: profile.avg_engagement,
        city: profile.city,
        country: profile.country,
        bio_hashtags: profile.bio_hashtags,
      },
      null,
      2
    );

    const postsSnippet = posts
      .slice(0, 10)
      .map((p) =>
        JSON.stringify({
          type: p.type || p.media_type,
          caption: typeof p.description === "string"
            ? (p.description as string).slice(0, 200)
            : "",
          likes: p.likes,
          comments: p.comments,
          hashtags: p.hashtags,
          mentions: p.mentions || p.tagged_users,
          timestamp: p.timestamp || p.taken_at,
        })
      )
      .join("\n");

    const { object } = await generateObject({
      model: anthropic("claude-haiku-4-5-20251001"),
      schema: IgPreviewSchema,
      prompt: `Analyze this Instagram profile and recent posts data. Return a structured preview summary.

Profile data:
${profileSnippet}

Recent posts (up to 10):
${postsSnippet}

Extract:
- followers, following, posts_count: from profile
- bio: cleaned bio text
- category: creator/brand category
- is_verified: boolean
- content_mix: approximate percentage breakdown of reels vs carousels vs static posts
- posting_frequency: e.g. "4.2 posts/week" based on timestamps
- top_hashtags: most used hashtags (up to 8)
- brand_mentions: brand handles tagged in posts (up to 5)
- caption_tone: 1-sentence description of voice/tone (e.g. "warm, botanical, clinical")
- audience_signals: 1-sentence audience inference from content + engagement patterns
- collaborator_handles: any creator/brand handles that appear to be collaborations (up to 5)
- avg_likes, avg_comments: average per post

Be concise. Only include fields you can extract from the data.`,
    });

    return { data: object };
  } catch (err) {
    console.error("[ig-preview] Error:", err);
    return {
      data: null,
      error: err instanceof Error ? err.message : "Failed to preview Instagram",
    };
  }
}
