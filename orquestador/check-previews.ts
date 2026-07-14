#!/usr/bin/env npx tsx
/**
 * check-previews.ts — ALARMA: detecta webs APROBADAS que se pueden contactar pero NO tienen
 * captura re-hospedada (sites.preview_image_url = null).
 *
 * Por qué existe: el 2026-07-14 se descubrió que 6 webs aprobadas del lote de energía del
 * 2026-07-08 (que se cortó por crédito de Anthropic + re-deploy por slug>45) se quedaron sin
 * `preview_image_url`. Efecto silencioso y feo: /book muestra el fallback y el email sale en
 * TEXTO PLANO sin el bloque showcase (captura enmarcada). Nadie se enteraba hasta mirar el email.
 * Ver docs/runbooks/preview-image-backfill.md.
 *
 * Este script NO arregla nada (solo lee). El arreglo es `npm run backfill-previews` (necesita
 * Lovable). Sirve para vigilar: si devuelve algo, hay webs aprobadas a medias.
 *
 * Uso:
 *   npm run check-previews          → lista las aprobadas sin captura; exit 1 si hay alguna
 *   npm run check-previews -- --json → salida JSON (para CI/alertas)
 *
 * Requiere .env (raíz) con SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY. NO usa Lovable.
 */
import "./env.ts";
import { createClient } from "@supabase/supabase-js";

const JSON_OUT = process.argv.includes("--json");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en la raíz .env.");
  process.exit(2);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

interface Row {
  id: string;
  lead_id: string | null;
  live_url: string | null;
  lovable_project_id: string | null;
  created_at: string;
  leads: { name: string | null } | null;
}

async function main() {
  // Web contactable = aprobada + con live_url. Si además le falta la captura → email a medias.
  const { data, error } = await supabase
    .from("sites")
    .select("id, lead_id, live_url, lovable_project_id, created_at, leads(name)")
    .eq("status", "approved")
    .not("live_url", "is", null)
    .is("preview_image_url", null)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("✗ Error leyendo `sites`:", error.message);
    process.exit(2);
  }

  const rows = (data ?? []) as unknown as Row[];

  if (JSON_OUT) {
    console.log(JSON.stringify({ count: rows.length, sites: rows }, null, 2));
    process.exit(rows.length === 0 ? 0 : 1);
  }

  if (rows.length === 0) {
    console.log("✅ Todas las webs aprobadas tienen su captura (preview_image_url). Nada que hacer.");
    process.exit(0);
  }

  console.log(`⚠️  ${rows.length} web(s) APROBADAS sin captura re-hospedada — email saldría en texto plano:\n`);
  for (const r of rows) {
    const name = r.leads?.name ?? "(sin nombre)";
    console.log(`  · ${name} — lead ${r.lead_id} — ${r.live_url}`);
  }
  console.log(`\nArréglalo con:  npm run backfill-previews`);
  console.log(`(dry-run:       npm run backfill-previews -- --dry-run)`);
  process.exit(1);
}

main().catch((e) => {
  console.error("✗ check-previews falló:", e?.message ?? e);
  process.exit(2);
});
