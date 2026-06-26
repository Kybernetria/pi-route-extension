import fs from "node:fs";
import path from "node:path";
import { DEFAULT_CATALOG, type CostClass, type ModelTier, type ProviderModelState, type ProviderStatus, type RouteConfig } from "./catalog.js";

export const CONFIG_FILE_NAME = "pi-route.json";

const TIERS = new Set<ModelTier>(["fast", "medium", "strong"]);
const COST_CLASSES = new Set<CostClass>(["free", "local", "subscription", "payg", "premium"]);
const STATUSES = new Set<ProviderStatus>(["available", "degraded", "blocked", "unavailable"]);

export interface NormalizedRouteConfig {
  config: RouteConfig;
  warnings: string[];
}

export function projectConfigPath(cwd: string, configDirName = ".pi"): string {
  return path.join(cwd, configDirName, CONFIG_FILE_NAME);
}

export function readRouteConfig(filePath: string): RouteConfig {
  return readRouteConfigWithWarnings(filePath).config;
}

export function readRouteConfigWithWarnings(filePath: string): NormalizedRouteConfig {
  if (!fs.existsSync(filePath)) return { config: {}, warnings: [] };
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return normalizeRouteConfig(parsed);
}

export function normalizeRouteConfig(input: unknown): NormalizedRouteConfig {
  const warnings: string[] = [];
  if (!isRecord(input)) return { config: {}, warnings: ["config must be an object"] };

  const config: RouteConfig = {};
  if (Array.isArray(input.providers)) {
    const providers: ProviderModelState[] = [];
    input.providers.forEach((value, index) => {
      const normalized = normalizeProviderModel(value, `providers[${index}]`, warnings);
      if (normalized) providers.push(normalized);
    });
    if (providers.length) config.providers = providers;
  } else if (input.providers !== undefined) {
    warnings.push("providers must be an array; ignored");
  }

  if (isRecord(input.policy)) {
    config.policy = {
      blockedProviders: stringArray(input.policy.blockedProviders, "policy.blockedProviders", warnings),
      blockedModels: stringArray(input.policy.blockedModels, "policy.blockedModels", warnings),
      preferProviders: stringArray(input.policy.preferProviders, "policy.preferProviders", warnings),
      maxInputCostPerMTok: optionalNonNegative(input.policy.maxInputCostPerMTok, "policy.maxInputCostPerMTok", warnings),
      requireLocal: typeof input.policy.requireLocal === "boolean" ? input.policy.requireLocal : undefined,
    };
  } else if (input.policy !== undefined) {
    warnings.push("policy must be an object; ignored");
  }

  if (isRecord(input.scoring)) {
    config.scoring = {
      suitability: optionalNonNegative(input.scoring.suitability, "scoring.suitability", warnings),
      cost: optionalNonNegative(input.scoring.cost, "scoring.cost", warnings),
      latency: optionalNonNegative(input.scoring.latency, "scoring.latency", warnings),
      health: optionalNonNegative(input.scoring.health, "scoring.health", warnings),
      policy: optionalNonNegative(input.scoring.policy, "scoring.policy", warnings),
      preferredProviderBonus: optionalNumber(input.scoring.preferredProviderBonus, "scoring.preferredProviderBonus", warnings),
    };
  } else if (input.scoring !== undefined) {
    warnings.push("scoring must be an object; ignored");
  }

  if (isRecord(input.burnRate)) {
    config.burnRate = {
      dailyUsd: optionalNonNegative(input.burnRate.dailyUsd, "burnRate.dailyUsd", warnings),
      monthlyUsd: optionalNonNegative(input.burnRate.monthlyUsd, "burnRate.monthlyUsd", warnings),
      dailyTokenLimit: optionalNonNegative(input.burnRate.dailyTokenLimit, "burnRate.dailyTokenLimit", warnings),
      monthlyTokenLimit: optionalNonNegative(input.burnRate.monthlyTokenLimit, "burnRate.monthlyTokenLimit", warnings),
    };
  } else if (input.burnRate !== undefined) {
    warnings.push("burnRate must be an object; ignored");
  }

  return { config, warnings };
}

export function mergeConfig(base: RouteConfig = {}, override: RouteConfig = {}): RouteConfig {
  const cleanBase = normalizeRouteConfig(base).config;
  const cleanOverride = normalizeRouteConfig(override).config;
  return {
    providers: cleanOverride.providers ?? cleanBase.providers,
    policy: { ...(cleanBase.policy ?? {}), ...(cleanOverride.policy ?? {}) },
    scoring: { ...(cleanBase.scoring ?? {}), ...(cleanOverride.scoring ?? {}) },
    burnRate: { ...(cleanBase.burnRate ?? {}), ...(cleanOverride.burnRate ?? {}) },
  };
}

