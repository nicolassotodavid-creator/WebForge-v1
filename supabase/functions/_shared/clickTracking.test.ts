// node --experimental-strip-types supabase/functions/_shared/clickTracking.test.ts
import {
  clickBase,
  clickUrl,
  isLikelyBot,
  isTooSoonAfterSend,
  parseClickPath,
  demoUrl,
  trackEmailLinks,
} from "./clickTracking.ts";

let failures = 0;
function assertEq(actual: unknown, expected: unknown, msg: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "✓" : "✗"} ${msg}  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`);
  if (!ok) failures++;
}

const LEAD = "9334c48a-1b2c-4d5e-8f90-a1b2c3d4e5f6";
const MSG = "5b6d599b-d292-4e76-ba36-f8296cceae59";

// ── clickBase ────────────────────────────────────────────────────────────────
assertEq(clickBase("https://www.nico-soto.es/", "https://x.supabase.co"), "https://www.nico-soto.es/r", "APP_URL → <dominio>/r");
assertEq(clickBase(null, "https://x.supabase.co"), "https://x.supabase.co/functions/v1/track-click", "sin APP_URL → función directa");
assertEq(clickBase("", undefined), null, "sin nada → null (no se rastrea)");

// ── clickUrl ─────────────────────────────────────────────────────────────────
const BASE = "https://www.nico-soto.es/r";
assertEq(
  clickUrl(BASE, LEAD, "web", { messageId: MSG, channel: "email" }),
  `${BASE}/${LEAD}/web?m=${MSG}&c=email`,
  "enlace con mensaje y canal",
);
assertEq(clickUrl(BASE, LEAD, "book"), `${BASE}/${LEAD}/book`, "sin opciones → sin query");
assertEq(clickUrl(BASE, LEAD, "wa", { channel: "whatsapp" }), `${BASE}/${LEAD}/wa?c=whatsapp`, "WhatsApp manual sin mensaje");

// ── parseClickPath ───────────────────────────────────────────────────────────
assertEq(parseClickPath(`/r/${LEAD}/book`), { leadId: LEAD, target: "book" }, "ruta pública /r");
assertEq(parseClickPath(`/track-click/${LEAD}/wa/`), { leadId: LEAD, target: "wa" }, "ruta de la función con barra final");
assertEq(parseClickPath(`/r/${LEAD.toUpperCase()}/WEB`), { leadId: LEAD, target: "web" }, "normaliza mayúsculas");
assertEq(parseClickPath(`/r/${LEAD}/home`), { leadId: LEAD, target: "home" }, "portada de la marca");
assertEq(parseClickPath(`/r/${LEAD}/evil`), null, "destino desconocido → null");
assertEq(parseClickPath(`/r/${LEAD}/demo`), { leadId: LEAD, target: "demo" }, "destino demo del simulador");
assertEq(demoUrl("cecever"), "https://presupuestos.nico-soto.es/demo/cecever", "demo con slug válido");
assertEq(demoUrl("x/../../evil.com"), null, "slug con barras → null");
assertEq(demoUrl(""), null, "sin slug → null");
assertEq(parseClickPath("/r/no-es-uuid/web"), null, "lead no válido → null");

// ── isLikelyBot ──────────────────────────────────────────────────────────────
const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
assertEq(isLikelyBot(CHROME), false, "Chrome de escritorio → persona");
assertEq(isLikelyBot(IPHONE), false, "Safari de iPhone → persona");
assertEq(isLikelyBot("WhatsApp/2.23.20.0 A"), true, "vista previa de WhatsApp → automático");
assertEq(isLikelyBot("facebookexternalhit/1.1 Facebot Twitterbot/1.0"), true, "vista previa de iMessage → automático");
assertEq(isLikelyBot("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"), true, "crawler → automático");
assertEq(isLikelyBot("Microsoft Office Existence Discovery"), true, "comprobación previa de Outlook → automático");
assertEq(isLikelyBot("curl/8.4.0"), true, "curl → automático");
assertEq(isLikelyBot(""), true, "sin user-agent → automático");
assertEq(isLikelyBot(null), true, "user-agent null → automático");

// ── isTooSoonAfterSend ───────────────────────────────────────────────────────
const SENT = "2026-07-08T14:35:20Z";
assertEq(isTooSoonAfterSend(SENT, "2026-07-08T14:35:25Z"), true, "4 s tras el envío (IMPERCLIMA) → escáner");
assertEq(isTooSoonAfterSend(SENT, "2026-07-08T19:35:12Z"), false, "5 h después → persona");
assertEq(isTooSoonAfterSend("2026-07-13T12:17:24Z", "2026-07-13T12:17:04Z"), true, "antes del envío (YuriCar) → prueba");
assertEq(isTooSoonAfterSend(null, "2026-07-08T19:35:12Z"), false, "sin sent_at → no se marca");

// ── trackEmailLinks ──────────────────────────────────────────────────────────
{
  const web = "https://web-adm-0d41f9.lovable.app";
  const book = `https://www.nico-soto.es/book/${LEAD}`;
  const unsub = `https://x.supabase.co/functions/v1/unsubscribe?lead=${LEAD}&sig=abc`;
  const html =
    `<a href="${web}"><img src="${web}/og.png"></a>` +
    `<a href="${web}">Ver la web entera</a>` +
    `<a href="${book}">Ver la propuesta</a>` +
    `<a href="https://wa.me/34600782211">WhatsApp</a>` +
    `<a href="${unsub}">Baja</a>`;
  const out = trackEmailLinks(html, { base: BASE, leadId: LEAD, messageId: MSG, webUrl: web, bookUrl: book });
  const tracked = (t: string) => `href="${BASE}/${LEAD}/${t}?m=${MSG}&amp;c=email"`;
  assertEq(out.split(tracked("web")).length - 1, 2, "captura y botón de la web pasan por el seguimiento");
  assertEq(out.includes(tracked("book")), true, "botón de la propuesta pasa por el seguimiento");
  assertEq(out.includes(tracked("wa")), true, "botón de WhatsApp pasa por el seguimiento");
  assertEq(out.includes(`src="${web}/og.png"`), true, "la imagen no se toca");
  assertEq(out.includes(`href="${unsub}"`), true, "el enlace de baja no se toca");
  assertEq(out.includes(`href="${web}"`), false, "no queda ningún enlace directo a la web");
}

console.log(failures === 0 ? "\nOK" : `\n${failures} FALLO(S)`);
if (failures) process.exit(1);
