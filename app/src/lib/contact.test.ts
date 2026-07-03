// Test de un solo uso (no hay framework): se ejecuta con
//   node --experimental-strip-types src/lib/contact.test.ts
import { waLink, whatsappOutreachText } from "./contact.ts";

let failures = 0;
function assert(cond: boolean, msg: string) {
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) failures++;
}
function assertEq(actual: unknown, expected: unknown, msg: string) {
  const ok = actual === expected;
  console.log(`${ok ? "✓" : "✗"} ${msg}  (got ${actual}, want ${expected})`);
  if (!ok) failures++;
}

const leadWa = { whatsapp: "600782211", phone: null }; // móvil 9 díg → 34600782211
const leadFijo = { whatsapp: null, phone: "912345678" }; // fijo → sin WhatsApp

// waLink SIN mensaje = comportamiento actual intacto
assertEq(waLink(leadWa), "https://wa.me/34600782211", "waLink pelado (sin texto)");
assertEq(waLink(leadFijo), null, "fijo sin whatsapp → null");

// waLink CON mensaje = ?text= correctamente encodeado
assertEq(
  waLink(leadWa, "Hola qué tal"),
  "https://wa.me/34600782211?text=Hola%20qu%C3%A9%20tal",
  "waLink con ?text= encodeado",
);
assertEq(waLink(leadFijo, "Hola"), null, "sin número → null aunque haya mensaje");

// whatsappOutreachText — con negocio
const t = whatsappOutreachText("Bar Paco", "https://web.com/", "https://x.com/book/1");
assert(t.includes("Bar Paco"), "incluye el negocio");
assert(t.includes("https://web.com/"), "incluye liveUrl");
assert(t.includes("https://x.com/book/1"), "incluye bookUrl");

// whatsappOutreachText — sin negocio (vacío/null) omite el nombre pero mantiene los enlaces
const t2 = whatsappOutreachText("", "https://web.com/", "https://x.com/book/1");
assert(!t2.includes("web para"), "negocio vacío → sin 'web para'");
assert(
  t2.includes("https://web.com/") && t2.includes("https://x.com/book/1"),
  "vacío mantiene los dos enlaces",
);
const t3 = whatsappOutreachText(null, "https://web.com/", "https://x.com/book/1");
assert(!t3.includes("web para"), "negocio null → sin 'web para'");

console.log(failures === 0 ? "\nOK" : `\n${failures} FALLO(S)`);
if (failures) process.exit(1);
