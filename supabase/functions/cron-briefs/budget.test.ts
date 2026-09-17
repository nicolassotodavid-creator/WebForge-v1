// node --experimental-strip-types supabase/functions/cron-briefs/budget.test.ts
import { nextLeadTimeoutMs, remainingBudgetMs } from "./budget.ts";

let failures = 0;
function assertEq(actual: unknown, expected: unknown, msg: string) {
  const ok = actual === expected;
  console.log(`${ok ? "✓" : "✗"} ${msg}  (got ${actual}, want ${expected})`);
  if (!ok) failures++;
}

assertEq(
  remainingBudgetMs(1_000, 120_000, 5_000, 31_000),
  85_000,
  "resta el tiempo transcurrido y el guard rail global",
);

assertEq(
  nextLeadTimeoutMs({
    startedAt: 1_000,
    now: 10_000,
    budgetMs: 120_000,
    guardMs: 5_000,
    maxCallTimeoutMs: 25_000,
  }),
  25_000,
  "capa el timeout de Claude al máximo configurado cuando sobra tiempo",
);

assertEq(
  nextLeadTimeoutMs({
    startedAt: 1_000,
    now: 106_000,
    budgetMs: 120_000,
    guardMs: 5_000,
    maxCallTimeoutMs: 25_000,
  }),
  8_000,
  "usa el presupuesto restante del lote cuando queda poco margen",
);

assertEq(
  nextLeadTimeoutMs({
    startedAt: 1_000,
    now: 114_000,
    budgetMs: 120_000,
    guardMs: 5_000,
    maxCallTimeoutMs: 25_000,
  }),
  null,
  "no arranca otro lead si ya no queda tiempo suficiente para terminarlo",
);

console.log(failures === 0 ? "\nOK" : `\n${failures} FALLO(S)`);
if (failures) throw new Error(`${failures} FALLO(S)`);
