import type { BurnRateBudget, ProviderModelState } from "./catalog.js";

export interface BurnRateUsage {
  inputTokens?: number;
  outputTokens?: number;
  requests?: number;
  spentUsd?: number;
  window?: "daily" | "monthly";
}

export interface BurnRateState {
  usage: Required<BurnRateUsage>;
  budget?: BurnRateBudget;
  estimatedSpendUsd: number;
  budgetStatus: {
    dailyUsdRemaining?: number;
    monthlyUsdRemaining?: number;
    dailyTokensRemaining?: number;
    monthlyTokensRemaining?: number;
    warnings: string[];
  };
  providers: Array<{
    provider: string;
    model: string;
    rateLimit?: ProviderModelState["rateLimit"];
    estimatedInputCostPerMTok?: number;
    estimatedOutputCostPerMTok?: number;
    estimatedRequestCostUsd: number;
    maxAffordableRequests?: number;
  }>;
}

export function buildBurnRateState(models: ProviderModelState[], budget: BurnRateBudget = {}, usage: BurnRateUsage = {}): BurnRateState {
  const fullUsage: Required<BurnRateUsage> = {
    inputTokens: usage.inputTokens ?? 0,
    outputTokens: usage.outputTokens ?? 0,
    requests: usage.requests ?? 0,
    spentUsd: usage.spentUsd ?? 0,
    window: usage.window ?? "daily",
  };

  const providers = models.map((m) => {
    const estimatedRequestCostUsd = estimateCostUsd(m, fullUsage.inputTokens, fullUsage.outputTokens);
    const remainingBudget = fullUsage.window === "monthly" ? budget.monthlyUsd : budget.dailyUsd;
    const alreadySpent = fullUsage.spentUsd;
    const remainingUsd = remainingBudget === undefined ? undefined : Math.max(0, remainingBudget - alreadySpent);
    return {
      provider: m.provider,
      model: m.model,
      rateLimit: m.rateLimit,
      estimatedInputCostPerMTok: m.inputCostPerMTok,
      estimatedOutputCostPerMTok: m.outputCostPerMTok,
      estimatedRequestCostUsd,
      maxAffordableRequests: remainingUsd === undefined || estimatedRequestCostUsd <= 0 ? undefined : Math.floor(remainingUsd / estimatedRequestCostUsd),
    };
  });

  const representative = providers[0];
  const estimatedSpendUsd = fullUsage.spentUsd + (representative?.estimatedRequestCostUsd ?? 0) * Math.max(1, fullUsage.requests);
  const totalTokens = fullUsage.inputTokens + fullUsage.outputTokens;
  const budgetStatus = {
    dailyUsdRemaining: budget.dailyUsd === undefined ? undefined : Math.max(0, budget.dailyUsd - estimatedSpendUsd),
    monthlyUsdRemaining: budget.monthlyUsd === undefined ? undefined : Math.max(0, budget.monthlyUsd - estimatedSpendUsd),
    dailyTokensRemaining: budget.dailyTokenLimit === undefined ? undefined : Math.max(0, budget.dailyTokenLimit - totalTokens),
    monthlyTokensRemaining: budget.monthlyTokenLimit === undefined ? undefined : Math.max(0, budget.monthlyTokenLimit - totalTokens),
    warnings: [] as string[],
  };

  if (budgetStatus.dailyUsdRemaining === 0) budgetStatus.warnings.push("daily USD budget exhausted");
  if (budgetStatus.monthlyUsdRemaining === 0) budgetStatus.warnings.push("monthly USD budget exhausted");
  if (budgetStatus.dailyTokensRemaining === 0) budgetStatus.warnings.push("daily token budget exhausted");
  if (budgetStatus.monthlyTokensRemaining === 0) budgetStatus.warnings.push("monthly token budget exhausted");

  return { usage: fullUsage, budget, estimatedSpendUsd, budgetStatus, providers };
}

function estimateCostUsd(model: ProviderModelState, inputTokens: number, outputTokens: number): number {
  const input = (model.inputCostPerMTok ?? 0) * inputTokens / 1_000_000;
  const output = (model.outputCostPerMTok ?? 0) * outputTokens / 1_000_000;
  return Number((input + output).toFixed(8));
}
