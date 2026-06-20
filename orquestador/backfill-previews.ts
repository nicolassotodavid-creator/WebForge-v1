#!/usr/bin/env npx tsx
/**
 * backfill-previews.ts — Rellena sites.preview_image_url en webs YA construidas.
 *
 * Las webs construidas antes de la migración 0004 no tienen captura re-hospedada, así que
 * /book les muestra el fallback. Este script recorre los `sites` con lovable_project_id pero
 * sin preview_image_url, consulta get_project en Lovable para sacar latest_screenshot_url,
 * la re-hospeda en Supabase Storage y guarda la URL pública.
 *
 * Uso:
 *   npm run backfill-previews             → re-hospeda y guarda
 *   npm run backfill-previews -- --dry-run → muestra qué haría, sin escribir
 *
 * Requiere .env con SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y el token de Lovable (LOVABLE_*).
 */

import "./env.ts"; // PRIMERO: carga ../.env
import { createClient } from "@supabase/supabase-js";
import { fetchProjectScreenshot } from "./lovable.ts";
import { rehostScreenshot } from "./preview.ts";

const DRY_RUN = process.argv.includes("--dry-run");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en la raíz .env.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

interface SiteRow {
  id: string;
  lead_id: string | null;
  lovable_project_id: string | null;
}

async function main() {
  console.log(`WebForge — backfill de previews${DRY_RUN ? " (DRY-RUN)" : ""}\n`);

  // Webs construidas (tienen project_id) pero sin captura re-hospedada todavía.
  const { data: sites, error } = await supabase
    .from("sites")
    .select("id, lead_id, lovable_project_id")
    .is("preview_image_url", null)
    .not("lovable_project_id", "is", null);

  if (error) { console.error("✗ Error leyendo `sites`:", error.message); process.exit(1); }
  if (!sites?.length) { console.log("No hay webs pendientes de captura. Nada que hacer. ✅"); return; }

  console.log(`${sites.length} web(s) sin preview_image_url.\n`);

  const tally = { ok: 0, skipped: 0, failed: 0 };

  for (const site of sites as SiteRow[]) {
    const label = `site ${site.id} (proj ${site.lovable_project_id})`;
    if (!site.lovable_project_id || !site.lead_id) { console.log(`  · ${label}: sin project_id/lead_id — saltado`); tally.skipped++; continue; }

    try {
      const screenshotUrl = await fetchProjectScreenshot(site.lovable_project_id);
      if (!screenshotUrl) {
        console.log(`  · ${label}: get_project no devolvió captura — saltado`);
        tally.skipped++;
        continue;
      }

      if (DRY_RUN) {
        console.log(`  · ${label}: re-hospedaría ${screenshotUrl}`);
        tally.ok++;
        continue;
      }

      const previewImageUrl = await rehostScreenshot(supabase, site.lead_id, screenshotUrl);
      if (!previewImageUrl) { console.log(`  · ${label}: re-hospedaje devolvió null — saltado`); tally.skipped++; continue; }

      const { error: upErr } = await supabase
        .from("sites")
        .update({ preview_image_url: previewImageUrl })
        .eq("id", site.id);
      if (upErr) { console.error(`  ✗ ${label}: no se pudo actualizar sites: ${upErr.message}`); tally.failed++; continue; }

      console.log(`  ✓ ${label}: preview_image_url guardada`);
      tally.ok++;
    } catch (e) {
      console.error(`  ✗ ${label}: ${e instanceof Error ? e.message : e}`);
      tally.failed++;
    }
  }

  console.log(`\nResumen: ${tally.ok} ok · ${tally.skipped} saltados · ${tally.failed} fallidos.`);
}

main().catch((e) => { console.error("✗", e); process.exit(1); });
