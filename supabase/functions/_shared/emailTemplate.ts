// emailTemplate.ts — Plantilla de email compartida para Email 1 (send-email) y
// Email 2/3 (cron-followups). Estilo "personal pulido": fondo blanco, sin caja,
// UNA sola CTA, sin bloque de firma propio (el cuerpo ya firma), línea de opt-out
// y píxel de apertura opcional. Email-safe: tablas + estilos inline, una columna.
// Diseño: docs/superpowers/specs/2026-06-20-email-template-personal-design.md

// Identidad del remitente para el pie legal (LSSI Art. 10 + principio de transparencia
// del RGPD: toda comunicación comercial debe identificar a quien la envía). Sobrescribible
// por los callers vía la opción `senderIdentity` (p.ej. Deno.env.get("SENDER_LEGAL_IDENTITY"))
// si se quiere añadir NIF/domicilio y cubrir el Art. 10 al 100 %.
const DEFAULT_SENDER_IDENTITY = "David Nicolás Soto · diseño web (autónomo)";

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
        // Pie de WhatsApp ("WhatsApp: https://wa.me/…") → botón verde de marca en vez de un
        // enlace pelado. Es CTA secundaria (responder por WhatsApp), va tras la firma. La URL
        // sigue siendo exactamente https://wa.me/… → clicable y detectable por los tests.
        const waMatch = line.trim().match(/^WhatsApp:\s*(https:\/\/wa\.me\/\d+)$/i);
        if (waMatch) {
          return `<a href="${waMatch[1]}" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;padding:13px 28px;border-radius:999px;font-size:15px;font-weight:700;line-height:1;box-shadow:0 4px 12px rgba(37,211,102,0.30);">Escríbeme por WhatsApp &nbsp;→</a>`;
        }
        const urlMatch = line.trim().match(/^(https?:\/\/[^\s]+)$/);
        if (urlMatch) {
          return `<a href="${urlMatch[1]}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:8px;font-size:15px;font-weight:600;">Ver la web →</a>`;
        }
        // URL embebida dentro de una línea de texto (p.ej. otras URLs sueltas en una frase)
        // → clicable. Las URLs que van SOLAS en su línea ya son botón arriba; esto es solo inline.
        return line.replace(
          /(https?:\/\/[^\s<]+)/g,
          '<a href="$1" style="color:#111827;text-decoration:underline;">$1</a>',
        );
      });
      const isButton = rendered.some((l) => l.startsWith("<a "));
      if (isButton) return `<p style="margin:20px 0;">${rendered.join("<br>")}</p>`;
      return `<p style="margin:0 0 18px;color:#1a1a1a;font-size:16px;line-height:1.6;">${rendered.join("<br>")}</p>`;
    })
    .join("");
}

// Enlace a la página de venta /book de un lead. `base` = BOOKING_BASE (con o sin barra final).
// Devuelve null si no hay base configurada → los llamadores caen entonces a la live_url cruda.
export function bookingLink(base: string | null | undefined, leadId: string): string | null {
  return base ? `${base.replace(/\/$/, "")}/${leadId}` : null;
}

// Añade una línea de contacto por WhatsApp bajo la firma del cuerpo, para que el prospecto
// pueda responder por WhatsApp además de por email. `number` = WHATSAPP_NUMBER (dígitos; el
// llamador lo lee de Deno.env — así el helper es puro y testeable). Se omite si el canal no
// es email o si no hay número válido (>= 8 dígitos): apagado por defecto y NUNCA en LinkedIn
// (que va por nota de conexión). La URL sale clicable en el HTML (ver bodyToHtml) y visible
// en la versión de texto plano. Usado por generate-outreach (email 1) y cron-followups (2/3).
//
// IMPORTANTE: el pie va como PÁRRAFO PROPIO (separado por \n\n). Si se pegara con un solo \n,
// en el Email 1 quedaría fundido con la línea-URL final (…\n\nURL\nWhatsApp:…) y renderEmail
// dejaría de reconocer esa URL como línea suelta → el escaparate no la sustituiría y saldría un
// botón "Ver la web →" duplicado con la captura descolocada al final. Con \n\n la URL sigue
// sola en su párrafo y el escaparate funciona.
export function withWhatsappFooter(body: string, number: string | null | undefined, channel = "email"): string {
  const raw = (number ?? "").replace(/\D/g, "");
  if (channel !== "email" || raw.length < 8) return body;
  return `${body}\n\nWhatsApp: https://wa.me/${raw}`;
}

