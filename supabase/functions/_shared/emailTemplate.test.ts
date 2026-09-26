// node --experimental-strip-types supabase/functions/_shared/emailTemplate.test.ts
import { bodyToHtml, withWhatsappFooter, bookingLink, renderEmail } from "./emailTemplate.ts";

let failures = 0;
function assertEq(actual: unknown, expected: unknown, msg: string) {
  const ok = actual === expected;
  console.log(`${ok ? "✓" : "✗"} ${msg}  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`);
  if (!ok) failures++;
}
function assertIncludes(haystack: string, needle: string, msg: string) {
  const ok = haystack.includes(needle);
  console.log(`${ok ? "✓" : "✗"} ${msg}`);
  if (!ok) { failures++; console.log(`   no contiene: ${needle}\n   en: ${haystack}`); }
}
function assertExcludes(haystack: string, needle: string, msg: string) {
  const ok = !haystack.includes(needle);
  console.log(`${ok ? "✓" : "✗"} ${msg}`);
  if (!ok) failures++;
}

const BODY = "Hola Ana,\nSolo por si no lo viste.\n\nhttps://ejemplo.com\n\nNico";

// ── withWhatsappFooter (puro, sin leer env) ──────────────────────────────────
// El pie va como PÁRRAFO PROPIO (\n\n) para no fundirse con la línea-URL del email 1.
assertEq(
  withWhatsappFooter(BODY, "34600782211"),
  `${BODY}\n\nWhatsApp: https://wa.me/34600782211`,
  "email + número válido → añade línea WhatsApp como párrafo propio",
);
assertEq(withWhatsappFooter(BODY, ""), BODY, "número vacío → cuerpo intacto (pie apagado)");
assertEq(withWhatsappFooter(BODY, null), BODY, "número null → cuerpo intacto");
assertEq(withWhatsappFooter(BODY, "12345"), BODY, "número demasiado corto → cuerpo intacto");
assertEq(withWhatsappFooter(BODY, "34600782211", "linkedin"), BODY, "canal linkedin → nunca añade WhatsApp");
assertEq(
  withWhatsappFooter(BODY, "+34 600 78 22 11"),
  `${BODY}\n\nWhatsApp: https://wa.me/34600782211`,
  "normaliza el número (quita +, espacios)",
);

// ── bodyToHtml: linkifica la URL del pie de WhatsApp ─────────────────────────
const withFooterHtml = bodyToHtml(withWhatsappFooter(BODY, "34600782211"));
assertIncludes(withFooterHtml, `href="https://wa.me/34600782211"`, "la URL de WhatsApp sale clicable (<a href>)");

// ── bodyToHtml: la URL sola en su línea sigue siendo el botón "Ver la web →" ──
const html = bodyToHtml(BODY);
assertIncludes(html, "Ver la web →", "URL en su propia línea → botón (sin regresión)");
assertExcludes(bodyToHtml("Hola Ana,\nQué tal."), "<a ", "texto sin URL → sin ningún enlace");

// ── REGRESIÓN (bug review #1): Email 1 con captura (escaparate) + pie WhatsApp ─
// Ruta real: generate-outreach guarda `${cuerpoIA}\n\n${bookUrl}` y luego withWhatsappFooter.
// Con el pie a un solo \n, el bookUrl dejaba de ir solo en su línea → renderEmail no lo
// sustituía por el escaparate → salía botón "Ver la web →" duplicado + captura al final.
// Con \n\n el bookUrl sigue suelto → el escaparate lo consume. Verificamos ambas cosas.
{
  const bookUrl = bookingLink("https://webforge.app/book", "lead-1")!; // https://webforge.app/book/lead-1
  const stored = withWhatsappFooter(`Hola Ana, te hice una web.\n\n${bookUrl}`, "34600782211");
  const showcaseHtml = renderEmail({
    bodyText: stored,
    subject: "Tu web está lista.",
    previewImageUrl: "https://cdn/site-previews/lead-1.png",
    webUrl: "https://clinica-ana.web.app",
    bookingUrl: bookUrl,
  });
  assertExcludes(showcaseHtml, "Ver la web →", "escaparate: el bookUrl NO sale como botón suelto duplicado");
  assertIncludes(showcaseHtml, "Ver la web entera", "escaparate: sí aparece el botón del escaparate");
  assertIncludes(showcaseHtml, `href="https://wa.me/34600782211"`, "escaparate: WhatsApp clicable tras la captura");
}

