import type { ModelTier, ProviderModelState } from "./catalog.js";

export type TaskKind = "chat" | "code" | "debug" | "analysis" | "writing" | "vision" | "tool_use" | "other";
export type DesiredStrength = "fast" | "balanced" | "strong";
export type Sensitivity = "low" | "medium" | "high";
export type LocalPreference = "required" | "preferred" | "neutral" | "remote_preferred";

export interface RoutingTaskProfile {
  kind?: TaskKind;
  expectedContextTokens?: number;
  desiredStrength?: DesiredStrength;
  latencySensitivity?: Sensitivity;
  costSensitivity?: Sensitivity;
  localPreference?: LocalPreference;
  requiredCapabilities?: string[];
}

export function idealTierForTask(profile: RoutingTaskProfile): ModelTier {
  if (profile.desiredStrength === "strong") return "strong";
  if (profile.desiredStrength === "fast") return "fast";
  if (profile.kind === "analysis" || profile.kind === "debug") return "strong";
  if (profile.kind === "code" || profile.kind === "tool_use") return "medium";
  return "medium";
}

export function tierRank(tier: ModelTier): number {
  return tier === "fast" ? 1 : tier === "medium" ? 2 : 3;
}

export function scoreSuitability(model: ProviderModelState, profile: RoutingTaskProfile): { score: number; reasons: string[]; warnings: string[] } {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let score = 0;

  const expectedContext = profile.expectedContextTokens ?? 4000;
  if (model.contextWindow >= expectedContext) {
    score += 25;
    reasons.push(`fits expected context (${expectedContext} tokens)`);
  } else {
    score -= 60;
    warnings.push(`context window ${model.contextWindow} is below expected ${expectedContext}`);
  }

  const ideal = idealTierForTask(profile);
  const diff = Math.abs(tierRank(model.tier) - tierRank(ideal));
  score += diff === 0 ? 22 : diff === 1 ? 10 : -8;
  reasons.push(diff === 0 ? `matches ${ideal} tier` : `${model.tier} tier is ${diff} step(s) from ideal ${ideal}`);

  const required = profile.requiredCapabilities ?? defaultCapabilities(profile.kind);
  const caps = new Set(model.capabilities ?? ["text"]);
  const missing = required.filter((cap) => !caps.has(cap));
  if (missing.length === 0) {
    score += 15;
    if (required.length) reasons.push(`has required capabilities: ${required.join(", ")}`);
  } else {
    score -= 40;
    warnings.push(`missing capabilities: ${missing.join(", ")}`);
  }

  if (profile.localPreference === "required" && !model.local) {
    score -= 100;
    warnings.push("local model required");
  } else if (profile.localPreference === "preferred" && model.local) {
    score += 12;
    reasons.push("local model preferred");
  } else if (profile.localPreference === "remote_preferred" && !model.local) {
    score += 6;
  }

  return { score, reasons, warnings };
}

function defaultCapabilities(kind?: TaskKind): string[] {
  if (kind === "code" || kind === "debug") return ["text", "code"];
  if (kind === "analysis") return ["text", "reasoning"];
  if (kind === "vision") return ["vision"];
  return ["text"];
}
