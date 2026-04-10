/* ------------------------------------------------------------------ */
/*  Heterogeneous Model Router                                         */
/*  Routes tasks to the optimal Claude model based on complexity:      */
/*  - Haiku: summaries, classification, simple Q&A                    */
/*  - Sonnet: standard conversations, tool calling (default)          */
/*  - Opus: complex reasoning, multi-step planning, negotiation       */
/* ------------------------------------------------------------------ */

import type { TaskComplexity } from "./step-limiter";

export type ModelTier = "fast" | "balanced" | "powerful";

/** Model IDs for each tier — update when new models release */
export const MODEL_IDS: Record<ModelTier, string> = {
  fast: "claude-haiku-4-5-20251001",
  balanced: "claude-sonnet-4-20250514",
  powerful: "claude-opus-4-6",
};

/** The default model_name in agent_config. When this is set, it means the brand
 *  hasn't customized their model — allow the router to select by complexity. */
export const DEFAULT_MODEL_NAME = "claude-sonnet-4-20250514";

interface ModelSelection {
  modelId: string;
  tier: ModelTier;
  temperature: number;
  maxTokens: number;
}

const TIER_CONFIG: Record<ModelTier, Omit<ModelSelection, "modelId">> = {
  fast: {
    tier: "fast",
    temperature: 0.3,
    maxTokens: 2048,
  },
  balanced: {
    tier: "balanced",
    temperature: 0.7,
    maxTokens: 4096,
  },
  powerful: {
    tier: "powerful",
    temperature: 0.5,
    maxTokens: 8192,
  },
};

const COMPLEXITY_TO_TIER: Record<TaskComplexity, ModelTier> = {
  simple: "fast",
  standard: "balanced",
  complex: "powerful",
};

/**
 * Select the optimal model for a given task complexity.
 *
 * If `configModelOverride` is set (from agent_config.model_name),
 * it takes precedence — the brand explicitly chose a model.
 */
export function selectModel(
  complexity: TaskComplexity,
  configModelOverride?: string | null
): ModelSelection {
  const tier = COMPLEXITY_TO_TIER[complexity];
  const config = TIER_CONFIG[tier];

  if (configModelOverride) {
    return {
      modelId: configModelOverride,
      ...config,
    };
  }

  return {
    modelId: MODEL_IDS[tier],
    ...config,
  };
}
