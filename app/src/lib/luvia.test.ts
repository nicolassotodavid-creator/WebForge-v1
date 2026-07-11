// node --experimental-strip-types src/lib/luvia.test.ts
import { luviaSiteState } from "./luvia.ts";

let failures = 0;
function assertEq(actual: unknown, expected: unknown, msg: string) {
  const ok = actual === expected;
  console.log(`${ok ? "✓" : "✗"} ${msg}  (got ${actual}, want ${expected})`);
  if (!ok) failures++;
}

assertEq(luviaSiteState({ site_has_whatsapp: null, site_has_chat: null, site_has_bot: null }), "unknown", "todo null → unknown");
assertEq(luviaSiteState({ site_has_whatsapp: true, site_has_chat: false, site_has_bot: true }), "automated", "bot gana → automated");
assertEq(luviaSiteState({ site_has_whatsapp: true, site_has_chat: true, site_has_bot: false }), "hot", "whatsapp gana a chat → hot");
assertEq(luviaSiteState({ site_has_whatsapp: false, site_has_chat: true, site_has_bot: false }), "chat", "solo chat → chat");
assertEq(luviaSiteState({ site_has_whatsapp: false, site_has_chat: false, site_has_bot: false }), "none", "todo false → none");

console.log(failures === 0 ? "\nOK" : `\n${failures} FALLO(S)`);
if (failures) process.exit(1);
