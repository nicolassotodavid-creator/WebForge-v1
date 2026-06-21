// emailTemplate.ts — Plantilla de email compartida.
//  - Los 3 emails (Email 1 en send-email, Email 2/3 en cron-followups) usan el diseño
//    "showcase": captura de la web enmarcada en un mini-navegador + DOS CTAs
//    ("Ver la web entera" → la web, "Activar mi web" → /book). Se activa pasando `webUrl`.
//    Diseño canónico: docs/email-design/EMAIL1-DISENO-DEFINITIVO.html
//  - Modo simple (texto + 1 botón) = solo fallback si no hay web en vivo (sin `webUrl`).
// Email-safe: tablas + estilos inline, una columna, fondo blanco.

// Una línea que es SOLO una URL.
function isBareUrl(line: string): boolean {
  return /^(https?:\/\/[^\s]+)$/.test(line.trim());
}

// Convierte el cuerpo en texto plano a HTML (modo SIMPLE, Email 2/3):
//  - párrafos separados por línea en blanco
//  - una línea que es SOLO una URL → botón slim "Ver la web →"
//  - el resto → texto normal (incluida la firma, que ya viene en el cuerpo)
export function bodyToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((para) => {
      const lines = para.split("\n").filter((l) => l.trim());
      const rendered = lines.map((line) => {
        if (isBareUrl(line)) {
          return `<a href="${line.trim()}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:8px;font-size:15px;font-weight:600;">Ver la web →</a>`;
        }
        return line;
      });
      const isButton = rendered.some((l) => l.startsWith("<a "));
      if (isButton) return `<p style="margin:20px 0;">${rendered.join("<br>")}</p>`;
      return `<p style="margin:0 0 18px;color:#1a1a1a;font-size:16px;line-height:1.6;">${rendered.join("<br>")}</p>`;
    })
    .join("");
}

// Convierte el cuerpo a HTML (modo SHOWCASE, Email 1): igual que bodyToHtml, pero la
// primera línea que es SOLO una URL se sustituye por el bloque `showcase` (captura + CTAs),
// justo donde el cuerpo decía "échale un vistazo: <link>". Otras líneas-URL se descartan
// (las CTAs ya llevan el enlace). Si no hay línea-URL, el showcase se añade al final del cuerpo.
function bodyToHtmlShowcase(text: string, showcase: string): string {
  let inserted = false;
  const html = text
    .split(/\n{2,}/)
    .map((para) => {
      const lines = para.split("\n").filter((l) => l.trim());
      // Párrafo que es SOLO una URL → marca de posición de la web.
      if (lines.length === 1 && isBareUrl(lines[0])) {
        if (!inserted) {
          inserted = true;
          return showcase;
        }
        return ""; // línea-URL duplicada: descartar
      }
      return `<p style="margin:0 0 18px;color:#1a1a1a;font-size:16px;line-height:1.6;">${lines.join("<br>")}</p>`;
    })
    .filter(Boolean)
    .join("");
  return inserted ? html : html + showcase;
}

