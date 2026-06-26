/**
 * pi-route-extension — protocol-only entry point.
 *
 * Registers the route node on the protocol fabric so callers can
 * invoke provides (route_model, provider_snapshot, route_explain,
 * burn_rate_state) through the shared protocol gateway instead of
 * individual Pi tools.
 *
 * @kyvernitria/pi-protocol-minimal is an optional peer dep — if unavailable
 * the extension loads silently without protocol registration.
 */

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createRouteProtocolHandlers } from "./protocol/handlers.js";

const _require = createRequire(import.meta.url);

export default function piRouteExtension(pi: ExtensionAPI) {
  registerProtocolIfAvailable();
}

function registerProtocolIfAvailable(): void {
  let protocolMinimal: typeof import("@kyvernitria/pi-protocol-minimal");
  try {
    protocolMinimal = _require("@kyvernitria/pi-protocol-minimal");
  } catch {
    // @kyvernitria/pi-protocol-minimal not installed — skip protocol registration.
    return;
  }

  const manifest = JSON.parse(
    readFileSync(new URL("./pi.protocol.json", import.meta.url), "utf8"),
  );

  const fabric = protocolMinimal.ensureProtocolFabric();
  fabric.unregister("route");
  protocolMinimal.registerProtocolManifest(fabric, {
    manifest,
    handlers: createRouteProtocolHandlers(),
  });
}
