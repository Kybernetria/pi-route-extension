export type ModelTier = "fast" | "medium" | "strong";
export type CostClass = "free" | "local" | "subscription" | "payg" | "premium";
export type ProviderStatus = "available" | "degraded" | "blocked" | "unavailable";

export interface ScoringWeights {
  suitability?: number;
  cost?: number;
  latency?: number;
  health?: number;
  policy?: number;
  preferredProviderBonus?: number;
}

export interface BurnRateBudget {
  dailyUsd?: number;
  monthlyUsd?: number;
  dailyTokenLimit?: number;
  monthlyTokenLimit?: number;
}

export interface ProviderModelState {
  provider: string;
  model: string;
  tier: ModelTier;
  contextWindow: number;
  maxOutputTokens?: number;
  costClass: CostClass;
  /** USD per 1M input tokens. Unknown costs are treated as moderate. */
  inputCostPerMTok?: number;
  /** USD per 1M output tokens. Unknown costs are treated as moderate. */
  outputCostPerMTok?: number;
  /** Typical first-token or end-to-end latency class in milliseconds. */
  latencyMs?: number;
  /** 0..1 observed or expected reliability. */
  reliability?: number;
  local?: boolean;
  capabilities?: string[];
  status?: ProviderStatus;
  blockedReason?: string;
  rateLimit?: {
    requestsRemaining?: number;
    tokensRemaining?: number;
    resetAt?: string;
  };
  notes?: string;
}

export interface RouteConfig {
  providers?: ProviderModelState[];
  policy?: {
    blockedProviders?: string[];
    blockedModels?: string[];
    maxInputCostPerMTok?: number;
    requireLocal?: boolean;
    preferProviders?: string[];
  };
  scoring?: ScoringWeights;
  burnRate?: BurnRateBudget;
}

export const DEFAULT_SCORING_WEIGHTS: Required<ScoringWeights> = {
  suitability: 1,
  cost: 1,
  latency: 1,
  health: 1,
  policy: 1,
  preferredProviderBonus: 8,
};

export const DEFAULT_CATALOG: ProviderModelState[] = [
  {
    provider: "local",
    model: "local-small",
    tier: "fast",
    contextWindow: 8192,
    costClass: "local",
    inputCostPerMTok: 0,
    outputCostPerMTok: 0,
    latencyMs: 600,
    reliability: 0.82,
    local: true,
    capabilities: ["text", "code"],
    notes: "Generic local fallback; replace with your real local model in .pi/pi-route.json.",
  },
  {
    provider: "generic",
    model: "balanced-medium",
    tier: "medium",
    contextWindow: 128000,
    costClass: "payg",
    inputCostPerMTok: 1.5,
    outputCostPerMTok: 6,
    latencyMs: 1800,
    reliability: 0.9,
    capabilities: ["text", "code", "reasoning"],
  },
  {
    provider: "generic",
    model: "reasoning-strong",
    tier: "strong",
    contextWindow: 200000,
    costClass: "premium",
    inputCostPerMTok: 5,
    outputCostPerMTok: 15,
    latencyMs: 4500,
    reliability: 0.94,
    capabilities: ["text", "code", "reasoning", "analysis"],
  },
];
