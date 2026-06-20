// Datos de contacto del OPERADOR (tú), centralizados en un solo sitio.
// Esto NO es el WhatsApp de los leads (eso vive en contact.ts) — es el tuyo,
// el que aparece en la página de venta /book para que el prospecto te escriba.

export const CONTACT_EMAIL = "hola@nico-soto.es";

// ── WhatsApp ─────────────────────────────────────────────────────────────────
// Dígitos en formato internacional, sin "+" ni espacios. Ej. España: "34600000000".
// Mientras esté vacío, el botón de WhatsApp simplemente NO se muestra (sin enlaces rotos).
// +34 600 78 22 11 (móvil personal de Nico) → activado 2026-06-26 mientras no haya
// WhatsApp Business. Para retirarlo, basta con volver a poner "".
export const WHATSAPP_NUMBER = "34600782211";

/**
 * Enlace wa.me al WhatsApp del negocio con mensaje pre-rellenado (opcional),
 * o `null` si aún no hay número configurado (entonces el botón no se pinta).
 */
export function whatsappLink(message?: string): string | null {
  const n = WHATSAPP_NUMBER.replace(/\D/g, "");
  if (n.length < 8) return null; // sin número válido → sin botón
  const q = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${n}${q}`;
}
