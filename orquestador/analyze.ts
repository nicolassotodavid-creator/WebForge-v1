// analyze.ts — Scoring automático de la web ya construida.
// Lo llama el Orquestador en processBuild, justo después de publicar la web en Lovable.
// Usa Haiku 4.5 (barato, ~medio céntimo por web) con el MISMO prompt que la Edge Function
// analyze-site (ANALYSIS_PROMPT en _shared/prompts.ts), para que manual y automático coincidan.
// Es ORIENTATIVO: no toca el gate humano (nada se contacta hasta status='approved').

import { ANALYSIS_PROMPT } from "../supabase/functions/_shared/prompts.ts";
import { extractJson } from "./llm.ts";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
// Haiku 4.5 para análisis a volumen (mismo modelo que la Edge Function analyze-site).
const ANALYSIS_MODEL = "claude-haiku-4-5-20251001";

interface AnthropicResponse {
  content?: { type?: string; text?: string }[];
  error?: { message?: string };
}

export interface SiteAnalysis {
  score: number;
  summary: string;
  strengths: string[];
  improvements: { area: string; issue: string; fix: string }[];
}

interface AnalyzeLead {
  name: string;
  category?: string | null;
  city?: string | null;
  rating?: number | null;
  review_count?: number | null;
}

interface AnalyzeBrief {
  business_summary?: string | null;
  tone?: string | null;
  value_props?: unknown;
  hero_copy?: string | null;
  services?: unknown;
}

interface AnalyzeInput {
  lead: AnalyzeLead;
  brief: AnalyzeBrief | null;
  liveUrl: string;
}

interface AnalyzeExistingInput {
  lead: AnalyzeLead;
  url: string;
}

// Baja el HTML de la página y lo deja en texto plano recortado a 4000 chars.
// Misma limpieza que analyze-site. Si la página bloquea el scraping, devolvemos "".
async function fetchPageSnippet(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; WebForge-Analyzer/1.0)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return "";
    const html = await res.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 4000);
  } catch (_e) {
    return "";
  }
}

// Núcleo compartido: baja el HTML de `url`, lo manda a Claude con ANALYSIS_PROMPT y devuelve
// el JSON estricto del scoring. Lo usan tanto el análisis de la web construida (analyzeSite)
// como el de la web ACTUAL del negocio (analyzeExistingSite). `brief` es opcional (null para
// la web del negocio, que no tiene brief nuestro).
async function analyzeUrl(lead: AnalyzeLead, brief: AnalyzeBrief | null, url: string): Promise<SiteAnalysis> {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) throw new Error("Falta ANTHROPIC_API_KEY en el entorno del Orquestador.");

  const htmlSnippet = await fetchPageSnippet(url);

  const payload = {
    negocio: {
      nombre: lead.name,
      categoria: lead.category,
      ciudad: lead.city,
      valoracion: lead.rating,
      reseñas: lead.review_count,
    },
    brief: brief
      ? {
          resumen: brief.business_summary,
          tono: brief.tone,
          propuestas_valor: brief.value_props,
          hero_copy: brief.hero_copy,
          servicios: brief.services,
        }
      : null,
    url,
    contenido_pagina: htmlSnippet || "(no disponible — la página bloquea el scraping)",
  };

  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANALYSIS_MODEL,
      max_tokens: 1500,
      system: [{ type: "text", text: ANALYSIS_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: JSON.stringify(payload) }],
    }),
  });

  const data = (await res.json()) as AnthropicResponse;
  if (!res.ok) throw new Error(`Claude devolvió ${res.status}: ${data?.error?.message ?? "error"}`);

  const text = data.content?.find((c) => c.type === "text")?.text ?? data.content?.[0]?.text ?? "";
  if (!text) throw new Error("Claude devolvió una respuesta vacía");
  return extractJson<SiteAnalysis>(text);
}

// Analiza la web CONSTRUIDA por nosotros (live_url). La llama processBuild justo tras publicar
// en Lovable; el resultado se guarda en `sites`. No crítico: la web ya está publicada.
export async function analyzeSite({ lead, brief, liveUrl }: AnalyzeInput): Promise<SiteAnalysis> {
  return analyzeUrl(lead, brief, liveUrl);
}

// Analiza la web ACTUAL del negocio (la de raw_json, el globo del panel). La usa el barrido
// diario del Orquestador y el botón manual; el resultado se guarda en `leads.site_*`.
// Sin brief: es la web del negocio, no nuestra propuesta.
export async function analyzeExistingSite({ lead, url }: AnalyzeExistingInput): Promise<SiteAnalysis> {
  return analyzeUrl(lead, null, url);
}
