#!/usr/bin/env npx tsx
/**
 * regen-email.ts — Regenera un borrador de outreach (borra el existente y vuelve a llamar a
 * generate-outreach). Útil cuando un borrador quedó viejo (asunto antiguo, copy desactualizado).
 *
 * OJO: llama a la Edge Function generate-outreach DESPLEGADA. Si el cambio de código aún no está
 * desplegado, el borrador nuevo saldrá con el comportamiento viejo (p. ej. enlace a la web cruda
 * en vez de a /book). El visor send-test-email.ts ya hace el swap a /book al enseñarlo.
 *
 * Uso:
 *   npx tsx orquestador/regen-email.ts                      → regenera Email 1 de YuriCar
 *   npx tsx orquestador/regen-email.ts --lead "otro" --n 1  → otro lead / otro email
 *   npx tsx orquestador/regen-email.ts --dry-run            → enseña qué borraría, sin tocar nada
 *
 * Requiere .env (raíz) con SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
 */
import "./env.ts";
import { createClient } from "@supabase/supabase-js";

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const LEAD_REF = argValue("--lead") ?? "yuricar";
const N = Number(argValue("--n") ?? 1);
const DRY_RUN = process.argv.includes("--dry-run");

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

async function main() {
  // --- Lead ---
  let q = supabase.from("leads").select("id,name,status").limit(1);
  q = isUuid(LEAD_REF) ? q.eq("id", LEAD_REF) : q.ilike("name", `%${LEAD_REF}%`);
  const { data: leads, error } = await q;
  if (error) { console.error("❌", error.message); process.exit(1); }
  const lead = leads?.[0];
  if (!lead) { console.error(`❌ No se encontró lead para "${LEAD_REF}".`); process.exit(1); }
  console.log(`Lead: ${lead.name} (${lead.id}) · status=${lead.status}`);

  // --- Borrador existente de ese email ---
  const { data: existing } = await supabase
    .from("outreach_messages").select("id,channel,status,subject")
    .eq("lead_id", lead.id).eq("email_number", N);

  if (existing?.length) {
    for (const m of existing) console.log(`  borrador existente: [${m.channel} ${m.status}] ${JSON.stringify(m.subject)} (id=${m.id})`);
  } else {
    console.log(`  (no había borrador de Email ${N})`);
  }

  if (DRY_RUN) { console.log("\n🧪 DRY-RUN — no se borra ni se regenera nada."); return; }

  // --- Borrar el/los existentes (si los hay) para esquivar la idempotencia de generate-outreach ---
  if (existing?.length) {
    const { error: delErr } = await supabase
      .from("outreach_messages").delete().eq("lead_id", lead.id).eq("email_number", N);
    if (delErr) { console.error(`❌ No se pudo borrar el borrador: ${delErr.message}`); process.exit(1); }
    console.log(`  🗑  Borrado(s) ${existing.length} borrador(es) de Email ${N}.`);
  }

  // --- Regenerar vía la Edge Function desplegada ---
  console.log(`  → Llamando generate-outreach (lead_id=${lead.id}, email_number=${N})…`);
  const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-outreach`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ lead_id: lead.id, email_number: N }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { console.error(`❌ generate-outreach ${res.status}:`, JSON.stringify(data)); process.exit(1); }

  const msg = (data as { message?: { subject?: string; body?: string } })?.message;
  console.log(`\n✅ Regenerado.`);
  console.log(`Asunto: ${msg?.subject ?? "(sin asunto)"}`);
  console.log(`---- cuerpo ----\n${msg?.body ?? "(vacío)"}\n----------------`);
  console.log(`\nAhora: npx tsx orquestador/send-test-email.ts   → para verlo en tu bandeja con el link a /book.`);
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
