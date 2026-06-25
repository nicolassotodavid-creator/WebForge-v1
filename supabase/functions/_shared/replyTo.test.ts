// node --experimental-strip-types supabase/functions/_shared/replyTo.test.ts
import { replyToFor } from "./replyTo.ts";

let failures = 0;
function assertEq(actual: unknown, expected: unknown, msg: string) {
  const ok = actual === expected;
  console.log(`${ok ? "✓" : "✗"} ${msg}  (got ${actual}, want ${expected})`);
  if (!ok) failures++;
}

const ADMIN = "11111111-1111-1111-1111-111111111111";
const MIGUEL = "22222222-2222-2222-2222-222222222222";
const CFG = { webforge: "hola@nico-soto.es", luvia: "marketing@luvia-ia.es" };

assertEq(replyToFor(MIGUEL, ADMIN, CFG), "marketing@luvia-ia.es", "lead Luvia → buzón Luvia");
assertEq(replyToFor(ADMIN, ADMIN, CFG), "hola@nico-soto.es", "lead admin → buzón WebForge");
assertEq(replyToFor(null, ADMIN, CFG), "hola@nico-soto.es", "lead sin dueño (cron) → buzón WebForge");
assertEq(
  replyToFor(MIGUEL, ADMIN, { webforge: "hola@nico-soto.es", luvia: "  " }),
  undefined,
  "dirección vacía → undefined (se omite reply_to)",
);

console.log(failures === 0 ? "\nOK" : `\n${failures} FALLO(S)`);
if (failures) process.exit(1);
