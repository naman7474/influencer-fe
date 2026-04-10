import type { AgentConfig } from "@/lib/types/database";
import type { KnowledgeItem } from "./memory/knowledge-reader";
import { formatKnowledgeForPrompt } from "./memory/knowledge-reader";
import { formatAutonomyForPrompt } from "./autonomy";

interface BuildSystemPromptParams {
  soulMd: string;
  brandMd: string;
  pageContext: string;
  pageData?: Record<string, unknown> | null;
  memories: Array<{
    summary: string;
    episode_type: string;
    created_at: string;
  }>;
  autonomyLevel: string;
  /** Phase 5: semantic knowledge items */
  knowledge?: KnowledgeItem[];
  /** Phase 5: full agent config for per-action autonomy */
  agentConfig?: AgentConfig | null;
}

export function buildSystemPrompt(params: BuildSystemPromptParams): string {
  const {
    soulMd,
    brandMd,
    pageContext,
    pageData,
    memories,
    autonomyLevel,
    knowledge,
    agentConfig,
  } = params;

  let prompt = `You are an AI marketing assistant on the Influencer Intelligence Platform. You help brand managers discover creators, draft outreach, analyze campaigns, and make data-driven decisions.

${soulMd}

## Brand Context
${brandMd}

## Current Page
The user is currently viewing: ${pageContext}`;

  if (pageData && Object.keys(pageData).length > 0) {
    prompt += `\nRelevant page data:\n${JSON.stringify(pageData, null, 2)}`;
  }

  prompt += `

## Important Rules
1. Always show key metrics when discussing creators: followers, engagement rate, CPI score, niche, tier
2. When drafting outreach, explain your personalization choices
3. Currency is INR (₹) unless the brand profile specifies otherwise
4. Never fabricate data — only report what the tools return
5. If a search returns no results, suggest adjusting filters rather than making up creators
6. For any action that affects external systems (sending emails, creating codes), always use propose_outreach to create an approval request first
7. Be concise in chat. Use bullet points and tables for data-heavy responses
8. When the user asks about something on their current page, use that context to inform your answer
9. Today's date is ${new Date().toISOString().split("T")[0]}
10. For negotiations, always show market rate context and justify your recommendation
11. When content is submitted, check compliance if enabled
12. When a campaign ends, proactively suggest generating a report`;

  // Episodic memories
  if (memories.length > 0) {
    prompt += `\n\n## Relevant Past Interactions`;
    for (const mem of memories) {
      const date = new Date(mem.created_at).toLocaleDateString();
      prompt += `\n- [${mem.episode_type}, ${date}] ${mem.summary}`;
    }
  }

  // Phase 5: Semantic knowledge
  if (knowledge && knowledge.length > 0) {
    const knowledgeSection = formatKnowledgeForPrompt(knowledge);
    if (knowledgeSection) {
      prompt += `\n\n${knowledgeSection}`;
    }
  }

  // Phase 5: Per-action autonomy (preferred over global level)
  if (agentConfig?.action_autonomy) {
    prompt += `\n\n${formatAutonomyForPrompt(agentConfig)}`;
  } else {
    // Fallback to global autonomy level
    if (autonomyLevel === "suggest_only") {
      prompt += `\n\n## Autonomy Level: SUGGEST ONLY
All actions that affect external systems require human approval. Draft emails and create proposals, but never send directly.`;
    } else if (autonomyLevel === "draft_and_propose") {
      prompt += `\n\n## Autonomy Level: DRAFT & PROPOSE
You can draft outreach and save it, but sending requires approval. Always use propose_outreach for anything that contacts a creator.`;
    } else if (autonomyLevel === "auto_with_guardrails") {
      prompt += `\n\n## Autonomy Level: AUTO WITH GUARDRAILS
Low-risk actions (search, recommendations, draft saving) can proceed automatically. Medium and high-risk actions (sending emails, committing budget) still require approval.`;
    }
  }

  return prompt;
}
