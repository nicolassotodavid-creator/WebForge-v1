// Lógica ÚNICA de "web real del negocio". Pura (sin APIs de Deno/Node) para poder importarse
// desde Edge Functions (Deno) y desde el Orquestador (Node/tsx). El frontend (app/src) mantiene
// una copia equivalente porque no comparte build con este árbol — si tocas las reglas aquí,
// replícalas en app/src/lib (LeadDetail/Dashboard).

// Enlaces que NO son la web propia del negocio: redes, mapas, mensajería, vídeo.
// Si la "web" de Google Maps es uno de estos, el negocio NO tiene web propia conocida ahí.
const NOT_OWN_SITE =
  /google\.|maps\.|facebook\.|fb\.me|instagram\.|twitter\.|x\.com|linkedin\.|wa\.me|whatsapp|youtube\.|youtu\.be|tiktok\.|t\.me|pinterest\./i;

// ¿Es una URL http(s) que apunta a una web propia (no a una red social / mapa)?
export function isRealWebsite(url: unknown): url is string {
  if (typeof url !== "string") return false;
  const u = url.trim();
  if (!/^https?:\/\//i.test(u)) return false;
  return !NOT_OWN_SITE.test(u);
}

// Primera web real entre los campos del scrape (raw_json de Apify/Google Maps). Null si solo
// hay redes/mapas o nada.
export function realWebsiteFromRaw(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  for (const k of ["website", "websiteUrl", "url", "web", "site", "domain"]) {
    const v = r[k];
    if (isRealWebsite(v)) return v.trim();
  }
  return null;
}

// Web real DEFINITIVA del lead: primero la resuelta por descubrimiento (columna `website_url`);
// si no, la que figura en el scrape. Null si el negocio no tiene web propia conocida.
export function resolveWebsite(
  lead: { website_url?: unknown; raw_json?: unknown } | null | undefined,
): string | null {
  if (!lead) return null;
  if (isRealWebsite(lead.website_url)) return (lead.website_url as string).trim();
  return realWebsiteFromRaw(lead.raw_json);
}

// Compat: callers antiguos pasan raw_json directamente. Ahora rechaza redes/mapas (antes no).
export function getWebsiteUrl(raw: unknown): string | null {
  return realWebsiteFromRaw(raw);
}

// ── Detección de widgets en la web ACTUAL del negocio ───────────────────────────────────────
// Señal de prospección DETERMINISTA (sin Claude): ¿la web ya tiene un chat web (Tawk, Crisp…)
// o un canal de WhatsApp (wa.me, botón flotante)? Se escanea el HTML CRUDO — los widgets viven
// en <script> y en <a href>, justo lo que la limpieza para Claude descarta. Función pura: la
// usan las Edge Functions (Deno) y el Orquestador (Node).
//
// Semántica honesta: solo ve lo que está en el HTML inicial. Un widget cargado por JS/GTM tras
// el render puede escaparse (falso negativo). hasChat/hasWhatsapp=true => lo tiene seguro.
export interface WidgetSignals {
  hasChat: boolean;
  hasWhatsapp: boolean;
  vendors: string[]; // nombres legibles de los chats detectados (para mostrar en la ficha)
}

// Firma (subcadena que el proveedor inyecta, normalmente el src de su script) → nombre legible.
// Se busca sobre el HTML en minúsculas, así que las firmas van en minúsculas.
const CHAT_VENDORS: { name: string; re: RegExp }[] = [
  { name: "Tawk.to", re: /tawk\.to/ },
  { name: "Crisp", re: /crisp\.chat/ },
  { name: "Intercom", re: /widget\.intercom\.io|intercomcdn|intercom\.(io|com)/ },
  { name: "Tidio", re: /tidio\.(co|com)/ },
  { name: "Zendesk", re: /zdassets\.com|static\.zopim\.com|zopim|zendesk\.com\/embeddable/ },
  { name: "Drift", re: /js\.driftt\.com|drift\.com\/include|driftt\.com/ },
  { name: "HubSpot", re: /js\.hs-scripts\.com|js\.usemessages\.com|js\.hsforms\.net/ },
  { name: "Smartsupp", re: /smartsuppchat\.com|smartsupp/ },
  { name: "LiveChat", re: /cdn\.livechatinc\.com|livechatinc\.com|livechat\.com/ },
  { name: "Olark", re: /static\.olark\.com|olark/ },
  { name: "Freshchat", re: /wchat\.freshchat\.com|freshchat/ },
  { name: "JivoChat", re: /code\.jivosite\.com|jivosite|jivo_api|jivochat/ },
  { name: "Chatra", re: /call\.chatra\.io|chatra\.io|window\.chatra/ },
  { name: "Userlike", re: /userlike\.com|userlikecdn/ },
  { name: "Landbot", re: /landbot\.io|static\.landbot/ },
  { name: "ManyChat", re: /manychat\.com|mch_widget/ },
];

// Canal de WhatsApp: enlace o botón a un chat de WhatsApp (no un "compartir en WhatsApp", que es
// raro en webs de negocio local). wa.link es el acortador oficial de WhatsApp Business.
const WHATSAPP_RE = /wa\.me\/|api\.whatsapp\.com\/send|web\.whatsapp\.com|whatsapp:\/\/send|wa\.link\//;

export function detectWidgets(html: unknown): WidgetSignals {
  const hay = (typeof html === "string" ? html : "").toLowerCase();
  const vendors = CHAT_VENDORS.filter((v) => v.re.test(hay)).map((v) => v.name);
  return {
    hasChat: vendors.length > 0,
    hasWhatsapp: WHATSAPP_RE.test(hay),
    vendors,
  };
}

// ── Entrada manual de URL (panel → add-lead-by-url) ─────────────────────────────────────────
// Normaliza lo que pega el operador: trim, https:// si falta esquema, y valida que sea una URL
// http(s) con un dominio real (con punto). Null = no se puede usar.
export function normalizeUrlInput(input: unknown): string | null {
  if (typeof input !== "string") return null;
  let u = input.trim();
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  try {
    const parsed = new URL(u);
    if (!/^https?:$/.test(parsed.protocol)) return null;
    if (!parsed.hostname.includes(".")) return null;
    // Rechaza URLs con userinfo (usuario:contraseña@host). Un email pegado por error
    // ("contacto@talleres.com") parsea como https://contacto@talleres.com/, con
    // "contacto" como username — no es una URL válida para guardar como lead.
    if (parsed.username || parsed.password) return null;
    return parsed.toString();
  } catch (_e) {
    return null;
  }
}

// Clave de comparación de duplicados: hostname en minúsculas, sin "www.". La misma web puede
// estar guardada con o sin www / con distinto path; el host pelado las iguala.
export function siteHost(url: unknown): string | null {
  if (typeof url !== "string") return null;
  try {
    const h = new URL(url.trim()).hostname.toLowerCase().replace(/^www\./, "");
    return h || null;
  } catch (_e) {
    return null;
  }
}
