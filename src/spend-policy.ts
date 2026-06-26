import type { ProviderModelState, RouteConfig } from "./catalog.js";

export function violatesSpendPolicy(model: ProviderModelState, config: RouteConfig): string | undefined {
  const max = config.policy?.maxInputCostPerMTok;
  if (max !== undefined && (model.inputCostPerMTok ?? 0) > max) {
    return `input cost ${(model.inputCostPerMTok ?? 0).toFixed(2)}/M exceeds policy max ${max}/M`;
  }
  return undefined;
}
