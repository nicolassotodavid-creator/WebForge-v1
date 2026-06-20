// getWebsiteUrl — extrae la URL de la web ACTUAL del negocio desde raw_json (datos del scrape).
// Mismo criterio que el panel (Dashboard/LeadDetail). Devuelve null si no hay una URL http(s).
// TS puro (sin APIs de Deno) para poder importarlo también desde el Orquestador (Node/tsx).
export function getWebsiteUrl(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const url =
    r.website ?? r.websiteUrl ?? r.url ?? r.website_url ?? r.web ?? r.site ?? r.domain ?? null;
  return typeof url === "string" && url.startsWith("http") ? url : null;
}
