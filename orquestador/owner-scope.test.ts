// node --experimental-strip-types orquestador/owner-scope.test.ts
import { requireAdminUserId, adminOwnerFilter, isAdminScopedOwner } from "./owner-scope.ts";

let failures = 0;
function assert(ok: boolean, msg: string) {
  console.log(`${ok ? "✓" : "✗"} ${msg}`);
  if (!ok) failures++;
}
function throws(fn: () => unknown): boolean {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
}

const ADMIN = "0fd86a77-b1de-41da-b22f-ae9c196abca1";
const LUVIA = "e9536f1a-006b-497f-83a5-b3ffe6fb786d";

assert(throws(() => requireAdminUserId(undefined)), "sin ADMIN_USER_ID no arranca");
assert(throws(() => requireAdminUserId("")), "ADMIN_USER_ID vacío no arranca");
assert(throws(() => requireAdminUserId("   ")), "ADMIN_USER_ID en blanco no arranca");
assert(throws(() => requireAdminUserId("nicolassotodavid@gmail.com")), "un email no vale como ADMIN_USER_ID");
assert(requireAdminUserId(` ${ADMIN}\n`) === ADMIN, "UUID válido (con espacios) se acepta recortado");

assert(adminOwnerFilter(ADMIN) === `owner.eq.${ADMIN},owner.is.null`, "filtro: admin o sin dueño");

assert(isAdminScopedOwner(ADMIN, ADMIN), "lead del admin entra");
assert(isAdminScopedOwner(null, ADMIN), "lead sin dueño (cron) entra");
assert(!isAdminScopedOwner(LUVIA, ADMIN), "lead de Luvia NO entra");

if (failures) {
  console.error(`\n${failures} fallo(s)`);
  process.exit(1);
}
console.log("\nowner-scope OK");
