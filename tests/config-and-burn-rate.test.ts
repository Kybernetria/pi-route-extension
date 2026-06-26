import { describe, expect, it } from "vitest";
import { buildBurnRateState } from "../src/burn-rate.js";
import { normalizeRouteConfig } from "../src/provider-registry.js";
import { routeModel } from "../src/router.js";

const providers = [
  {
    provider: "cheap",
    model: "cheap-medium",
    tier: "medium" as const,
    contextWindow: 100000,
    costClass: "payg" as const,
    inputCostPerMTok: 0.1,
    outputCostPerMTok: 0.2,
    latencyMs: 2500,
    reliability: 0.85,
    capabilities: ["text", "code"],
  },
  {
    provider: "fast",
    model: "fast-medium",
    tier: "medium" as const,
    contextWindow: 100000,
    costClass: "payg" as const,
    inputCostPerMTok: 3,
    outputCostPerMTok: 10,
    latencyMs: 200,
    reliability: 0.85,
    capabilities: ["text", "code"],
  },
];

describe("config validation", () => {
  it("normalizes invalid provider fields and emits warnings", () => {
    const { config, warnings } = normalizeRouteConfig({
      providers: [{ provider: " p ", model: " m ", tier: "huge", contextWindow: -1, reliability: 2, capabilities: "text" }],
      scoring: { cost: -1, latency: 2 },
    });

    expect(config.providers?.[0]).toMatchObject({ provider: "p", model: "m", tier: "medium", contextWindow: 8192, reliability: 1 });
    expect(config.scoring?.cost).toBeUndefined();
    expect(config.scoring?.latency).toBe(2);
    expect(warnings.length).toBeGreaterThan(0);
  });
});

describe("configurable scoring", () => {
  it("allows weights to favor latency over cost", () => {
    const normal = routeModel({ config: { providers }, profile: { kind: "code", costSensitivity: "high" } });
    const latencyFavored = routeModel({ config: { providers, scoring: { cost: 0, latency: 5 } }, profile: { kind: "code" } });

    expect(normal.selected?.provider).toBe("cheap");
    expect(latencyFavored.selected?.provider).toBe("fast");
  });
});

describe("burn rate", () => {
  it("estimates spend and budget remaining", () => {
    const state = buildBurnRateState(providers, { dailyUsd: 1 }, { inputTokens: 1_000_000, outputTokens: 1_000_000 });

    expect(state.providers[0].estimatedRequestCostUsd).toBeCloseTo(0.3);
    expect(state.budgetStatus.dailyUsdRemaining).toBeCloseTo(0.7);
  });
});
