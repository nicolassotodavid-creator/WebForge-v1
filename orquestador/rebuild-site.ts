// rebuild-site.ts — Reconstruye EN SITIO la web de un lead ya construido: mismo proyecto Lovable y misma
// live_url, con el build-prompt actual (fotos curadas + marca real + sistema de diseño).
//
// Para qué: arreglar webs que salieron mal sin crear proyectos nuevos ni cambiar el enlace. Caso que lo
// motivó: lote de talleres del 13-sep — Lovable dejó la plantilla en blanco (plan sin aprobar) y además
// las webs no llevaban el logo ni los colores del negocio.
//
// NO toca el estado del lead ni envía nada: la web vuelve a 'built' y sigue pendiente del visto bueno.
// Cada reconstrucción consume créditos del agente de Lovable.
//
// Uso:
//   npx tsx rebuild-site.ts --lead <id> [--lead <id> …]
//   npx tsx rebuild-site.ts --lead <id> --dry-run     (solo imprime el prompt; sin Lovable, sin marca)

import "./env.ts"; // PRIMERO: carga ../.env
import { createClient } from "@supabase/supabase-js";
import { composeBuildPrompt, type BuildLead } from "./compose-build.ts";
import { lovableUpdate } from "./lovable.ts";
import { rehostScreenshot } from "./preview.ts";
import { analyzeSite } from "./analyze.ts";
import { runPool } from "./pool.ts";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const LEAD_IDS = args.flatMap((a, i) => (a === "--lead" && args[i + 1] ? [args[i + 1]] : []));
const CONCURRENCY = Math.max(1, Number(process.env.BUILD_CONCURRENCY ?? 3));
const BOOKING_BASE = process.env.BOOKING_BASE ?? "";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY || !BOOKING_BASE) {
  console.error("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / BOOKING_BASE en la raíz .env.");
  process.exit(1);
}
if (LEAD_IDS.length === 0) {
  console.error("Uso: npx tsx rebuild-site.ts --lead <id> [--lead <id> …] [--dry-run]");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const REBUILD_INTRO =
  "RECONSTRUYE LA WEB COMPLETA desde cero con este encargo. Sustituye todo lo que haya ahora en la página " +
  "(no conserves diseño, textos, logo ni colores anteriores). Construye directamente, sin modo plan ni pedir aprobación.\n\n";

async function rebuild(leadId: string): Promise<boolean> {
  const { data: lead } = await supabase.from("leads").select("*").eq("id", leadId).maybeSingle();
  if (!lead) { console.error(`✗ ${leadId}: lead no encontrado`); return false; }
  const { data: brief } = await supabase.from("briefs").select("*").eq("lead_id", leadId)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!brief) { console.error(`✗ ${lead.name}: sin brief`); return false; }
  const { data: site } = await supabase.from("sites").select("id, lovable_project_id, live_url, status")
    .eq("lead_id", leadId).not("lovable_project_id", "is", null).not("live_url", "is", null)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!site?.lovable_project_id || !site.live_url) { console.error(`✗ ${lead.name}: sin web construida que reconstruir`); return false; }

  console.log(`\n▶ [REBUILD] ${lead.name} — ${site.live_url}`);
  const bookingUrl = `${BOOKING_BASE.replace(/\/$/, "")}/${lead.id}`;
  const { buildPrompt, brand } = await composeBuildPrompt(supabase, lead as BuildLead, brief, bookingUrl, DRY_RUN);
  if (DRY_RUN) {
    console.log("\n----- BUILD-PROMPT -----\n" + buildPrompt + "\n------------------------\n");
    return true;
  }

  try {
    // Mismo slug → misma URL pública (la que ya está en el panel y, si lo hubiera, en los emails).
    const slug = new URL(site.live_url).hostname.replace(/\.lovable\.app$/, "");
    const { liveUrl, screenshotUrl } = await lovableUpdate(site.lovable_project_id, REBUILD_INTRO + buildPrompt, slug);
    const previewImageUrl = await rehostScreenshot(supabase, lead.id, screenshotUrl);
    await supabase.from("sites").update({
      build_prompt: buildPrompt,
      live_url: liveUrl,
      preview_image_url: previewImageUrl,
      status: site.status === "approved" ? "built" : site.status, // cambió la web: requiere visto bueno otra vez
      built_at: new Date().toISOString(),
      notes: null,
    }).eq("id", site.id);
    console.log(`  ✓ reconstruida${brand?.logoUrl ? " con su logo" : ""}: ${liveUrl}`);

    try {
      const analysis = await analyzeSite({ lead, brief, liveUrl });
      await supabase.from("sites").update({
        score: typeof analysis.score === "number" ? analysis.score : null,
        analysis,
        analyzed_at: new Date().toISOString(),
      }).eq("id", site.id);
      console.log(`  · scoring: ${analysis.score}/10`);
    } catch (e) {
      console.error(`  · scoring falló (no crítico): ${e instanceof Error ? e.message : e}`);
    }
    return true;
  } catch (e) {
    console.error(`  ✗ ${lead.name}: ${e instanceof Error ? e.message : e}`);
    return false;
  }
}

let ok = 0;
let failed = 0;
await runPool(LEAD_IDS, CONCURRENCY, async (id) => {
  if (await rebuild(id)) ok++; else failed++;
});
console.log(`\nResumen: ${ok} reconstruidas · ${failed} fallidas.`);
