// clickTracking.ts — Seguimiento de clics en los enlaces que recibe el prospecto (emails 1-3 y
// WhatsApp manual). Cada enlace sale como https://www.nico-soto.es/r/<leadId>/<destino>; Vercel
// lo reescribe a la función track-click, que apunta el clic en `events` y redirige.
// El destino (web / propuesta / WhatsApp) se resuelve EN EL SERVIDOR a partir del lead: el enlace
// nunca lleva la URL final, así que no hay redirección abierta. Puro y sin dependencias: lo
// importan las Edge Functions (Deno) y el orquestador (Node).

export type ClickTarget = "web" | "book" | "wa" | "demo";

// [SIMULADOR] Demo del Home Estimator: el enlace lleva el slug (?s=), el host es FIJO, así que
// tampoco hay redirección abierta. Devuelve null si el slug no es válido.
export const DEMO_BASE = "https://presupuestos.nico-soto.es/demo";
export function demoUrl(slug: string | null | undefined): string | null {
  const s = (slug ?? "").trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]{0,79}$/.test(s) ? `${DEMO_BASE}/${s}` : null;
}

// Base de los enlaces de seguimiento. Con APP_URL (dominio de la marca) → <APP_URL>/r, que es lo
// que ve el prospecto y va alineado con el dominio remitente. Sin APP_URL → la función directa.
export function clickBase(
  appUrl: string | null | undefined,
  supabaseUrl: string | null | undefined,
): string | null {
  if (appUrl) return `${appUrl.replace(/\/$/, "")}/r`;
  if (supabaseUrl) return `${supabaseUrl.replace(/\/$/, "")}/functions/v1/track-click`;
  return null;
}

export function clickUrl(
  base: string,
  leadId: string,
  target: ClickTarget,
  opts: { messageId?: string | null; channel?: string | null; slug?: string | null } = {},
): string {
  const q = new URLSearchParams();
  if (opts.messageId) q.set("m", opts.messageId);
  if (opts.channel) q.set("c", opts.channel);
  if (opts.slug) q.set("s", opts.slug);
  const qs = q.toString();
  return `${base.replace(/\/$/, "")}/${leadId}/${target}${qs ? `?${qs}` : ""}`;
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const CLICK_PATH = new RegExp(`/(${UUID})/(web|book|wa|demo)/?$`, "i");

// Acepta tanto /r/<lead>/<destino> como /track-click/<lead>/<destino> (la ruta que llega a la función).
export function parseClickPath(pathname: string): { leadId: string; target: ClickTarget } | null {
  const m = pathname.match(CLICK_PATH);
  return m ? { leadId: m[1].toLowerCase(), target: m[2].toLowerCase() as ClickTarget } : null;
}

// Agentes que "pulsan" enlaces sin ser una persona: vistas previas (WhatsApp, iMessage usa el UA
// de Facebook), escáneres de seguridad del correo, crawlers y clientes HTTP de scripts.
const AUTOMATED_UA =
  /bot\b|crawler|spider|preview|facebookexternalhit|whatsapp|telegram|slack|discord|skypeuri|headless|python|curl\/|wget|go-http-client|node-fetch|axios|okhttp|java\/|libwww|httpclient|scanner|proofpoint|mimecast|barracuda|safelinks|urldefense|existence discovery/i;

export function isLikelyBot(ua: string | null | undefined): boolean {
  if (!ua || !ua.trim()) return true;
  return AUTOMATED_UA.test(ua);
}

// Apertura o clic a menos de `seconds` del envío (o incluso antes): lo hace un escáner al entregar
// el correo o una prueba nuestra, no el prospecto leyéndolo. Sin sent_at no se puede saber → false.
export function isTooSoonAfterSend(
  sentAt: string | null | undefined,
  at: Date | string,
  seconds = 60,
): boolean {
  if (!sentAt) return false;
  const diff = (new Date(at).getTime() - new Date(sentAt).getTime()) / 1000;
  return diff < seconds;
}

// Sustituye en el HTML los href EXACTOS (url original → url de seguimiento). Solo toca atributos
// href: la captura (<img src>) y el enlace de baja no se modifican.
export function trackHrefs(
  html: string,
  links: Array<[string | null | undefined, string | null | undefined]>,
): string {
  let out = html;
  for (const [from, to] of links) {
    if (!from || !to) continue;
    out = out.split(`href="${from}"`).join(`href="${to.replace(/&/g, "&amp;")}"`);
  }
  return out;
}

// Pasa por el seguimiento los tres enlaces de un email: la web, la propuesta (/book) y el botón
// de WhatsApp del pie (si lo lleva).
export function trackEmailLinks(
  html: string,
  o: {
    base: string;
    leadId: string;
    messageId?: string | null;
    channel?: string;
    webUrl?: string | null;
    bookUrl?: string | null;
  },
): string {
  const opts = { messageId: o.messageId, channel: o.channel ?? "email" };
  const wa = html.match(/href="(https:\/\/wa\.me\/\d+)"/)?.[1];
  return trackHrefs(html, [
    [o.webUrl, clickUrl(o.base, o.leadId, "web", opts)],
    [o.bookUrl, clickUrl(o.base, o.leadId, "book", opts)],
    [wa, clickUrl(o.base, o.leadId, "wa", opts)],
  ]);
}
