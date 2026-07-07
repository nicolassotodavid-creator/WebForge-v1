// WebForge — Orquestador (agente diario). Ver ARQUITECTURA_webforge_v2.md sec. 9.
// Corre por CRON en un VPS. NO es serverless corto: un build de Lovable tarda minutos.
//
// Flujo en DOS PASOS (gate de validación humana entre pasos):
//   PASO 1 — Brief: lee leads 'new' → el modelo redacta brief → 'analyzed'
//             (El operador revisa el brief en el panel y pulsa "Construir web")
//   PASO 2 — Build: lee leads 'build_queued' → el modelo redacta build-prompt → Lovable → 'site_built'
//             (Solo gasta créditos de Lovable cuando el operador lo ha aprobado)
// Las aprobaciones y el outreach (email / LinkedIn) son pasos POSTERIORES (tras el QA humano).
//
// Uso:
//   npm start                 -> Paso 1 (brief) para leads 'new' + Paso 2 (build) para 'build_queued'
//   npm start -- --lead <id>  -> procesa SOLO ese lead (para la prueba de la Fase 3)
//   npm run dry-run           -> brief + build-prompt SIN tocar Lovable ni escribir `sites` (no gasta créditos)

import "./env.ts"; // debe ir el PRIMERO: carga ../.env antes de evaluar el resto
import { createClient } from "@supabase/supabase-js";
import { BRIEF_PROMPT, BUILD_PROMPT, REVIEW_HIGHLIGHTS_PROMPT, DESIGN_SYSTEM } from "../supabase/functions/_shared/prompts.ts";
import { llmJson, llmText, extractReviews, ORQUESTADOR_MODEL } from "./llm.ts";
import { fetchReviewsForPlace, placeIdFromLead, fetchPhotosForPlace } from "./reviews.ts";
import { extractPhotoCandidates, curatePhotos, photoManifest } from "./photos.ts";
import { lovableBuild } from "./lovable.ts";
import { analyzeSite } from "./analyze.ts";
import { scoreExistingSites } from "./score-existing-sites.ts";
import { rehostScreenshot } from "./preview.ts";
import { sendFollowupEmail, getLiveUrl, supabase as supabaseFollowup } from "./followup-mailer.ts";
import { runPool } from "./pool.ts";

const BATCH = Number(process.env.BATCH_SIZE ?? 5);
const BOOKING_BASE = process.env.BOOKING_BASE ?? "";
// Solo el admin construye webs. Si está definido, el cron procesa SOLO sus leads (o sin dueño):
// los leads de otros usuarios (Luvia) no se analizan ni se les genera brief.
const ADMIN_USER_ID = process.env.ADMIN_USER_ID;
// Un build se considera abandonado pasado este tiempo: permite re-reclamar el lead si el
// proceso anterior murió a mitad. > BUILD_DEADLINE_MS de lovable.ts (15 min).
const BUILD_LOCK_STALE_MS = Number(process.env.BUILD_LOCK_STALE_MS ?? 20 * 60 * 1000);
// Cuántos builds/briefs se procesan EN PARALELO dentro de un mismo run. Antes era 1 (serie):
// la cola se molía de una en una y N builds de ~4 min tardaban N×4 min. Como cada lead crea su
// propio proyecto Lovable (con lock atómico anti-doble-build en processBuild), un pool baja el
// wall-clock a ≈(N/concurrencia)×build. Conservador por los rate limits de Lovable: si se queja,
// bájalo a 2 con BUILD_CONCURRENCY en .env.
const BUILD_CONCURRENCY = Math.max(1, Number(process.env.BUILD_CONCURRENCY ?? 3));

// Resultado de procesar un lead. 'skip' = no se hizo nada (ya reclamado por otro proceso).
type Outcome = "ok" | "dry" | "failed" | "skip";

// --- args ---
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
// --builds-only: SOLO ejecuta PASO 2 (construir leads 'build_queued'). Lo usa el cron
// frecuente (cada minuto) para que un build aprobado arranque en <1 min. Scoring, briefs y
// seguimientos NO se tocan aquí: siguen en el run diario completo de las 08:00.
const BUILDS_ONLY = args.includes("--builds-only");
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
  google_place_id?: string | null;
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

// Payload compacto para el modelo (solo datos reales, sin inventar nada).
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

