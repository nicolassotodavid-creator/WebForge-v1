#!/usr/bin/env npx tsx
/**
 * check-yuricar.ts — Verifica y (opcionalmente) corrige la live_url del lead YuriCar.
 *
 * Uso:
 *   npx tsx orquestador/check-yuricar.ts          → solo muestra el estado actual
 *   npx tsx orquestador/check-yuricar.ts --fix    → corrige si la URL es del editor
 *
 * Requiere .env con SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
 */

import "./env.ts";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL  = process.env.SUPABASE_URL ?? "";
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const FIX_MODE      = process.argv.includes("--fix");

// URL pública conocida del proyecto YuriCar (la que está hardcodeada en el preview de Book.tsx)
const YURICAR_KNOWN_URL = "https://yuricars-landing-joy.lovable.app";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

function isEditorUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      (u.hostname === "lovable.dev" || u.hostname.endsWith(".lovable.dev")) &&
      u.pathname.startsWith("/projects/")
    );
  } catch {
    return false;
  }
}

function isPublicLovableUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".lovable.app");
  } catch {
    return false;
  }
}

async function main() {
  console.log("🔍 Buscando lead YuriCar en Supabase...\n");

  // Buscar el lead por nombre (case-insensitive)
  const { data: leads, error: leadErr } = await supabase
    .from("leads")
    .select("id, name, status, city")
    .ilike("name", "%yuricar%");

  if (leadErr) { console.error("❌ Error buscando lead:", leadErr.message); process.exit(1); }
  if (!leads?.length) { console.warn("⚠  No se encontró ningún lead con nombre 'yuricar'."); process.exit(0); }

  for (const lead of leads) {
    console.log(`Lead encontrado:`);
    console.log(`  id:     ${lead.id}`);
    console.log(`  nombre: ${lead.name}`);
    console.log(`  ciudad: ${lead.city}`);
    console.log(`  status: ${lead.status}`);

    // Buscar el site asociado
    const { data: sites, error: siteErr } = await supabase
      .from("sites")
      .select("id, live_url, created_at")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false });

    if (siteErr) { console.error("❌ Error buscando site:", siteErr.message); continue; }
    if (!sites?.length) { console.log("  ⚠  Sin sites asociados en tabla `sites`.\n"); continue; }

    for (const site of sites) {
      const url = site.live_url ?? "(null)";
      console.log(`\n  Site id: ${site.id}`);
      console.log(`  created: ${site.created_at}`);
      console.log(`  live_url actual: ${url}`);

      if (!site.live_url) {
        console.log("  Estado: ❌ live_url es NULL");
        if (FIX_MODE) await patchSite(site.id, YURICAR_KNOWN_URL, "yuricar_known_url");
        continue;
      }

      if (isEditorUrl(site.live_url)) {
        console.log("  Estado: ❌ live_url es una URL del EDITOR de Lovable (lovable.dev/projects/...)");
        if (FIX_MODE) await patchSite(site.id, YURICAR_KNOWN_URL, "yuricar_known_url");
        else console.log(`  → Ejecuta con --fix para corregirla a: ${YURICAR_KNOWN_URL}`);
        continue;
      }

      if (isPublicLovableUrl(site.live_url)) {
        console.log("  Estado: ✅ live_url es una URL pública de Lovable (*.lovable.app). Correcto.");
        continue;
      }

      // URL que existe pero no es ni editor ni *.lovable.app
      console.log("  Estado: ⚠  URL desconocida (ni editor ni *.lovable.app). Revisar manualmente.");
    }
    console.log();
  }

  // Test de iframe (si hay una URL válida)
  const firstSite = (await supabase
    .from("sites")
    .select("live_url")
    .ilike("leads.name" as string, "%yuricar%")
    .limit(1)
    .maybeSingle())?.data?.live_url;

  const testUrl = firstSite ?? YURICAR_KNOWN_URL;
  if (testUrl && isPublicLovableUrl(testUrl)) {
    console.log(`\n🌐 Comprobando si ${testUrl} permite iframe...`);
    try {
      const res = await fetch(testUrl, {
        method: "HEAD",
        signal: AbortSignal.timeout(8_000),
        headers: { "User-Agent": "WebForge-iframe-checker/1.0" },
      });
      const xfo = res.headers.get("x-frame-options") ?? "(no header)";
      const csp = res.headers.get("content-security-policy") ?? "(no header)";
      console.log(`  X-Frame-Options:       ${xfo}`);
      console.log(`  Content-Security-Policy: ${csp.length > 80 ? csp.slice(0, 80) + "…" : csp}`);
      const blocked = xfo.toUpperCase() === "DENY" || xfo.toUpperCase() === "SAMEORIGIN";
      console.log(`  Resultado: ${blocked ? "❌ iframe BLOQUEADO" : "✅ iframe permitido"}`);
    } catch (e) {
      console.log(`  ⚠  No se pudo hacer HEAD request: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

async function patchSite(siteId: string, newUrl: string, source: string) {
  console.log(`  🔧 Actualizando live_url a: ${newUrl} (fuente: ${source})`);
  const { error } = await supabase
    .from("sites")
    .update({ live_url: newUrl })
    .eq("id", siteId);
  if (error) console.error(`  ❌ Error actualizando: ${error.message}`);
  else       console.log("  ✅ live_url actualizada correctamente.");
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
