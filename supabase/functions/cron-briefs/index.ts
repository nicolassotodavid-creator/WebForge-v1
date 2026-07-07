// cron-briefs — Genera el brief de los leads 'new' sin depender del Mac.
// Es el PASO 1 del Orquestador (brief → 'analyzed') movido a la nube, como 0011 hizo con los
// seguimientos y 0012 con el scoring. Lo dispara GitHub Actions (.github/workflows/daily-brief.yml)
// con un curl autenticado con la service key; NO pg_cron (a diferencia de followups/scoring).
//
// El brief es LIGERO: solo Anthropic + Supabase. Las reseñas se piden después, en el build.
// Por eso puede vivir fuera del Mac. El build en Lovable (MCP) sigue en local.
//
// Auth: exige Authorization: Bearer <service_role_key> (idéntico a cron-followups / score-sites).
// Modelo: claude-sonnet-4-6 por defecto (regla del CLAUDE.md para briefs); override ORQUESTADOR_MODEL.
// Secrets SOLO en servidor.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { BRIEF_PROMPT } from "../_shared/prompts.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
// SERVICE_KEY: solo para el cliente de DB (bypass RLS). Supabase la inyecta y sirve para escribir.
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// CRON_SECRET: secreto DEDICADO de auth del cron (lo controlamos en los dos extremos: este entorno
// y quien invoca). NO usamos SUPABASE_SERVICE_ROLE_KEY para autenticar porque está DEPRECATED y su
// valor en runtime no es reproducible tras la migración de keys del proyecto (daba 401 siempre).
const CRON_SECRET = Deno.env.get("CRON_SECRET");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
// Solo el admin construye webs. Si está definido, el cron procesa SOLO sus leads (o sin dueño):
// los leads de usuarios Luvia no se analizan ni se les genera brief. Igual que run.ts.
const ADMIN_USER_ID = Deno.env.get("ADMIN_USER_ID");
// Sonnet 4.6 para briefs (calidad de la web). Override para abaratar a Haiku si hiciera falta.
const BRIEF_MODEL = Deno.env.get("ORQUESTADOR_MODEL") ?? "claude-sonnet-4-6";
// Leads por invocación. El workflow llama en bucle hasta drenar, así que un lote pequeño evita
// el timeout de la función aunque haya un backlog grande.
const BRIEF_BATCH = Number(Deno.env.get("BRIEF_BATCH") ?? 15);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

interface Lead {
  id: string;
  name: string;
  category?: string | null;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  rating?: number | null;
  review_count?: number | null;
  raw_json?: unknown;
}

// Saca un array de textos de reseña del raw_json del scraper (formato flexible). Idéntico a
// analyze-lead: el brief de prospección normalmente no trae reseñas, pero si las hay se usan.
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

// Payload compacto para el prompt (solo datos reales, sin inventar nada). Igual que run.ts/analyze-lead.
function leadPayload(lead: Lead) {
  return {
    name: lead.name,
    category: lead.category,
    city: lead.city,
    address: lead.address,
    phone: lead.phone,
    rating: lead.rating,
    review_count: lead.review_count,
    reviews: extractReviews(lead.raw_json),
  };
}

// Genera y guarda el brief de UN lead. Devuelve true si lo pasó a 'analyzed'.
async function briefLead(
  supabase: ReturnType<typeof createClient>,
  lead: Lead,
): Promise<boolean> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: BRIEF_MODEL,
      max_tokens: 2000,
      // Prompt caching en el system (el prompt es fijo entre leads).
      system: [{ type: "text", text: BRIEF_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: JSON.stringify(leadPayload(lead)) }],
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Claude ${res.status}: ${data?.error?.message ?? "error"}`);
  }

  const text = data.content?.[0]?.text ?? "";
  const brief = extractJson(text); // lanza si no es JSON válido

  const { error: insErr } = await supabase.from("briefs").insert({
    lead_id: lead.id,
    business_summary: brief.business_summary ?? null,
    tone: brief.tone ?? null,
    value_props: brief.value_props ?? null,
    highlights_from_reviews: brief.highlights_from_reviews ?? null,
    recommended_sections: brief.recommended_sections ?? null,
    services: brief.services ?? null,
    suggested_palette: brief.suggested_palette ?? null,
    hero_copy: brief.hero_copy ?? null,
    model_used: BRIEF_MODEL,
  });
  if (insErr) throw new Error(`insert brief: ${insErr.message}`);

  // Mover new -> analyzed (sin regresar leads más avanzados). Idempotente.
  const { error: updErr } = await supabase
    .from("leads")
    .update({ status: "analyzed", updated_at: new Date().toISOString() })
    .eq("id", lead.id)
    .eq("status", "new");
  if (updErr) throw new Error(`update lead: ${updErr.message}`);

  return true;
}

Deno.serve(async (req: Request) => {
  // Auth: Bearer <CRON_SECRET>. Lo manda el workflow de GitHub Actions (daily-brief.yml).
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!CRON_SECRET || token !== CRON_SECRET) return jsonResponse({ error: "No autorizado" }, 401);

  if (!ANTHROPIC_API_KEY) {
    return jsonResponse({ error: "Falta ANTHROPIC_API_KEY en los secrets de la función." }, 500);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Leads 'new' del cron/admin (nunca de usuarios Luvia). Mismo filtro que run.ts.
  let q = supabase
    .from("leads")
    .select("id, name, category, city, address, phone, rating, review_count, raw_json")
    .eq("status", "new")
    .limit(BRIEF_BATCH);
  if (ADMIN_USER_ID) q = q.or(`owner.eq.${ADMIN_USER_ID},owner.is.null`);

  const { data: leads, error } = await q;
  if (error) return jsonResponse({ error: error.message }, 500);

  let processed = 0;
  let failed = 0;
  const errors: string[] = [];
  for (const lead of (leads ?? []) as Lead[]) {
    try {
      await briefLead(supabase, lead);
      processed++;
      console.log(`[cron-briefs] brief OK → ${lead.name} (${lead.id})`);
    } catch (e) {
      // Un fallo de un lead no tumba el lote. El lead sigue en 'new' y se reintenta el próximo tick.
      failed++;
      const msg = e instanceof Error ? e.message : String(e);
      if (errors.length < 3) errors.push(msg.slice(0, 200)); // muestra para diagnóstico/monitorización
      console.error(`[cron-briefs] fallo en ${lead.id}: ${msg}`);
    }
  }

  console.log(`cron-briefs: processed=${processed} failed=${failed}`);
  return jsonResponse({ ok: true, processed, failed, ...(errors.length ? { errors } : {}) });
});
