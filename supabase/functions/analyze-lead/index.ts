// analyze-lead — Edge Function de PRUEBA para el brief (ARQUITECTURA_webforge_v2.md sec. 8 y 13, Fase 2).
// Input: { lead_id }. Lee el lead + reseñas, llama a Claude (Haiku 4.5) con BRIEF_PROMPT,
// parsea el JSON estricto (try/catch), lo guarda en `briefs` y pone el lead en status='analyzed'.
// En producción este mismo paso lo hace el Orquestador con el mismo prompt. Secrets SOLO en servidor.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { BRIEF_PROMPT } from "../_shared/prompts.ts";

// Haiku 4.5 para extracción a volumen (ver routing de modelos en la arquitectura).
const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Saca un array de textos de reseña del raw_json del scraper (formato flexible).
function extractReviews(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return [];
  const r = (raw as Record<string, unknown>).reviews;
  if (!Array.isArray(r)) return [];
  return r
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        return String(o.text ?? o.review ?? o.comment ?? o.snippet ?? "");
      }
      return "";
    })
    .filter((t) => t.trim().length > 0)
    .slice(0, 15);
}

// Claude debe devolver JSON puro, pero por si acaso quitamos vallas ```json y recortamos al objeto.
function extractJson(text: string): Record<string, unknown> {
  let t = text.trim();
  t = t.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("respuesta sin JSON");
  return JSON.parse(t.slice(start, end + 1));
}

/** Extrae la URL del website del raw_json de Apify/Outscraper. */
function getWebsiteUrl(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  for (const key of ["website", "url", "web", "site", "domain"]) {
    const v = o[key];
    if (typeof v === "string" && v.trim() && /^https?:\/\//i.test(v.trim())) {
      if (!/google\.|maps\.|facebook\.|instagram\./i.test(v)) return v.trim();
    }
  }
  return null;
}

/** Extrae emails de un texto HTML. Devuelve el primero que no sea imagen/archivo. */
function extractEmails(html: string): string[] {
  const found = html.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) ?? [];
  return [...new Set(found)].filter((e) =>
    !e.match(/\.(png|jpg|jpeg|gif|svg|webp|pdf|js|css)$/i) &&
    !e.startsWith("@") &&
    e.includes(".")
  );
}

/**
 * Intenta encontrar el email de contacto en la web del negocio.
 * Prueba la home + rutas de contacto habituales. Best-effort: si falla no bloquea.
 */
