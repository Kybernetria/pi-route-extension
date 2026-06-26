import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ensureProtocolFabric, registerProtocolManifest, type PiProtocolManifest } from "@kyvernitria/pi-protocol-minimal";
import { createRouteProtocolHandlers } from "../protocol/handlers.js";

const manifest = JSON.parse(readFileSync(new URL("../pi.protocol.json", import.meta.url), "utf8")) as PiProtocolManifest;

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

describe("pi-protocol compatibility", () => {
  it("declares the expected route provides", () => {
    expect(manifest.protocolVersion).toBe("0.2.0");
    expect(manifest.provides.map((provide) => provide.name).sort()).toEqual([
      "burn_rate_state",
      "provider_snapshot",
      "route_explain",
      "route_model",
    ]);
    expect(manifest.provides.every((provide) => provide.inputSchema && provide.outputSchema && provide.execution.type === "handler")).toBe(true);
  });

  it("registers with the fabric and invokes route_model", async () => {
    const fabric = ensureProtocolFabric();
    fabric.unregister(manifest.nodeId);
    registerProtocolManifest(fabric, { manifest, handlers: createRouteProtocolHandlers() });

    expect(fabric.describeProvide("route", "route_model")?.execution).toEqual({ type: "handler", handler: "route_model" });

    const result = await fabric.invoke({
      nodeId: "route",
      provide: "route_model",
      input: { config, profile: { kind: "analysis", expectedContextTokens: 50000, desiredStrength: "strong" } },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.output as any).selected).toEqual({ provider: "remote", model: "strong-remote" });
    }
  });

  it("validates handler input before routing", async () => {
    const handlers = createRouteProtocolHandlers();
    await expect(handlers.route_model({ profile: { kind: "not-a-kind" } })).rejects.toThrow(/profile.kind/);
  });
});
