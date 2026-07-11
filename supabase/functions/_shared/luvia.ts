// ¿Este lead pertenece al producto Luvia (usuario de Miguel) y NO al admin (David)?
// Se deriva del dueño del lead:
//  - adminUserId vacío  -> nunca Luvia (comportamiento previo: todo es del admin).
//  - owner null         -> lead del cron/admin, no Luvia.
//  - owner != admin     -> Luvia.
export function isLuviaLead(
  owner: string | null | undefined,
  adminUserId: string | null | undefined,
): boolean {
  if (!adminUserId || !owner) return false;
  return owner !== adminUserId;
}

export type LuviaSiteState = "automated" | "hot" | "chat" | "none" | "unknown";

// Estado del canal de mensajería ACTUAL del negocio, derivado de los flags deterministas de su web
// (site_has_bot/whatsapp/chat, ver 0017 + 0022). Base del gancho del pitch de Luvia. Precedencia
// deliberada bot > whatsapp > chat > none: si ya tiene un bot, decirle "lo atiendes a mano" sería
// falso. unknown = los tres flags null (web sin analizar / no se pudo bajar).
// PURA. Se replica igual en app/src/lib/luvia.ts (no comparten build) — si cambias las reglas aquí,
// cámbialas allí.
export function luviaSiteState(lead: {
  site_has_whatsapp?: boolean | null;
  site_has_chat?: boolean | null;
  site_has_bot?: boolean | null;
}): LuviaSiteState {
  const wa = lead.site_has_whatsapp ?? null;
  const chat = lead.site_has_chat ?? null;
  const bot = lead.site_has_bot ?? null;
  if (wa === null && chat === null && bot === null) return "unknown";
  if (bot === true) return "automated";
  if (wa === true) return "hot";
  if (chat === true) return "chat";
  return "none";
}

// Payload del Email 1 de Luvia que se manda a Claude. Ancla el gancho en el ESTADO del canal actual
// (no en reseñas): fuera rating/review_count. vendors[] permite nombrar el bot cuando state="automated".
export function buildLuviaOutreachPayload(lead: {
  name: string | null;
  category?: string | null;
  city?: string | null;
  site_has_whatsapp?: boolean | null;
  site_has_chat?: boolean | null;
  site_has_bot?: boolean | null;
  website_url?: string | null;
  site_analysis?: { _widgets?: { vendors?: string[] } } | null;
  luvia_demo_url?: string | null;
}) {
  return {
    business: { name: lead.name, category: lead.category ?? null, city: lead.city ?? null },
    site: {
      state: luviaSiteState(lead),
      has_whatsapp: lead.site_has_whatsapp ?? null,
      has_chat: lead.site_has_chat ?? null,
      has_bot: lead.site_has_bot ?? null,
      vendors: lead.site_analysis?._widgets?.vendors ?? [],
      url: lead.website_url ?? null,
    },
    // Si hay demo montada, el gancho pasa a "ya te lo monté, pruébalo"; el sistema añade el link.
    demo_url: lead.luvia_demo_url ?? null,
  };
}

// Body final del Email 1 de Luvia: si hay demo, el sistema añade el link EN SU PROPIA LÍNEA al
// final (para que la plantilla lo renderice como botón); la IA nunca escribe la URL.
export function buildLuviaFinalBody(bodyText: string, demoUrl: string | null | undefined): string {
  const b = bodyText.trim();
  return demoUrl ? `${b}\n\n${demoUrl}` : b;
}
