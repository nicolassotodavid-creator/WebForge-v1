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

console.log(failures === 0 ? "\nOK" : `\n${failures} FALLO(S)`);
if (failures) process.exit(1);
