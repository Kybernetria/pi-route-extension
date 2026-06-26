import { describe, expect, it } from "vitest";
import { routeModel } from "../src/router.js";
import { buildProviderStateSnapshot } from "../src/state-registry.js";

const config = {
  providers: [
    {
      provider: "local",
      model: "fast-local",
      tier: "fast" as const,
      contextWindow: 8192,
      costClass: "local" as const,
      inputCostPerMTok: 0,
      outputCostPerMTok: 0,
      latencyMs: 500,
      reliability: 0.8,
      local: true,
      capabilities: ["text", "code"],
    },
    {
      provider: "remote",
      model: "strong-remote",
      tier: "strong" as const,
      contextWindow: 200000,
      costClass: "premium" as const,
      inputCostPerMTok: 5,
      outputCostPerMTok: 15,
      latencyMs: 3000,
      reliability: 0.95,
      capabilities: ["text", "code", "reasoning"],
    },
  ],
};

describe("routeModel", () => {
  it("chooses a strong model for analysis with large context", () => {
    const result = routeModel({
      config,
      profile: { kind: "analysis", expectedContextTokens: 50000, desiredStrength: "strong" },
    });

    expect(result.selected).toEqual({ provider: "remote", model: "strong-remote" });
    expect(result.fallbackCandidates.length).toBeGreaterThan(0);
  });

  it("honors local required preference", () => {
    const result = routeModel({
      config,
      profile: { kind: "code", localPreference: "required", costSensitivity: "high" },
    });

    expect(result.selected).toEqual({ provider: "local", model: "fast-local" });
  });

  it("reports blocked models in snapshots", () => {
    const snapshot = buildProviderStateSnapshot({
      ...config,
      policy: { blockedProviders: ["remote"] },
    });

    expect(snapshot.routeableModels).toHaveLength(1);
    expect(snapshot.blockedModels[0].provider).toBe("remote");
  });
});
