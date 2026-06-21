// supabase/functions/stripe-webhook/payout.test.ts
// Run: deno test supabase/functions/stripe-webhook/payout.test.ts
import { assertEquals } from "jsr:@std/assert@1";
import { extractPaymentIntents } from "./payout-utils.ts";

Deno.test("extractPaymentIntents saca los payment_intent de las balance transactions", () => {
  const resp = {
    data: [
      { source: { payment_intent: "pi_1" } },
      { source: { payment_intent: "pi_2" } },
      { source: {} },            // sin payment_intent → se ignora
      { source: null },          // sin source → se ignora
      {},                        // vacío → se ignora
    ],
  };
  assertEquals(extractPaymentIntents(resp), ["pi_1", "pi_2"]);
});

Deno.test("extractPaymentIntents tolera respuesta vacía", () => {
  assertEquals(extractPaymentIntents({}), []);
  assertEquals(extractPaymentIntents({ data: [] }), []);
});
