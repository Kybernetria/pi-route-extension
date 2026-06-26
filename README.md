# pi-route-extension

A small Pi extension that answers: **which AI model/provider should I use right now?**

It exposes four Pi tools and matching pi-protocol provides:

- `route_model` — choose a model for a task profile.
- `provider_snapshot` — show routeable and blocked/unavailable models.
- `route_explain` — give a concise human-readable routing explanation.
- `burn_rate_state` — show simple cost/rate-limit capacity state.

## Install / load

Use directly while developing:

```bash
pi -e ./extension.ts
```

Or install/copy this folder into a Pi extension location. The package declares:

```json
{ "pi": { "extensions": ["./extension.ts"] } }
```

## Pi protocol

This package ships `pi.protocol.json` (`protocolVersion` `0.2.0`) and registers it from `extension.ts` with the shared protocol fabric. Existing Pi extension tools are unchanged; protocol callers can discover node `route` and invoke:

```json
{ "nodeId": "route", "provide": "route_model", "input": { "profile": { "kind": "code" } } }
```

Protocol inputs match the tool inputs. They may also include `cwd` (or `rootDir`) to choose the project directory used for `.pi/pi-route.json`; when omitted, protocol handlers use `process.cwd()`. For direct programmatic use, import `createRouteProtocolHandlers` from `pi-route-extension/protocol/handlers`.

## Configuration

Routing works without configuration by using a tiny generic fallback catalog. For real use, add project config at:

```text
.pi/pi-route.json
```

Example:

```json
{
  "providers": [
    {
      "provider": "ollama",
      "model": "qwen2.5-coder:14b",
      "tier": "medium",
      "contextWindow": 32768,
      "costClass": "local",
      "inputCostPerMTok": 0,
      "outputCostPerMTok": 0,
      "latencyMs": 900,
      "reliability": 0.86,
      "local": true,
      "capabilities": ["text", "code"]
    },
    {
      "provider": "openai",
      "model": "gpt-4.1",
      "tier": "strong",
      "contextWindow": 1000000,
      "costClass": "premium",
      "inputCostPerMTok": 2,
      "outputCostPerMTok": 8,
      "latencyMs": 2500,
      "reliability": 0.95,
      "capabilities": ["text", "code", "reasoning", "vision"]
    }
  ],
  "policy": {
    "blockedProviders": [],
    "blockedModels": [],
    "maxInputCostPerMTok": 5,
    "preferProviders": ["ollama"]
  },
  "scoring": {
    "suitability": 1,
    "cost": 1,
    "latency": 1,
    "health": 1,
    "policy": 1,
    "preferredProviderBonus": 8
  },
  "burnRate": {
    "dailyUsd": 10,
    "monthlyUsd": 100,
    "dailyTokenLimit": 2000000
  }
}
```

Tool input can also pass `config` directly; direct tool config overrides the project config. Config is normalized defensively: malformed providers are ignored, invalid enum values are defaulted, numeric ranges are clamped/ignored, and unknown/missing optional fields do not crash routing.

## Task profile

`route_model` accepts enum-validated profile fields:

- `kind`: `chat`, `code`, `debug`, `analysis`, `writing`, `vision`, `tool_use`, `other`
- `desiredStrength`: `fast`, `balanced`, `strong`
- `latencySensitivity` / `costSensitivity`: `low`, `medium`, `high`
- `localPreference`: `required`, `preferred`, `neutral`, `remote_preferred`

Example:

```json
{
  "profile": {
    "kind": "code",
    "expectedContextTokens": 20000,
    "desiredStrength": "balanced",
    "latencySensitivity": "medium",
    "costSensitivity": "high",
    "localPreference": "preferred",
    "requiredCapabilities": ["text", "code"]
  }
}
```

## Scoring

Each candidate receives a weighted score from:

- suitability: context fit, ideal tier, capabilities, local preference;
- cost: lower estimated token cost scores higher, especially when cost sensitivity is high;
- latency: lower latency scores higher, especially when latency sensitivity is high;
- health: reliability, degraded status, and exhausted rate limits;
- policy: blocked/preferred providers, blocked models, max cost, local-only rules.

The highest score is selected. The next few candidates are returned as fallbacks, and blocked/unavailable/policy-affected models appear in warnings and `provider_snapshot`.

You can tune score multipliers under `scoring`. For example, `{ "scoring": { "latency": 3, "cost": 0.5 } }` makes fast models much more attractive, while `{ "scoring": { "cost": 3 } }` strongly favors cheap/local models.

## Burn/rate state

`burn_rate_state` accepts optional usage input:

```json
{
  "usage": {
    "inputTokens": 100000,
    "outputTokens": 20000,
    "requests": 1,
    "spentUsd": 2.5,
    "window": "daily"
  }
}
```

It estimates per-model request cost from configured token prices, computes remaining daily/monthly USD/token budgets from `burnRate`, and reports budget exhaustion warnings. It still does not persist historical usage; callers should pass known usage for the current window.

## State

The extension has no hidden global mutable state. It reads `.pi/pi-route.json` on each tool call (only for trusted projects when Pi exposes trust state) and combines that with any config passed in the tool input.
