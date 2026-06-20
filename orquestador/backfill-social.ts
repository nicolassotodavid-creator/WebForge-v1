#!/usr/bin/env npx tsx
/**
 * backfill-social.ts — Rellena leads.facebook y leads.whatsapp visitando la web del negocio.
 * Extrae enlaces facebook.com (descartando sharer/plugins) y wa.me/api.whatsapp.com.
 *
 * Uso:  npx tsx orquestador/backfill-social.ts [--dry-run]
 * Requiere .env con SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
 */
import "./env.ts";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false } });
const DRY = process.argv.includes("--dry-run");
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const PATHS = ["", "contacto", "contacto/", "contact", "contacta", "aviso-legal", "aviso-legal/"];

const FB_RX = /https?:\/\/(?:www\.|m\.)?facebook\.com\/[A-Za-z0-9._%\-/?=&]+/i;
const FB_BAD = /facebook\.com\/(sharer|dialog|plugins|tr(\b|\/)|sharer\.php|events\/|groups\/)/i;
const WA_RX = /(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=)\+?\d[\d ]{6,}/i;

function realWebsite(raw: Record<string, unknown>): string | null {
  const ws = String(raw["website"] ?? raw["site"] ?? raw["web"] ?? raw["domain"] ?? "").trim();
  if (!ws || /google\.|maps\.|facebook\.|instagram\.|wa\.me/i.test(ws)) return null;
  try { return new URL(ws.startsWith("http") ? ws : `https://${ws}`).origin; } catch { return null; }
}
async function fetchText(url: string): Promise<string> {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(12_000), redirect: "follow" });
    return r.ok ? await r.text() : "";
  } catch { return ""; }
}
function clean(fb: string): string { return fb.replace(/["'<>]/g, "").replace(/\\$/, ""); }

async function scrapeSite(origin: string): Promise<{ facebook: string | null; whatsapp: string | null }> {
  let facebook: string | null = null, whatsapp: string | null = null;
  for (const p of PATHS) {
    if (facebook && whatsapp) break;
    const html = await fetchText(p ? `${origin}/${p}` : origin);
    if (!html) continue;
    if (!facebook) {
      const m = html.match(FB_RX);
      if (m && !FB_BAD.test(m[0])) facebook = clean(m[0]);
    }
    if (!whatsapp) {
      const m = html.match(WA_RX);
      if (m) { const d = m[0].replace(/\D/g, ""); if (d.length >= 7) whatsapp = d; }
    }
  }
  return { facebook, whatsapp };
}

const { data: leads } = await sb.from("leads").select("id,name,facebook,whatsapp,raw_json");
let fbCount = 0, waCount = 0;
const pending: string[] = [];
for (const l of leads ?? []) {
  if (l.facebook && l.whatsapp) continue;
  const origin = realWebsite((l.raw_json ?? {}) as Record<string, unknown>);
  if (!origin) { pending.push(`${l.name} (sin web)`); continue; }
  const { facebook, whatsapp } = await scrapeSite(origin);
  const patch: Record<string, string> = {};
  if (facebook && !l.facebook) patch.facebook = facebook;
  if (whatsapp && !l.whatsapp) patch.whatsapp = whatsapp;
  if (Object.keys(patch).length === 0) { console.log(`· ${l.name}: nada en ${origin}`); continue; }
  console.log(`· ${l.name}:`, JSON.stringify(patch));
  if (patch.facebook) fbCount++;
  if (patch.whatsapp) waCount++;
  if (!DRY) {
    const { error } = await sb.from("leads").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", l.id);
    if (error) console.log(`   ❌ ${error.message}`);
  }
}
console.log(`\n${DRY ? "[DRY] " : ""}Facebook nuevos: ${fbCount} | WhatsApp nuevos: ${waCount}`);
if (pending.length) console.log("Sin web (a mano):", pending.join(", "));
