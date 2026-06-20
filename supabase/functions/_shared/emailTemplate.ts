// emailTemplate.ts — Plantilla de email compartida para Email 1 (send-email) y
// Email 2/3 (cron-followups). Estilo "personal pulido": fondo blanco, sin caja,
// UNA sola CTA, sin bloque de firma propio (el cuerpo ya firma), línea de opt-out
// y píxel de apertura opcional. Email-safe: tablas + estilos inline, una columna.
// Diseño: docs/superpowers/specs/2026-06-20-email-template-personal-design.md

// Convierte el cuerpo en texto plano a HTML:
//  - párrafos separados por línea en blanco
//  - una línea que es SOLO una URL → botón slim "Ver la web →"
//  - el resto → texto normal (incluida la firma, que ya viene en el cuerpo)
export function bodyToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((para) => {
      const lines = para.split("\n").filter((l) => l.trim());
      const rendered = lines.map((line) => {
        const urlMatch = line.trim().match(/^(https?:\/\/[^\s]+)$/);
        if (urlMatch) {
          return `<a href="${urlMatch[1]}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:8px;font-size:15px;font-weight:600;">Ver la web →</a>`;
        }
        return line;
      });
      const isButton = rendered.some((l) => l.startsWith("<a "));
      if (isButton) return `<p style="margin:20px 0;">${rendered.join("<br>")}</p>`;
      return `<p style="margin:0 0 18px;color:#1a1a1a;font-size:16px;line-height:1.6;">${rendered.join("<br>")}</p>`;
    })
    .join("");
}

export interface RenderEmailOptions {
  bodyText: string;
  trackingPixelUrl?: string | null;
  subject?: string;
  // Enlace suave de compra → página de contratación. Solo en seguimientos (Email 2/3);
  // el Email 1 en frío va sin él (doctrina: "que abran el link, no que compren todavía").
  bookingUrl?: string | null;
}

// Devuelve el HTML completo del email. NO añade firma (el cuerpo ya la trae) ni
// botón de WhatsApp. Solo: cuerpo + (enlace de compra opcional) + opt-out + píxel.
export function renderEmail({ bodyText, trackingPixelUrl, subject = "", bookingUrl }: RenderEmailOptions): string {
  const pixel = trackingPixelUrl
    ? `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none;border:0;" alt="" />`
    : "";

  const buyLink = bookingUrl
    ? `<p style="margin:0 0 18px;"><a href="${bookingUrl}" style="color:#111827;font-size:14px;font-weight:600;text-decoration:none;border-bottom:1px solid #111827;padding-bottom:1px;">Si ya la quieres, te la dejo lista aquí →</a></p>`
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,'Segoe UI',Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;">
    <tr>
      <td align="center" style="padding:32px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;">
          <tr>
            <td style="color:#1a1a1a;font-size:16px;line-height:1.6;">
              ${bodyToHtml(bodyText)}
              ${buyLink}
              <hr style="border:none;border-top:1px solid #eeeeee;margin:28px 0 16px;">
              <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.5;">Si no te encaja, respóndeme y no vuelvo a escribir.</p>
              ${pixel}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
