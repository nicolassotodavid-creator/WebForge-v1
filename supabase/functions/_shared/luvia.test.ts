// node --experimental-strip-types supabase/functions/_shared/luvia.test.ts
import { isLuviaLead } from "./luvia.ts";

let failures = 0;
function assertEq(actual: unknown, expected: unknown, msg: string) {
  const ok = actual === expected;
  console.log(`${ok ? "✓" : "✗"} ${msg}  (got ${actual}, want ${expected})`);
  if (!ok) failures++;
}

const ADMIN = "11111111-1111-1111-1111-111111111111";
const MIGUEL = "22222222-2222-2222-2222-222222222222";
assertEq(isLuviaLead(MIGUEL, ADMIN), true, "lead de otro usuario = Luvia");
assertEq(isLuviaLead(ADMIN, ADMIN), false, "lead del admin = no Luvia");
assertEq(isLuviaLead(null, ADMIN), false, "lead sin dueño (cron) = no Luvia");
assertEq(isLuviaLead(MIGUEL, undefined), false, "sin ADMIN_USER_ID = no Luvia (compat)");

console.log(failures === 0 ? "\nOK" : `\n${failures} FALLO(S)`);
if (failures) process.exit(1);
