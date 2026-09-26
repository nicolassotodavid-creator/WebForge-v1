// emailTemplate.ts — Plantilla de email compartida para Email 1 (send-email) y
// Email 2/3 (cron-followups). Estilo "personal pulido": fondo blanco, sin caja,
// UNA sola CTA, sin bloque de firma propio (el cuerpo ya firma), línea de opt-out
// y píxel de apertura opcional. Email-safe: tablas + estilos inline, una columna.
// Diseño: docs/superpowers/specs/2026-06-20-email-template-personal-design.md

import { trackEmailLinks } from "./clickTracking.ts";

// Identidad del remitente para el pie legal (LSSI Art. 10 + principio de transparencia
// del RGPD: toda comunicación comercial debe identificar a quien la envía). Sobrescribible
// por los callers vía la opción `senderIdentity` (p.ej. Deno.env.get("SENDER_LEGAL_IDENTITY"))
// si se quiere añadir NIF/domicilio y cubrir el Art. 10 al 100 %.
const DEFAULT_SENDER_IDENTITY = "David Nicolás Soto · diseño web (autónomo)";

// Marca que firma el email. "luvia" = diseño propio de correo personal (ver luviaBodyToHtml).
export type EmailBrand = "webforge" | "luvia";

// [LUVIA] Tinta de marca de luvia-ia.es (--ink) para el texto.
const LUVIA_INK = "#1b1b1b";
// Paleta de luvia-ia.es: --sage-600 (verde de los botones), crema del hero y teja del antetítulo.
const LUVIA_SAGE = "#4c765a";
const LUVIA_CREAM = "#f3efe8";
const LUVIA_RUST = "#b4441c";
const LUVIA_WEB_URL = "https://luvia-ia.es";
const LUVIA_TEXT = `margin:0 0 14px;color:${LUVIA_INK};font-size:15px;line-height:1.55;`;

// [LUVIA] Cuerpo con pinta de correo personal: texto a 15 px como el de Gmail, un mini banner con
// la estética de luvia-ia.es y su botón a la web (la CTA principal: ver a Luvia y hablarle), el WhatsApp como enlace normal
// debajo y la 2ª línea de la firma en gris. Los dos enlaces se pintan juntos donde aparezca el
// primero y SIEMPRE con la web delante (los borradores viejos traen el WhatsApp primero).
const LUVIA_WEB_LINE = /^(?:H[aá]blale por voz|Pru[eé]bala en luvia-ia\.es):\s*(https:\/\/luvia-ia\.es\S*)$/i;
const LUVIA_WA_LINE = /^(?:O\s+)?Escr[ií]bele por WhatsApp:\s*(https:\/\/wa\.me\/\d+\?text=\S+)$/i;

