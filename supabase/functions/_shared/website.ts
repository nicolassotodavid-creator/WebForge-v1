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
