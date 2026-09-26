// node --experimental-strip-types supabase/functions/_shared/luvia.test.ts
import {
  isLuviaLead, luviaSiteState, buildLuviaOutreachPayload, buildLuviaFinalBody, pickLuviaReviews,
  luviaShortName, luviaQuoteIssues, LUVIA_SIGNATURE,
} from "./luvia.ts";
import { luviaWhatsappUrl, isLuviaWhatsappUrl } from "./clickTracking.ts";

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

// ── buildLuviaOutreachPayload (con reseñas) ────────────────────────────────
const p = buildLuviaOutreachPayload({
  name: "Clínica X", category: "estética", city: "València",
  rating: "4.9", review_count: 603,
  raw_json: { reviews: [
    { stars: 5, text: "Tratamiento genial, el resultado muy natural y todo el equipo encantador.", name: "Ana P." },
    { stars: 2, text: "Imposible que te cojan el teléfono, tuve que ir en persona a pedir cita.", publishedAtDate: "2026-09-01T10:00:00Z" },
    { stars: 5, text: "Corta" },
  ] },
  site_has_whatsapp: true, site_has_chat: false, site_has_bot: false,
  website_url: "https://clinicax.es",
  site_analysis: { _widgets: { vendors: [] } },
});
assertEq(p.site.state, "hot", "payload: state = hot");
assertEq(p.site.url, "https://clinicax.es", "payload: url");
assertEq(p.business.name, "Clínica X", "payload: business.name");
assertEq(p.reviews.rating, 4.9, "payload: rating numérico");
assertEq(p.reviews.count, 603, "payload: review_count");
assertEq(p.reviews.samples.length, 2, "payload: descarta reseñas de <25 caracteres");
assertEq(p.reviews.samples[0].stars, 2, "payload: primero la que habla de contactar/cita");
assertEq(p.reviews.samples[0].date, "2026-09-01", "payload: fecha corta");
assertEq(JSON.stringify(p).includes("Ana P."), false, "payload: sin el nombre del autor");
assertEq(pickLuviaReviews(null).length, 0, "pickLuviaReviews: sin raw_json → []");

// ── buildLuviaFinalBody ────────────────────────────────────────────────────
const wa = luviaWhatsappUrl("Clínica X");
const fb = buildLuviaFinalBody("Hola,\nPárrafo.\n\nNico\nLuvia — atención al cliente con IA.", {
  whatsappUrl: wa, webUrl: "https://luvia-ia.es",
});
assertEq(fb.startsWith("Hola,\nPárrafo.\n\nPruébala en luvia-ia.es: https://luvia-ia.es\n\nO escríbele por WhatsApp: https://wa.me/34632217400?text="), true, "final body: quita la firma de la IA, web primero y WhatsApp después");

assertEq(fb.endsWith(LUVIA_SIGNATURE), true, "final body: firma del sistema al final");
assertEq(fb.split("Nico").length - 1, 1, "final body: una sola firma");
assertEq(decodeURIComponent(wa.split("text=")[1]).includes("soy de Clínica X"), true, "whatsapp: lleva el nombre de la clínica");
assertEq(isLuviaWhatsappUrl(wa), true, "whatsapp: el enlace generado es válido");
assertEq(isLuviaWhatsappUrl("https://wa.me/34600000000?text=x"), false, "whatsapp: otro número no vale");
assertEq(isLuviaWhatsappUrl("https://evil.com/?https://wa.me/34632217400"), false, "whatsapp: otro host no vale");

// ── luviaShortName ─────────────────────────────────────────────────────────
assertEq(luviaShortName("Benaes", "Clínica de Medicina Estética - Benaes"), "Benaes", "short name: el de la IA");
assertEq(luviaShortName("", "Clínicas de Medicina Estética en Valencia | Clínica Belice"), "Clínica Belice", "short name: fallback con marca");
assertEq(luviaShortName(null, "PaoVick - Centro de estética y bienestar"), "PaoVick", "short name: fallback el más corto");
assertEq(luviaShortName("x".repeat(60), "Clínica Lou - Medicina Estética"), "Clínica Lou", "short name: IA demasiado largo → fallback");

// ── luviaQuoteIssues ───────────────────────────────────────────────────────
const samples = p.reviews.samples;
assertEq(luviaQuoteIssues('Una paciente dice "imposible que te cojan el teléfono".', samples).length, 0, "citas: literal → ok");
assertEq(luviaQuoteIssues('Una paciente dice "nunca contestan los mensajes".', samples).length, 1, "citas: inventada → issue");

console.log(failures === 0 ? "\nOK" : `\n${failures} FALLO(S)`);
if (failures) process.exit(1);
