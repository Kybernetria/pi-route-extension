/**
 * pi-route-extension — protocol-only entry point.
 *
 * Registers the route node on the protocol fabric so callers can
 * invoke provides (route_model, provider_snapshot, route_explain,
 * burn_rate_state) through the shared protocol gateway instead of
 * individual Pi tools.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { ensureProtocolFabric, registerProtocolManifest, type PiProtocolManifest } from "@kyvernitria/pi-protocol-minimal";
import { readFileSync } from "node:fs";
import { createRouteProtocolHandlers } from "./protocol/handlers.js";

const manifest = JSON.parse(readFileSync(new URL("./pi.protocol.json", import.meta.url), "utf8")) as PiProtocolManifest;

export default function piRouteExtension(pi: ExtensionAPI) {
  const fabric = ensureProtocolFabric();
  fabric.unregister(manifest.nodeId);
  registerProtocolManifest(fabric, {
    manifest,
    handlers: createRouteProtocolHandlers(),
  });
}
