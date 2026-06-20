import type { Lead } from "./types";

type ContactLead = Pick<Lead, "whatsapp" | "phone">;

/**
 * Número de WhatsApp del lead (dígitos, formato internacional sin +):
 * 1) WhatsApp explícito si existe (normaliza móvil/fijo español de 9 díg con prefijo 34);
 * 2) si no, el teléfono cuando es MÓVIL español (empieza por 6 ó 7);
 * 3) fijos (9xx) → null (no se asume que tengan WhatsApp).
 */
export function waNumber(lead: ContactLead): string | null {
  const explicit = (lead.whatsapp ?? "").replace(/\D/g, "");
  if (explicit.length >= 7) {
    return explicit.length === 9 && /^[679]/.test(explicit) ? `34${explicit}` : explicit;
  }
  const d = (lead.phone ?? "").replace(/\D/g, "");
  const local = d.startsWith("34") ? d.slice(2) : d;
  if (/^[67]\d{8}$/.test(local)) return `34${local}`;
  return null;
}

/** Enlace wa.me listo para usar, o null si el lead no tiene WhatsApp. */
export function waLink(lead: ContactLead): string | null {
  const n = waNumber(lead);
  return n ? `https://wa.me/${n}` : null;
}
