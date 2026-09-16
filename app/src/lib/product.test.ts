// Test de un solo uso (no hay framework): node --experimental-strip-types src/lib/product.test.ts
import { messageLabel, messageProduct } from "./product.ts";

let failures = 0;
function assertEq(actual: unknown, expected: unknown, msg: string) {
  const ok = actual === expected;
  console.log(`${ok ? "✓" : "✗"} ${msg}  (got ${actual}, want ${expected})`);
  if (!ok) failures++;
}

assertEq(messageProduct({ email_number: 1 }), "webs", "Email 1 de webs");
assertEq(messageProduct({ email_number: 3 }), "webs", "Email 3 de webs");
assertEq(messageProduct({ email_number: 0 }), "webs", "WhatsApp manual (0) es de webs");
assertEq(messageProduct({ email_number: null }), "webs", "sin número = webs");
assertEq(messageProduct({ email_number: 101 }), "simulador", "101 es del simulador");
assertEq(messageLabel({ channel: "email", email_number: 2 }), "Email 2", "etiqueta webs");
assertEq(messageLabel({ channel: "whatsapp", email_number: 0 }), "WhatsApp", "etiqueta WhatsApp");
assertEq(messageLabel({ channel: "email", email_number: 101 }), "Simulador · Email 1", "etiqueta simulador 1");
assertEq(messageLabel({ channel: "email", email_number: 102 }), "Simulador · Seguimiento", "etiqueta simulador 2");

if (failures) { console.error(`${failures} fallo(s)`); process.exit(1); }
