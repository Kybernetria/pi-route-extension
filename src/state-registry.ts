import type { ProviderModelState, RouteConfig } from "./catalog.js";
import { getConfiguredModels, normalizeModel } from "./provider-registry.js";
import { isRouteableByHealth, providerHealthWarning } from "./provider-health.js";
import { violatesSpendPolicy } from "./spend-policy.js";

export interface ProviderSnapshot {
  routeableModels: ProviderModelState[];
  blockedModels: Array<ProviderModelState & { reason: string }>;
  policy: RouteConfig["policy"];
  savedAt: string;
}

export function buildProviderStateSnapshot(config: RouteConfig = {}): ProviderSnapshot {
  const routeableModels: ProviderModelState[] = [];
  const blockedModels: Array<ProviderModelState & { reason: string }> = [];

  for (const raw of getConfiguredModels(config).map(normalizeModel)) {
    const healthReason = providerHealthWarning(raw);
    const spendReason = violatesSpendPolicy(raw, config);
    const policyReason = config.policy?.blockedProviders?.includes(raw.provider)
      ? "blocked provider policy"
      : config.policy?.blockedModels?.includes(raw.model)
        ? "blocked model policy"
        : config.policy?.requireLocal && !raw.local
          ? "policy requires local model"
          : undefined;
    const reason = healthReason ?? spendReason ?? policyReason;
    if (reason || !isRouteableByHealth(raw)) blockedModels.push({ ...raw, reason: reason ?? "not routeable" });
    else routeableModels.push(raw);
  }

  return { routeableModels, blockedModels, policy: config.policy, savedAt: new Date().toISOString() };
}

export function getAvailableModels(config: RouteConfig = {}): ProviderModelState[] {
  return buildProviderStateSnapshot(config).routeableModels;
}

export function getKnownModelById(provider: string, model: string, config: RouteConfig = {}): ProviderModelState | undefined {
  return getConfiguredModels(config).map(normalizeModel).find((m) => m.provider === provider && m.model === model);
}
