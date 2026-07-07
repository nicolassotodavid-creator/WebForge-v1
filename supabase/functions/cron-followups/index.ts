// cron-followups — Llamado por pg_cron cada día a las 08:00 UTC.
// Email 2: leads 'contacted' desde hace 4+ días sin Email 2.
// Email 3: Email 2 enviado hace 3+ días sin apertura y sin Email 3.
// Lógica idéntica al PASO 3 del orquestador Node — ahora vive en la nube.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { renderEmail, bookingLink, withWhatsappFooter } from "../_shared/emailTemplate.ts";
import {
  DEFAULT_REPLY_TO_LUVIA,
  DEFAULT_REPLY_TO_WEBFORGE,
  replyToFor,
} from "../_shared/replyTo.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
// SERVICE_KEY: solo para el cliente de DB (bypass RLS). CRON_SECRET: auth dedicada del cron
// (la manda pg_cron leyéndola del Vault 'cron_secret'). No autenticamos con la service key
// porque está DEPRECATED y su valor en runtime no es reproducible tras la migración de keys.
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");
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
  return (
    `Hola ${nombre},\n` +
    `Es el último email que te mando. ${hasWebsite ? "Voy a retirar tu web" : "Voy a darla de baja"} en las próximas 48 h — tengo otros negocios esperando y no puedo mantenerla activa indefinidamente.\n` +
    `Si la quieres activa, es ahora o la suelto:\n\n${link}\n\nNico`
  );
}

async function sendFollowup(
  supabase: ReturnType<typeof createClient>,
  lead: { id: string; name: string; email: string; contact_name?: string | null; has_website?: boolean | null; owner?: string | null },
  emailNumber: 2 | 3,
  liveUrl: string,
  previewImageUrl: string | null,
): Promise<void> {
  const hasWebsite = lead.has_website === true;
  const nombre = lead.contact_name ?? lead.name;
  const subject = getSubject(hasWebsite);
  // /book como destino de compra (cae a la web cruda si no hay BOOKING_BASE).
  const bookUrl = bookingLink(BOOKING_BASE, lead.id);
  const link = bookUrl ?? liveUrl;
  // Pie de WhatsApp opcional (WHATSAPP_NUMBER): mismo mecanismo que el Email 1 en
  // generate-outreach, para que 1, 2 y 3 ofrezcan la misma vía de respuesta por WhatsApp.
  // Va en el cuerpo → aparece tanto en el HTML (renderEmail) como en la versión de texto.
  const bodyText = withWhatsappFooter(buildBody(emailNumber, hasWebsite, nombre, link), Deno.env.get("WHATSAPP_NUMBER"));

  // Reply-To por dueño: respuestas de leads Luvia → Miguel; WebForge → Nico.
  const replyTo = replyToFor(lead.owner, Deno.env.get("ADMIN_USER_ID"), {
    webforge: Deno.env.get("REPLY_TO_WEBFORGE") ?? DEFAULT_REPLY_TO_WEBFORGE,
    luvia: Deno.env.get("REPLY_TO_LUVIA") ?? DEFAULT_REPLY_TO_LUVIA,
  });

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
      // Showcase también en 2/3: captura + "Ver la web entera" (→ live_url) + "Activar mi web" (→ /book).
      html: renderEmail({
        bodyText,
        trackingPixelUrl,
        subject,
        previewImageUrl,
        webUrl: liveUrl,
        bookingUrl: bookUrl,
      }),
      text: bodyText,
      ...(replyTo ? { reply_to: replyTo } : {}),
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
  // Auth: Bearer <CRON_SECRET> (lo manda pg_cron o el operador). Ver nota en las env vars.
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!CRON_SECRET || token !== CRON_SECRET) return jsonResponse({ error: "No autorizado" }, 401);

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
    .select("id, name, email, contact_name, has_website, owner")
    .eq("status", "contacted")
    .lt("updated_at", day4Ago);

  for (const lead of staleLeads ?? []) {
    if (!lead.email) continue;
    const { data: existing } = await supabase
      .from("outreach_messages").select("id")
      .eq("lead_id", lead.id).eq("email_number", 2).maybeSingle();
    if (existing) continue;

    const { data: site } = await supabase
      .from("sites").select("live_url, preview_image_url")
      .eq("lead_id", lead.id).not("live_url", "is", null)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!site?.live_url) continue;

    await sendFollowup(supabase, lead, 2, site.live_url, site.preview_image_url ?? null);
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
      .from("leads").select("id, name, email, contact_name, has_website, owner")
      .eq("id", msg.lead_id).maybeSingle();
    if (!lead?.email) continue;

    const { data: site } = await supabase
      .from("sites").select("live_url, preview_image_url")
      .eq("lead_id", lead.id).not("live_url", "is", null)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!site?.live_url) continue;

    await sendFollowup(supabase, lead, 3, site.live_url, site.preview_image_url ?? null);
    sent3++;
  }

  console.log(`cron-followups: Email2=${sent2} Email3=${sent3}`);
  return jsonResponse({ ok: true, email2: sent2, email3: sent3 });
});
