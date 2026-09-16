// product.ts — ¿De qué producto es un mensaje saliente?
// En outreach_messages conviven la secuencia de webs (email_number 1/2/3, y 0 = WhatsApp manual)
// y los correos manuales del simulador (Home Estimator), que se guardan con email_number 101, 102…
// Ese rango no choca con el índice único (lead_id, email_number) ni lo cogen los crons de
// seguimiento de webs, que filtran por 1/2/3. Puro: node --experimental-strip-types src/lib/product.test.ts

export type Product = "webs" | "simulador";

/** Primer email_number del simulador: 101 = email 1, 102 = seguimiento. */
export const SIMULADOR_BASE = 100;

export function messageProduct(m: { email_number: number | null }): Product {
  return (m.email_number ?? 0) > SIMULADOR_BASE ? "simulador" : "webs";
}

/** Nombre corto del mensaje en su secuencia: "Email 2", "WhatsApp", "Simulador · Seguimiento". */
export function messageLabel(m: { channel: string; email_number: number | null }): string {
  if (m.channel === "whatsapp") return "WhatsApp";
  if (m.channel === "linkedin") return "LinkedIn";
  if (messageProduct(m) === "simulador") {
    const n = (m.email_number ?? 0) - SIMULADOR_BASE;
    return n === 1 ? "Simulador · Email 1" : `Simulador · Seguimiento${n > 2 ? ` ${n - 1}` : ""}`;
  }
  return `Email ${m.email_number ?? 1}`;
}
