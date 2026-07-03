// Descarga y preparación del HTML de una web para el scoring. Centraliza lo que antes estaba
// DUPLICADO en analyze-site y score-sites (mismo fetch + misma limpieza). Usa `fetch` (estándar
// web, disponible en Deno), por eso vive aquí y no en website.ts (que es puro, importable también
// desde el Orquestador/Node).
import { detectWidgets, type WidgetSignals } from "./website.ts";

export interface FetchedPage {
  ok: boolean; // ¿se pudo bajar el HTML? (false = web caída / bloqueada / timeout)
  snippet: string; // texto visible limpio, recortado a 4000 chars (lo que se le pasa a Claude)
  signals: WidgetSignals | null; // detección de chat/WhatsApp sobre el HTML CRUDO; null si !ok
  title: string | null; // nombre propuesto del negocio (og:site_name o <title> sin sufijos SEO)
}

// Baja el HTML de `url` UNA sola vez y deriva dos cosas: (1) el `snippet` limpio para Claude
// (sin <script>/<style>/etiquetas) y (2) `signals`, la detección de widgets sobre el HTML CRUDO
// (los chats viven en <script> y enlaces, justo lo que el snippet tira). Best-effort: si la
// página no responde, devuelve ok:false y signals:null (los flags quedan "sin comprobar").
export async function fetchPageForAnalysis(url: string): Promise<FetchedPage> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; WebForge-Analyzer/1.0)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { ok: false, snippet: "", signals: null, title: null };
    const html = await res.text();
    const signals = detectWidgets(html);
    const snippet = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 4000);
    return { ok: true, snippet, signals, title: extractSiteTitle(html) };
  } catch (_e) {
    return { ok: false, snippet: "", signals: null, title: null };
  }
}

// ── Nombre propuesto del negocio a partir del HTML ──────────────────────────────────────────
// Para el alta manual por URL: og:site_name es el nombre "oficial" del sitio; el <title> suele
// llevar sufijos de SEO ("Talleres García | Taller en Salamanca") — nos quedamos con el primer
// tramo. Heurística, no verdad absoluta: el operador SIEMPRE confirma/edita el nombre en el panel.
const HTML_ENTITIES: Record<string, string> = {
  amp: "&", quot: '"', apos: "'", nbsp: " ",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ", ccedil: "ç",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú", Ntilde: "Ñ",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)))
    .replace(/&([a-zA-Z]+);/g, (m, name: string) => HTML_ENTITIES[name] ?? m);
}

export function extractSiteTitle(html: unknown): string | null {
  const src = typeof html === "string" ? html : "";
  if (!src) return null;
  const og =
    src.match(/<meta[^>]+property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i) ??
    src.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:site_name["']/i);
  let title = og?.[1] ?? src.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  title = decodeEntities(title).replace(/\s+/g, " ").trim();
  if (!og && title) {
    // Separadores SEO: |, ·, — y – siempre; el guion normal SOLO con espacios (" - "),
    // para no partir nombres como "Semi-nuevos García".
    const first = title.split(/\s*[|·—–]\s*|\s+-\s+/)[0].trim();
    if (first.length >= 3) title = first;
  }
  if (title.length < 2) return null;
  return title.slice(0, 120);
}
