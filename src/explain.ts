import type { RouteModelResult } from "./router.js";

export function explainRoute(result: RouteModelResult): string {
  if (!result.selected) return `${result.reason}${result.warnings.length ? ` Warnings: ${result.warnings.join("; ")}` : ""}`;
  const fallbacks = result.fallbackCandidates.map((c) => `${c.provider}/${c.model} (${c.score.toFixed(1)})`).join(", ");
  return [
    `Selected ${result.selected.provider}/${result.selected.model}.`,
    result.reason,
    fallbacks ? `Fallbacks: ${fallbacks}.` : "No fallback candidates available.",
    result.warnings.length ? `Warnings: ${result.warnings.slice(0, 4).join("; ")}.` : "",
  ].filter(Boolean).join(" ");
}
