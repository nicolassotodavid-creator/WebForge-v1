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

/** Tipo de la línea española de 9 dígitos: móvil (6/7), gratuita (800/900) o fija (resto de 8/9). */
export type PhoneKind = "movil" | "fijo" | "gratuito";

/**
 * Clasifica el teléfono del lead. Solo numeración española de 9 dígitos
 * (con o sin prefijo 34); cualquier otra cosa → null (desconocido).
 */
export function phoneKind(phone: string | null | undefined): PhoneKind | null {
  const d = (phone ?? "").replace(/\D/g, "");
  const local = d.startsWith("34") ? d.slice(2) : d;
  if (!/^\d{9}$/.test(local)) return null;
  if (/^[67]/.test(local)) return "movil";
  if (/^(80|90)/.test(local)) return "gratuito";
  if (/^[89]/.test(local)) return "fijo";
  return null;
}

/** Formatea un número de 9 dígitos como "+34 600 78 22 11" para pintarlo. */
export function formatPhone(digits: string | null | undefined): string | null {
  const d = (digits ?? "").replace(/\D/g, "");
  const local = d.startsWith("34") ? d.slice(2) : d;
  if (!/^\d{9}$/.test(local)) return d || null;
  return `+34 ${local.slice(0, 3)} ${local.slice(3, 5)} ${local.slice(5, 7)} ${local.slice(7)}`;
}

/**
 * Número de WhatsApp listo para pintar ("+34 670 05 29 58"), o null si el lead
 * no es contactable por WhatsApp. Misma fuente de verdad que `waNumber`.
 */
export function waDisplay(lead: ContactLead): string | null {
  const n = waNumber(lead);
  return n ? formatPhone(n) : null;
}

/** Enlace wa.me listo para usar; si se pasa `mensaje`, lo prerellena (?text=). Null si el lead no tiene WhatsApp. */
export function waLink(lead: ContactLead, mensaje?: string): string | null {
  const n = waNumber(lead);
  if (!n) return null;
  return mensaje
    ? `https://wa.me/${n}?text=${encodeURIComponent(mensaje)}`
    : `https://wa.me/${n}`;
}

/**
 * Texto de la plantilla de WhatsApp saliente (acción manual desde la ficha del lead):
 * saludo + enlace a la web (liveUrl) + enlace de activación (/book). `negocio` vacío/null
 * omite el nombre con gracia. Editable por el operador antes de enviar.
 */
export function whatsappOutreachText(
  negocio: string | null | undefined,
  liveUrl: string,
  bookUrl: string,
): string {
  const n = (negocio ?? "").trim();
  const saludo = n
    ? `Hola 👋 soy Nico. He preparado una web para ${n}, échale un vistazo:`
    : `Hola 👋 soy Nico. He preparado una web, échale un vistazo:`;
  return (
    `${saludo}\n${liveUrl}\n\n` +
    `Si te gusta, aquí la dejas activada en un momento:\n${bookUrl}\n\n` +
    `Un saludo.`
  );
}

// Texto de WhatsApp saliente manual para leads de Luvia: enlaza la demo ya montada, firma Nico.
export function whatsappLuviaText(
  negocio: string | null | undefined,
  demoUrl: string,
): string {
  const n = (negocio ?? "").trim();
  const saludo = n
    ? `Hola 👋 soy Nico, de Luvia. Le monté un asistente a ${n} con vuestros datos, pruébalo:`
    : `Hola 👋 soy Nico, de Luvia. Monté un asistente con vuestros datos, pruébalo:`;
  return (
    `${saludo}\n${demoUrl}\n\n` +
    `Háblale como si fueras un cliente pidiendo cita. Si te encaja, lo dejamos atendiendo tu WhatsApp 24/7.\n\n` +
    `Un saludo.`
  );
}