// [LUVIA] Mini banner con la estética de luvia-ia.es (crema, titular serif con "cada llamada" en
// verde cursiva, antetítulo en teja, botón píldora verde). Todo HTML, sin imágenes: se ve igual con
// las imágenes bloqueadas (Outlook, Zoho…). La serif de la web no carga en email → Georgia.
// Titular y subtítulo también enlazan a la web: quien pincha en la tarjeta en vez de en el botón
// llega igual (mismo href → mismo contador lweb).
function luviaBanner(webUrl: string): string {
  const serif = "Georgia,'Times New Roman',serif";
  return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:24px 0 12px;"><tr>` +
    `<td class="lv-card" bgcolor="${LUVIA_CREAM}" style="background:${LUVIA_CREAM};border:1px solid #e6e0d4;border-radius:14px;padding:22px 24px 24px;">` +
    `<p style="margin:0 0 14px;font-family:${serif};font-size:20px;line-height:1;color:${LUVIA_INK};">Luvia <span style="font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:10px;font-weight:600;color:${LUVIA_SAGE};border:1px solid ${LUVIA_SAGE};border-radius:6px;padding:1px 4px;vertical-align:middle;">IA</span></p>` +
    `<p style="margin:0 0 8px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${LUVIA_RUST};font-weight:600;">Recepcionista con IA para cl&iacute;nicas</p>` +
    `<p class="lv-h" style="margin:0 0 10px;font-family:${serif};font-size:26px;line-height:1.2;color:${LUVIA_INK};"><a href="${webUrl}" style="color:${LUVIA_INK};text-decoration:none;">Coge <em style="color:${LUVIA_SAGE};">cada llamada</em>. Agenda la cita.</a></p>` +
    `<p style="margin:0 0 18px;font-size:14px;line-height:1.5;color:#57534e;"><a href="${webUrl}" style="color:#57534e;text-decoration:none;">H&aacute;blale ahora en la web y compru&eacute;balo: contesta en segundos, de d&iacute;a y de noche.</a></p>` +
    `<table class="lv-btn" cellpadding="0" cellspacing="0" role="presentation"><tr>` +
    `<td align="center" bgcolor="${LUVIA_SAGE}" style="background:${LUVIA_SAGE};border-radius:999px;">` +
    `<a href="${webUrl}" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;line-height:1.2;">Pru&eacute;bala en luvia-ia.es &rarr;</a>` +
    `</td></tr></table>` +
    `</td></tr></table>`;
}

// [LUVIA] Firma: barra verde a la izquierda, nombre, marca en serif y web + teléfono. El teléfono
// va como texto (no wa.me): un wa.me sin ?text= lo capturaría el contador "wa" de las webs.
function luviaSignature(): string {
  const serif = "Georgia,'Times New Roman',serif";
  return `<table cellpadding="0" cellspacing="0" role="presentation" style="margin:4px 0 0;"><tr>` +
    `<td style="border-left:3px solid ${LUVIA_SAGE};padding:2px 0 2px 12px;">` +
    `<p style="margin:0;font-size:15px;line-height:1.4;font-weight:600;color:${LUVIA_INK};">Nico</p>` +
    `<p style="margin:0 0 4px;font-size:14px;line-height:1.4;color:#5f6368;"><span style="font-family:${serif};font-size:15px;color:${LUVIA_INK};">Luvia</span> &middot; recepcionista con IA para cl&iacute;nicas</p>` +
    `<p style="margin:0;font-size:13px;line-height:1.4;color:#5f6368;"><a href="${LUVIA_WEB_URL}" style="color:${LUVIA_SAGE};text-decoration:none;font-weight:600;">luvia-ia.es</a> &middot; <a href="tel:+34632217400" style="color:#5f6368;text-decoration:none;">+34 632 21 74 00</a></p>` +
    `</td></tr></table>`;
}

function luviaBodyToHtml(text: string): string {
  const linkify = (s: string) =>
    s.replace(/(https?:\/\/[^\s<]+)/g, `<a href="$1" style="color:${LUVIA_INK};text-decoration:underline;">$1</a>`);
  const paras = text.split(/\n{2,}/).map((p) => p.split("\n").map((l) => l.trim()).filter(Boolean));
  const one = (lines: string[]) => (lines.length === 1 ? lines[0] : "");
  const webUrl = paras.map((l) => one(l).match(LUVIA_WEB_LINE)?.[1]).find(Boolean);
  const waUrl = paras.map((l) => one(l).match(LUVIA_WA_LINE)?.[1]).find(Boolean);
  const ctas =
    (webUrl ? luviaBanner(webUrl) : "") +
    (waUrl
      ? `<p style="margin:0 0 26px;color:#5f6368;font-size:14px;line-height:1.5;">${webUrl ? "o, si lo prefieres, " : ""}<a href="${waUrl.replace(/&/g, "&amp;")}" style="color:${LUVIA_INK};text-decoration:underline;">escr&iacute;bele por WhatsApp</a></p>`
      : "");
  let ctasDone = false;
  return paras
    .map((lines) => {
      if (LUVIA_WEB_LINE.test(one(lines)) || LUVIA_WA_LINE.test(one(lines))) {
        if (ctasDone) return "";
        ctasDone = true;
        return ctas;
      }
      // Firma "Nico / Luvia — …" → bloque de firma con barra verde, marca y contacto.
      if (lines.length === 2 && /^nico$/i.test(lines[0])) return luviaSignature();
      return `<p style="${LUVIA_TEXT}">${lines.map(linkify).join("<br>")}</p>`;
    })
    .join("");
}