export function getConfiguredModels(config: RouteConfig = {}): ProviderModelState[] {
  const normalized = normalizeRouteConfig(config).config;
  return normalized.providers?.length ? normalized.providers : DEFAULT_CATALOG;
}

export function normalizeModel(model: ProviderModelState): ProviderModelState {
  const normalized = normalizeProviderModel(model, "model", []);
  return {
    status: "available",
    reliability: 0.85,
    capabilities: ["text"],
    ...(normalized ?? model),
  };
}

function normalizeProviderModel(input: unknown, label: string, warnings: string[]): ProviderModelState | undefined {
  if (!isRecord(input)) {
    warnings.push(`${label} must be an object; ignored`);
    return undefined;
  }
  if (typeof input.provider !== "string" || input.provider.trim() === "") {
    warnings.push(`${label}.provider must be a non-empty string; ignored`);
    return undefined;
  }
  if (typeof input.model !== "string" || input.model.trim() === "") {
    warnings.push(`${label}.model must be a non-empty string; ignored`);
    return undefined;
  }
  const tier = TIERS.has(input.tier as ModelTier) ? input.tier as ModelTier : "medium";
  if (input.tier !== undefined && !TIERS.has(input.tier as ModelTier)) warnings.push(`${label}.tier invalid; defaulted to medium`);
  const costClass = COST_CLASSES.has(input.costClass as CostClass) ? input.costClass as CostClass : "payg";
  if (input.costClass !== undefined && !COST_CLASSES.has(input.costClass as CostClass)) warnings.push(`${label}.costClass invalid; defaulted to payg`);
  const status = input.status === undefined || STATUSES.has(input.status as ProviderStatus) ? input.status as ProviderStatus | undefined : "available";
  if (input.status !== undefined && !STATUSES.has(input.status as ProviderStatus)) warnings.push(`${label}.status invalid; defaulted to available`);

  return {
    provider: input.provider.trim(),
    model: input.model.trim(),
    tier,
    contextWindow: optionalPositive(input.contextWindow, `${label}.contextWindow`, warnings) ?? 8192,
    maxOutputTokens: optionalPositive(input.maxOutputTokens, `${label}.maxOutputTokens`, warnings),
    costClass,
    inputCostPerMTok: optionalNonNegative(input.inputCostPerMTok, `${label}.inputCostPerMTok`, warnings),
    outputCostPerMTok: optionalNonNegative(input.outputCostPerMTok, `${label}.outputCostPerMTok`, warnings),
    latencyMs: optionalNonNegative(input.latencyMs, `${label}.latencyMs`, warnings),
    reliability: clampOptional(input.reliability, 0, 1, `${label}.reliability`, warnings),
    local: typeof input.local === "boolean" ? input.local : undefined,
    capabilities: stringArray(input.capabilities, `${label}.capabilities`, warnings) ?? ["text"],
    status,
    blockedReason: typeof input.blockedReason === "string" ? input.blockedReason : undefined,
    rateLimit: isRecord(input.rateLimit) ? {
      requestsRemaining: optionalNonNegative(input.rateLimit.requestsRemaining, `${label}.rateLimit.requestsRemaining`, warnings),
      tokensRemaining: optionalNonNegative(input.rateLimit.tokensRemaining, `${label}.rateLimit.tokensRemaining`, warnings),
      resetAt: typeof input.rateLimit.resetAt === "string" ? input.rateLimit.resetAt : undefined,
    } : undefined,
    notes: typeof input.notes === "string" ? input.notes : undefined,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown, label: string, warnings: string[]): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    warnings.push(`${label} must be an array of strings; ignored`);
    return undefined;
  }
  return value.filter((item): item is string => typeof item === "string" && item.trim() !== "").map((item) => item.trim());
}

function optionalNumber(value: unknown, label: string, warnings: string[]): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    warnings.push(`${label} must be a finite number; ignored`);
    return undefined;
  }
  return value;
}

function optionalNonNegative(value: unknown, label: string, warnings: string[]): number | undefined {
  const number = optionalNumber(value, label, warnings);
  if (number === undefined) return undefined;
  if (number < 0) {
    warnings.push(`${label} must be non-negative; ignored`);
    return undefined;
  }
  return number;
}

function optionalPositive(value: unknown, label: string, warnings: string[]): number | undefined {
  const number = optionalNumber(value, label, warnings);
  if (number === undefined) return undefined;
  if (number <= 0) {
    warnings.push(`${label} must be positive; ignored`);
    return undefined;
  }
  return number;
}

function clampOptional(value: unknown, min: number, max: number, label: string, warnings: string[]): number | undefined {
  const number = optionalNumber(value, label, warnings);
  if (number === undefined) return undefined;
  if (number < min || number > max) warnings.push(`${label} clamped to ${min}..${max}`);
  return Math.max(min, Math.min(max, number));
}
