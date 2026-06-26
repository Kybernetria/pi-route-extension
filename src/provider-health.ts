import type { ProviderModelState } from "./catalog.js";

export function providerHealthWarning(model: ProviderModelState): string | undefined {
  if (model.status === "blocked") return model.blockedReason ?? "provider/model is blocked";
  if (model.status === "unavailable") return "provider/model is unavailable";
  if (model.status === "degraded") return "provider/model is degraded";
  if (model.rateLimit?.requestsRemaining === 0) return "request rate limit exhausted";
  if (model.rateLimit?.tokensRemaining === 0) return "token rate limit exhausted";
  return undefined;
}

export function isRouteableByHealth(model: ProviderModelState): boolean {
  return model.status !== "blocked" && model.status !== "unavailable" && model.rateLimit?.requestsRemaining !== 0 && model.rateLimit?.tokensRemaining !== 0;
}
