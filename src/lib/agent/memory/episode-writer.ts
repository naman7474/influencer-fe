import type { SupabaseClient } from "@supabase/supabase-js";
import { generateEmbedding } from "./embeddings";

type EpisodeType =
  | "outreach_drafted"
  | "outreach_approved"
  | "outreach_rejected"
  | "creator_search"
  | "recommendation_given"
  | "question_answered"
  | "preference_learned"
  | "correction_received"
  | "campaign_advice"
  | "rate_benchmark"
  | "general_interaction";

interface WriteEpisodeParams {
  brandId: string;
  type: string;
  summary: string;
  details?: Record<string, unknown>;
  creatorId?: string;
  campaignId?: string;
  outcome?: "positive" | "negative" | "neutral";
  importance?: number;
  conversationMsgId?: string;
  supabase: SupabaseClient;
}

export async function writeEpisode(params: WriteEpisodeParams) {
  const {
    brandId,
    type,
    summary,
    details,
    creatorId,
    campaignId,
    outcome,
    importance,
    conversationMsgId,
    supabase,
  } = params;

  // Generate embedding for vector search (non-blocking — null on failure)
  const embedding = await generateEmbedding(summary);

  await supabase.from("agent_episodes").insert({
    brand_id: brandId,
    episode_type: type as EpisodeType,
    summary,
    details: details || {},
    creator_id: creatorId || null,
    campaign_id: campaignId || null,
    outcome: outcome || "neutral",
    importance: importance ?? 0.5,
    conversation_msg_id: conversationMsgId || null,
    embedding: embedding,
  });
}
