// WebForge — Orquestador (agente diario). Ver ARQUITECTURA_webforge_v2.md sec. 9.
// Corre por CRON en un VPS. NO es serverless corto: un build de Lovable tarda minutos.
//
// Flujo en DOS PASOS (gate de validación humana entre pasos):
//   PASO 1 — Brief: lee leads 'new' → Fable redacta brief → 'analyzed'
//             (El operador revisa el brief en el panel y pulsa "Construir web")
//   PASO 2 — Build: lee leads 'build_queued' → Fable redacta build-prompt → Lovable → 'site_built'
//             (Solo gasta créditos de Lovable cuando el operador lo ha aprobado)
// Las aprobaciones y el outreach (email / LinkedIn) son pasos POSTERIORES (tras el QA humano).
//
// Uso:
//   npm start                 -> Paso 1 (brief) para leads 'new' + Paso 2 (build) para 'build_queued'
//   npm start -- --lead <id>  -> procesa SOLO ese lead (para la prueba de la Fase 3)
//   npm run dry-run           -> brief + build-prompt SIN tocar Lovable ni escribir `sites` (no gasta créditos)

import "./env.ts"; // debe ir el PRIMERO: carga ../.env antes de evaluar el resto
import { createClient } from "@supabase/supabase-js";
import { BRIEF_PROMPT, BUILD_PROMPT } from "../supabase/functions/_shared/prompts.ts";
import { fableJson, fableText, extractReviews, FABLE_MODEL } from "./fable.ts";
import { lovableBuild } from "./lovable.ts";
import { sendFollowupEmail, getLiveUrl, supabase as supabaseFollowup } from "./followup-mailer.ts";

const BATCH = Number(process.env.BATCH_SIZE ?? 5);
const BOOKING_BASE = process.env.BOOKING_BASE ?? "";

// --- args ---
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const leadFlagIdx = args.indexOf("--lead");
const ONLY_LEAD = leadFlagIdx !== -1 ? args[leadFlagIdx + 1] : process.env.LEAD_ID;

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
  status: string;
}

interface Brief {
  business_summary?: string;
  tone?: string;
  value_props?: unknown;
  highlights_from_reviews?: unknown;
  recommended_sections?: unknown;
  services?: unknown;
  suggested_palette?: unknown;
  hero_copy?: string;
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en la raíz .env.");
  process.exit(1);
}
if (!DRY_RUN && !BOOKING_BASE) {
  console.error("Falta BOOKING_BASE en la raíz .env (URL base de /book).");
  process.exit(1);
}

// El Orquestador escribe con la SERVICE KEY (bypassa RLS). Nunca exponer esta clave en el frontend.
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// Payload compacto para Fable (solo datos reales, sin inventar nada).
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

// ─── PASO 1: Generar brief (barato — Haiku/Fable) ──────────────────────────────
// Lee leads 'new', genera el brief y los pasa a 'analyzed'.
// El operador revisa el brief en el panel y decide si encolar el build.
async function processBrief(lead: Lead): Promise<"ok" | "dry" | "failed"> {
  console.log(`\n▶ [BRIEF] ${lead.id} — ${lead.name} (${lead.city ?? "?"})`);

  const brief = await fableJson<Brief>(BRIEF_PROMPT, leadPayload(lead));
  console.log(`  · brief listo (${brief.business_summary?.slice(0, 60) ?? "—"}…)`);

  if (DRY_RUN) {
    console.log("  · DRY-RUN: brief generado pero no guardado.");
    console.log("  · Resumen:", brief.business_summary?.slice(0, 120));
    return "dry";
  }

  await supabase.from("briefs").insert({
    lead_id: lead.id,
    business_summary: brief.business_summary ?? null,
    tone: brief.tone ?? null,
    value_props: brief.value_props ?? null,
    highlights_from_reviews: brief.highlights_from_reviews ?? null,
    recommended_sections: brief.recommended_sections ?? null,
    services: brief.services ?? null,
    suggested_palette: brief.suggested_palette ?? null,
    hero_copy: brief.hero_copy ?? null,
    model_used: FABLE_MODEL,
  });
  await supabase.from("leads")
    .update({ status: "analyzed", updated_at: new Date().toISOString() })
    .eq("id", lead.id).in("status", ["new"]);

  console.log(`  ✓ brief guardado → lead 'analyzed' (pendiente de aprobación del operador)`);
  return "ok";
}

