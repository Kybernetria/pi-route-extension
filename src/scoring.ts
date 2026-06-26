import { DEFAULT_SCORING_WEIGHTS, type ProviderModelState, type RouteConfig } from "./catalog.js";
import type { RoutingTaskProfile } from "./suitability.js";
import { scoreSuitability } from "./suitability.js";

export interface RouteScoreBreakdown {
  suitability: number;
  cost: number;
  latency: number;
  health: number;
  policy: number;
  total: number;
  reasons: string[];
  warnings: string[];
}

export interface RoutingCandidate {
  provider: string;
  model: string;
  score: number;
  breakdown: RouteScoreBreakdown;
}

export function scoreModel(model: ProviderModelState, profile: RoutingTaskProfile, config: RouteConfig = {}): RouteScoreBreakdown {
  const suitability = scoreSuitability(model, profile);
  const warnings = [...suitability.warnings];
  const reasons = [...suitability.reasons];

  const weights = { ...DEFAULT_SCORING_WEIGHTS, ...(config.scoring ?? {}) };

  const avgCost = ((model.inputCostPerMTok ?? 2) + (model.outputCostPerMTok ?? 8)) / 2;
  const costWeight = profile.costSensitivity === "high" ? 2.2 : profile.costSensitivity === "low" ? 0.6 : 1;
  const cost = Math.max(-35, 18 - avgCost * costWeight * 2.5);
  if (avgCost <= 1) reasons.push("low cost");
  if (config.policy?.maxInputCostPerMTok !== undefined && (model.inputCostPerMTok ?? 0) > config.policy.maxInputCostPerMTok) warnings.push("above max input cost policy");

  const latencyMs = model.latencyMs ?? 2500;
  const latencyWeight = profile.latencySensitivity === "high" ? 1.6 : profile.latencySensitivity === "low" ? 0.5 : 1;
  const latency = Math.max(-25, 16 - (latencyMs / 1000) * 4 * latencyWeight);
  if (latencyMs <= 1000) reasons.push("low latency");

  const reliability = model.reliability ?? 0.85;
  let health = (reliability - 0.75) * 60;
  if (model.status === "degraded") {
    health -= 10;
    warnings.push("provider is degraded");
  }
  if (model.rateLimit?.requestsRemaining === 0 || model.rateLimit?.tokensRemaining === 0) {
    health -= 80;
    warnings.push("rate limit exhausted");
  }

  let policy = 0;
  if (config.policy?.preferProviders?.includes(model.provider)) {
    policy += weights.preferredProviderBonus;
    reasons.push("preferred provider policy");
  }
  if (config.policy?.blockedProviders?.includes(model.provider)) {
    policy -= 100;
    warnings.push("blocked provider policy");
  }
  if (config.policy?.blockedModels?.includes(model.model)) {
    policy -= 100;
    warnings.push("blocked model policy");
  }
  if (config.policy?.requireLocal && !model.local) {
    policy -= 100;
    warnings.push("policy requires local model");
  }

  const total = suitability.score * weights.suitability + cost * weights.cost + latency * weights.latency + health * weights.health + policy * weights.policy;
  return { suitability: suitability.score, cost, latency, health, policy, total, reasons, warnings };
}

export function candidateFromModel(model: ProviderModelState, profile: RoutingTaskProfile, config: RouteConfig = {}): RoutingCandidate {
  const breakdown = scoreModel(model, profile, config);
  return { provider: model.provider, model: model.model, score: breakdown.total, breakdown };
}
