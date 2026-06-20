// cron-followups — Llamado por pg_cron cada día a las 08:00 UTC.
// Email 2: leads 'contacted' desde hace 4+ días sin Email 2.
// Email 3: Email 2 enviado hace 3+ días sin apertura y sin Email 3.
// Lógica idéntica al PASO 3 del orquestador Node — ahora vive en la nube.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { renderEmail, bookingLink } from "../_shared/emailTemplate.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL");
const BOOKING_BASE = Deno.env.get("BOOKING_BASE"); // base de la página de contratación (/book)

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getSubject(hasWebsite: boolean): string {
  const base = hasWebsite
    ? "Tu web está lista. ¿Te gusta cómo ha quedado?"
    : "Tu web está lista.";
  return `Re: ${base}`;
}

// `link` va SOLO en su propia línea para que la plantilla lo renderice como botón "Ver la web →".
function buildBody(emailNumber: 2 | 3, hasWebsite: boolean, nombre: string, link: string): string {
  if (emailNumber === 2) {
    return `Hola ${nombre},\nSolo por si no lo viste.\n\n${link}\n\nNico`;
  }
  const verb = hasWebsite ? "lo dejo caer" : "la doy de baja";
  return (
    `Hola ${nombre},\n` +
    `Esta semana ${verb} — tengo otros negocios esperando y no puedo tenerlo activo indefinidamente.\n` +
    `Por si acaso, aquí la tienes:\n\n${link}\n\nNico`
  );
}

async function sendFollowup(
  supabase: ReturnType<typeof createClient>,
  lead: { id: string; name: string; email: string; contact_name?: string | null; has_website?: boolean | null },
  emailNumber: 2 | 3,
  liveUrl: string,
): Promise<void> {
  const hasWebsite = lead.has_website === true;
  const nombre = lead.contact_name ?? lead.name;
  const subject = getSubject(hasWebsite);
  // Una sola CTA → la página de venta /book (cae a la web cruda si no hay BOOKING_BASE).
  const link = bookingLink(BOOKING_BASE, lead.id) ?? liveUrl;
  const bodyText = buildBody(emailNumber, hasWebsite, nombre, link);

  const { data: msg, error: insErr } = await supabase
    .from("outreach_messages")
    .insert({
      lead_id: lead.id,
      channel: "email",
      subject,
      body: bodyText,
      status: "draft",
      generated_by_model: "template",
      email_number: emailNumber,
    })
    .select()
    .single();

  if (insErr || !msg) {
    console.error(`[followup] Draft insert error para ${lead.id}: ${insErr?.message}`);
    return;
  }

  const trackingPixelUrl =
    `${SUPABASE_URL}/functions/v1/track-event` +
    `?lead_id=${encodeURIComponent(lead.id)}&type=email_opened&message_id=${encodeURIComponent(msg.id)}`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `Nico <${FROM_EMAIL}>`,
      to: [lead.email],
      subject,
      html: renderEmail({ bodyText, trackingPixelUrl, subject }),
      text: bodyText,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    console.error(`[followup] Resend error ${res.status} para ${lead.id}: ${err}`);
    await supabase.from("outreach_messages").delete().eq("id", msg.id);
    return;
  }

  const nowIso = new Date().toISOString();
  await supabase.from("outreach_messages").update({ status: "sent", sent_at: nowIso }).eq("id", msg.id);
  await supabase.from("events").insert({
    lead_id: lead.id,
    type: "email_sent",
    payload: { message_id: msg.id, email_number: emailNumber },
  });
  console.log(`[followup] Email ${emailNumber} → ${lead.name} <${lead.email}>`);
}

Deno.serve(async (req: Request) => {
  // Auth: solo service_role (pg_cron) o llamada manual del operador
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (token !== SERVICE_KEY) return jsonResponse({ error: "No autorizado" }, 401);

  if (!RESEND_API_KEY || !FROM_EMAIL) {
    return jsonResponse({ error: "Faltan RESEND_API_KEY o FROM_EMAIL en los secrets." }, 500);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const now = new Date();
  const day4Ago = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString();
  const day3Ago = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
  let sent2 = 0, sent3 = 0;

  // ── EMAIL 2: leads 'contacted' desde hace 4+ días ───────────────────────
  const { data: staleLeads } = await supabase
    .from("leads")
    .select("id, name, email, contact_name, has_website")
    .eq("status", "contacted")
    .lt("updated_at", day4Ago);

  for (const lead of staleLeads ?? []) {
    if (!lead.email) continue;
    const { data: existing } = await supabase
      .from("outreach_messages").select("id")
      .eq("lead_id", lead.id).eq("email_number", 2).maybeSingle();
    if (existing) continue;

    const { data: site } = await supabase
      .from("sites").select("live_url")
      .eq("lead_id", lead.id).not("live_url", "is", null)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!site?.live_url) continue;

    await sendFollowup(supabase, lead, 2, site.live_url);
    sent2++;
  }

  // ── EMAIL 3: Email 2 enviado hace 3+ días sin apertura ──────────────────
  const { data: unOpened } = await supabase
    .from("outreach_messages")
    .select("id, lead_id")
    .eq("email_number", 2).eq("status", "sent")
    .lt("sent_at", day3Ago).is("opened_at", null);

  for (const msg of unOpened ?? []) {
    const { data: existing } = await supabase
      .from("outreach_messages").select("id")
      .eq("lead_id", msg.lead_id).eq("email_number", 3).maybeSingle();
    if (existing) continue;

    const { data: lead } = await supabase
      .from("leads").select("id, name, email, contact_name, has_website")
      .eq("id", msg.lead_id).maybeSingle();
    if (!lead?.email) continue;

    const { data: site } = await supabase
      .from("sites").select("live_url")
      .eq("lead_id", lead.id).not("live_url", "is", null)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!site?.live_url) continue;

    await sendFollowup(supabase, lead, 3, site.live_url);
    sent3++;
  }

  console.log(`cron-followups: Email2=${sent2} Email3=${sent3}`);
  return jsonResponse({ ok: true, email2: sent2, email3: sent3 });
});