// ─── PASO 2: Construir web en Lovable (caro — gasta créditos) ──────────────────
// Solo se ejecuta cuando el operador ha aprobado el brief desde el panel
// y el lead está en 'build_queued'.
async function processBuild(lead: Lead): Promise<"ok" | "dry" | "failed"> {
  console.log(`\n▶ [BUILD] ${lead.id} — ${lead.name} (${lead.city ?? "?"})`);

  // Recuperar el brief guardado
  const { data: briefData } = await supabase
    .from("briefs")
    .select("*")
    .eq("lead_id", lead.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!briefData) {
    console.error(`  ✗ No se encontró brief para este lead. Regenera el brief primero.`);
    return "failed";
  }

  const brief = briefData as Brief;
  const bookingUrl = `${BOOKING_BASE.replace(/\/$/, "")}/${lead.id}`;
  const buildPrompt = await fableText(
    BUILD_PROMPT.replaceAll("{{BOOKING_URL}}", bookingUrl),
    { brief, business: leadPayload(lead) },
    2500,
  );
  console.log(`  · build-prompt listo (${buildPrompt.length} chars), reserva → ${bookingUrl}`);

  if (DRY_RUN) {
    console.log("  · DRY-RUN: no se construye en Lovable ni se escribe en `sites`.");
    console.log("\n----- BUILD-PROMPT -----\n" + buildPrompt + "\n------------------------\n");
    return "dry";
  }

  const description = `Web ${lead.name}`.slice(0, 80);
  const { data: site, error: siteErr } = await supabase.from("sites")
    .insert({ lead_id: lead.id, build_prompt: buildPrompt, status: "building" })
    .select().single();
  if (siteErr || !site) throw new Error(`No se pudo crear la fila en 'sites': ${siteErr?.message}`);

  try {
    console.log("  · construyendo en Lovable (puede tardar varios minutos)…");
    const { projectId, liveUrl } = await lovableBuild(buildPrompt, description);
    await supabase.from("sites").update({
      lovable_project_id: projectId,
      live_url: liveUrl,
      status: "built",
      built_at: new Date().toISOString(),
    }).eq("id", site.id);
    await supabase.from("leads")
      .update({ status: "site_built", updated_at: new Date().toISOString() })
      .eq("id", lead.id).in("status", ["build_queued"]);
    console.log(`  ✓ web publicada: ${liveUrl}`);
    return "ok";
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase.from("sites").update({ status: "failed", notes: msg.slice(0, 1000) }).eq("id", site.id);
    // Revertir a 'analyzed' para que el operador pueda reintentar desde el panel.
    await supabase.from("leads")
      .update({ status: "analyzed", updated_at: new Date().toISOString() })
      .eq("id", lead.id);
    console.error(`  ✗ build falló (revertido a 'analyzed'): ${msg}`);
    return "failed";
  }
}

// ─── PASO 3: Seguimientos automáticos (Email 2 día 4, Email 3 día 7 si no abrió Email 2) ───
// Corre en cada tick del cron. Los guards de idempotencia (email_number único por lead)
// garantizan que nunca se envíe el mismo email dos veces.
async function processFollowups(): Promise<void> {
  if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL) {
    console.log("── PASO 3: RESEND_API_KEY o FROM_EMAIL no configurados — seguimientos omitidos.");
    return;
  }

  const now = new Date();
  // Día 4 desde que el lead pasó a 'contacted'
  const day4Cutoff = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString();
  // Día 3 desde que se envió el Email 2 (= día 7 desde el contacto inicial)
  const day3Cutoff = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();

  let sent2 = 0;
  let sent3 = 0;

  // ── Email 2: leads en 'contacted' desde hace 4+ días ──────────────────────
  const { data: staleLeads, error: staleErr } = await supabaseFollowup
    .from("leads")
    .select("id, name, email, contact_name, has_website")
    .eq("status", "contacted")
    .lt("updated_at", day4Cutoff);

  if (staleErr) {
    console.error(`  ✗ [PASO 3] Error leyendo leads para Email 2: ${staleErr.message}`);
  } else {
    for (const lead of staleLeads ?? []) {
      if (!lead.email) continue;
      // Idempotencia: ¿ya tiene Email 2?
      const { data: existing } = await supabaseFollowup
        .from("outreach_messages")
        .select("id")
        .eq("lead_id", lead.id)
        .eq("email_number", 2)
        .maybeSingle();
      if (existing) continue;

      const liveUrl = await getLiveUrl(lead.id);
      if (!liveUrl) {
        console.log(`  · [PASO 3] Lead ${lead.id} sin live_url — Email 2 omitido.`);
        continue;
      }

      await sendFollowupEmail(lead, 2, liveUrl);
      sent2++;
    }
  }

  // ── Email 3: Email 2 enviado hace 3+ días SIN apertura ────────────────────
  // La lógica "no enviar si abrió" está aquí y también en generate-outreach como doble seguro.
  const { data: unOpenedEmail2, error: unopenedErr } = await supabaseFollowup
    .from("outreach_messages")
    .select("id, lead_id")
    .eq("email_number", 2)
    .eq("status", "sent")
    .lt("sent_at", day3Cutoff)
    .is("opened_at", null);

  if (unopenedErr) {
    console.error(`  ✗ [PASO 3] Error leyendo Email 2 para Email 3: ${unopenedErr.message}`);
  } else {
    for (const msg of unOpenedEmail2 ?? []) {
      // Idempotencia: ¿ya tiene Email 3?
      const { data: existing } = await supabaseFollowup
        .from("outreach_messages")
        .select("id")
        .eq("lead_id", msg.lead_id)
        .eq("email_number", 3)
        .maybeSingle();
      if (existing) continue;

      // Datos del lead
      const { data: lead } = await supabaseFollowup
        .from("leads")
        .select("id, name, email, contact_name, has_website")
        .eq("id", msg.lead_id)
        .maybeSingle();
      if (!lead?.email) continue;

      const liveUrl = await getLiveUrl(lead.id);
      if (!liveUrl) continue;

      await sendFollowupEmail(lead, 3, liveUrl);
      sent3++;
    }
  }

  console.log(`── PASO 3: Email 2 enviados: ${sent2} · Email 3 enviados: ${sent3}`);
}

