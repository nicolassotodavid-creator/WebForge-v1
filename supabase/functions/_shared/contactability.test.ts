// node --experimental-strip-types supabase/functions/_shared/contactability.test.ts
import { isOptedOut } from "./contactability.ts";

let failures = 0;
function assertEq(actual: unknown, expected: unknown, msg: string) {
  const ok = actual === expected;
  console.log(`${ok ? "✓" : "✗"} ${msg}  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`);
  if (!ok) failures++;
}

assertEq(isOptedOut({ do_not_contact: true }), true, "do_not_contact=true → opted out (no se contacta)");
assertEq(isOptedOut({ do_not_contact: false }), false, "do_not_contact=false → contactable");
assertEq(isOptedOut({}), false, "sin el campo → contactable (default seguro)");
assertEq(isOptedOut(null), false, "lead null → false (no revienta la guardia)");
assertEq(isOptedOut(undefined), false, "lead undefined → false");
assertEq(isOptedOut({ do_not_contact: null }), false, "do_not_contact=null → contactable");

console.log(failures === 0 ? "\nOK" : `\n${failures} FALLO(S)`);
if (failures) process.exit(1);
