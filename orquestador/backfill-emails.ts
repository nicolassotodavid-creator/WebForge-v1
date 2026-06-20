#!/usr/bin/env npx tsx
/**
 * backfill-emails.ts — Rellena leads.email visitando la web del negocio.
 *
 * Para cada lead con email NULL que tenga una web propia (raw_json.website), visita
 * la home y algunas páginas de contacto/legal y extrae el primer email válido por regex.
 * Los negocios SIN web no tienen fuente automática: se listan al final como pendientes.
 *
 * Uso:
 *   npx tsx orquestador/backfill-emails.ts            → escribe en la DB
 *   npx tsx orquestador/backfill-emails.ts --dry-run  → solo muestra qué haría
 *
 * Requiere .env con SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
 */
import "./env.ts";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const DRY_RUN = process.argv.includes("--dry-run");

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// OJO: para escanear texto necesitamos /g (matchAll). Para VALIDAR un email suelto usamos
// una regex SIN /g (EMAIL_ONE): reusar la global con .test() es stateful (lastIndex) y se
// salta resultados de forma intermitente.
const EMAIL_RX_G = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const EMAIL_ONE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const CONTACT_PATHS = ["", "contacto", "contacto/", "contact", "contacta", "contacta/", "aviso-legal", "aviso-legal/", "avisolegal", "legal", "privacidad"];

function isJunkEmail(e: string): boolean {
  const x = e.toLowerCase();
  return (
    /\.(png|jpe?g|gif|webp|svg|css|js)$/.test(x) ||
    /(example|sentry|wixpress|\.wix|godaddy|placeholder|yourdomain|email@|user@|name@|@sentry|@2x)/.test(x)
  );
}

function realWebsite(raw: Record<string, unknown>): string | null {
  const ws = String(raw["website"] ?? raw["site"] ?? raw["web"] ?? raw["domain"] ?? "").trim();
  if (!ws) return null;
  if (/google\.|maps\.|facebook\.|instagram\.|wa\.me|whatsapp/i.test(ws)) return null;
  try {
    const u = new URL(ws.startsWith("http") ? ws : `https://${ws}`);
    return u.origin;
  } catch {
    return null;
  }
}

async function fetchText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept": "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(12_000),
      redirect: "follow",
    });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

function extractEmail(html: string, domainHost: string): string | null {
  const found = new Set<string>();
  // 1) mailto: es lo más fiable
  for (const m of html.matchAll(/mailto:([^"'?>\s]+)/gi)) {
    const e = decodeURIComponent(m[1]).trim().toLowerCase();
    if (EMAIL_ONE.test(e) && !isJunkEmail(e)) found.add(e);
  }
  // 2) emails en texto plano
  for (const m of html.matchAll(EMAIL_RX_G)) {
    const e = m[0].toLowerCase();
    if (!isJunkEmail(e)) found.add(e);
  }
  if (found.size === 0) return null;
  const list = [...found];
  // Preferir email del mismo dominio del negocio
  const host = domainHost.replace(/^www\./, "");
  const sameDomain = list.find((e) => e.endsWith(`@${host}`) || e.endsWith(`.${host}`));
  return sameDomain ?? list[0];
}

async function findEmailForSite(origin: string): Promise<string | null> {
  const host = new URL(origin).hostname;
  for (const path of CONTACT_PATHS) {
    const url = path ? `${origin}/${path}` : origin;
    const html = await fetchText(url);
    if (!html) continue;
    const email = extractEmail(html, host);
    if (email) return email;
  }
  return null;
}

async function main() {
  console.log(`WebForge — backfill de emails${DRY_RUN ? " (DRY-RUN)" : ""}\n`);

  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, name, has_website, raw_json")
    .is("email", null);

  if (error) { console.error("❌ Error leyendo leads:", error.message); process.exit(1); }
  if (!leads?.length) { console.log("No hay leads sin email. Nada que hacer."); return; }

  console.log(`${leads.length} leads sin email.\n`);
  let updated = 0;
  const pending: string[] = [];

  for (const lead of leads) {
    const raw = (lead.raw_json ?? {}) as Record<string, unknown>;
    const origin = realWebsite(raw);
    if (!origin) {
      pending.push(`${lead.name} (sin web propia)`);
      continue;
    }
    process.stdout.write(`· ${lead.name} → ${origin} … `);
    const email = await findEmailForSite(origin);
    if (!email) {
      console.log("sin email en la web");
      pending.push(`${lead.name} (web sin email visible: ${origin})`);
      continue;
    }
    console.log(`✅ ${email}`);
    if (!DRY_RUN) {
      const { error: upErr } = await supabase
        .from("leads")
        .update({ email, updated_at: new Date().toISOString() })
        .eq("id", lead.id);
      if (upErr) { console.log(`   ❌ no se pudo guardar: ${upErr.message}`); continue; }
    }
    updated++;
  }

  console.log(`\n── Resumen ──`);
  console.log(`${DRY_RUN ? "Se actualizarían" : "Actualizados"}: ${updated}`);
  if (pending.length) {
    console.log(`Pendientes (sin fuente automática): ${pending.length}`);
    for (const p of pending) console.log(`   · ${p}`);
  }
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