// ── Pie legal (LSSI Art. 21/10 + RGPD): opt-out BAJA + origen del dato + identidad ──
// Debe aparecer en TODO email (los 3), con captura o sin ella. Sin él, un envío en frío
// es infracción casi automática si el destinatario denuncia.
{
  const legal = renderEmail({ bodyText: "Hola Ana,\n\nNico", subject: "x" });
  assertIncludes(legal, "BAJA", "pie legal: incluye el opt-out BAJA");
  assertIncludes(legal, "ficha p", "pie legal: declara el origen del dato (ficha pública)");
  assertIncludes(legal, "David Nicol", "pie legal: identifica al remitente (default)");
  const custom = renderEmail({ bodyText: "Hola\n\nNico", subject: "x", senderIdentity: "Fulano SL &middot; B12345678" });
  assertIncludes(custom, "Fulano SL", "pie legal: senderIdentity override se respeta");
  assertExcludes(custom, "David Nicol", "pie legal: el override reemplaza el default");
}

// ── Copy neutro del escaparate: "Ver la propuesta", NO venta directa en el email ──
{
  const showcase = renderEmail({
    bodyText: "Hola Ana, te hice una web.\n\nhttps://webforge.app/book/lead-1\n\nNico",
    subject: "x",
    previewImageUrl: "https://cdn/site-previews/lead-1.png",
    webUrl: "https://clinica-ana.web.app",
    bookingUrl: "https://webforge.app/book/lead-1",
  });
  assertIncludes(showcase, "Ver la propuesta", "escaparate: botón neutro 'Ver la propuesta'");
  assertExcludes(showcase, "Activar mi web", "escaparate: sin CTA de venta directa 'Activar mi web'");
  assertExcludes(showcase, "sin permanencia", "escaparate: la venta dura (precio/permanencia) no va en el email");
  assertIncludes(showcase, "book/lead-1", "escaparate: el 2º enlace a /book se mantiene");
}

// ── Imágenes bloqueadas (Outlook/Zoho las bloquean por defecto): la captura debe degradar
// a un hueco con texto, no a un icono roto. El alt se estila EN EL <img> porque el <td>
// lleva font-size:0 (hueco fantasma) y ahí el texto del alt sería invisible.
{
  const showcase = renderEmail({
    bodyText: "Hola Ana, te hice una web.\n\nhttps://webforge.app/book/lead-1\n\nNico",
    subject: "x",
    previewImageUrl: "https://cdn/site-previews/lead-1.png",
    webUrl: "https://clinica-ana.web.app",
    bookingUrl: "https://webforge.app/book/lead-1",
  });
  const img = showcase.match(/<img[^>]*site-previews[^>]*>/)?.[0] ?? "";
  assertIncludes(img, `height="304"`, "captura: reserva el hueco 16:9 (540x304) con imágenes bloqueadas");
  assertIncludes(img, "haz clic para verla", "captura: el alt vende en vez de quedar en icono roto");
  assertIncludes(img, "font-size:15px", "captura: el alt es legible (estilo en el propio <img>)");
  assertIncludes(img, "color:#57534E", "captura: el alt lleva color de marca, no azul de enlace roto");
  assertIncludes(showcase, `bgcolor="#FAFAF9"`, "captura: el hueco bloqueado tiene fondo, no un vacío blanco");
}