async function selectLeadsByStatus(status: string): Promise<Lead[]> {
  const { data, error } = await supabase.from("leads").select("*").eq("status", status).limit(BATCH);
  if (error) throw new Error(error.message);
  return (data ?? []) as Lead[];
}

async function selectSingleLead(id: string): Promise<Lead[]> {
  console.log(`  · buscando lead id="${id}" (${id.length} chars)`);
  const { data, error } = await supabase.from("leads").select("*").eq("id", id).limit(1);
  if (error) throw new Error(error.message);
  return (data ?? []) as Lead[];
}

async function run() {
  console.log(`WebForge Orquestador — modelo ${FABLE_MODEL}${DRY_RUN ? " (DRY-RUN)" : ""}`);

  const tally = { ok: 0, dry: 0, failed: 0 };

  if (ONLY_LEAD) {
    // Modo prueba: procesa un lead concreto según su estado actual.
    const leads = await selectSingleLead(ONLY_LEAD.trim());
    if (leads.length === 0) {
      console.log(`No se encontró el lead ${ONLY_LEAD}.`);
      return;
    }
    const lead = leads[0];
    try {
      if (lead.status === "new" || lead.status === "analyzed") {
        // En modo prueba se puede forzar el build completo
        tally[await processBrief(lead)]++;
        if (!DRY_RUN && lead.status !== "analyzed") {
          // Si queremos forzar también el build, pasar manualmente a 'build_queued' antes
          console.log("  · Lead pasó a 'analyzed'. Para construir la web, apruébalo en el panel.");
        }
      } else if (lead.status === "build_queued") {
        tally[await processBuild(lead)]++;
      } else {
        console.log(`  · Lead en estado '${lead.status}' — sin acción para este estado.`);
      }
    } catch (e) {
      tally.failed++;
      console.error(`  ✗ error: ${e instanceof Error ? e.message : e}`);
    }
  } else {
    // Modo normal: dos pasadas independientes.

    // PASADA 1 — Briefs (leads 'new' → 'analyzed')
    const newLeads = await selectLeadsByStatus("new");
    if (newLeads.length > 0) {
      console.log(`\n── PASO 1: Generando briefs para ${newLeads.length} lead(s) nuevos ──`);
      for (const lead of newLeads) {
        try {
          tally[await processBrief(lead)]++;
        } catch (e) {
          tally.failed++;
          console.error(`  ✗ error brief ${lead.id}: ${e instanceof Error ? e.message : e}`);
        }
      }
    } else {
      console.log("── PASO 1: No hay leads nuevos para procesar.");
    }

    // PASADA 2 — Builds (leads 'build_queued' → 'site_built')
    const buildLeads = await selectLeadsByStatus("build_queued");
    if (buildLeads.length > 0) {
      console.log(`\n── PASO 2: Construyendo webs en Lovable para ${buildLeads.length} lead(s) ──`);
      for (const lead of buildLeads) {
        try {
          tally[await processBuild(lead)]++;
        } catch (e) {
          tally.failed++;
          console.error(`  ✗ error build ${lead.id}: ${e instanceof Error ? e.message : e}`);
        }
      }
    } else {
      console.log("── PASO 2: No hay leads encolados para construir.");
    }
  }

  // PASADA 3 — Seguimientos automáticos (Email 2 día 4, Email 3 día 7 si no abrió Email 2)
  // No aplica en dry-run ni en modo --lead (son pruebas puntuales, no el ciclo completo).
  if (!DRY_RUN && !ONLY_LEAD) {
    await processFollowups();
  }

  console.log(`\nResumen: ${tally.ok} ok · ${tally.dry} dry · ${tally.failed} fallidos.`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
