export interface NextLeadTimeoutOptions {
  startedAt: number;
  now?: number;
  budgetMs: number;
  guardMs: number;
  maxCallTimeoutMs: number;
  minCallTimeoutMs?: number;
  postFetchBufferMs?: number;
}

export function remainingBudgetMs(
  startedAt: number,
  budgetMs: number,
  guardMs: number,
  now: number = Date.now(),
): number {
  return Math.max(0, budgetMs - guardMs - Math.max(0, now - startedAt));
}

export function nextLeadTimeoutMs(opts: NextLeadTimeoutOptions): number | null {
  const minCallTimeoutMs = Math.max(1_000, opts.minCallTimeoutMs ?? 5_000);
  const postFetchBufferMs = Math.max(0, opts.postFetchBufferMs ?? 2_000);
  const remaining = remainingBudgetMs(opts.startedAt, opts.budgetMs, opts.guardMs, opts.now);
  const callBudget = remaining - postFetchBufferMs;
  if (callBudget < minCallTimeoutMs) return null;
  return Math.min(opts.maxCallTimeoutMs, callBudget);
}