// ── Seguimiento de clics: web, propuesta y WhatsApp salen por /r; la captura y la baja no ──
{
  const bookUrl = "https://www.nico-soto.es/book/lead-1";
  const tracked = renderEmail({
    bodyText: withWhatsappFooter(`Hola Ana, te hice una web.\n\n${bookUrl}`, "34600782211"),
    subject: "x",
    previewImageUrl: "https://cdn/site-previews/lead-1.png",
    webUrl: "https://clinica-ana.web.app",
    bookingUrl: bookUrl,
    unsubscribeUrl: "https://x/unsubscribe?lead=lead-1&sig=s",
    clickTracking: { base: "https://www.nico-soto.es/r", leadId: "lead-1", messageId: "msg-1" },
  });
  assertIncludes(tracked, `href="https://www.nico-soto.es/r/lead-1/web?m=msg-1&amp;c=email"`, "clics: la web sale por /r");
  assertIncludes(tracked, `href="https://www.nico-soto.es/r/lead-1/book?m=msg-1&amp;c=email"`, "clics: la propuesta sale por /r");
  assertIncludes(tracked, `href="https://www.nico-soto.es/r/lead-1/wa?m=msg-1&amp;c=email"`, "clics: el WhatsApp sale por /r");
  assertExcludes(tracked, `href="https://clinica-ana.web.app"`, "clics: no queda enlace directo a la web");
  assertIncludes(tracked, `src="https://cdn/site-previews/lead-1.png"`, "clics: la captura sigue siendo estática");
  assertIncludes(tracked, `href="https://x/unsubscribe?lead=lead-1&sig=s"`, "clics: la baja no pasa por el seguimiento");

  const direct = renderEmail({
    bodyText: "Hola\n\nhttps://clinica-ana.web.app\n\nNico",
    subject: "x",
    webUrl: "https://clinica-ana.web.app",
    clickTracking: { base: null, leadId: "lead-1" },
  });
  assertIncludes(direct, `href="https://clinica-ana.web.app"`, "clics: sin base → enlaces directos");
}

// ── [LUVIA] email: botón de WhatsApp de ventas + voz, sin escaparate ni /book ──────────
{
  const { luviaWhatsappUrl } = await import("./clickTracking.ts");
  const wa = luviaWhatsappUrl("Clínica Belice");
  const body = `Hola,\nTexto.\n\nEscríbele por WhatsApp: ${wa}\n\nHáblale por voz: https://luvia-ia.es\n\nNico\nLuvia — atención al cliente con IA`;
  const lead = "9334c48a-0000-4000-8000-000000000000";
  const html = renderEmail({
    bodyText: body,
    bookingUrl: null,
    senderIdentity: "David Nicolás Soto · Luvia IA (luvia-ia.es)",
    clickTracking: { base: "https://www.nico-soto.es/r", leadId: lead, messageId: "m1" },
    brand: "luvia",
  });
  assertIncludes(html, "Pru&eacute;bala en luvia-ia.es &rarr;", "luvia: el botón (CTA principal) va a la web");
  assertEq(html.indexOf("/lweb?") < html.indexOf("/lwa?"), true, "luvia: la web va delante del WhatsApp aunque el borrador viejo traiga el WhatsApp primero");
  assertExcludes(html, "#25D366", "luvia: botón en tinta de marca, no verde fosforito");
  assertExcludes(html, "max-width:560px", "luvia: alineado a la izquierda, sin la columna centrada de las webs");
  assertIncludes(html, "@media only screen and (max-width:480px)", "luvia: versión móvil (botón a todo el ancho)");
  assertIncludes(html, "border-left:3px solid #4c765a", "luvia: firma con la barra verde");
  assertIncludes(html, "+34 632 21 74 00", "luvia: firma con el teléfono");
  assertExcludes(html, 'href="https://wa.me/34632217400"', "luvia: el teléfono de la firma no es un wa.me (lo capturaría el contador de las webs)");
  assertIncludes(html, "o, si lo prefieres, <a", "luvia: WhatsApp como enlace secundario");
  assertIncludes(html, "escr&iacute;bele por WhatsApp</a>", "luvia: texto del enlace de WhatsApp");
  assertIncludes(html, `href="https://www.nico-soto.es/r/${lead}/lwa?m=m1&amp;c=email"`, "luvia: WhatsApp pasa por el contador");
  assertIncludes(html, `href="https://www.nico-soto.es/r/${lead}/lweb?m=m1&amp;c=email"`, "luvia: voz pasa por el contador");
  assertExcludes(html, "wa.me/34632217400", "luvia: no queda el enlace directo al WhatsApp");
  assertExcludes(html, "Ver la propuesta", "luvia: sin /book");
  assertExcludes(html, "Si ya la quieres", "luvia: sin enlace de compra");
  assertExcludes(html, "Aviso legal", "luvia: sin aviso legal si no se configura");
  assertIncludes(html, "David Nicolás Soto · Luvia IA (<a ", "luvia: pie con la identidad de Luvia (luvia-ia.es enlazado en gris)");
  const direct = renderEmail({ bodyText: body, brand: "luvia" });
  assertIncludes(direct, `href="${wa.replace(/&/g, "&amp;")}"`, "luvia: sin contador → WhatsApp directo con el texto");
}

console.log(failures === 0 ? "\nOK" : `\n${failures} FALLO(S)`);
if (failures) process.exit(1);
