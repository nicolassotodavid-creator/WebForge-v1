// node --experimental-strip-types supabase/functions/_shared/luvia.test.ts
import { isLuviaLead, luviaSiteState, buildLuviaOutreachPayload, buildLuviaFinalBody } from "./luvia.ts";

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

// ── luviaSiteState ─────────────────────────────────────────────────────────
assertEq(luviaSiteState({}), "unknown", "sin flags → unknown");
assertEq(luviaSiteState({ site_has_whatsapp: null, site_has_chat: null, site_has_bot: null }), "unknown", "todo null → unknown");
assertEq(luviaSiteState({ site_has_bot: true, site_has_whatsapp: true, site_has_chat: false }), "automated", "bot gana a whatsapp → automated");
assertEq(luviaSiteState({ site_has_whatsapp: true, site_has_chat: true, site_has_bot: false }), "hot", "whatsapp gana a chat → hot");
assertEq(luviaSiteState({ site_has_whatsapp: false, site_has_chat: true, site_has_bot: false }), "chat", "solo chat → chat");
assertEq(luviaSiteState({ site_has_whatsapp: false, site_has_chat: false, site_has_bot: false }), "none", "todo false → none");

// ── buildLuviaOutreachPayload (sin reseñas) ────────────────────────────────
const p = buildLuviaOutreachPayload({
  name: "Clínica X", category: "estética", city: "València",
  site_has_whatsapp: true, site_has_chat: false, site_has_bot: false,
  website_url: "https://clinicax.es",
  site_analysis: { _widgets: { vendors: [] } },
});
assertEq(p.site.state, "hot", "payload: state = hot");
assertEq(p.site.has_whatsapp, true, "payload: has_whatsapp");
assertEq(p.site.url, "https://clinicax.es", "payload: url");
assertEq(p.business.name, "Clínica X", "payload: business.name");
assertEq((p as Record<string, unknown>).rating, undefined, "payload: SIN rating");
assertEq((p as Record<string, unknown>).review_count, undefined, "payload: SIN review_count");
assertEq((p as Record<string, unknown>).demo_url, null, "payload: demo_url null cuando no hay demo");

// ── demo_url en el payload ─────────────────────────────────────────────────
const pDemo = buildLuviaOutreachPayload({
  name: "Clínica X", category: "estética", city: "València",
  site_has_whatsapp: true, site_has_chat: false, site_has_bot: false,
  website_url: "https://clinicax.es",
  site_analysis: { _widgets: { vendors: [] } },
  luvia_demo_url: "https://luvia-ia.es/demo/abc123",
});
assertEq((pDemo as Record<string, unknown>).demo_url, "https://luvia-ia.es/demo/abc123", "payload: demo_url presente");

// ── buildLuviaFinalBody ────────────────────────────────────────────────────
assertEq(buildLuviaFinalBody("Hola.\nNico", "https://luvia-ia.es/demo/x"), "Hola.\nNico\n\nhttps://luvia-ia.es/demo/x", "final body: link en su línea");
assertEq(buildLuviaFinalBody("Hola.\nNico", null), "Hola.\nNico", "final body: sin link si demoUrl null");
assertEq(buildLuviaFinalBody("  Hola.  ", "https://d"), "Hola.\n\nhttps://d", "final body: trim del body");

console.log(failures === 0 ? "\nOK" : `\n${failures} FALLO(S)`);
if (failures) process.exit(1);