// ─── PASO 1: Generar brief (barato — Sonnet/Haiku) ─────────────────────────────
// Lee leads 'new', genera el brief y los pasa a 'analyzed'.
// El operador revisa el brief en el panel y decide si encolar el build.
async function processBrief(lead: Lead): Promise<Outcome> {
  console.log(`\n▶ [BRIEF] ${lead.id} — ${lead.name} (${lead.city ?? "?"})`);

  const brief = await llmJson<Brief>(BRIEF_PROMPT, leadPayload(lead));
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
    model_used: ORQUESTADOR_MODEL,
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
async function processBuild(lead: Lead): Promise<Outcome> {
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

  // ── Pasada 2 de reseñas ───────────────────────────────────────────────────────────────────────
  // El scrape de prospección ya NO trae reseñas (cuestan por reseña en el actor y solo se usan al
  // construir la web). Las traemos AQUÍ, una sola vez y solo para este negocio aprobado.
  // Idempotente: si el lead ya tiene reseñas (scrape antiguo o build reintentado) NO se re-paga.
  if (!DRY_RUN && extractReviews(lead.raw_json).length === 0) {
    const placeId = placeIdFromLead(lead);
    if (!placeId) {
      console.log("  · sin placeId (ChIJ…): no se pueden traer reseñas; la web se construye sin carrusel.");
    } else {
      try {
        const fetched = await fetchReviewsForPlace(placeId, { maxReviews: 15, language: "es" });
        if (fetched.length > 0) {
          const raw = { ...((lead.raw_json ?? {}) as Record<string, unknown>), reviews: fetched };
          lead.raw_json = raw;
          await supabase.from("leads")
            .update({ raw_json: raw, updated_at: new Date().toISOString() })
            .eq("id", lead.id);
          console.log(`  · reseñas traídas para el carrusel: ${fetched.length}`);

          // Refrescar highlights_from_reviews del brief: el Email 1 en frío CITA una reseña real
          // desde ahí (generate-outreach), y el brief de prospección se generó sin reseñas.
          const hasHighlights = Array.isArray(brief.highlights_from_reviews) &&
            brief.highlights_from_reviews.length > 0;
          if (!hasHighlights) {
            try {
              const hl = await llmJson<{ highlights_from_reviews?: string[] }>(
                REVIEW_HIGHLIGHTS_PROMPT,
                { reviews: extractReviews(raw) },
              );
              if (hl.highlights_from_reviews?.length) {
                brief.highlights_from_reviews = hl.highlights_from_reviews;
                await supabase.from("briefs")
                  .update({ highlights_from_reviews: hl.highlights_from_reviews })
                  .eq("id", (briefData as { id: string }).id);
                console.log(`  · highlights_from_reviews refrescados (${hl.highlights_from_reviews.length}) para el outreach.`);
              }
            } catch (e) {
              console.error(`  · no se pudieron refrescar highlights (no crítico): ${e instanceof Error ? e.message : e}`);
            }
          }
        } else {
          console.log("  · el actor no devolvió reseñas (el negocio puede no tener).");
        }
      } catch (e) {
        console.error(`  · no se pudieron traer reseñas (no crítico, sigue el build): ${e instanceof Error ? e.message : e}`);
      }
    }
  }

  // ── Pasada 2 de FOTOS (idempotente, molde de las reseñas) ───────────────────────────────────────
  // Solo el lead aprobado paga el detalle de su ficha. Si ya tiene galería suficiente, no se re-paga.
  if (!DRY_RUN && extractPhotoCandidates(lead.raw_json).length < 3) {
    const photoPlaceId = placeIdFromLead(lead);
    if (photoPlaceId) {
      try {
        const fetchedPhotos = await fetchPhotosForPlace(photoPlaceId, { maxImages: 10 });
        if (fetchedPhotos.length > 0) {
          const raw = { ...((lead.raw_json ?? {}) as Record<string, unknown>), imageUrls: fetchedPhotos };
          lead.raw_json = raw;
          await supabase.from("leads")
            .update({ raw_json: raw, updated_at: new Date().toISOString() })
            .eq("id", lead.id);
          console.log(`  · fotos traídas para la galería: ${fetchedPhotos.length}`);
        }
      } catch (e) {
        console.error(`  · no se pudieron traer fotos (no crítico, sigue el build): ${e instanceof Error ? e.message : e}`);
      }
    } else {
      console.log("  · sin placeId: no se pueden traer fotos; la web se construye sin galería.");
    }
  }

  // ── Curación por visión (Haiku): solo ganadoras, re-hospedadas. Fallback: sin fotos ────────────
  const curated = DRY_RUN
    ? { hero: null, gallery: [] as string[] }
    : await curatePhotos(supabase, lead.id, extractPhotoCandidates(lead.raw_json), {
        name: lead.name,
        category: lead.category ?? null,
        city: lead.city ?? null,
      });

  const bookingUrl = `${BOOKING_BASE.replace(/\/$/, "")}/${lead.id}`;
  const variablePrompt = await llmText(
    BUILD_PROMPT.replaceAll("{{BOOKING_URL}}", bookingUrl),
    { brief, business: leadPayload(lead), photos: { hero: curated.hero != null, gallery: curated.gallery.length } },
    2800, // tope holgado: transcribir 6-8 reseñas reales (autor + estrellas + texto) + resto de secciones sin truncar el CTA/badge del final
  );
  // Prompt final a Lovable = parte variable (Sonnet) + manifiesto de fotos + design-system invariante.
  const buildPrompt = `${variablePrompt}\n\n${photoManifest(curated)}\n\n${DESIGN_SYSTEM}`;
  console.log(`  · build-prompt listo (${buildPrompt.length} chars; fotos: hero=${curated.hero != null}, galería=${curated.gallery.length}), reserva → ${bookingUrl}`);

  if (DRY_RUN) {
    console.log("  · DRY-RUN: no se construye en Lovable ni se escribe en `sites`.");
    console.log("\n----- BUILD-PROMPT -----\n" + buildPrompt + "\n------------------------\n");
    return "dry";
  }

  // --- Claim atómico (#2): evita que dos ticks del cron solapados construyan el mismo lead
  //     (= doble gasto de créditos Lovable). El UPDATE condicional sobre build_lock_at sólo
  //     afecta filas si el lock está libre o caducado; en una carrera, exactamente un proceso
  //     gana (Postgres serializa los UPDATE sobre la misma fila). ---
  const nowIso = new Date().toISOString();
  const staleIso = new Date(Date.now() - BUILD_LOCK_STALE_MS).toISOString();
  const { data: claimed, error: claimErr } = await supabase.from("leads")
    .update({ build_lock_at: nowIso })
    .eq("id", lead.id)
    .eq("status", "build_queued")
    .or(`build_lock_at.is.null,build_lock_at.lt.${staleIso}`)
    .select("id");
  if (claimErr) throw new Error(`No se pudo reclamar el lead para build: ${claimErr.message}`);
  if (!claimed || claimed.length === 0) {
    console.log("  · lead ya en construcción por otro proceso (lock activo) — saltando.");
    return "skip";
  }

  // --- Reanudar build huérfano (#3): si un intento previo creó el proyecto en Lovable pero
  //     falló DESPUÉS (deploy/red), reutilizamos ESE proyecto en vez de crear otro (créditos).
  //     Reusamos también su fila en `sites`. ---
  const { data: resumable } = await supabase.from("sites")
    .select("id, lovable_project_id")
    .eq("lead_id", lead.id)
    .not("lovable_project_id", "is", null)
    .in("status", ["building", "failed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let siteId: string;
  let resumeProjectId: string | undefined;
  if (resumable?.lovable_project_id) {
    siteId = resumable.id as string;
    resumeProjectId = resumable.lovable_project_id as string;
    await supabase.from("sites")
      .update({ status: "building", build_prompt: buildPrompt, notes: null })
      .eq("id", siteId);
    console.log(`  · reanudando sobre proyecto Lovable existente (${resumeProjectId})`);
  } else {
    const { data: site, error: siteErr } = await supabase.from("sites")
      .insert({ lead_id: lead.id, build_prompt: buildPrompt, status: "building" })
      .select().single();
    if (siteErr || !site) throw new Error(`No se pudo crear la fila en 'sites': ${siteErr?.message}`);
    siteId = site.id as string;
  }

  try {
    console.log("  · construyendo en Lovable (puede tardar varios minutos)…");
    const description = `Web ${lead.name}`.slice(0, 80);
    const { projectId, liveUrl, isPreview, screenshotUrl } = await lovableBuild(buildPrompt, description, {
      slugSuffix: lead.id.slice(0, 6),
      resumeProjectId,
      // Persistir el projectId EN CUANTO existe: si un fallo posterior aborta, el próximo
      // intento reanuda en vez de recrear (no se duplica el gasto de créditos).
      onProjectCreated: async (pid) => {
        await supabase.from("sites").update({ lovable_project_id: pid }).eq("id", siteId);
      },
    });
    const previewImageUrl = await rehostScreenshot(supabase, lead.id, screenshotUrl);
    await supabase.from("sites").update({
      lovable_project_id: projectId,
      live_url: liveUrl,
      preview_image_url: previewImageUrl,
      status: "built",
      built_at: new Date().toISOString(),
      notes: isPreview ? "URL de preview (no publicada) — re-deploy pendiente" : null,
    }).eq("id", siteId);
    await supabase.from("leads")
      .update({ status: "site_built", build_lock_at: null, updated_at: new Date().toISOString() })
      .eq("id", lead.id).in("status", ["build_queued"]);
    console.log(`  ✓ web publicada: ${liveUrl}`);

    // Scoring automático de la web (Haiku, ~medio céntimo). Best-effort: si falla,
    // la web ya está publicada — solo nos quedamos sin score, no revertimos nada.
    try {
      const analysis = await analyzeSite({ lead, brief, liveUrl });
      await supabase.from("sites").update({
        score: typeof analysis.score === "number" ? analysis.score : null,
        analysis,
        analyzed_at: new Date().toISOString(),
      }).eq("id", siteId);
      console.log(`  · scoring: ${analysis.score}/10 — ${analysis.summary?.slice(0, 80) ?? ""}`);
    } catch (e) {
      console.error(`  · scoring falló (no crítico): ${e instanceof Error ? e.message : e}`);
    }

    return "ok";
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase.from("sites").update({ status: "failed", notes: msg.slice(0, 1000) }).eq("id", siteId);
    // Revertir a 'analyzed' SOLO si el lead sigue en 'build_queued' (#4): no pisar una acción
    // del operador hecha durante el build. Liberamos el lock para permitir el reintento.
    await supabase.from("leads")
      .update({ status: "analyzed", build_lock_at: null, updated_at: new Date().toISOString() })
      .eq("id", lead.id).in("status", ["build_queued"]);
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
  let q = supabase.from("leads").select("*").eq("status", status).limit(BATCH);
  if (ADMIN_USER_ID) q = q.or(`owner.eq.${ADMIN_USER_ID},owner.is.null`);
  const { data, error } = await q;
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
  console.log(`WebForge Orquestador — modelo ${ORQUESTADOR_MODEL}${DRY_RUN ? " (DRY-RUN)" : ""}`);

  const tally: Record<Outcome, number> = { ok: 0, dry: 0, failed: 0, skip: 0 };

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

    // PASO 0 — Scoring de la web ACTUAL de cada negocio (señal de prospección, se ve en el panel).
    if (BUILDS_ONLY) {
      // Tick build-only (cron frecuente): sin scoring; solo construimos lo que ya está en cola.
    } else if (DRY_RUN) {
      console.log("\n── PASO 0: DRY-RUN — no se puntúan webs actuales (gasta tokens y escribe en leads).");
    } else {
      try {
        const { scored, skipped, failed } = await scoreExistingSites(supabase, ADMIN_USER_ID);
        console.log(`\n── PASO 0: webs actuales puntuadas: ${scored} · sin URL: ${skipped} · fallidas: ${failed}`);
      } catch (e) {
        console.error(`── PASO 0: barrido de scoring falló: ${e instanceof Error ? e.message : e}`);
      }
    }

    // PASADA 1 — Briefs (leads 'new' → 'analyzed'). En modo build-only se omite.
    const newLeads = BUILDS_ONLY ? [] : await selectLeadsByStatus("new");
    if (newLeads.length > 0) {
      console.log(`\n── PASO 1: Generando briefs para ${newLeads.length} lead(s) nuevos · concurrencia ${BUILD_CONCURRENCY} ──`);
      await runPool(newLeads, BUILD_CONCURRENCY, async (lead) => {
        try {
          tally[await processBrief(lead)]++;
        } catch (e) {
          tally.failed++;
          console.error(`  ✗ error brief ${lead.id}: ${e instanceof Error ? e.message : e}`);
        }
      });
    } else {
      console.log("── PASO 1: No hay leads nuevos para procesar.");
    }

    // PASADA 2 — Builds (leads 'build_queued' → 'site_built')
    const buildLeads = await selectLeadsByStatus("build_queued");
    if (buildLeads.length > 0) {
      console.log(`\n── PASO 2: Construyendo webs en Lovable para ${buildLeads.length} lead(s) · concurrencia ${BUILD_CONCURRENCY} ──`);
      await runPool(buildLeads, BUILD_CONCURRENCY, async (lead) => {
        try {
          tally[await processBuild(lead)]++;
        } catch (e) {
          tally.failed++;
          console.error(`  ✗ error build ${lead.id}: ${e instanceof Error ? e.message : e}`);
        }
      });
    } else {
      console.log("── PASO 2: No hay leads encolados para construir.");
    }
  }

  // PASADA 3 — Seguimientos automáticos (Email 2 día 4, Email 3 día 7 si no abrió Email 2)
  // No aplica en dry-run ni en modo --lead (son pruebas puntuales, no el ciclo completo).
  if (!DRY_RUN && !ONLY_LEAD && !BUILDS_ONLY) {
    await processFollowups();
  }

  console.log(`\nResumen: ${tally.ok} ok · ${tally.dry} dry · ${tally.skip} saltados · ${tally.failed} fallidos.`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
