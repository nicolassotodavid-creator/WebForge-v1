// node --experimental-strip-types supabase/functions/_shared/luviaHandoff.test.ts
import { buildLuviaClientPayload, canHandoffToLuvia } from "./luviaHandoff.ts";

let failures = 0;
function assertEq(actual: unknown, expected: unknown, msg: string) {
  const ok = actual === expected;
  console.log(`${ok ? "✓" : "✗"} ${msg}  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`);
  if (!ok) failures++;
}

const ADMIN = "11111111-1111-1111-1111-111111111111";
const OP = "22222222-2222-2222-2222-222222222222";

// canHandoffToLuvia: mismas reglas que isLuviaLead
assertEq(canHandoffToLuvia(OP, ADMIN), true, "lead de otro dueño = se puede entregar");
assertEq(canHandoffToLuvia(ADMIN, ADMIN), false, "lead del admin = NO se entrega");
assertEq(canHandoffToLuvia(null, ADMIN), false, "lead sin dueño = NO se entrega");
assertEq(canHandoffToLuvia(OP, undefined), false, "sin ADMIN_USER_ID = NO se entrega (compat)");

// buildLuviaClientPayload: mapeo de campos
const lead = {
  id: "lead-1", name: "Clínica Bella", category: "Clínica estética",
  phone: "+34600111222", whatsapp: "+34600111222", email: "hola@bella.es",
  address: "Calle Mayor 1", city: "Valencia", country: "ES",
  rating: 4.8, review_count: 137, owner: OP,
};
const payload = buildLuviaClientPayload(lead);
assertEq(payload.webforge_lead_id, "lead-1", "payload.webforge_lead_id = lead.id");
assertEq(payload.nombre, "Clínica Bella", "payload.nombre = lead.name");
assertEq(payload.telefono, "+34600111222", "payload.telefono = lead.phone");
assertEq(payload.ciudad, "Valencia", "payload.ciudad = lead.city");
assertEq(payload.resenas, 137, "payload.resenas = lead.review_count");
assertEq(payload.source, "webforge", "payload.source = 'webforge'");

console.log(failures === 0 ? "\nOK" : `\n${failures} FALLO(S)`);
if (failures) process.exit(1);
