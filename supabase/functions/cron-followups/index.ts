// cron-followups — Llamado por pg_cron cada día a las 08:00 UTC.
// Email 2: leads 'contacted' desde hace 4+ días sin Email 2.
// Email 3: Email 2 enviado hace 3+ días sin apertura y sin Email 3.
// Lógica idéntica al PASO 3 del orquestador Node — ahora vive en la nube.
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL");

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

function buildBody(emailNumber: 2 | 3, hasWebsite: boolean, nombre: string, liveUrl: string): string {
  if (emailNumber === 2) {
    return `Hola ${nombre},\nSolo por si no lo viste.\n\n${liveUrl}\n\nNico`;
  }
  const verb = hasWebsite ? "lo dejo caer" : "la doy de baja";
  return (
    `Hola ${nombre},\n` +
    `Esta semana ${verb} — tengo otros negocios esperando y no puedo tenerlo activo indefinidamente.\n\n` +
    `Por si acaso: ${liveUrl}\n\n` +
    `Nico`
  );
}

function buildHtml(body: string, subject: string, trackingPixel: string): string {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((para) => {
      const lines = para.split("\n").filter((l) => l.trim());
      const rendered = lines.map((line) => {
        const urlMatch = line.trim().match(/^(https?:\/\/[^\s]+)$/);
        if (urlMatch) {
          return `<a href="${urlMatch[1]}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:15px;font-weight:600;margin:8px 0;">Ver la web →</a>`;
        }
        return line;
      });
      const isButton = rendered.some((l) => l.startsWith("<a "));
      if (isButton) return `<p style="margin:16px 0;">${rendered.join("<br>")}</p>`;
      return `<p style="margin:0 0 16px;color:#1a1a1a;font-size:15px;line-height:1.6;">${rendered.join("<br>")}</p>`;
    })
    .join("");

  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;background:#f4f4f5;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#fff;border-radius:10px;padding:36px 32px;">
<tr><td>
${paragraphs}
<hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 20px;">
<p style="margin:0;color:#374151;font-size:14px;"><strong>Nico</strong><br>
<span style="color:#6b7280;font-size:13px;">Diseño webs para negocios locales</span></p>
</td></tr></table>
<p style="margin:16px 0 0;color:#9ca3af;font-size:12px;">Has recibido este email porque alguien encontró tu negocio en Google y quiso compartir algo contigo.</p>
${trackingPixel}
</td></tr></table></body></html>`;
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
  const bodyText = buildBody(emailNumber, hasWebsite, nombre, liveUrl);

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
  const trackingPixel = `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none;border:0;" alt="" />`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [lead.email],
      subject,
      html: buildHtml(bodyText, subject, trackingPixel),
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
