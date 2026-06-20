#!/usr/bin/env npx tsx
/**
 * send-test-email.ts — Manda a TU bandeja un email de prueba con la plantilla REAL
 * (la compartida _shared/emailTemplate.ts), para revisar visualmente cómo queda.
 *
 * Usa el borrador REAL del lead si existe (Email 1 lo redacta la IA, así que se respeta
 * tal cual está en outreach_messages). Si no hay borrador, cae a un cuerpo representativo.
 * NO toca la DB: no marca 'sent', no inserta eventos, no mueve el lead, no pone píxel de
 * apertura (para no ensuciar el tracking real del lead).
 *
 * Uso:
 *   npx tsx orquestador/send-test-email.ts                          → Email 1 de YuriCar a tu Gmail
 *   npx tsx orquestador/send-test-email.ts --n 1                    → fuerza Email 1 (gancho completo)
 *   npx tsx orquestador/send-test-email.ts --lead "otro negocio"    → otro lead (por nombre o id)
 *   npx tsx orquestador/send-test-email.ts --to alguien@correo.com  → otro destinatario
 *   npx tsx orquestador/send-test-email.ts --dry-run                → guarda el HTML a fichero, NO envía
 *
 * Requiere .env (raíz) con SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, FROM_EMAIL.
 */
import "./env.ts";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { renderEmail } from "../supabase/functions/_shared/emailTemplate.ts";

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const LEAD_REF = argValue("--lead") ?? "yuricar";
const TO = argValue("--to") ?? "nicolassotodavid@gmail.com";
const N = Number(argValue("--n") ?? 1) as 1 | 2 | 3;
const DRY_RUN = process.argv.includes("--dry-run");

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const FROM_EMAIL = process.env.FROM_EMAIL ?? "";
const BOOKING_BASE = process.env.BOOKING_BASE ?? "";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

function getSubject(hasWebsite: boolean, n: number): string {
  const base = hasWebsite
    ? "Tu web está lista. ¿Te gusta cómo ha quedado?"
    : "Tu web está lista.";
  return n === 1 ? base : `Re: ${base}`;
}

// Cuerpo de respaldo si el lead aún no tiene borrador de ese email (mismas plantillas que producción).
function fallbackBody(n: 1 | 2 | 3, hasWebsite: boolean, nombre: string, rating: unknown, reviews: unknown, liveUrl: string): string {
  if (n === 2) return `Hola ${nombre},\nSolo por si no lo viste.\n\n${liveUrl}\n\nNico`;
  if (n === 3) {
    const verb = hasWebsite ? "lo dejo caer" : "la doy de baja";
    return `Hola ${nombre},\nEsta semana ${verb} — tengo otros negocios esperando y no puedo tenerlo activo indefinidamente.\nPor si acaso, aquí la tienes:\n\n${liveUrl}\n\nNico`;
  }
  // Email 1 (gancho). En producción lo redacta la IA; esto es solo respaldo representativo.
  const nota = rating != null ? `un ${String(rating).replace(".", ",")}` : "muy buena nota";
  const res = reviews != null ? ` con ${reviews} reseñas` : "";
  return hasWebsite
    ? `Hola ${nombre},\nVi que tenéis ${nota} en Google${res}.\nMe pregunté si os llega gente desde el móvil.\nLe di una vuelta a cómo podría verse:\n\n${liveUrl}\n\nSi os resulta útil, me decís.\nNico`
    : `Hola ${nombre},\nSé que esto es raro pero os busqué en Google, vi ${nota}${res} y no teníais web. Me puse.\n\n${liveUrl}\n\nEstán vuestros servicios, algunas fotos y frases de clientes reales de Google. Carga bien en el móvil.\nSi os gusta y queréis quedárosla, me decís.\nNico`;
}