// Convierte el cuerpo en texto plano a HTML:
//  - párrafos separados por línea en blanco
//  - una línea que es SOLO una URL → botón slim "Ver la web →"
//  - el resto → texto normal (incluida la firma, que ya viene en el cuerpo)
export function bodyToHtml(text: string, brand: EmailBrand = "webforge"): string {
  if (brand === "luvia") return luviaBodyToHtml(text);
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
    // Degradación con imágenes bloqueadas (Outlook, Zoho y compañía las bloquean por defecto):
    // el `height` reserva el hueco 16:9 de la captura (todas son 1920x1080 → 540x304) y el texto
    // del `alt` va estilado EN EL PROPIO <img> (el alt hereda del img, no del <td>, por eso el
    // font-size:0 de la celda —que mata el hueco fantasma bajo la imagen— no lo esconde).
    // Sin esto el prospecto ve un icono roto diminuto en vez de la web.
    `<tr><td bgcolor="#FAFAF9" style="background:#FAFAF9;font-size:0;line-height:0;">` +
    `<img src="${previewImageUrl}" width="540" height="304" alt="Vista previa de tu web &#8212; haz clic para verla" ` +
    `style="display:block;width:100%;height:auto;border:0;font-family:-apple-system,'Segoe UI',Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;font-weight:600;color:#57534E;text-align:center;" />` +
    `</td></tr>` +
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
  // Enlace de baja con un clic (RFC 8058). Si viene, el pie muestra "Darte de baja" clicable
  // junto al "responde BAJA". La versión legible por máquina va en la cabecera List-Unsubscribe.
  unsubscribeUrl?: string | null;
  // Seguimiento de clics (ver clickTracking.ts): si viene, los enlaces a la web, a /book y al
  // WhatsApp del pie salen por <base>/<leadId>/<destino>. null/undefined (o base null) → enlaces directos.
  clickTracking?: { base: string | null; leadId: string; messageId?: string | null } | null;
  // [LUVIA] Aviso legal de la marca que firma. Si viene, sustituye al derivado de bookingUrl
  // (los emails de Luvia no llevan /book).
  legalUrl?: string | null;
  // [LUVIA] "luvia" → layout de correo personal: alineado a la izquierda (sin la columna centrada
  // que en Gmail deja un hueco enorme), texto a 15 px y pie legal compacto. Sin escaparate.
  brand?: EmailBrand;
}

// [LUVIA] Gmail convierte "luvia-ia.es" suelto en un enlace azul chillón: lo enlazamos nosotros en
// el gris del pie (mismo href que la web → mismo contador lweb).
function luviaFootIdentity(identity: string): string {
  return identity.replace(/\bluvia-ia\.es\b/, `<a href="${LUVIA_WEB_URL}" style="color:#9aa0a6;text-decoration:underline;">luvia-ia.es</a>`);
}

