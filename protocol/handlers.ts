/**
 * Protocol handlers for pi-route-extension.
 *
 * Uses lazy dynamic imports for implementation modules so the extension loads
 * without error even when node_modules are not installed.
 */

type ProtocolHandler = (input: unknown) => unknown | Promise<unknown>;

const CONFIG_DIR_NAME = ".pi";
import type { RouteConfig } from "../src/catalog.js";
import type { RoutingTaskProfile } from "../src/suitability.js";

export function createRouteProtocolHandlers(): Record<string, ProtocolHandler> {
  return {
    route_model: async (input) => {
      const { routeModel } = await import("../src/router.js");
      const { mergeConfig, normalizeRouteConfig, projectConfigPath, readRouteConfigWithWarnings } = await import("../src/provider-registry.js");
      const params = parseRoutingInput(input, "route_model input");
      const loaded = loadProtocolConfig(params.cwd, params.config, projectConfigPath, readRouteConfigWithWarnings, mergeConfig, normalizeRouteConfig);
      const result = routeModel({ profile: params.profile, config: loaded.config });
      result.warnings.push(...loaded.warnings);
      return result;
    },
    provider_snapshot: async (input) => {
      const { buildProviderStateSnapshot } = await import("../src/state-registry.js");
      const { mergeConfig, normalizeRouteConfig, projectConfigPath, readRouteConfigWithWarnings } = await import("../src/provider-registry.js");
      const params = parseConfigInput(input, "provider_snapshot input");
      const loaded = loadProtocolConfig(params.cwd, params.config, projectConfigPath, readRouteConfigWithWarnings, mergeConfig, normalizeRouteConfig);
      const snapshot = buildProviderStateSnapshot(loaded.config);
      return { ...snapshot, configWarnings: loaded.warnings };
    },
    route_explain: async (input) => {
      const { routeModel } = await import("../src/router.js");
      const { explainRoute } = await import("../src/explain.js");
      const { mergeConfig, normalizeRouteConfig, projectConfigPath, readRouteConfigWithWarnings } = await import("../src/provider-registry.js");
      const params = parseRoutingInput(input, "route_explain input");
      const loaded = loadProtocolConfig(params.cwd, params.config, projectConfigPath, readRouteConfigWithWarnings, mergeConfig, normalizeRouteConfig);
      const result = routeModel({ profile: params.profile, config: loaded.config });
      result.warnings.push(...loaded.warnings);
      return { text: explainRoute(result), details: result };
    },
    burn_rate_state: async (input) => {
      const { buildBurnRateState } = await import("../src/burn-rate.js");
      const { buildProviderStateSnapshot } = await import("../src/state-registry.js");
      const { mergeConfig, normalizeRouteConfig, projectConfigPath, readRouteConfigWithWarnings } = await import("../src/provider-registry.js");
      const params = parseBurnRateInput(input);
      const loaded = loadProtocolConfig(params.cwd, params.config, projectConfigPath, readRouteConfigWithWarnings, mergeConfig, normalizeRouteConfig);
      const snapshot = buildProviderStateSnapshot(loaded.config);
      const state = buildBurnRateState([...snapshot.routeableModels, ...snapshot.blockedModels], loaded.config.burnRate, params.usage);
      return { ...state, configWarnings: loaded.warnings };
    },
  };
}

interface ConfigInput {
  cwd?: string;
  config?: RouteConfig;
}

interface RoutingInput extends ConfigInput {
  profile?: RoutingTaskProfile;
}

interface BurnRateInput extends ConfigInput {
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    requests?: number;
    spentUsd?: number;
    window?: "daily" | "monthly";
  };
}

function loadProtocolConfig(
  cwd: string | undefined,
  override: RouteConfig | undefined,
  projectConfigPath: (cwd: string, configDir: string) => string,
  readRouteConfigWithWarnings: (path: string) => { config: RouteConfig; warnings: string[] },
  mergeConfig: (a: RouteConfig, b: RouteConfig) => RouteConfig,
  normalizeRouteConfig: (c: RouteConfig) => { config: RouteConfig; warnings: string[] },
): { config: RouteConfig; warnings: string[] } {
  const root = cwd ?? process.cwd();
  let fileConfig: RouteConfig = {};
  const warnings: string[] = [];
  try {
    const loaded = readRouteConfigWithWarnings(projectConfigPath(root, CONFIG_DIR_NAME));
    fileConfig = loaded.config;
    warnings.push(...loaded.warnings.map((warning) => `file config: ${warning}`));
  } catch (error) {
    warnings.push(`file config could not be read: ${error instanceof Error ? error.message : String(error)}`);
  }

  const normalizedOverride = normalizeRouteConfig(override ?? {});
  warnings.push(...normalizedOverride.warnings.map((warning) => `input config: ${warning}`));
  return { config: mergeConfig(fileConfig, normalizedOverride.config), warnings };
}

