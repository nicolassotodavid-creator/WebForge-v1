// contactability.ts — Fuente única de verdad para "¿puedo contactar a este lead?".
// Un lead que respondió BAJA se marca do_not_contact=true (ver 0020) → no recibe NINGÚN
// email (1/2/3). Se usa como guardia en generate-outreach, send-email y cron-followups,
// para que la promesa de "responde BAJA y no vuelvo a escribir" se cumpla de verdad.
export function isOptedOut(lead: { do_not_contact?: boolean | null } | null | undefined): boolean {
  return lead?.do_not_contact === true;
}
