// send-email — Contrato: ARQUITECTURA_webforge_v2.md sec. 8 (Fase 5).
// Input: { message_id }. SOLO canal 'email'. Envía vía Resend desde FROM_EMAIL (dominio secundario,
// texto plano) al email del lead. Marca el mensaje 'sent' (+sent_at), inserta event 'email_sent' y
// mueve el lead approved -> contacted. El canal 'linkedin' NO se envía aquí: se copia/pega en el panel.
// Secrets SOLO en servidor.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Método no permitido" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const FROM_EMAIL = Deno.env.get("FROM_EMAIL");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return jsonResponse(
      { error: "Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el entorno." },
      500,
    );
  }
  if (!RESEND_API_KEY || !FROM_EMAIL) {
    return jsonResponse(
      {
        error:
          "Faltan RESEND_API_KEY / FROM_EMAIL. Configúralos como secretos: " +
          "npx supabase secrets set RESEND_API_KEY=re_... FROM_EMAIL=hola@tudominio-secundario.com",
      },
      500,
    );
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // --- Autorización: sesión de operador (Bearer JWT) o service_role (orquestador) ---
  const token = (req.headers.get("Authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  let authorized = false;
  if (token === SERVICE_KEY) {
    authorized = true; // llamada interna desde el orquestador (no exponer al navegador)
  } else if (token) {
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data?.user) authorized = true;
  }
  if (!authorized) return jsonResponse({ error: "No autorizado" }, 401);

  // --- Input ---
  let messageId: string | undefined;
  try {
    const body = await req.json();
    messageId = body?.message_id;
  } catch (_e) {
    return jsonResponse({ error: "Cuerpo no válido. Usa { message_id }." }, 400);
  }
  if (!messageId) return jsonResponse({ error: "Falta message_id." }, 400);

  // --- Mensaje ---
  const { data: msg, error: msgErr } = await supabase
    .from("outreach_messages")
    .select("*")
    .eq("id", messageId)
    .maybeSingle();
  if (msgErr) return jsonResponse({ error: msgErr.message }, 500);
  if (!msg) return jsonResponse({ error: "Mensaje no encontrado." }, 404);
  if (msg.channel !== "email") {
    return jsonResponse(
      {
        error:
          "Solo se envían por aquí los mensajes de email. Los de LinkedIn se copian y se pegan a mano.",
      },
      400,
    );
  }
  if (msg.status === "sent") {
    return jsonResponse({ error: "Este mensaje ya se había enviado." }, 409);
  }
  if (!msg.subject || !msg.body) {
    return jsonResponse({ error: "El mensaje no tiene asunto o cuerpo." }, 422);
  }

  // --- Destinatario: el email del lead ---
  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .select("id,email,status")
    .eq("id", msg.lead_id)
    .maybeSingle();
  if (leadErr) return jsonResponse({ error: leadErr.message }, 500);
  if (!lead?.email) {
    return jsonResponse({ error: "El lead no tiene email; no se puede enviar." }, 422);
  }

  // --- Construir HTML del email ---
  const WHATSAPP_NUMBER = "34600782211";

  // Pixel de seguimiento de apertura (1×1 GIF, llamada pública a track-event GET).
  // Permite saber si el lead abrió el email antes de enviar el Email 3.
  const trackingPixelUrl =
    `${SUPABASE_URL}/functions/v1/track-event` +
    `?lead_id=${encodeURIComponent(msg.lead_id)}` +
    `&type=email_opened` +
    `&message_id=${encodeURIComponent(messageId)}`;
  const trackingPixel = `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none;border:0;" alt="" />`;

  // Convertir el body de texto plano a HTML: párrafos separados por línea en blanco,
  // URLs en su propia línea se convierten en botón CTA, resto en texto.
  function bodyToHtml(text: string): string {
    const paragraphs = text.split(/\n{2,}/);
    return paragraphs.map((para) => {
      const lines = para.split("\n").filter((l) => l.trim());
      const rendered = lines.map((line) => {
        const urlMatch = line.trim().match(/^(https?:\/\/[^\s]+)$/);
        if (urlMatch) {
          return `<a href="${urlMatch[1]}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:15px;font-weight:600;margin:8px 0;">Ver la web →</a>`;
        }
        return line;
      });
      const isButton = rendered.some((l) => l.startsWith("<a "));
      if (isButton) return `<p style="margin:16px 0;text-align:left;">${rendered.join("<br>")}</p>`;
      return `<p style="margin:0 0 16px;color:#1a1a1a;font-size:15px;line-height:1.6;">${rendered.join("<br>")}</p>`;
    }).join("");
  }

  // Versión texto plano (fallback para clientes sin HTML)
  const textBody = msg.body;

  const htmlBody = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${msg.subject}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:540px;background:#ffffff;border-radius:10px;padding:36px 32px;box-sizing:border-box;">
          <tr>
            <td>
              ${bodyToHtml(textBody)}

              <!-- WhatsApp CTA -->
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:8px;">
                <tr>
                  <td>
                    <a href="https://wa.me/${WHATSAPP_NUMBER}" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:600;">
                      💬 Escribirme por WhatsApp
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Separador -->
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 20px;">

              <!-- Firma -->
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

  // --- Envío vía Resend (HTML + texto plano como fallback) ---
  let resendId: string | null = null;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [lead.email],
        subject: msg.subject,
        html: htmlBody,
        text: textBody,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
    };
    if (!res.ok) {
      return jsonResponse(
        { error: `Resend devolvió ${res.status}: ${data?.message ?? "error"}` },
        502,
      );
    }
    resendId = data?.id ?? null;
  } catch (e) {
    return jsonResponse(
      {
        error: `No se pudo enviar el email: ${e instanceof Error ? e.message : "error"}`,
      },
      502,
    );
  }

  const nowIso = new Date().toISOString();

  // --- Marcar el mensaje como enviado ---
  const { error: updErr } = await supabase
    .from("outreach_messages")
    .update({ status: "sent", sent_at: nowIso })
    .eq("id", messageId);
  if (updErr) {
    return jsonResponse(
      {
        error: `Email enviado, pero no se pudo marcar 'sent': ${updErr.message}`,
        resend_id: resendId,
      },
      500,
    );
  }

  // --- Evento de auditoría (best-effort) ---
  await supabase.from("events").insert({
    lead_id: msg.lead_id,
    type: "email_sent",
    payload: { message_id: messageId, to: lead.email, resend_id: resendId },
  });

  // --- Mover el lead approved -> contacted (sin regresar leads más avanzados) ---
  await supabase
    .from("leads")
    .update({ status: "contacted", updated_at: nowIso })
    .eq("id", msg.lead_id)
    .eq("status", "approved");

  return jsonResponse({ ok: true, resend_id: resendId, message_id: messageId });
});
