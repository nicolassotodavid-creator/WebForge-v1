// app/src/lib/payments.test.ts
// Sin framework: node --experimental-strip-types src/lib/payments.test.ts (desde app/)
import {
  deriveBankState,
  computeKpis,
  formatEuros,
  holdedInvoiceUrl,
  type Booking,
} from "./payments.ts";

let failures = 0;
function assertEq(actual: unknown, expected: unknown, msg: string) {
  const ok = actual === expected;
  console.log(`${ok ? "✓" : "✗"} ${msg}  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`);
  if (!ok) failures++;
}

const base: Booking = {
  id: "x", lead_id: "l", name: null, deposit_amount: 39700,
  status: "paid", stripe_payment_status: "paid",
  stripe_payout_id: null, payout_arrival_date: null,
  bank_confirmed_at: null, holded_invoice_id: null,
  created_at: "2026-06-10T10:00:00.000Z", leads: null,
};

// deriveBankState
assertEq(deriveBankState({ ...base, status: "started" }), "pending", "started → pending");
assertEq(deriveBankState({ ...base }), "with_stripe", "paid sin payout → with_stripe");
assertEq(deriveBankState({ ...base, stripe_payout_id: "po_1" }), "in_transit", "con payout → in_transit");
assertEq(deriveBankState({ ...base, stripe_payout_id: "po_1", bank_confirmed_at: "2026-06-20T00:00:00Z" }), "confirmed", "confirmado → confirmed");

// computeKpis (now = junio 2026)
const now = new Date("2026-06-21T12:00:00.000Z");
const set: Booking[] = [
  { ...base, id: "a", deposit_amount: 39700, created_at: "2026-06-05T00:00:00Z" }, // paid, mes actual, sin confirmar
  { ...base, id: "b", deposit_amount: 39700, stripe_payout_id: "po", bank_confirmed_at: "2026-06-20T00:00:00Z", created_at: "2026-06-18T00:00:00Z" }, // confirmado, mes actual
  { ...base, id: "c", deposit_amount: 39700, created_at: "2026-05-30T00:00:00Z" }, // paid pero mes anterior
  { ...base, id: "d", status: "started", deposit_amount: 39700, created_at: "2026-06-19T00:00:00Z" }, // no pagado
];
const k = computeKpis(set, now);
assertEq(k.cobradoMes, 79400, "cobradoMes = a+b (mes actual, paid)");
assertEq(k.pendienteBanco, 79400, "pendienteBanco = a+c (paid sin confirmar)");
assertEq(k.confirmadoBanco, 39700, "confirmadoBanco = b");
assertEq(k.total, 119100, "total = a+b+c (todos los paid)");

// formato y url
assertEq(formatEuros(39700).replace(/ /g, " "), "397,00 €", "formatEuros 39700");
assertEq(holdedInvoiceUrl("inv_9"), "https://app.holded.com/doc/invoice/inv_9", "holded url");

console.log(failures === 0 ? "\nTODO OK" : `\n${failures} FALLO(S)`);
if (failures > 0) process.exit(1);