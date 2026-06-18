// analyze-site — analiza la web construida en Lovable con Claude y devuelve recomendaciones.
// Input: { lead_id }. Requiere que el lead tenga un site con live_url.
// Usa el brief + intenta traer el HTML de la página para dar feedback real.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const ANALYSIS_PROMPT = `Eres un experto en diseño web, copywriting y conversión para negocios locales.
Te paso los datos de un negocio, su brief de marketing y el HTML de su landing page (si está disponible).
Analiza la web y devuelve un JSON estricto con esta estructura:

{
  "score": <número 1-10 de calidad general>,
  "summary": "<resumen ejecutivo en 2-3 frases>",
  "strengths": ["<punto fuerte 1>", "<punto fuerte 2>", ...],
  "improvements": [
    { "area": "<área: Copy|CTA|Estructura|Social proof|SEO|Diseño>", "issue": "<problema concreto>", "fix": "<solución accionable>" },
    ...
  ]
}

Sé directo y específico. Máximo 3 fortalezas y 5 mejoras. Solo JSON, sin texto extra.`;

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

  // Cargar lead, brief y site
  const [{ data: lead }, { data: brief }, { data: site }] = await Promise.all([
    supabase.from("leads").select("*").eq("id", leadId).maybeSingle(),
    supabase.from("briefs").select("*").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("sites").select("live_url,status").eq("lead_id", leadId).not("live_url", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  if (!lead) return jsonResponse({ error: "Lead no encontrado." }, 404);
  if (!site?.live_url) return jsonResponse({ error: "Este lead aún no tiene web con URL en vivo." }, 409);

  // Intentar traer el HTML de la página
  let htmlSnippet = "";
  try {
    const pageRes = await fetch(site.live_url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; WebForge-Analyzer/1.0)" },
      signal: AbortSignal.timeout(10000),
    });
    if (pageRes.ok) {
      const html = await pageRes.text();
      // Extraer solo texto relevante (quitar scripts/styles, limitar a 4000 chars)
      const clean = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 4000);
      htmlSnippet = clean;
    }
  } catch (_e) {
    // Si no se puede traer la página, seguimos solo con el brief
  }

  const payload = {
    negocio: { nombre: lead.name, categoria: lead.category, ciudad: lead.city, valoracion: lead.rating, reseñas: lead.review_count },
    brief: brief ? {
      resumen: brief.business_summary,
      tono: brief.tone,
      propuestas_valor: brief.value_props,
      hero_copy: brief.hero_copy,
      servicios: brief.services,
    } : null,
    live_url: site.live_url,
    contenido_pagina: htmlSnippet || "(no disponible — la página bloquea el scraping)",
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
    let t = analysisText.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    const start = t.indexOf("{"); const end = t.lastIndexOf("}");
    analysis = JSON.parse(t.slice(start, end + 1));
  } catch (_e) {
    return jsonResponse({ error: "Claude no devolvió JSON válido.", raw: analysisText.slice(0, 300) }, 422);
  }

  return jsonResponse({ ok: true, analysis, live_url: site.live_url });
});
