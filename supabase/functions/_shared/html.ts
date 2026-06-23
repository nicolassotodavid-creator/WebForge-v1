// Descarga y preparación del HTML de una web para el scoring. Centraliza lo que antes estaba
// DUPLICADO en analyze-site y score-sites (mismo fetch + misma limpieza). Usa `fetch` (estándar
// web, disponible en Deno), por eso vive aquí y no en website.ts (que es puro, importable también
// desde el Orquestador/Node).
import { detectWidgets, type WidgetSignals } from "./website.ts";

export interface FetchedPage {
  ok: boolean; // ¿se pudo bajar el HTML? (false = web caída / bloqueada / timeout)
  snippet: string; // texto visible limpio, recortado a 4000 chars (lo que se le pasa a Claude)
  signals: WidgetSignals | null; // detección de chat/WhatsApp sobre el HTML CRUDO; null si !ok
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
    if (!res.ok) return { ok: false, snippet: "", signals: null };
    const html = await res.text();
    const signals = detectWidgets(html);
    const snippet = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 4000);
    return { ok: true, snippet, signals };
  } catch (_e) {
    return { ok: false, snippet: "", signals: null };
  }
}
