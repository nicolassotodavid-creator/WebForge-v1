// score-sites — Barrido EN LA NUBE: puntúa la web que el negocio YA tiene (señal de prospección).
// Versión Edge (Deno) del barrido del Orquestador (score-existing-sites.ts), para que el Score
// se rellene aunque el Mac esté apagado. Lo dispara pg_cron (ver 0012_cron_score_sites.sql) cada
// pocos minutos en lotes pequeños, igual que cron-followups dispara los seguimientos.
//
// Coge leads con web propia (has_website=true) aún sin analizar, baja su HTML y deja en
// `leads.site_*` una nota 1-10 (Haiku 4.5, ~medio céntimo/web). Mismo prompt y mismas columnas
// que analyze-site (el botón manual): manual y automático coinciden.
//
// Auth: Bearer <service_role_key> (igual que cron-followups). Lo llama pg_cron con el secreto Vault.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { ANALYSIS_PROMPT } from "../_shared/prompts.ts";
import { resolveWebsite } from "../_shared/website.ts";
import { fetchPageForAnalysis } from "../_shared/html.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
// SERVICE_KEY: solo para el cliente de DB (bypass RLS). CRON_SECRET: auth dedicada del cron
// (la manda pg_cron leyéndola del Vault 'cron_secret'). No autenticamos con la service key
// porque está DEPRECATED y su valor en runtime no es reproducible tras la migración de keys.
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

// Tope de webs por corrida. Cada web = fetch HTML (≤10s) + Claude (~1-4s); con 6 el run cabe
// holgado bajo el límite de wall-time de la Edge Function (~150s). Override con body.limit.
const DEFAULT_BATCH = 6;
const MAX_BATCH = 10;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Puntúa UNA web con Claude a partir del snippet ya descargado. Devuelve el objeto análisis
// (con .score) o lanza si Claude falla. El fetch del HTML lo hace el caller (fetchPageForAnalysis),
// que además saca los flags de chat/WhatsApp del HTML crudo.
async function analyzeOne(
  lead: Record<string, unknown>,
  url: string,
  htmlSnippet: string,
): Promise<Record<string, unknown>> {
  const payload = {
    negocio: {
      nombre: lead.name,
      categoria: lead.category,
      ciudad: lead.city,
      valoracion: lead.rating,
      reseñas: lead.review_count,
    },
    url,
    contenido_pagina: htmlSnippet || "(no disponible — la página bloquea el scraping)",
  };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      system: [{ type: "text", text: ANALYSIS_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: JSON.stringify(payload) }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Claude ${res.status}: ${data?.error?.message ?? "error"}`);

  const text = String(data.content?.[0]?.text ?? "").trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("Claude no devolvió JSON");
  return JSON.parse(text.slice(start, end + 1));
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return jsonResponse({ error: "Método no permitido" }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY) return jsonResponse({ error: "Faltan vars de Supabase." }, 500);
  if (!ANTHROPIC_API_KEY) return jsonResponse({ error: "Falta ANTHROPIC_API_KEY." }, 500);

  // Auth: Bearer <CRON_SECRET> (lo manda pg_cron leyéndolo del Vault 'cron_secret'). Ver env vars.
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!CRON_SECRET || token !== CRON_SECRET) return jsonResponse({ error: "No autorizado" }, 401);

  let limit = DEFAULT_BATCH;
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.limit !== undefined) limit = Math.min(Math.max(1, Number(body.limit) || DEFAULT_BATCH), MAX_BATCH);
  } catch (_e) { /* body vacío: usamos el default */ }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Leads con web propia y sin analizar, los más antiguos primero.
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("has_website", true)
    .is("site_analyzed_at", null)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) return jsonResponse({ error: error.message }, 500);

  const leads = (data ?? []) as Record<string, unknown>[];
  const result = { scored: 0, skipped: 0, failed: 0, remaining_after: 0 };

  for (const lead of leads) {
    const url = resolveWebsite(lead as { website_url?: unknown; raw_json?: unknown });

    // has_website=true pero sin URL real (p. ej. solo Instagram): marcar analizado para no
    // re-escanearlo en cada corrida.
    if (!url) {
      await supabase
        .from("leads")
        .update({
          site_analyzed_at: new Date().toISOString(),
          site_analysis: { summary: "No se encontró una URL de web propia en los datos del lead." },
        })
        .eq("id", lead.id as string);
      result.skipped++;
      continue;
    }

    try {
      // Un solo fetch: el snippet para Claude + los flags de chat/WhatsApp del HTML crudo.
      const page = await fetchPageForAnalysis(url);
      const analysis = await analyzeOne(lead, url, page.snippet);
      if (page.signals) analysis._widgets = page.signals; // vendors visibles en la ficha
      const score = typeof analysis.score === "number" ? analysis.score : null;
      await supabase
        .from("leads")
        .update({
          site_score: score,
          site_analysis: analysis,
          site_analyzed_at: new Date().toISOString(),
          // null = no se pudo bajar la web (sin comprobar); true/false = comprobado.
          site_has_chat: page.signals ? page.signals.hasChat : null,
          site_has_whatsapp: page.signals ? page.signals.hasWhatsapp : null,
          site_has_bot: page.signals ? page.signals.hasBot : null,
        })
        .eq("id", lead.id as string);
      result.scored++;
    } catch (e) {
      // Error transitorio (Claude / red / timeout): NO marcamos analyzed_at → se reintenta luego.
      console.error(`score-sites: ${lead.name} → ${e instanceof Error ? e.message : e}`);
      result.failed++;
    }
  }

  // ¿Cuántos quedan por analizar tras esta corrida? (para saber si hace falta otra pasada)
  const { count } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("has_website", true)
    .is("site_analyzed_at", null);
  result.remaining_after = count ?? 0;

  return jsonResponse({ ok: true, ...result });
});
