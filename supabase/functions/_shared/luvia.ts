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

export type LuviaReview = { stars: number | null; text: string; date: string | null };

// Reseñas que hablan de lo que Luvia resuelve (contactar, responder, pedir cita, esperar): van
// primero porque son el gancho más directo, sean buenas ("siempre contestan rápido") o malas.
const CONTACT_RE =
  /tel[eé]fono|whats|contest|respond|respuesta|llam|cita|agenda|esper|mensaj|horario|recepci|coger|cogen|localizar|atienden|atendi/i;

// Hasta `max` reseñas reales (raw_json.reviews, formato compass) para que Claude ancle el email
// en lo que dicen sus pacientes. Sin el nombre del autor (dato personal que no hace falta).
export function pickLuviaReviews(rawJson: unknown, max = 8): LuviaReview[] {
  const reviews = (rawJson && typeof rawJson === "object")
    ? (rawJson as Record<string, unknown>).reviews
    : null;
  if (!Array.isArray(reviews)) return [];
  const rows = reviews
    .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
    .map((r) => {
      const text = typeof r.text === "string" ? r.text.replace(/<br\s*\/?>/gi, " ").replace(/\s+/g, " ").trim() : "";
      const stars = Number(r.stars ?? r.rating);
      const date = typeof r.publishedAtDate === "string" ? r.publishedAtDate.slice(0, 10) : null;
      return { stars: Number.isFinite(stars) ? stars : null, text, date };
    })
    .filter((r) => r.text.length >= 25);
  const contact = rows.filter((r) => CONTACT_RE.test(r.text));
  const rest = rows.filter((r) => !CONTACT_RE.test(r.text));
  return [...contact, ...rest]
    .slice(0, max)
    .map((r) => ({ ...r, text: r.text.length > 400 ? `${r.text.slice(0, 400)}…` : r.text }));
}

// Payload del Email 1 de Luvia que se manda a Claude: el ESTADO del canal actual (base del
// gancho) + sus reseñas reales (volumen de pacientes y lo que dicen de la atención).
// vendors[] permite nombrar el bot cuando state="automated".
export function buildLuviaOutreachPayload(lead: {
  name: string | null;
  category?: string | null;
  city?: string | null;
  rating?: number | string | null;
  review_count?: number | null;
  raw_json?: unknown;
  site_has_whatsapp?: boolean | null;
  site_has_chat?: boolean | null;
  site_has_bot?: boolean | null;
  website_url?: string | null;
  site_analysis?: { _widgets?: { vendors?: string[] } } | null;
}) {
  const rating = lead.rating == null ? null : Number(lead.rating);
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
    reviews: {
      rating: Number.isFinite(rating) ? rating : null,
      count: lead.review_count ?? null,
      samples: pickLuviaReviews(lead.raw_json),
    },
  };
}

// Firma fija de los emails de Luvia (la pone el sistema, no la IA).
export const LUVIA_SIGNATURE = "Nico\nLuvia — atención al cliente con IA";

// Body final del Email 1 de Luvia. La IA escribe solo los párrafos; el sistema añade, cada uno en
// su párrafo, el botón del WhatsApp de ventas (con el nombre de la clínica ya escrito), el enlace
// para hablarle por voz en la web y la firma. Si la IA firmó igualmente, se quita su firma.
export function buildLuviaFinalBody(
  bodyText: string,
  opts: { whatsappUrl: string; webUrl: string },
): string {
  const lines = bodyText.trim().split("\n");
  while (lines.length && /^\s*(nico\b.*|luvia\s*[—–-].*|un saludo,?|saludos,?|)\s*$/i.test(lines[lines.length - 1])) {
    lines.pop();
  }
  const body = lines.join("\n").trim();
  return [
    body,
    `Escríbele por WhatsApp: ${opts.whatsappUrl}`,
    `Háblale por voz: ${opts.webUrl}`,
    LUVIA_SIGNATURE,
  ].join("\n\n");
}

// Nombre corto de la clínica para el primer mensaje de WhatsApp: el que propone la IA si es
// razonable; si no, el de Maps sin coletillas SEO ("… | Clínica Belice" → "Clínica Belice").
export function luviaShortName(aiName: unknown, mapsName: string | null | undefined): string {
  const ai = typeof aiName === "string" ? aiName.replace(/\s+/g, " ").trim() : "";
  if (ai && ai.length <= 40 && !/[<>{}\n]/.test(ai)) return ai;
  const raw = String(mapsName ?? "").replace(/\s+/g, " ").trim();
  const parts = raw.split(/\s*\|\s*|\s+[-–—]\s+/).map((p) => p.trim()).filter(Boolean);
  const branded = parts.find((p) => /^cl[ií]nica\b/i.test(p) && p.length <= 40);
  const shortest = parts.slice().sort((a, b) => a.length - b.length)[0] ?? raw;
  return (branded ?? shortest).split(",")[0].trim().slice(0, 40);
}

// Citas: todo lo que la IA ponga entre comillas tiene que estar LITERAL en alguna reseña.
export function luviaQuoteIssues(body: string, samples: LuviaReview[]): string[] {
  const norm = (s: string) => s.toLocaleLowerCase("es").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const corpus = samples.map((s) => norm(s.text));
  const issues: string[] = [];
  for (const m of body.matchAll(/["“«]([^"”»]{4,})["”»]/g)) {
    const q = norm(m[1]);
    if (!corpus.some((c) => c.includes(q))) issues.push(`cita no literal: "${m[1]}"`);
  }
  return issues;
}