function parseConfigInput(input: unknown, name: string): ConfigInput {
  const value = optionalRecord(input, name);
  return {
    cwd: optionalString(value.cwd, "cwd") ?? optionalString(value.rootDir, "rootDir"),
    config: optionalConfig(value.config),
  };
}

function parseRoutingInput(input: unknown, name: string): RoutingInput {
  const value = optionalRecord(input, name);
  return {
    ...parseConfigInput(value, name),
    profile: optionalProfile(value.profile),
  };
}

function parseBurnRateInput(input: unknown): BurnRateInput {
  const value = optionalRecord(input, "burn_rate_state input");
  return {
    ...parseConfigInput(value, "burn_rate_state input"),
    usage: optionalUsage(value.usage),
  };
}

function optionalConfig(input: unknown): RouteConfig | undefined {
  if (input === undefined) return undefined;
  requiredRecord(input, "config");
  return input as RouteConfig;
}

function optionalProfile(input: unknown): RoutingTaskProfile | undefined {
  if (input === undefined) return undefined;
  const value = requiredRecord(input, "profile");
  return {
    kind: optionalEnum(value.kind, "profile.kind", ["chat", "code", "debug", "analysis", "writing", "vision", "tool_use", "other"]),
    expectedContextTokens: optionalNonNegativeNumber(value.expectedContextTokens, "profile.expectedContextTokens"),
    desiredStrength: optionalEnum(value.desiredStrength, "profile.desiredStrength", ["fast", "balanced", "strong"]),
    latencySensitivity: optionalEnum(value.latencySensitivity, "profile.latencySensitivity", ["low", "medium", "high"]),
    costSensitivity: optionalEnum(value.costSensitivity, "profile.costSensitivity", ["low", "medium", "high"]),
    localPreference: optionalEnum(value.localPreference, "profile.localPreference", ["required", "preferred", "neutral", "remote_preferred"]),
    requiredCapabilities: optionalStringArray(value.requiredCapabilities, "profile.requiredCapabilities"),
  };
}

function optionalUsage(input: unknown): BurnRateInput["usage"] {
  if (input === undefined) return undefined;
  const value = requiredRecord(input, "usage");
  return {
    inputTokens: optionalNonNegativeNumber(value.inputTokens, "usage.inputTokens"),
    outputTokens: optionalNonNegativeNumber(value.outputTokens, "usage.outputTokens"),
    requests: optionalNonNegativeNumber(value.requests, "usage.requests"),
    spentUsd: optionalNonNegativeNumber(value.spentUsd, "usage.spentUsd"),
    window: optionalEnum(value.window, "usage.window", ["daily", "monthly"]),
  };
}

function optionalRecord(input: unknown, name: string): Record<string, unknown> {
  if (input === undefined || input === null) return {};
  return requiredRecord(input, name);
}

function requiredRecord(input: unknown, name: string): Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) throw new Error(`${name} must be an object.`);
  return input as Record<string, unknown>;
}

function optionalString(input: unknown, name: string): string | undefined {
  if (input === undefined) return undefined;
  if (typeof input !== "string" || !input.trim()) throw new Error(`${name} must be a non-empty string.`);
  return input;
}

function optionalNonNegativeNumber(input: unknown, name: string): number | undefined {
  if (input === undefined) return undefined;
  if (typeof input !== "number" || !Number.isFinite(input) || input < 0) throw new Error(`${name} must be a non-negative finite number.`);
  return input;
}

function optionalStringArray(input: unknown, name: string): string[] | undefined {
  if (input === undefined) return undefined;
  if (!Array.isArray(input) || input.some((item) => typeof item !== "string")) throw new Error(`${name} must be an array of strings.`);
  return input;
}

function optionalEnum<T extends string>(input: unknown, name: string, allowed: readonly T[]): T | undefined {
  if (input === undefined) return undefined;
  if (typeof input !== "string" || !allowed.includes(input as T)) throw new Error(`${name} must be one of: ${allowed.join(", ")}.`);
  return input as T;
}
