import type { RouteConfig } from "./catalog.js";
import type { RoutingTaskProfile } from "./suitability.js";
import { candidateFromModel, type RoutingCandidate } from "./scoring.js";
import { buildProviderStateSnapshot } from "./state-registry.js";

export interface RouteModelInput {
  profile?: RoutingTaskProfile;
  config?: RouteConfig;
}

export interface RouteModelResult {
  selected: { provider: string; model: string } | null;
  reason: string;
  candidates: RoutingCandidate[];
  fallbackCandidates: RoutingCandidate[];
  warnings: string[];
}

export function routeModel(input: RouteModelInput = {}): RouteModelResult {
  const profile = input.profile ?? {};
  const config = input.config ?? {};
  const snapshot = buildProviderStateSnapshot(config);
  const candidates = snapshot.routeableModels
    .map((model) => candidateFromModel(model, profile, config))
    .sort((a, b) => b.score - a.score || `${a.provider}/${a.model}`.localeCompare(`${b.provider}/${b.model}`));

  const warnings = [
    ...snapshot.blockedModels.map((m) => `${m.provider}/${m.model}: ${m.reason}`),
    ...candidates.flatMap((c) => c.breakdown.warnings.map((w) => `${c.provider}/${c.model}: ${w}`)),
  ];

  const best = candidates[0];
  if (!best) {
    return {
      selected: null,
      reason: "No routeable model is available for this task/profile.",
      candidates: [],
      fallbackCandidates: [],
      warnings: warnings.length ? warnings : ["No providers configured. Add providers to .pi/pi-route.json or pass config.providers."],
    };
  }

  return {
    selected: { provider: best.provider, model: best.model },
    reason: `${best.provider}/${best.model} scored highest (${best.score.toFixed(1)}): ${best.breakdown.reasons.slice(0, 3).join("; ")}`,
    candidates,
    fallbackCandidates: candidates.slice(1, 4),
    warnings,
  };
}
