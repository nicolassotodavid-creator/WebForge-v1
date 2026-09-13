// Test de un solo uso (no hay framework): se ejecuta con
//   node --experimental-strip-types src/lib/activity.test.ts
import {
  buildActivity,
  describeEvent,
  messageEngagement,
  summarizeActivity,
  trackedLink,
  type ActivityMessage,
  type LeadEvent,
} from "./activity.ts";

let failures = 0;
function assertEq(actual: unknown, expected: unknown, msg: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "✓" : "✗"} ${msg}  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`);
  if (!ok) failures++;
}

const M1: ActivityMessage = { id: "m1", channel: "email", email_number: 1, sent_at: "2026-07-08T14:35:20Z", opened_at: null };
const M2: ActivityMessage = { id: "m2", channel: "email", email_number: 2, sent_at: "2026-07-12T08:00:00Z", opened_at: "2026-07-12T08:00:10Z" };
const MSGS = [M1, M2];

let seq = 0;
function ev(type: string, created_at: string, payload: Record<string, unknown> = {}): LeadEvent {
  return { id: `e${++seq}`, lead_id: "L", type, payload, created_at };
}

// ── describeEvent ────────────────────────────────────────────────────────────
{
  const scanner = describeEvent(ev("email_opened", "2026-07-08T14:35:25Z", { message_id: "m1" }), MSGS)!;
  assertEq([scanner.label, scanner.automatic], ["Abrió el Email 1", true], "apertura a 5 s del envío → automática (caso IMPERCLIMA)");
  const person = describeEvent(ev("email_opened", "2026-07-08T19:35:12Z", { message_id: "m1" }), MSGS)!;
  assertEq(person.automatic, false, "apertura 5 h después → persona");
  const flagged = describeEvent(ev("email_opened", "2026-07-09T10:00:00Z", { message_id: "m1", too_soon: true }), MSGS)!;
  assertEq(flagged.automatic, true, "too_soon del servidor manda");

  const click = describeEvent(ev("link_clicked", "2026-07-09T10:00:00Z", { message_id: "m1", target: "book", automatic: false }), MSGS)!;
  assertEq([click.kind, click.label, click.automatic], ["click", "Pulsó «Ver la propuesta» en el Email 1", false], "clic humano en la propuesta");
  const preview = describeEvent(ev("link_clicked", "2026-07-09T10:00:00Z", { target: "web", channel: "whatsapp", automatic: true }), MSGS)!;
  assertEq([preview.label, preview.automatic], ["Pulsó «Ver la web» en el WhatsApp", true], "vista previa de WhatsApp → automática");

  const operator = describeEvent(ev("demo_viewed", "2026-07-09T10:00:00Z", { operator: true }), MSGS)!;
  assertEq([operator.automatic, operator.detail], [true, "tú, con sesión del panel"], "visita a /book del operador → automática");
  assertEq(describeEvent(ev("home_estimator_audit", "2026-09-13T10:00:00Z"), MSGS), null, "auditoría del simulador → fuera de la actividad");
  assertEq(describeEvent(ev("email_sent", "2026-07-08T14:35:20Z", { message_id: "m1" }), MSGS)!.label, "Email 1 enviado", "envío con número de email del mensaje");
}

// ── buildActivity + summarizeActivity ────────────────────────────────────────
{
  const events = [
    ev("email_sent", "2026-07-08T14:35:20Z", { message_id: "m1" }),
    ev("email_opened", "2026-07-08T14:35:25Z", { message_id: "m1" }),
    ev("email_opened", "2026-07-08T19:35:12Z", { message_id: "m1" }),
    ev("link_clicked", "2026-07-08T19:36:00Z", { message_id: "m1", target: "web", automatic: false }),
    ev("link_clicked", "2026-07-08T14:35:30Z", { message_id: "m1", target: "web", automatic: true }),
    ev("demo_viewed", "2026-07-08T19:37:00Z"),
    ev("demo_viewed", "2026-07-09T09:00:00Z", { operator: true }),
    ev("booking_started", "2026-07-08T19:38:00Z", { channel: "whatsapp" }),
    ev("luvia_restage", "2026-07-24T10:00:00Z"),
  ];
  const items = buildActivity(events, MSGS);
  assertEq(items.length, 8, "oculta los tipos internos");
  assertEq(items[0].at, "2026-07-09T09:00:00Z", "lo más reciente primero");
  assertEq(
    summarizeActivity(events, MSGS),
    { opens: 1, webClicks: 1, bookClicks: 0, waClicks: 0, bookVisits: 1, waIntents: 1 },
    "el resumen solo cuenta al prospecto",
  );
}

// ── messageEngagement ────────────────────────────────────────────────────────
{
  const events = [
    ev("email_opened", "2026-07-08T14:35:25Z", { message_id: "m1" }),
    ev("email_opened", "2026-07-08T19:35:12Z", { message_id: "m1" }),
    ev("link_clicked", "2026-07-08T19:36:00Z", { message_id: "m1", target: "book", automatic: false }),
    ev("link_clicked", "2026-07-08T14:35:30Z", { message_id: "m1", target: "web", automatic: true }),
  ];
  const eng = messageEngagement(events, MSGS);
  assertEq(eng.m1.firstOpen, "2026-07-08T19:35:12Z", "primera apertura humana, no la del escáner");
  assertEq([eng.m1.autoOpens, eng.m1.autoClicks], [1, 1], "cuenta aparte lo automático");
  assertEq(eng.m1.clicks, [{ target: "book", at: "2026-07-08T19:36:00Z" }], "clics humanos con destino");
  assertEq([eng.m2.firstOpen, eng.m2.autoOpens], [null, 1], "opened_at histórico a 10 s del envío → automático");
}

// ── trackedLink ──────────────────────────────────────────────────────────────
assertEq(
  trackedLink("https://www.nico-soto.es/", "9334c48a-1b2c-4d5e-8f90-a1b2c3d4e5f6", "web"),
  "https://www.nico-soto.es/r/9334c48a-1b2c-4d5e-8f90-a1b2c3d4e5f6/web?c=whatsapp",
  "enlace del WhatsApp manual con seguimiento",
);

console.log(failures === 0 ? "\nOK" : `\n${failures} FALLO(S)`);
if (failures) process.exit(1);
