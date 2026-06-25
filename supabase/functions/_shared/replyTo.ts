// ¿A qué buzón deben volver las respuestas de un email en frío? Depende del dueño del lead:
//  - lead Luvia (owner != admin) -> buzón de Miguel.
//  - lead WebForge (admin / sin dueño) -> buzón de Nico.
// Si la dirección elegida está vacía, devuelve undefined y el llamador omite `reply_to`
// (degradación segura: el envío no se rompe por no tener reply-to configurado).
import { isLuviaLead } from "./luvia.ts";

// Defaults si no hay env. No son secretos (van solo en el servidor). Override con
// REPLY_TO_WEBFORGE / REPLY_TO_LUVIA sin tocar código (p. ej. apuntar WebForge a un Gmail).
// WebForge = mismo buzón que el remitente (FROM_EMAIL = hola@nico-soto.es): todo coherente.
export const DEFAULT_REPLY_TO_WEBFORGE = "hola@nico-soto.es";
export const DEFAULT_REPLY_TO_LUVIA = "marketing@luvia-ia.es";

export function replyToFor(
  owner: string | null | undefined,
  adminUserId: string | null | undefined,
  cfg: { webforge: string | null | undefined; luvia: string | null | undefined },
): string | undefined {
  const addr = isLuviaLead(owner, adminUserId) ? cfg.luvia : cfg.webforge;
  const trimmed = addr?.trim();
  return trimmed ? trimmed : undefined;
}