// Bloque "escaparate" (diseño definitivo, docs/email-design/EMAIL1-DISENO-DEFINITIVO.html):
// captura de la web enmarcada en un mini-navegador (clicable → la web) + DOS botones:
// "Ver la web entera" → live_url, y "Activar mi web" → /book. Se renderiza SOLO si hay
// captura (previewImageUrl). Si falta la web (webUrl) o el /book (bookUrl) se omiten esas
// piezas en vez de romper el email.
function showcaseBlock(previewImageUrl: string, webUrl?: string | null, bookUrl?: string | null): string {
  const frameInner =
    `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid #E7E5E4;border-radius:12px;overflow:hidden;box-shadow:0 10px 30px rgba(17,24,39,0.10);">` +
    `<tr><td style="background:#F5F5F4;padding:10px 14px;border-bottom:1px solid #E7E5E4;font-size:13px;color:#C4C0BB;letter-spacing:3px;line-height:1;">&#9679;&nbsp;&#9679;&nbsp;&#9679;</td></tr>` +
    `<tr><td style="font-size:0;line-height:0;"><img src="${previewImageUrl}" width="540" alt="Vista previa de tu web" style="display:block;width:100%;height:auto;border:0;" /></td></tr>` +
    `</table>`;
  const frame = webUrl
    ? `<a href="${webUrl}" style="text-decoration:none;color:inherit;display:block;margin:0 0 24px;">${frameInner}</a>`
    : `<div style="margin:0 0 24px;">${frameInner}</div>`;

  const ctaWeb = webUrl
    ? `<p style="margin:0 0 30px;text-align:center;"><a href="${webUrl}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:14px 30px;border-radius:9px;font-size:15px;font-weight:600;">Ver la web entera &rarr;</a></p>`
    : "";

  // CTA secundaria neutra ("muestra de trabajo", no producto en venta): el enlace sigue
  // yendo a /book (2º enlace obligatorio, no se quita), pero el copy no es venta directa.
  // El precio y el "activar" viven en la propia /book, cuando el prospecto ya ha entrado.
  const softSell = bookUrl
    ? `<p style="margin:0 0 16px;color:#57534E;font-size:15px;line-height:1.6;">Es una muestra de mi trabajo &mdash; te la dejo aqu&iacute; por si quieres verla en detalle o comentarla.</p>` +
      `<p style="margin:0 0 30px;text-align:center;"><a href="${bookUrl}" style="display:inline-block;background:#ffffff;color:#111827;text-decoration:none;padding:13px 28px;border-radius:9px;font-size:15px;font-weight:600;border:1.5px solid #111827;">Ver la propuesta &rarr;</a></p>`
    : "";

  return frame + ctaWeb + softSell;
}

export interface RenderEmailOptions {
  bodyText: string;
  trackingPixelUrl?: string | null;
  subject?: string;
  // Enlace de compra → página de contratación /book. En modo texto plano es el enlace
  // suave de seguimiento; en modo escaparate es el botón "Ver la propuesta".
  bookingUrl?: string | null;
  // Pie legal: identidad del remitente (LSSI Art. 10 / RGPD). Si se omite → DEFAULT_SENDER_IDENTITY.
  senderIdentity?: string;
  // Modo escaparate: captura re-hospedada de la web (sites.preview_image_url). Si viene,
  // el email sale con la captura enmarcada + 2 CTAs. Si es null/undefined → texto plano.
  previewImageUrl?: string | null;
  // URL en vivo de la web (sites.live_url) → captura clicable + botón "Ver la web entera".
  webUrl?: string | null;
}

// Devuelve el HTML completo del email. NO añade firma (el cuerpo ya la trae) ni
// botón de WhatsApp. Con captura → escaparate (captura enmarcada + 2 CTAs); sin
// captura → texto plano + (enlace de compra opcional). Siempre: opt-out + píxel.
export function renderEmail({ bodyText, trackingPixelUrl, subject = "", bookingUrl, previewImageUrl, webUrl, senderIdentity = DEFAULT_SENDER_IDENTITY }: RenderEmailOptions): string {
  const pixel = trackingPixelUrl
    ? `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none;border:0;" alt="" />`
    : "";

  // ── Cuerpo ──────────────────────────────────────────────────────────────
  // Modo escaparate: insertamos el bloque (captura + CTAs) DONDE el cuerpo tenía
  // la línea-URL suelta (los redactores la ponen tras un "…te dejo el enlace abajo"),
  // y la quitamos para no duplicar botón. Si no hay línea-URL, va al final del cuerpo.
  let bodyHtml: string;
  let buyLink = "";
  if (previewImageUrl) {
    const block = showcaseBlock(previewImageUrl, webUrl, bookingUrl);
    const paras = bodyText.split(/\n{2,}/);
    const urlIdx = paras.findIndex((p) => /^https?:\/\/[^\s]+$/.test(p.trim()));
    if (urlIdx >= 0) {
      const before = paras.slice(0, urlIdx).join("\n\n");
      const after = paras.slice(urlIdx + 1).join("\n\n");
      bodyHtml = (before ? bodyToHtml(before) : "") + block + (after ? bodyToHtml(after) : "");
    } else {
      bodyHtml = bodyToHtml(bodyText) + block;
    }
  } else {
    bodyHtml = bodyToHtml(bodyText);
    // Enlace suave de compra (solo en seguimientos sin captura).
    buyLink = bookingUrl
      ? `<p style="margin:0 0 18px;"><a href="${bookingUrl}" style="color:#111827;font-size:14px;font-weight:600;text-decoration:none;border-bottom:1px solid #111827;padding-bottom:1px;">Si ya la quieres, te la dejo lista aquí →</a></p>`
      : "";
  }

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
              ${bodyHtml}
              ${buyLink}
              <hr style="border:none;border-top:1px solid #eeeeee;margin:28px 0 16px;">
              <p style="margin:0 0 6px;color:#9ca3af;font-size:13px;line-height:1.5;">Te escribo a t&iacute;tulo profesional; encontr&eacute; tu contacto en tu ficha p&uacute;blica de actividad. Si no quieres recibir m&aacute;s propuestas o prefieres que borre tus datos, responde <strong>BAJA</strong> a este correo y lo hago de inmediato.</p>
              <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.5;">${senderIdentity}</p>
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