// Bloque "showcase": captura enmarcada (mini-navegador) clicable + CTA primaria
// "Ver la web entera" → web, y (si hay bookingUrl) soft-sell + CTA secundaria
// "Activar mi web" → /book. La captura se omite si no hay previewImageUrl.
function buildShowcase(opts: { webUrl: string; previewImageUrl?: string | null; bookingUrl?: string | null }): string {
  const { webUrl, previewImageUrl, bookingUrl } = opts;
  const framed = previewImageUrl
    ? `<a href="${webUrl}" style="text-decoration:none;color:inherit;display:block;margin:0 0 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid #E7E5E4;border-radius:12px;overflow:hidden;box-shadow:0 10px 30px rgba(17,24,39,0.10);">
              <tr><td style="background:#F5F5F4;padding:10px 14px;border-bottom:1px solid #E7E5E4;font-size:13px;color:#C4C0BB;letter-spacing:3px;line-height:1;">&#9679;&nbsp;&#9679;&nbsp;&#9679;</td></tr>
              <tr><td style="font-size:0;line-height:0;">
                <img src="${previewImageUrl}" width="540" alt="Vista previa de tu web" style="display:block;width:100%;height:auto;border:0;" />
              </td></tr>
            </table>
          </a>`
    : "";

  const primary = `<p style="margin:0 0 30px;text-align:center;">
            <a href="${webUrl}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:14px 30px;border-radius:9px;font-size:15px;font-weight:600;">Ver la web entera &rarr;</a>
          </p>`;

  const secondary = bookingUrl
    ? `<p style="margin:0 0 16px;color:#57534E;font-size:15px;line-height:1.6;">Si te convence, te la dejo publicada y lista &mdash; con tu dominio, las reseñas de Google y todo en marcha. Pago único, sin permanencia.</p>
          <p style="margin:0 0 30px;text-align:center;">
            <a href="${bookingUrl}" style="display:inline-block;background:#ffffff;color:#111827;text-decoration:none;padding:13px 28px;border-radius:9px;font-size:15px;font-weight:600;border:1.5px solid #111827;">Activar mi web &rarr;</a>
          </p>`
    : "";

  return framed + primary + secondary;
}

// Enlace a la página de venta /book de un lead. `base` = BOOKING_BASE (con o sin barra final).
// Devuelve null si no hay base configurada → los llamadores caen entonces a la live_url cruda.
export function bookingLink(base: string | null | undefined, leadId: string): string | null {
  return base ? `${base.replace(/\/$/, "")}/${leadId}` : null;
}

export interface RenderEmailOptions {
  bodyText: string;
  trackingPixelUrl?: string | null;
  subject?: string;
  // ── Modo SHOWCASE (Email 1) ──────────────────────────────────────────────
  // Si se pasa `webUrl`, el email se renderiza con la captura enmarcada + las dos
  // CTAs ("Ver la web entera" / "Activar mi web") en lugar del botón simple.
  webUrl?: string | null;
  previewImageUrl?: string | null;
  // ── Enlace suave de compra → /book ───────────────────────────────────────
  // En modo SHOWCASE = botón "Activar mi web". En modo simple (Email 2/3) = enlace
  // de texto al final. El Email 1 en frío clásico iba sin él; ahora lo lleva como CTA.
  bookingUrl?: string | null;
}

// Devuelve el HTML completo del email. NO añade firma (el cuerpo ya la trae) ni
// botón de WhatsApp. Modo SHOWCASE si hay webUrl; si no, modo simple.
export function renderEmail({ bodyText, trackingPixelUrl, subject = "", webUrl, previewImageUrl, bookingUrl }: RenderEmailOptions): string {
  const pixel = trackingPixelUrl
    ? `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none;border:0;" alt="" />`
    : "";

  let content: string;
  if (webUrl) {
    // Email 1 — diseño showcase: la captura + las 2 CTAs se insertan donde el cuerpo
    // menciona la web (la línea-URL); el resto del cuerpo (intro + cierre + firma) se respeta.
    const showcase = buildShowcase({ webUrl, previewImageUrl, bookingUrl });
    content = bodyToHtmlShowcase(bodyText, showcase);
  } else {
    // Email 2/3 — diseño simple: cuerpo + (enlace de compra de texto opcional).
    const buyLink = bookingUrl
      ? `<p style="margin:0 0 18px;"><a href="${bookingUrl}" style="color:#111827;font-size:14px;font-weight:600;text-decoration:none;border-bottom:1px solid #111827;padding-bottom:1px;">Si ya la quieres, te la dejo lista aquí →</a></p>`
      : "";
    content = bodyToHtml(bodyText) + buyLink;
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
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:540px;">
          <tr>
            <td style="color:#1a1a1a;font-size:16px;line-height:1.6;">
              ${content}
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
