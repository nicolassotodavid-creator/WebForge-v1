// Extracción de emails desde el HTML de la web propia del negocio. Pura (sin APIs de Deno/Node)
// para poder importarse desde Edge Functions (Deno) y desde el Orquestador (Node/tsx).
//
// Casos reales que motivan cada regla (13-sep-2026):
//  - Felipe Cebrià: `<a href="mailto:support@mobirise.com">f</a>elipe@felipecebria.com` → la regex
//    sobre el HTML crudo guardaba `elipe@…`. Hay que buscar en el TEXTO (sin etiquetas).
//  - MESFORM: `P.ej. contacto@ejemplo.com` (placeholder de Webnode) → el filtro solo conocía "example".
//  - BONO PROYECTOS: su home trae la errata `info@bonoporyectos.com`, pero su aviso legal tiene
//    `administracion@bonoproyectos.com` → hay que mirar todas las páginas y preferir la marca de la web.

const EMAIL_RX_G = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const EMAIL_ONE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

// Placeholders, constructores de webs, trackers y buzones que no contestan.
const JUNK =
  /(example|ejemplo|placeholder|yourdomain|tudominio|tuempresa|tuweb|tucorreo|tuemail|dominio\.(com|es)|domain\.com|sentry|wixpress|\.wix|godaddy|mobirise|webnode|jimdo|squarespace|@2x|^email@|^user@|^usuario@|^name@|^nombre@|^correo@|no-?reply|donotreply)/;

export function isJunkEmail(e: string): boolean {
  const x = e.toLowerCase();
  return /\.(png|jpe?g|gif|webp|svg|css|js)$/.test(x) || JUNK.test(x);
}

const FREE_PROVIDERS = new Set([
  "gmail.com", "hotmail.com", "hotmail.es", "outlook.com", "outlook.es", "yahoo.com", "yahoo.es",
  "icloud.com", "live.com", "msn.com", "telefonica.net", "ono.com", "movistar.es", "orange.es",
]);

// TLDs habituales en pymes españolas. Sirve para recortar la basura pegada tras el dominio cuando
// el texto de la etiqueta siguiente queda junto al email (`info@x.comLlámanos` → `info@x.com`).
const KNOWN_TLDS = [
  "com", "es", "net", "org", "eu", "info", "cat", "gal", "eus", "biz", "pro", "online", "site",
  "store", "shop", "website", "me", "co", "io", "app", "dev",
];

function trimTld(email: string): string {
  const at = email.lastIndexOf("@");
  const labels = email.slice(at + 1).split(".");
  const last = labels[labels.length - 1].toLowerCase();
  if (KNOWN_TLDS.includes(last)) return email;
  const prefix = KNOWN_TLDS.filter((t) => last.startsWith(t)).sort((a, b) => b.length - a.length)[0];
  if (!prefix) return email;
  labels[labels.length - 1] = prefix;
  return `${email.slice(0, at + 1)}${labels.join(".")}`;
}

// Etiquetas "en línea": se quitan sin separador (`<a>f</a>elipe` → `felipe`). El resto (bloques,
// saltos, celdas) se sustituye por un espacio para no fundir textos de elementos distintos.
const INLINE_TAGS = /<\/?(a|span|strong|b|em|i|u|font|small|mark|abbr|sup|sub)(\s[^>]*)?>/gi;

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(INLINE_TAGS, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#64;|&commat;/gi, "@")
    .replace(/&#46;|&period;/gi, ".")
    .replace(/&nbsp;/gi, " ");
}

// Todos los emails válidos de una página, en orden de aparición (primero los mailto:).
export function extractEmails(html: string): string[] {
  if (!html) return [];
  const found: string[] = [];
  const add = (raw: string) => {
    const e = trimTld(raw.trim().toLowerCase());
    if (EMAIL_ONE.test(e) && !isJunkEmail(e) && !found.includes(e)) found.push(e);
  };
  for (const m of html.matchAll(/mailto:([^"'?>\s]+)/gi)) {
    try { add(decodeURIComponent(m[1])); } catch { add(m[1]); }
  }
  for (const m of htmlToText(html).matchAll(EMAIL_RX_G)) add(m[0]);
  return found;
}

// "bonoproyectos.es" y "bonoproyectos.com" comparten marca: la etiqueta anterior al TLD.
function brandLabel(host: string): string {
  const labels = host.toLowerCase().replace(/^www\./, "").split(".");
  return labels.length >= 2 ? labels[labels.length - 2] : labels[0];
}

// 3 = mismo dominio de la web · 2 = misma marca con otro TLD · 1 = proveedor gratuito · 0 = otro.
export function emailScore(email: string, siteHost: string): number {
  const domain = email.slice(email.lastIndexOf("@") + 1).toLowerCase();
  const host = siteHost.toLowerCase().replace(/^www\./, "");
  if (domain === host || domain.endsWith(`.${host}`)) return 3;
  if (brandLabel(domain) === brandLabel(host)) return 2;
  if (FREE_PROVIDERS.has(domain)) return 1;
  return 0;
}

// El mejor email entre los encontrados en varias páginas. A igualdad de puntuación, el primero.
export function pickBestEmail(emails: string[], siteHost: string): string | null {
  let best: string | null = null;
  let bestScore = -1;
  for (const e of emails) {
    const s = emailScore(e, siteHost);
    if (s > bestScore) { best = e; bestScore = s; }
  }
  return best;
}
