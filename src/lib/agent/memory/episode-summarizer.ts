/* ------------------------------------------------------------------ */
/*  Episode Summarizer                                                 */
/*  Generates rich, meaningful episode summaries using Claude Haiku.    */
/*  Falls back to template-based summaries on failure.                 */
/* ------------------------------------------------------------------ */

import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

const SUMMARY_MODEL = "claude-haiku-4-5-20251001";
const MAX_RESPONSE_CHARS = 2000;
const MIN_INPUT_LENGTH = 20; // Don't waste LLM calls on trivial exchanges

/* ── Episode type classification ──────────────────────────────────── */

const CLASSIFICATION_RULES: Array<{
  pattern: RegExp;
  type: string;
}> = [
  // Priority order: most specific/actionable first
  { pattern: /\b(no that's|wrong|incorrect|actually i meant|not what|mistake|correct that)\b/i, type: "correction_received" },
  { pattern: /\b(prefer|always choose|never use|don't like|hate|love this|style|aesthetic)\b/i, type: "preference_learned" },
  { pattern: /\b(approve|accept|confirm|go ahead|looks good|send it)\b/i, type: "outreach_approved" },
  { pattern: /\b(reject|decline|don't send|cancel|remove)\b/i, type: "outreach_rejected" },
  { pattern: /\b(draft|outreach|email|write to|compose|message to)\b/i, type: "outreach_drafted" },
  // Rate/pricing before creator search — "worth it for this creator" is about pricing
  { pattern: /\b(rate|price|cost|budget|worth|benchmark|pay|rupee)\b|₹/i, type: "rate_benchmark" },
  { pattern: /\b(campaign|performance|roi|analytics|report|metric|track)\b/i, type: "campaign_advice" },
  { pattern: /\b(find|search|discover|recommend|lookup)\b.*\b(creators?|influencers?)\b|\b(creators?|influencers?)\b.*\b(find|search|discover)\b/i, type: "creator_search" },
];

/**
 * Classify the episode type from the user message.
 * Checks rules in priority order — corrections and preferences first.
 */
export function classifyEpisodeType(userMessage: string): string {
  const lower = userMessage.toLowerCase();
  for (const rule of CLASSIFICATION_RULES) {
    if (rule.pattern.test(lower)) {
      return rule.type;
    }
  }
  return "general_interaction";
}

/* ── Importance scoring by episode type ───────────────────────────── */

const IMPORTANCE_MAP: Record<string, number> = {
  correction_received: 0.9,
  preference_learned: 0.85,
  outreach_rejected: 0.8,
  outreach_approved: 0.7,
  outreach_drafted: 0.6,
  rate_benchmark: 0.6,
  campaign_advice: 0.55,
  creator_search: 0.5,
  recommendation_given: 0.5,
  question_answered: 0.4,
  general_interaction: 0.3,
};

/**
 * Compute importance score for an episode based on its type.
 * Higher importance = more likely to surface in future retrievals.
 */
export function computeImportance(episodeType: string): number {
  return IMPORTANCE_MAP[episodeType] ?? 0.3;
}

/* ── LLM-based episode summary generation ─────────────────────────── */

/**
 * Generate a rich, meaningful episode summary using Claude Haiku.
 * Falls back to template-based summary on failure or trivial input.
 */
export async function generateEpisodeSummary(
  userMessage: string,
  assistantResponse: string
): Promise<string> {
  // Don't waste LLM calls on trivial exchanges
  if (userMessage.length + assistantResponse.length < MIN_INPUT_LENGTH) {
    return buildTemplateSummary(userMessage, assistantResponse);
  }

  try {
    const truncatedResponse = assistantResponse.slice(0, MAX_RESPONSE_CHARS);

    const { text } = await generateText({
      model: anthropic(SUMMARY_MODEL),
      prompt: `Summarize this agent interaction in 2-3 concise sentences. Focus on:
- What was decided or recommended
- Any specific creator handles, campaign names, or numbers mentioned
- User preferences or corrections expressed

User: ${userMessage.slice(0, 500)}
Agent: ${truncatedResponse}

Summary:`,
      maxOutputTokens: 150,
      temperature: 0,
    });

    return text.trim() || buildTemplateSummary(userMessage, assistantResponse);
  } catch {
    return buildTemplateSummary(userMessage, assistantResponse);
  }
}

/**
 * Template-based fallback summary when LLM is unavailable.
 */
function buildTemplateSummary(
  userMessage: string,
  assistantResponse: string
): string {
  const episodeType = classifyEpisodeType(userMessage);
  const truncatedQuestion = userMessage.slice(0, 120).replace(/\n/g, " ");
  const responseLength = assistantResponse.length;

  const labels: Record<string, string> = {
    creator_search: "searched for creators",
    outreach_drafted: "drafted outreach",
    rate_benchmark: "discussed rates/pricing",
    campaign_advice: "discussed campaign performance",
    preference_learned: "expressed a preference",
    correction_received: "provided a correction",
    outreach_approved: "approved an outreach",
    outreach_rejected: "rejected an outreach",
    general_interaction: "had a conversation",
  };

  const label = labels[episodeType] || "interacted";
  const detail = responseLength > 200 ? "with detailed analysis" : "briefly";

  return `User ${label} ${detail}: "${truncatedQuestion}"`;
}
