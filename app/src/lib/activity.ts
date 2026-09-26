// activity.ts — Traduce los `events` de un lead a actividad legible para el panel: envíos,
// aperturas (pixel de track-event), clics en los enlaces (track-click), visitas a /book, intención
// de WhatsApp, rebotes, bajas y pagos. Marca lo que NO hizo el prospecto (escáneres del correo,
// vistas previas, aperturas a <1 min del envío, Nico con sesión del panel) para poder ocultarlo.
// Puro: node --experimental-strip-types src/lib/activity.test.ts

export interface LeadEvent {
  id: string;
  lead_id: string | null;
  type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface ActivityMessage {
  id: string;
  channel: string;
  email_number: number | null;
  sent_at: string | null;
  opened_at?: string | null;
}

export type ActivityKind = "sent" | "open" | "click" | "visit" | "intent" | "paid" | "problem";

export interface ActivityItem {
  id: string;
  at: string;
  kind: ActivityKind;
  label: string;
  detail: string | null;
  /** true = no lo hizo el prospecto (escáner, vista previa, prueba o el operador). */
  automatic: boolean;
}

// Una apertura o un clic a menos de esto del envío no es una persona leyendo.
const AUTO_WINDOW_S = 60;

const TARGET_LABEL: Record<string, string> = {
  web: "«Ver la web»",
  book: "«Ver la propuesta»",
  wa: "«Escríbeme por WhatsApp»",
};

// Tipos que no son actividad del prospecto de webs (auditorías del simulador, contabilidad, etc.).
const HIDDEN_TYPES = new Set([
  "home_estimator_audit",
  "luvia_restage",
  "holded_draft_created",
  "holded_error",
  "payout_error",
]);

function str(v: unknown): string | null {
  return typeof v === "string" && v ? v : null;
}

function tooSoon(sentAt: string | null | undefined, at: string): boolean {
  if (!sentAt) return false;
  return (new Date(at).getTime() - new Date(sentAt).getTime()) / 1000 < AUTO_WINDOW_S;
}

function messageName(m: ActivityMessage | undefined): string | null {
  if (!m) return null;
  return m.channel === "whatsapp" ? "el WhatsApp" : `el Email ${m.email_number ?? 1}`;
}

export function describeEvent(e: LeadEvent, messages: ActivityMessage[]): ActivityItem | null {
  if (HIDDEN_TYPES.has(e.type)) return null;
  const p = e.payload ?? {};
  const msg = messages.find((m) => m.id === str(p.message_id));
  const base = { id: e.id, at: e.created_at };
  const operator = p.operator === true;

  switch (e.type) {
    case "email_sent": {
      const n = typeof p.email_number === "number" ? p.email_number : msg?.email_number ?? null;
      return { ...base, kind: "sent", label: n ? `Email ${n} enviado` : "Email enviado", detail: str(p.to), automatic: false };
    }
    case "email_opened": {
      const auto = p.too_soon === true || tooSoon(msg?.sent_at, e.created_at);
      return {
        ...base,
        kind: "open",
        label: `Abrió ${messageName(msg) ?? "un email"}`,
        detail: auto ? "a menos de 1 min del envío: escáner del correo o prueba" : null,
        automatic: auto,
      };
    }
    case "link_clicked": {
      const target = TARGET_LABEL[str(p.target) ?? ""] ?? "un enlace";
      const from = messageName(msg) ?? (p.channel === "whatsapp" ? "el WhatsApp" : null);
      const auto = p.automatic === true || tooSoon(msg?.sent_at, e.created_at);
      return {
        ...base,
        kind: "click",
        label: `Pulsó ${target}${from ? ` en ${from}` : ""}`,
        detail: auto ? "clic automático (vista previa, escáner o prueba)" : null,
        automatic: auto,
      };
    }
    case "replied":
      return { ...base, kind: "intent", label: "Respondió", detail: [str(p.subject), str(p.snippet)].filter(Boolean).join(" — ") || str(p.channel), automatic: false };
    case "demo_viewed":
      return { ...base, kind: "visit", label: "Abrió la propuesta (/book)", detail: operator ? "tú, con sesión del panel" : null, automatic: operator };
    case "booking_started":
      return { ...base, kind: "intent", label: "Pulsó WhatsApp en la propuesta", detail: operator ? "tú, con sesión del panel" : null, automatic: operator };
    case "book_link_clicked": {
      const t = { web: "Ver la web", whatsapp_dudas: "WhatsApp (dudas)", email: "el email" }[str(p.target) ?? ""] ?? "un enlace";
      return { ...base, kind: "intent", label: `Pulsó ${t} en la propuesta`, detail: operator ? "tú (este dispositivo es del panel)" : null, automatic: operator };
    }
    case "checkout_started":
      return { ...base, kind: "intent", label: "Abrió el pago con tarjeta", detail: null, automatic: false };
    case "booking_paid":
      return { ...base, kind: "paid", label: "Pagó la reserva", detail: null, automatic: false };
    case "luvia_handoff":
      return { ...base, kind: "paid", label: "Pasado a Luvia como cliente", detail: null, automatic: false };
    case "email_bounced":
      return { ...base, kind: "problem", label: "El email rebotó", detail: str(p.email), automatic: false };
    case "email_complained":
      return { ...base, kind: "problem", label: "Marcó el email como spam", detail: str(p.email), automatic: false };
    case "unsubscribed":
      return { ...base, kind: "problem", label: "Se dio de baja", detail: null, automatic: false };
    default:
      return { ...base, kind: "intent", label: e.type, detail: null, automatic: false };
  }
}

/** Actividad del lead, lo más reciente primero. */
export function buildActivity(events: LeadEvent[], messages: ActivityMessage[]): ActivityItem[] {
  return events
    .map((e) => describeEvent(e, messages))
    .filter((i): i is ActivityItem => i !== null)
    .sort((a, b) => b.at.localeCompare(a.at));
}

export interface ActivitySummary {
  opens: number;
  webClicks: number;
  bookClicks: number;
  waClicks: number;
  bookVisits: number;
  waIntents: number;
}

/** Cuenta solo lo que hizo el prospecto (sin automáticos). */
export function summarizeActivity(events: LeadEvent[], messages: ActivityMessage[]): ActivitySummary {
  const s: ActivitySummary = { opens: 0, webClicks: 0, bookClicks: 0, waClicks: 0, bookVisits: 0, waIntents: 0 };
  for (const e of events) {
    const item = describeEvent(e, messages);
    if (!item || item.automatic) continue;
    const target = e.payload?.target;
    if (e.type === "email_opened") s.opens++;
    else if (e.type === "demo_viewed") s.bookVisits++;
    else if (e.type === "booking_started") s.waIntents++;
    else if (e.type === "link_clicked") {
      if (target === "web") s.webClicks++;
      else if (target === "book") s.bookClicks++;
      else if (target === "wa") s.waClicks++;
    }
  }
  return s;
}

export interface MessageEngagement {
  /** Primera apertura de una persona (null = no abierto o solo aperturas automáticas). */
  firstOpen: string | null;
  autoOpens: number;
  clicks: { target: string; at: string }[];
  autoClicks: number;
}

/** Aperturas y clics por mensaje, separando lo humano de lo automático. */
export function messageEngagement(
  events: LeadEvent[],
  messages: ActivityMessage[],
): Record<string, MessageEngagement> {
  const out: Record<string, MessageEngagement> = {};
  for (const m of messages) out[m.id] = { firstOpen: null, autoOpens: 0, clicks: [], autoClicks: 0 };

  const sorted = [...events].sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const e of sorted) {
    const eng = out[str(e.payload?.message_id) ?? ""];
    if (!eng || (e.type !== "email_opened" && e.type !== "link_clicked")) continue;
    const item = describeEvent(e, messages);
    if (!item) continue;
    if (e.type === "email_opened") {
      if (item.automatic) eng.autoOpens++;
      else if (!eng.firstOpen) eng.firstOpen = e.created_at;
    } else if (item.automatic) {
      eng.autoClicks++;
    } else {
      eng.clicks.push({ target: str(e.payload?.target) ?? "?", at: e.created_at });
    }
  }

  // Mensajes con opened_at pero sin eventos de apertura: se respeta opened_at salvo que sea a
  // menos de 1 min del envío.
  for (const m of messages) {
    const eng = out[m.id];
    if (eng.firstOpen || eng.autoOpens || !m.opened_at) continue;
    if (tooSoon(m.sent_at, m.opened_at)) eng.autoOpens++;
    else eng.firstOpen = m.opened_at;
  }
  return out;
}

/** Enlace con seguimiento para el WhatsApp manual (misma ruta que los emails: /r → track-click). */
export function trackedLink(origin: string, leadId: string, target: "web" | "book", channel = "whatsapp"): string {
  return `${origin.replace(/\/$/, "")}/r/${leadId}/${target}?c=${encodeURIComponent(channel)}`;
}
