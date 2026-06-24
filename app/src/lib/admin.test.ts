// Test de un solo uso (no hay framework): se ejecuta con
//   node --experimental-strip-types src/lib/admin.test.ts
import { isAdminEmail } from "./admin.ts";

let failures = 0;
function assertEq(actual: unknown, expected: unknown, msg: string) {
  const ok = actual === expected;
  console.log(`${ok ? "✓" : "✗"} ${msg}  (got ${actual}, want ${expected})`);
  if (!ok) failures++;
}

const ADMIN = "nicolassotodavid@gmail.com";
assertEq(isAdminEmail(ADMIN, ADMIN), true, "mismo email = admin");
assertEq(isAdminEmail("miguel@x.com", ADMIN), false, "otro email = no admin");
assertEq(isAdminEmail("Nicolassotodavid@Gmail.com", ADMIN), true, "case-insensitive + trim");
assertEq(isAdminEmail(null, ADMIN), false, "sin sesión = no admin");
assertEq(isAdminEmail("x@y.com", undefined), false, "sin VITE_ADMIN_EMAIL = no admin");

console.log(failures === 0 ? "\nOK" : `\n${failures} FALLO(S)`);
if (failures) process.exit(1);
