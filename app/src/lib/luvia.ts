// Espejo en el frontend de supabase/functions/_shared/luvia.ts::luviaSiteState. El panel no comparte
// build con las Edge Functions, así que la lógica se replica. Si cambias las reglas allí, cámbialas
// aquí (y al revés). Deriva el estado del canal de mensajería actual del negocio de sus flags
// deterministas (0017 + 0022). Precedencia bot > whatsapp > chat > none; unknown si los tres son null.
import type { Lead } from "./types.ts";

export type LuviaSiteState = "automated" | "hot" | "chat" | "none" | "unknown";

export function luviaSiteState(
  lead: Pick<Lead, "site_has_whatsapp" | "site_has_chat" | "site_has_bot">,
): LuviaSiteState {
  const wa = lead.site_has_whatsapp ?? null;
  const chat = lead.site_has_chat ?? null;
  const bot = lead.site_has_bot ?? null;
  if (wa === null && chat === null && bot === null) return "unknown";
  if (bot === true) return "automated";
  if (wa === true) return "hot";
  if (chat === true) return "chat";
  return "none";
}
