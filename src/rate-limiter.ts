export interface RateLimitState {
  requestsRemaining?: number;
  tokensRemaining?: number;
  resetAt?: string;
}

export function rateLimitSummary(state?: RateLimitState): string {
  if (!state) return "unknown";
  const parts = [];
  if (state.requestsRemaining !== undefined) parts.push(`${state.requestsRemaining} requests remaining`);
  if (state.tokensRemaining !== undefined) parts.push(`${state.tokensRemaining} tokens remaining`);
  if (state.resetAt) parts.push(`resets ${state.resetAt}`);
  return parts.length ? parts.join(", ") : "unknown";
}
