// analyze-site — analiza la web que el negocio YA tiene (la de raw_json) con Claude y la puntúa.
// Input: { lead_id }. Requiere que el lead tenga una URL de web propia en raw_json.
// Es el equivalente MANUAL del barrido diario del Orquestador (score-existing-sites.ts):
// ambos escriben en `leads.site_*` para que manual y automático coincidan.
// NO analiza la web que construimos nosotros (eso lo hace el Orquestador y vive en `sites`).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { ANALYSIS_PROMPT } from "../_shared/prompts.ts";
import { resolveWebsite } from "../_shared/website.ts";
import { fetchPageForAnalysis } from "../_shared/html.ts";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Método no permitido" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

  if (!SUPABASE_URL || !SERVICE_KEY) return jsonResponse({ error: "Faltan vars de Supabase." }, 500);
  if (!ANTHROPIC_API_KEY) return jsonResponse({ error: "Falta ANTHROPIC_API_KEY." }, 500);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Auth
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  let authorized = false;
  if (token) {
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data?.user) authorized = true;
  }
  if (!authorized) return jsonResponse({ error: "No autorizado" }, 401);

  let leadId: string;
  try {
    const body = await req.json();
    leadId = String(body?.lead_id ?? "").trim();
    if (!leadId) return jsonResponse({ error: "Falta lead_id." }, 400);
  } catch (_e) {
    return jsonResponse({ error: "Cuerpo no válido." }, 400);
  }

  // Cargar lead y sacar la URL de su web actual desde raw_json (mismo criterio que el panel).
  const { data: lead } = await supabase.from("leads").select("*").eq("id", leadId).maybeSingle();
  if (!lead) return jsonResponse({ error: "Lead no encontrado." }, 404);

  // Web real: la descubierta (website_url) tiene prioridad sobre la del scrape (raw_json),
  // que puede ser su Instagram. Así el análisis nunca apunta a una red social.
  const url = resolveWebsite(lead);
  if (!url) return jsonResponse({ error: "Este negocio no tiene una web propia para analizar." }, 409);

  // Un solo fetch: el snippet limpio para Claude + los flags de chat/WhatsApp del HTML crudo.
  // Si la página bloquea el scraping, seguimos solo con los metadatos del negocio (signals=null).
  const page = await fetchPageForAnalysis(url);

  const payload = {
    negocio: { nombre: lead.name, categoria: lead.category, ciudad: lead.city, valoracion: lead.rating, reseñas: lead.review_count },
    url,
    contenido_pagina: page.snippet || "(no disponible — la página bloquea el scraping)",
  };

  // Llamar a Claude
  let analysisText = "";
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
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
    if (!res.ok) return jsonResponse({ error: `Claude devolvió ${res.status}: ${data?.error?.message}` }, 502);
    analysisText = data.content?.[0]?.text ?? "";
  } catch (e) {
    return jsonResponse({ error: `Error llamando a Claude: ${e instanceof Error ? e.message : "error"}` }, 502);
  }

  // Parsear JSON de Claude
  let analysis: Record<string, unknown>;
  try {
    const t = analysisText.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    const start = t.indexOf("{"); const end = t.lastIndexOf("}");
    analysis = JSON.parse(t.slice(start, end + 1));
  } catch (_e) {
    return jsonResponse({ error: "Claude no devolvió JSON válido.", raw: analysisText.slice(0, 300) }, 422);
  }

  // Persistir en `leads` para que el score sea visible en el panel sin re-analizar
  // (best-effort: si falla la escritura, seguimos devolviendo el análisis al usuario).
  if (page.signals) analysis._widgets = page.signals; // vendors de chat visibles en la ficha
  const score = typeof analysis.score === "number" ? analysis.score : null;
  const { error: persistErr } = await supabase
    .from("leads")
    .update({
      site_score: score,
      site_analysis: analysis,
      site_analyzed_at: new Date().toISOString(),
      // null = no se pudo bajar la web (sin comprobar); true/false = comprobado.
      site_has_chat: page.signals ? page.signals.hasChat : null,
      site_has_whatsapp: page.signals ? page.signals.hasWhatsapp : null,
    })
    .eq("id", leadId);
  if (persistErr) console.error(`No se pudo guardar el análisis: ${persistErr.message}`);

  return jsonResponse({ ok: true, analysis, url });
});
