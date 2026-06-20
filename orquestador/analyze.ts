// analyze.ts — Scoring automático de la web ya construida.
// Lo llama el Orquestador en processBuild, justo después de publicar la web en Lovable.
// Usa Haiku 4.5 (barato, ~medio céntimo por web) con el MISMO prompt que la Edge Function
// analyze-site (ANALYSIS_PROMPT en _shared/prompts.ts), para que manual y automático coincidan.
// Es ORIENTATIVO: no toca el gate humano (nada se contacta hasta status='approved').

import { ANALYSIS_PROMPT } from "../supabase/functions/_shared/prompts.ts";
import { extractJson } from "./fable.ts";

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

interface AnalyzeInput {
  lead: {
    name: string;
    category?: string | null;
    city?: string | null;
    rating?: number | null;
    review_count?: number | null;
  };
  brief: {
    business_summary?: string | null;
    tone?: string | null;
    value_props?: unknown;
    hero_copy?: string | null;
    services?: unknown;
  } | null;
  liveUrl: string;
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

// Analiza la web construida y devuelve el JSON estricto del scoring.
// Lanza si falta la API key, si Claude devuelve error o si la respuesta no es JSON válido;
// el caller (processBuild) lo trata como no crítico (la web ya está publicada).
export async function analyzeSite({ lead, brief, liveUrl }: AnalyzeInput): Promise<SiteAnalysis> {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) throw new Error("Falta ANTHROPIC_API_KEY en el entorno del Orquestador.");

  const htmlSnippet = await fetchPageSnippet(liveUrl);

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
    live_url: liveUrl,
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