// [LUVIA] HTML completo: alineado a la izquierda y sin padding lateral propio (Gmail/Apple Mail ya
// ponen el suyo), así el texto arranca a la altura del remitente como un correo normal.
function luviaEmailHtml(o: {
  bodyText: string; subject: string; senderIdentity: string; legalUrl: string | null;
  unsubscribeUrl?: string | null; pixel: string;
}): string {
  const foot = "color:#9aa0a6;font-size:12px;line-height:1.5;";
  const extras = [
    o.legalUrl ? `<a href="${o.legalUrl}" style="color:#9aa0a6;text-decoration:underline;">Aviso legal</a>` : "",
    o.unsubscribeUrl ? `<a href="${o.unsubscribeUrl}" style="color:#9aa0a6;text-decoration:underline;">Darte de baja</a>` : "",
  ].filter(Boolean);
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>${o.subject}</title>
  <style>
    @media only screen and (max-width:480px) {
      .lv-card { padding:18px 18px 20px !important; }
      .lv-h { font-size:22px !important; }
      .lv-btn { width:100% !important; }
      .lv-btn a { display:block !important; text-align:center !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,'Segoe UI',Roboto,Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;">
    <tr>
      <td align="left" style="padding:4px 0 8px;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;">
          <tr>
            <td align="left" style="color:${LUVIA_INK};font-family:-apple-system,'Segoe UI',Roboto,Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;">
              ${bodyToHtml(o.bodyText, "luvia")}
              <p style="margin:28px 0 0;padding-top:12px;border-top:1px solid #ececec;${foot}">Te escribo a t&iacute;tulo profesional; tu contacto est&aacute; en tu ficha p&uacute;blica. Si no quieres m&aacute;s correos, responde <strong>BAJA</strong> y borro tus datos.</p>
              <p style="margin:4px 0 0;${foot}">${luviaFootIdentity(o.senderIdentity)}${extras.length ? ` &middot; ${extras.join(" &middot; ")}` : ""}</p>
              ${o.pixel}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Devuelve el HTML completo del email. NO añade firma (el cuerpo ya la trae) ni
// botón de WhatsApp. Con captura → escaparate (captura enmarcada + 2 CTAs); sin
// captura → texto plano + (enlace de compra opcional). Siempre: opt-out + píxel.
export function renderEmail({ bodyText, trackingPixelUrl, subject = "", bookingUrl, previewImageUrl, webUrl, senderIdentity = DEFAULT_SENDER_IDENTITY, unsubscribeUrl, clickTracking, legalUrl: legalUrlOpt, brand = "webforge" }: RenderEmailOptions): string {
  const pixel = trackingPixelUrl
    ? `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none;border:0;" alt="" />`
    : "";
  if (brand === "luvia") {
    const html = luviaEmailHtml({ bodyText, subject, senderIdentity, legalUrl: legalUrlOpt ?? null, unsubscribeUrl, pixel });
    return clickTracking?.base
      ? trackEmailLinks(html, { ...clickTracking, base: clickTracking.base, webUrl: null, bookUrl: null })
      : html;
  }

  // Enlace de baja clicable en el pie (opcional). El botón nativo "Cancelar suscripción" del
  // cliente de correo sale de la cabecera List-Unsubscribe; esto es su equivalente visible.
  // Aviso legal (NIF y domicilio, LSSI art. 10) en la web de la marca: mismo dominio que /book.
  let legalUrl: string | null = legalUrlOpt ?? null;
  try {
    if (!legalUrl && bookingUrl) legalUrl = `${new URL(bookingUrl).origin}/aviso-legal`;
  } catch { /* bookingUrl inválida → sin enlace */ }
  const unsub = unsubscribeUrl
    ? `<p style="margin:6px 0 0;color:#9ca3af;font-size:13px;line-height:1.5;"><a href="${unsubscribeUrl}" style="color:#9ca3af;text-decoration:underline;">Darte de baja con un clic</a></p>`
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

  const html = `<!DOCTYPE html>
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
              <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.5;">${senderIdentity}${legalUrl ? ` · <a href="${legalUrl}" style="color:#9ca3af;text-decoration:underline;">Aviso legal</a>` : ""}</p>
              ${unsub}
              ${pixel}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return clickTracking?.base
    ? trackEmailLinks(html, { ...clickTracking, base: clickTracking.base, webUrl, bookUrl: bookingUrl })
    : html;
}
