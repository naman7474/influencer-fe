import { streamText, stepCountIs } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentConfig } from "@/lib/types/database";
import type { ModelMessage } from "ai";
import { buildSystemPrompt } from "./system-prompt";
import { DEFAULT_SOUL_MD } from "./soul-md";
import { buildToolset } from "./skills/registry";
import { writeEpisode } from "./memory/episode-writer";
import { retrieveKnowledge } from "./memory/knowledge-reader";

// Import category index files to trigger skill registration
import "./skills/discovery";
import "./skills/negotiation";
import "./skills/campaign";
import "./skills/outreach";
import "./skills/tracking";
import "./skills/relationship";

interface AgentRuntimeParams {
  brandId: string;
  messages: ModelMessage[];
  pageContext: string;
  pageData?: Record<string, unknown>;
  agentConfig: AgentConfig;
  supabase: SupabaseClient;
}

export async function runAgent(params: AgentRuntimeParams) {
  const { brandId, messages, pageContext, pageData, agentConfig, supabase } =
    params;

  // 1. Retrieve relevant episodic memories
  const memories = await retrieveMemories(brandId, messages, supabase);

  // 1b. Retrieve relevant semantic knowledge (Phase 5)
  const lastUserContent = getLastUserContent(messages);
  const knowledge = await retrieveKnowledge(
    brandId,
    lastUserContent,
    supabase
  );

  // 2. Build the system prompt
  const systemPrompt = buildSystemPrompt({
    soulMd: agentConfig.soul_md || DEFAULT_SOUL_MD,
    brandMd: agentConfig.brand_md || "",
    pageContext,
    pageData: pageData || null,
    memories,
    autonomyLevel: agentConfig.autonomy_level,
    knowledge,
    agentConfig,
  });

  // 3. Build tool set from skill registry (permission-filtered + custom skills)
  const tools = await buildToolset(brandId, supabase, agentConfig);

  // 4. Stream response with tool calling
  const result = streamText({
    model: anthropic(agentConfig.model_name || "claude-sonnet-4-20250514"),
    system: systemPrompt,
    messages,
    tools,
    stopWhen: stepCountIs(5),
    temperature: Number(agentConfig.temperature) || 0.7,
    maxOutputTokens: agentConfig.max_tokens || 4096,
    onFinish: async ({ text, usage }) => {
      // 5. Persist assistant message
      await supabase.from("agent_conversations").insert({
        brand_id: brandId,
        role: "assistant",
        content: text || "",
        page_context: pageContext,
        token_count: usage?.totalTokens ?? null,
        model_used: agentConfig.model_name,
      } as never);

      // 6. Write episodic memory for significant interactions
      if (text && text.length > 50) {
        await maybeWriteEpisode(brandId, messages, text, supabase);
      }

      // 7. Increment daily counter
      await supabase
        .from("agent_config")
        .update({ messages_today: (agentConfig.messages_today || 0) + 1 } as never)
        .eq("brand_id", brandId);
    },
  });

  return result;
}

async function retrieveMemories(
  brandId: string,
  messages: ModelMessage[],
  supabase: SupabaseClient
): Promise<Array<{ summary: string; episode_type: string; created_at: string }>> {
  // Get the latest user message for context
  const lastUserMsg = [...messages]
    .reverse()
    .find((m) => m.role === "user");
  if (!lastUserMsg) return [];

  const content =
    typeof lastUserMsg.content === "string"
      ? lastUserMsg.content
      : "";

  if (!content) return [];

  // Use keyword-based search (always available, no embedding needed)
  const keywords = content
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 3)
    .join(" ");

  if (!keywords) {
    // Fall back to recent episodes
    const { data } = await supabase
      .from("agent_episodes")
      .select("summary, episode_type, created_at")
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false })
      .limit(3);
    return (data || []) as Array<{ summary: string; episode_type: string; created_at: string }>;
  }

  const { data } = await supabase.rpc("fn_search_agent_episodes_keyword", {
    p_brand_id: brandId,
    p_query: keywords,
    p_limit: 5,
  });

  return (data || []) as Array<{ summary: string; episode_type: string; created_at: string }>;
}

async function maybeWriteEpisode(
  brandId: string,
  messages: ModelMessage[],
  assistantText: string,
  supabase: SupabaseClient
) {
  const lastUserMsg = [...messages]
    .reverse()
    .find((m) => m.role === "user");
  if (!lastUserMsg) return;

  const userContent =
    typeof lastUserMsg.content === "string" ? lastUserMsg.content : "";

  // Determine episode type from user message keywords
  const lower = userContent.toLowerCase();
  let episodeType = "general_interaction";

  if (/find|search|discover|recommend|creator/i.test(lower)) {
    episodeType = "creator_search";
  } else if (/draft|outreach|email|write|compose/i.test(lower)) {
    episodeType = "outreach_drafted";
  } else if (/rate|price|cost|budget|worth|benchmark/i.test(lower)) {
    episodeType = "rate_benchmark";
  } else if (/campaign|performance|roi|analytics/i.test(lower)) {
    episodeType = "campaign_advice";
  }

  const summary = `User asked: "${userContent.substring(0, 100)}". Agent responded with ${assistantText.length > 200 ? "detailed" : "brief"} guidance.`;

  await writeEpisode({
    brandId,
    type: episodeType,
    summary,
    supabase,
  });
}

function getLastUserContent(messages: ModelMessage[]): string {
  const lastUserMsg = [...messages]
    .reverse()
    .find((m) => m.role === "user");
  if (!lastUserMsg) return "";
  return typeof lastUserMsg.content === "string" ? lastUserMsg.content : "";
}
