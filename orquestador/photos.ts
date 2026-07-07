// Curación de fotos reales del negocio para el build en Lovable.
// Helpers PUROS (extractPhotoCandidates, parseCurationResponse, photoManifest) + la cola de red
// (curatePhotos, Task 5). Mismo patrón que llm.ts: lógica pura y llamada de red en un módulo.

import type { SupabaseClient } from "@supabase/supabase-js";
import { llmVisionJson } from "./llm.ts";
import { rehostToBucket, PREVIEW_BUCKET } from "./preview.ts";

export interface CuratedPhotos {
  hero: string | null;
  gallery: string[];
}

const MAX_CANDIDATES = 15;
const MAX_WINNERS = 6;

function isHttpUrl(v: unknown): v is string {
  return typeof v === "string" && /^https?:\/\//i.test(v.trim());
}

// URLs candidatas del raw_json del scraper: portada (imageUrl) + galería (imageUrls, strings u objetos).
// Únicas, en orden, solo http(s), tope 15. No inventa nada; vacío si no hay.
export function extractPhotoCandidates(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return [];
  const r = raw as Record<string, unknown>;
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (v: unknown) => {
    let url: string | null = null;
    if (isHttpUrl(v)) url = v.trim();
    else if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      const cand = o.imageUrl ?? o.url ?? o.src;
      if (isHttpUrl(cand)) url = cand.trim();
    }
    if (url && !seen.has(url)) {
      seen.add(url);
      out.push(url);
    }
  };
  push(r.imageUrl);
  if (Array.isArray(r.imageUrls)) for (const item of r.imageUrls) push(item);
  return out.slice(0, MAX_CANDIDATES);
}

// Quita vallas ```json y recorta al objeto (mismo criterio que extractJson de llm.ts). Nunca lanza.
function looseJson(text: string): Record<string, unknown> | null {
  try {
    let t = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    return JSON.parse(t.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// La respuesta de la visión: { "order": [índices de candidatas, hero primero] }. Devuelve índices
// válidos [0,n), deduplicados, en orden, tope 6. Cualquier basura → [] (sesgo conservador).
export function parseCurationResponse(text: string, n: number): number[] {
  const obj = looseJson(text);
  const order = obj?.order;
  if (!Array.isArray(order)) return [];
  const out: number[] = [];
  const seen = new Set<number>();
  for (const v of order) {
    const i = typeof v === "number" ? v : Number(v);
    if (Number.isInteger(i) && i >= 0 && i < n && !seen.has(i)) {
      seen.add(i);
      out.push(i);
      if (out.length >= MAX_WINNERS) break;
    }
  }
  return out;
}

// Bloque determinista que run.ts añade al prompt de Lovable según el resultado de la curación.
export function photoManifest(photos: CuratedPhotos): string {
  if (!photos.hero && photos.gallery.length === 0) {
    return [
      "FOTOS: No hay fotos disponibles de este negocio.",
      "NO uses fotos de stock ni imágenes de relleno. Construye un diseño tipográfico limpio:",
      "hero de texto, iconos para los servicios, y apóyate en el carrusel de reseñas como prueba social.",
    ].join(" ");
  }
  const lines = ["FOTOS: usa EXCLUSIVAMENTE estas fotos reales del negocio (no añadas stock)."];
  if (photos.hero) lines.push(`Hero (foto principal): ${photos.hero}`);
  if (photos.gallery.length) lines.push(`Galería: ${photos.gallery.join(", ")}`);
  lines.push("Son fotos reales; respétalas, no las deformes ni recortes las caras.");
  return lines.join(" ");
}

const CURATION_SYSTEM = `Eres director de arte seleccionando fotos para la web profesional de un negocio.
Recibes varias imágenes numeradas desde 0 y los datos del negocio. Devuelve ÚNICAMENTE un objeto JSON
válido (sin markdown): { "order": [índices] }, con los índices de las 4-6 MEJORES fotos, la primera = la
mejor para el hero. Incluye SOLO fotos que sean: (a) de buena calidad y CLARAMENTE relevantes a este
negocio, y (b) seguras para publicar: NADA de caras identificables en primer plano, capturas de pantalla,
tiques, menús como texto, memes, ni fotos borrosas u oscuras. Si ninguna cumple con confianza, devuelve
{ "order": [] }. Ante la duda, EXCLUYE (mejor sin foto que una foto mala).`;

// Curación por visión + re-host de solo las ganadoras. Degradación total ante cualquier fallo.
export async function curatePhotos(
  supabase: SupabaseClient,
  leadId: string,
  candidates: string[],
  ctx: { name: string; category?: string | null; city?: string | null },
): Promise<CuratedPhotos> {
  const empty: CuratedPhotos = { hero: null, gallery: [] };
  if (candidates.length === 0) return empty;
  try {
    const userText = `Negocio: ${ctx.name}${ctx.category ? ` (${ctx.category})` : ""}${ctx.city ? ` en ${ctx.city}` : ""}. Hay ${candidates.length} imágenes numeradas 0..${candidates.length - 1} en el orden en que se te envían.`;
    const parsed = await llmVisionJson<{ order?: unknown }>(CURATION_SYSTEM, candidates, userText);
    const order = parseCurationResponse(JSON.stringify(parsed), candidates.length);
    if (order.length === 0) {
      console.log("  · curación de fotos: ninguna pasó el filtro → web sin fotos.");
      return empty;
    }
    // Re-hospedar en orden; hero = primera superviviente, galería = resto.
    const survivors: string[] = [];
    for (let i = 0; i < order.length; i++) {
      const slot = survivors.length === 0 ? "hero" : `g${survivors.length}`;
      const rehosted = await rehostToBucket(supabase, PREVIEW_BUCKET, `photos/${leadId}/${slot}`, candidates[order[i]]);
      if (rehosted) survivors.push(rehosted);
    }
    if (survivors.length === 0) return empty;
    console.log(`  · curación de fotos: ${survivors.length} foto(s) seleccionada(s) y re-hospedada(s).`);
    return { hero: survivors[0], gallery: survivors.slice(1) };
  } catch (e) {
    console.error(`  · curación de fotos falló (no crítico, web sin fotos): ${e instanceof Error ? e.message : e}`);
    return empty;
  }
}
