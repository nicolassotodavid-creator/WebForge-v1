#!/usr/bin/env npx tsx
/**
 * add-photos.ts — Añade las fotos REALES del negocio a una web YA construida, sin recrear el proyecto.
 *
 * Por qué existe: si la curación por visión falla en el momento del build (la API no siempre puede
 * descargar las URLs de fotos de Google — 400 "Unable to download the file"), la web sale con el
 * manifiesto "no hay fotos" y se construye solo tipográfica, aunque el negocio tenga 16 fotos en su
 * ficha. Recrear el proyecto costaría créditos y una URL nueva; aquí se hace la edición IN-PLACE:
 * curación (ya con el plan B de re-hospedar y reintentar) → send_message al proyecto existente →
 * re-deploy con el MISMO slug (misma live_url) → captura re-hospedada.
 *
 * Uso:
 *   npx tsx orquestador/add-photos.ts --lead <id>
 *   npx tsx orquestador/add-photos.ts --lead <id> --dry-run   (cura fotos pero NO toca Lovable)
 */
import "./env.ts";
import { createClient } from "@supabase/supabase-js";
import { extractPhotoCandidates, curatePhotos, photoManifest } from "./photos.ts";
import { lovableUpdate } from "./lovable.ts";
import { rehostScreenshot } from "./preview.ts";

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const ONLY_LEAD = argValue("--lead");
const DRY_RUN = process.argv.includes("--dry-run");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en la raíz .env.");
  process.exit(1);
}
if (!ONLY_LEAD) {
  console.error("Falta --lead <id>.");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

/** Slug actual de la web publicada (subdominio sin .lovable.app) para re-publicar en la MISMA URL. */
function slugFromLiveUrl(liveUrl: string): string {
  const host = new URL(liveUrl).hostname;
  return host.replace(/\.lovable\.app$/i, "").replace(/^.*?-preview--/, "");
}

async function main() {
  const { data: lead } = await supabase.from("leads").select("*").eq("id", ONLY_LEAD).maybeSingle();
  if (!lead) throw new Error(`Lead ${ONLY_LEAD} no encontrado.`);
  const { data: site } = await supabase
    .from("sites").select("*").eq("lead_id", lead.id)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!site?.lovable_project_id || !site.live_url) {
    throw new Error("Este lead no tiene una web construida con projectId + live_url.");
  }
  console.log(`\n▶ ${lead.name} — ${site.live_url}${DRY_RUN ? " (DRY-RUN)" : ""}`);

  const candidates = extractPhotoCandidates(lead.raw_json);
  console.log(`  · candidatas en la ficha: ${candidates.length}`);
  const curated = await curatePhotos(supabase, lead.id, candidates, {
    name: lead.name, category: lead.category, city: lead.city,
  });
  const total = (curated.hero ? 1 : 0) + curated.gallery.length;
  if (total === 0) {
    console.log("  ✗ la curación no dejó ninguna foto publicable — la web se queda como está.");
    return;
  }
  console.log(`  · fotos curadas: hero=${curated.hero ? "sí" : "no"} · galería=${curated.gallery.length}`);

  const message = [
    "AÑADIR FOTOS REALES (el resto de la web NO se toca):",
    "Esta web se construyó sin fotos por un fallo al leerlas. Ahora sí las hay.",
    photoManifest(curated),
    "Integra la foto hero como fondo de la portada con un velo oscuro suficiente para que el titular",
    "y el subtítulo se lean en BLANCO con contraste (no pongas texto oscuro sobre la foto).",
    "Añade una sección de galería/instalaciones con EXACTAMENTE las fotos de la galería, en el lugar",
    "natural de la página (antes de las reseñas). NO cambies el copy, ni las secciones existentes, ni",
    "los CTAs, ni los enlaces de reserva. NO añadas fotos de stock.",
  ].join(" ");

  if (DRY_RUN) {
    console.log("\n----- MENSAJE DE EDICIÓN -----\n" + message + "\n------------------------------\n");
    return;
  }

  const slug = slugFromLiveUrl(site.live_url as string);
  console.log(`  · editando en Lovable y re-publicando en el mismo slug (${slug})…`);
  const res = await lovableUpdate(site.lovable_project_id as string, message, slug);

  const previewImageUrl = await rehostScreenshot(supabase, lead.id, res.screenshotUrl);
  const upd: Record<string, unknown> = { live_url: res.liveUrl };
  if (previewImageUrl) upd.preview_image_url = previewImageUrl;
  const { error } = await supabase.from("sites").update(upd).eq("id", site.id);
  if (error) throw new Error(`No se pudo actualizar 'sites': ${error.message}`);
  console.log(`  ✓ web actualizada con sus fotos: ${res.liveUrl}${res.isPreview ? " (preview)" : ""}`);
}

main().catch((e) => {
  console.error(`\n✗ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