async function main() {
  // --- Lead ---
  let q = supabase.from("leads").select("id,name,contact_name,has_website,rating,review_count,email,segment,status");
  q = isUuid(LEAD_REF) ? q.eq("id", LEAD_REF) : q.ilike("name", `%${LEAD_REF}%`);
  const { data: leads, error: leadErr } = await q.limit(1);
  if (leadErr) { console.error("❌ Error leyendo lead:", leadErr.message); process.exit(1); }
  const lead = leads?.[0];
  if (!lead) { console.error(`❌ No se encontró lead para "${LEAD_REF}".`); process.exit(1); }

  const hasWebsite = lead.has_website === true;
  const nombre = lead.contact_name ?? lead.name;

  // --- live_url ---
  const { data: site } = await supabase
    .from("sites").select("live_url")
    .eq("lead_id", lead.id).not("live_url", "is", null)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  const liveUrl: string = site?.live_url ?? "https://ejemplo.lovable.app";

  // --- Borrador REAL de ese email (si existe) ---
  const { data: msg } = await supabase
    .from("outreach_messages").select("subject,body,status,generated_by_model")
    .eq("lead_id", lead.id).eq("email_number", N).eq("channel", "email")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();

  // El asunto SIEMPRE lo fija getSubject en producción (no la IA), así que mostramos el canónico:
  // si el borrador guardado trae uno viejo, lo señalamos pero enseñamos el que de verdad se enviará.
  const subject = getSubject(hasWebsite, N);
  const subjectNote = msg?.subject && msg.subject !== subject ? `  (⚠ borrador guardado tiene asunto viejo: "${msg.subject}")` : "";
  let bodyText = msg?.body ?? fallbackBody(N, hasWebsite, nombre, lead.rating, lead.review_count, liveUrl);
  const source = msg?.body ? `borrador real (${msg.generated_by_model ?? "?"}, ${msg.status})` : "cuerpo de respaldo (no había borrador)";

  const bookLink = BOOKING_BASE ? `${BOOKING_BASE.replace(/\/$/, "")}/${lead.id}` : null;

  // Los 3 emails llevan UNA sola CTA → la página de venta /book. Replicamos lo que hacen
  // generate-outreach / cron-followups sustituyendo la live_url por el enlace de /book en el cuerpo.
  let linkDestino = liveUrl;
  if (bookLink) {
    bodyText = bodyText.includes(liveUrl)
      ? bodyText.split(liveUrl).join(bookLink)
      : `${bodyText.trimEnd()}\n\n${bookLink}`;
    linkDestino = bookLink;
  }

  const html = renderEmail({ bodyText, trackingPixelUrl: null, subject });

  console.log(`Lead:       ${lead.name} (${lead.id})  has_website=${hasWebsite}  status=${lead.status}`);
  console.log(`Email:      ${N}  ·  fuente del cuerpo: ${source}`);
  console.log(`Asunto:     ${subject}${subjectNote}`);
  console.log(`Enlace CTA: ${linkDestino}`);
  console.log(`---- cuerpo (texto) ----\n${bodyText}\n------------------------`);

  if (DRY_RUN) {
    const out = `${process.cwd()}/orquestador/.tmp-email-preview.html`;
    writeFileSync(out, html);
    console.log(`\n🧪 DRY-RUN — HTML escrito en: ${out}\n   Ábrelo en el navegador para verlo. NO se ha enviado nada.`);
    return;
  }

  if (!RESEND_API_KEY || !FROM_EMAIL) {
    console.error("❌ Faltan RESEND_API_KEY / FROM_EMAIL en .env — no se puede enviar.");
    process.exit(1);
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `Nico <${FROM_EMAIL}>`,
      to: [TO],
      subject: `[PRUEBA · Email ${N}] ${subject}`,
      html,
      text: bodyText,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok) { console.error(`❌ Resend ${res.status}: ${data?.message ?? "error"}`); process.exit(1); }
  console.log(`\n✅ Enviado a ${TO} — Resend id: ${data?.id ?? "?"}`);
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