async function findEmailFromWebsite(websiteUrl: string): Promise<string | null> {
  const base = websiteUrl.replace(/\/$/, "");
  const paths = ["", "/contacto", "/contacta", "/contact", "/sobre-nosotros", "/quienes-somos"];
  for (const path of paths) {
    try {
      const res = await fetch(base + path, {
        signal: AbortSignal.timeout(5000),
        headers: { "User-Agent": "Mozilla/5.0 (compatible; WebForgeBot/1.0)" },
      });
      if (!res.ok) continue;
      const html = await res.text();
      const emails = extractEmails(html);
      // Preferir emails que no sean noreply/info genérico — pero si es lo único, sirve.
      const preferred = emails.find((e) => !e.startsWith("noreply") && !e.startsWith("no-reply"));
      if (preferred) return preferred;
      if (emails[0]) return emails[0];
    } catch {
      // Timeout o error de red — continuar con siguiente ruta.
    }
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Método no permitido" }, 405);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return jsonResponse(
      { error: "Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el entorno." },
      500,
    );
  }
  if (!ANTHROPIC_API_KEY) {
    return jsonResponse(
      {
        error:
          "Falta ANTHROPIC_API_KEY. Configúrala como secreto de la función: " +
          "npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...",
      },
      500,
    );
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // --- Autorización: sesión de operador (o secret del webhook) ---
  let authorized = false;
  const secret = Deno.env.get("INGEST_WEBHOOK_SECRET");
  const providedSecret = req.headers.get("x-ingest-secret");
  if (secret && providedSecret && providedSecret === secret) authorized = true;
  if (!authorized) {
    const token = (req.headers.get("Authorization") ?? "")
      .replace(/^Bearer\s+/i, "")
      .trim();
    if (token) {
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data?.user) authorized = true;
    }
  }
  if (!authorized) return jsonResponse({ error: "No autorizado" }, 401);

  // --- Input ---
  let leadId: string | undefined;
  try {
    const body = await req.json();
    leadId = body?.lead_id;
  } catch (_e) {
    return jsonResponse({ error: "Cuerpo no válido. Usa { lead_id }." }, 400);
  }
  if (!leadId) return jsonResponse({ error: "Falta lead_id." }, 400);

  // --- Lead ---
  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .maybeSingle();
  if (leadErr) return jsonResponse({ error: leadErr.message }, 500);
  if (!lead) return jsonResponse({ error: "Lead no encontrado." }, 404);

  // --- Buscar email en la web del negocio (best-effort, no bloquea si falla) ---
  if (!lead.email && lead.has_website) {
    const websiteUrl = getWebsiteUrl(lead.raw_json);
    if (websiteUrl) {
      try {
        // Buscar en home + páginas de contacto habituales, recopilar TODOS los emails
        const base = websiteUrl.replace(/\/$/, "");
        const paths = ["", "/contacto", "/contacta", "/contact", "/sobre-nosotros", "/quienes-somos"];
        const allEmails: string[] = [];
        for (const path of paths) {
          try {
            const res = await fetch(base + path, {
              signal: AbortSignal.timeout(5000),
              headers: { "User-Agent": "Mozilla/5.0 (compatible; WebForgeBot/1.0)" },
            });
            if (res.ok) {
              const html = await res.text();
              const found = extractEmails(html);
              for (const e of found) if (!allEmails.includes(e)) allEmails.push(e);
            }
          } catch { /* timeout / error red */ }
        }
        if (allEmails.length > 0) {
          // El primero va al campo email del lead; si hay varios, los guardamos todos en raw_json
          const primary = allEmails.find((e) => !e.startsWith("noreply") && !e.startsWith("no-reply")) ?? allEmails[0];
          const updatePayload: Record<string, unknown> = { email: primary };
          if (allEmails.length > 1) {
            // Guardar emails adicionales en raw_json.extra_emails para mostrarlos en el panel
            const raw = (lead.raw_json && typeof lead.raw_json === "object")
              ? { ...(lead.raw_json as Record<string, unknown>) }
              : {};
            raw.extra_emails = allEmails;
            updatePayload.raw_json = raw;
          }
          await supabase.from("leads").update(updatePayload).eq("id", leadId);
          lead.email = primary; // actualizar en memoria para el payload de Claude
        }
      } catch { /* no bloquear */ }
    }
  }

  // Payload compacto para el prompt (solo datos reales).
  const payload = {
    name: lead.name,
    category: lead.category,
    city: lead.city,
    address: lead.address,
    phone: lead.phone,
    rating: lead.rating,
    review_count: lead.review_count,
    reviews: extractReviews(lead.raw_json),
  };

  // --- Llamada a Claude (Anthropic Messages API), con prompt caching en el system ---
  let anthropicData: { content?: { text?: string }[]; error?: { message?: string } };
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 2000,
        system: [
          {
            type: "text",
            text: BRIEF_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          { role: "user", content: JSON.stringify(payload) },
        ],
      }),
    });
    anthropicData = await res.json();
    if (!res.ok) {
      return jsonResponse(
        { error: `Claude devolvió ${res.status}: ${anthropicData?.error?.message ?? "error"}` },
        502,
      );
    }
  } catch (e) {
    return jsonResponse(
      { error: `No se pudo contactar con Claude: ${e instanceof Error ? e.message : "error"}` },
      502,
    );
  }

  const text = anthropicData.content?.[0]?.text ?? "";
  let brief: Record<string, unknown>;
  try {
    brief = extractJson(text);
  } catch (_e) {
    return jsonResponse(
      { error: "Claude no devolvió un JSON válido.", raw: text.slice(0, 500) },
      422,
    );
  }

  // --- Guardar brief ---
  const briefRow = {
    lead_id: leadId,
    business_summary: brief.business_summary ?? null,
    tone: brief.tone ?? null,
    value_props: brief.value_props ?? null,
    highlights_from_reviews: brief.highlights_from_reviews ?? null,
    recommended_sections: brief.recommended_sections ?? null,
    services: brief.services ?? null,
    suggested_palette: brief.suggested_palette ?? null,
    hero_copy: brief.hero_copy ?? null,
    model_used: ANTHROPIC_MODEL,
  };
  const { data: inserted, error: insErr } = await supabase
    .from("briefs")
    .insert(briefRow)
    .select()
    .single();
  if (insErr) return jsonResponse({ error: `Guardando brief: ${insErr.message}` }, 500);

  // Mover new -> analyzed (sin regresar leads más avanzados).
  await supabase
    .from("leads")
    .update({ status: "analyzed", updated_at: new Date().toISOString() })
    .eq("id", leadId)
    .eq("status", "new");

  return jsonResponse({ ok: true, brief: inserted });
});
