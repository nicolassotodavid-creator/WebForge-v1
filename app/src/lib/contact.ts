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
