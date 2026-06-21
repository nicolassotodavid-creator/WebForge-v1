// followup-mailer.ts — Envío automático de Email 2 (día 4) y Email 3 (día 7 si no abrió Email 2).
// Llamado desde PASO 3 de run.ts. Opera con service_role key: nunca exponer al frontend.
// Usa Resend directamente (mismo patrón que la Edge Function send-email) para evitar el
// salto HTTP de service_role → Edge Function y mantener la lógica en el orquestador.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL;

export const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

interface Lead {
  id: string;
  name: string;
  email: string | null;
  contact_name?: string | null;
  has_website?: boolean | null;
}

// Asuntos por (tiene web, nº de email). Sin "Re:": cada asunto va solo.
function getSubject(hasWebsite: boolean, emailNumber: number): string {
  if (hasWebsite) {
    if (emailNumber === 2) return "¿Os ha gustado el cambio?";
    if (emailNumber === 3) return "La doy de baja el viernes";
    return "Le di una vuelta a vuestra web";
  }
  if (emailNumber === 2) return "¿Has podido verla?";
  if (emailNumber === 3) return "La borro el viernes";
  return "Te monté una web";
}

// Template literal para Email 2 o 3.
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

// HTML mínimo para emails de seguimiento (sin CTA de WhatsApp, sin HTML complejo — solo texto).
function buildHtml(body: string, subject: string, trackingPixel: string): string {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((para) => {
      const lines = para.split("\n").filter((l) => l.trim());
      const rendered = lines.map((line) => {
        const urlMatch = line.trim().match(/^(https?:\/\/[^\s]+)$/);
        if (urlMatch) {
          return `<a href="${urlMatch[1]}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:15px;font-weight:600;margin:8px 0;">Ver la web →</a>`;
        }
        return line;
      });
      const isButton = rendered.some((l) => l.startsWith("<a "));
      if (isButton) return `<p style="margin:16px 0;">${rendered.join("<br>")}</p>`;
      return `<p style="margin:0 0 16px;color:#1a1a1a;font-size:15px;line-height:1.6;">${rendered.join("<br>")}</p>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:540px;background:#ffffff;border-radius:10px;padding:36px 32px;box-sizing:border-box;">
          <tr>
            <td>
              ${paragraphs}
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 20px;">
              <p style="margin:0;color:#374151;font-size:14px;line-height:1.5;">
                <strong>Nico</strong><br>
                <span style="color:#6b7280;font-size:13px;">Diseño webs para negocios locales</span>
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;color:#9ca3af;font-size:12px;">Has recibido este email porque alguien encontró tu negocio en Google y quiso compartir algo contigo.</p>
        ${trackingPixel}
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendFollowupEmail(
  lead: Lead,
  emailNumber: 2 | 3,
  liveUrl: string,
): Promise<void> {
  if (!lead.email) {
    console.log(`  · [followup] Lead ${lead.id} sin email — omitido.`);
    return;
  }
  if (!RESEND_API_KEY || !FROM_EMAIL) {
    console.error(`  ✗ [followup] Faltan RESEND_API_KEY o FROM_EMAIL en .env. Email ${emailNumber} no enviado.`);
    return;
  }

  const hasWebsite = lead.has_website === true;
  const nombre = lead.contact_name ?? lead.name;
  const subject = getSubject(hasWebsite, emailNumber);
  const bodyText = buildBody(emailNumber, hasWebsite, nombre, liveUrl);

  // Insertar draft en outreach_messages
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
    // 23505 = violación de UNIQUE(lead_id, email_number): otra ejecución solapada ya insertó
    // este email. Es el guard de idempotencia funcionando — no es un error real.
    if (insErr?.code === "23505") {
      console.log(`  · [followup] Email ${emailNumber} para lead ${lead.id} ya existe (carrera) — omitido.`);
      return;
    }
    console.error(`  ✗ [followup] No se pudo guardar draft para lead ${lead.id}: ${insErr?.message}`);
    return;
  }

  // Pixel de tracking
  const trackingPixelUrl =
    `${SUPABASE_URL}/functions/v1/track-event` +
    `?lead_id=${encodeURIComponent(lead.id)}` +
    `&type=email_opened` +
    `&message_id=${encodeURIComponent(msg.id)}`;
  const trackingPixel = `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none;border:0;" alt="" />`;

  const htmlBody = buildHtml(bodyText, subject, trackingPixel);

  // Enviar vía Resend
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [lead.email],
      subject,
      html: htmlBody,
      text: bodyText,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error(`  ✗ [followup] Resend error ${res.status} para lead ${lead.id}: ${errText}`);
    // Limpiar el draft fallido para poder reintentar
    await supabase.from("outreach_messages").delete().eq("id", msg.id);
    return;
  }

  const nowIso = new Date().toISOString();
  await supabase.from("outreach_messages")
    .update({ status: "sent", sent_at: nowIso })
    .eq("id", msg.id);

  await supabase.from("events").insert({
    lead_id: lead.id,
    type: "email_sent",
    payload: { message_id: msg.id, email_number: emailNumber },
  });

  console.log(`  → [followup] Email ${emailNumber} enviado a ${lead.name} <${lead.email}>`);
}

// Obtiene la live_url más reciente de un lead.
export async function getLiveUrl(leadId: string): Promise<string | null> {
  const { data } = await supabase
    .from("sites")
    .select("live_url")
    .eq("lead_id", leadId)
    .not("live_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.live_url ?? null;
}
