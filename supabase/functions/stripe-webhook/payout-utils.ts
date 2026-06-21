/** Saca los payment_intent (charges) de una respuesta de balance_transactions de Stripe. */
export function extractPaymentIntents(
  resp: { data?: Array<{ source?: { payment_intent?: string } | null } | null> },
): string[] {
  return (resp.data ?? [])
    .map((tx) => tx?.source?.payment_intent)
    .filter((pi): pi is string => typeof pi === "string" && pi.length > 0);
}
