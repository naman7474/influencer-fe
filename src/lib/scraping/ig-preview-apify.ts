import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { IgPreviewSchema, type IgPreview } from "./ig-preview";

// ---------------------------------------------------------------------------
// Apify actor IDs (mirrors the Python apify scrapers)
// ---------------------------------------------------------------------------
const ACTOR_PROFILE =
  process.env.APIFY_ACTOR_IG_PROFILE || "apify/instagram-profile-scraper";
const ACTOR_POSTS =
  process.env.APIFY_ACTOR_IG_POSTS || "apify/instagram-post-scraper";

// Apify actor IDs go through the URL with `~` instead of `/`.
const actorPath = (id: string) => id.replace("/", "~");

// ---------------------------------------------------------------------------
// Apify HTTP helper — start a run and wait for the dataset items.
// ---------------------------------------------------------------------------
async function apifyRun(
  actorId: string,
  input: unknown,
  timeoutMs = 30_000
): Promise<unknown[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN not configured");

  const startRes = await fetch(
    `https://api.apify.com/v2/acts/${actorPath(actorId)}/runs`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    }
  );
  if (!startRes.ok) {
    const txt = await startRes.text();
    throw new Error(`Apify run start failed (${startRes.status}): ${txt}`);
  }
  const startBody = (await startRes.json()) as {
    data: { id: string; defaultDatasetId: string };
  };
  const { id: runId, defaultDatasetId: datasetId } = startBody.data;

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const pollRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (pollRes.ok) {
      const body = (await pollRes.json()) as { data: { status: string } };
      const status = body.data.status;
      if (status === "SUCCEEDED") break;
      if (
        status === "FAILED" ||
        status === "ABORTED" ||
        status === "TIMED-OUT"
      ) {
        throw new Error(`Apify run ${runId} ${status}`);
      }
    }
    await new Promise((r) => setTimeout(r, 3000));
  }

  const itemsRes = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?format=json&clean=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!itemsRes.ok) throw new Error("Apify dataset fetch failed");
  const items = (await itemsRes.json()) as unknown[];
  return Array.isArray(items) ? items : [items];
}

// ---------------------------------------------------------------------------
// Main: lightweight IG preview via Apify
// ---------------------------------------------------------------------------

export async function getIgPreviewApify(handle: string): Promise<{
  data: IgPreview | null;
  error?: string;
}> {
  const cleanHandle = handle.replace(/^@/, "").trim().toLowerCase();
  if (!cleanHandle) return { data: null, error: "No handle provided" };

  try {
    const [profileResults, postsResults] = await Promise.all([
      apifyRun(ACTOR_PROFILE, { usernames: [cleanHandle] }, 25_000),
      apifyRun(
        ACTOR_POSTS,
        { username: [cleanHandle], resultsLimit: 10 },
        25_000
      ).catch(() => [] as unknown[]),
    ]);

    const profile = (profileResults[0] ?? {}) as Record<string, unknown>;
    const posts = postsResults as Record<string, unknown>[];

    const profileSnippet = JSON.stringify(
      {
        account: profile.username,
        followers: profile.followersCount,
        following: profile.followsCount ?? profile.followingCount,
        posts_count: profile.postsCount,
        biography: profile.biography,
        category:
          profile.businessCategoryName ??
          profile.categoryName ??
          profile.category,
        is_verified: profile.verified,
        avg_engagement: null, // not provided by Apify; LLM will infer from posts
        city: profile.city,
        country: profile.country,
      },
      null,
      2
    );

    const postsSnippet = posts
      .slice(0, 10)
      .map((p) =>
        JSON.stringify({
          type: p.type,
          caption:
            typeof p.caption === "string"
              ? (p.caption as string).slice(0, 200)
              : "",
          likes: p.likesCount,
          comments: p.commentsCount,
          hashtags: p.hashtags,
          mentions: p.taggedUsers,
          timestamp: p.timestamp,
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
    console.error("[ig-preview-apify] Error:", err);
    return {
      data: null,
      error:
        err instanceof Error ? err.message : "Failed to preview Instagram",
    };
  }
}
