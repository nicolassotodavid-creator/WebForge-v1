// node --experimental-strip-types src/lib/funnel.test.ts
import assert from "node:assert/strict";
import { buildFunnel, funnelTotals, type FunnelMessage } from "./funnel.ts";
import type { LeadEvent } from "./activity.ts";

const sent = "2026-09-16T20:00:00.000Z";
const msgs: FunnelMessage[] = [
  { id: "m1", lead_id: "a", channel: "email", email_number: 1, status: "sent", sent_at: sent },
  { id: "m2", lead_id: "b", channel: "email", email_number: 1, status: "replied", sent_at: sent },
  { id: "m3", lead_id: "c", channel: "whatsapp", email_number: 0, status: "sent", sent_at: sent },
  { id: "m4", lead_id: "old", channel: "email", email_number: 1, status: "sent", sent_at: "2026-01-01T00:00:00Z" },
  { id: "m5", lead_id: "d", channel: "email", email_number: 1, status: "sent", sent_at: sent },
];
const ev = (lead: string, type: string, payload: Record<string, unknown>, at = "2026-09-16T21:00:00.000Z"): LeadEvent =>
  ({ id: `${lead}${type}${JSON.stringify(payload)}`, lead_id: lead, type, payload, created_at: at });
const events: LeadEvent[] = [
  ev("a", "link_clicked", { target: "web", message_id: "m1", automatic: false }),
  ev("a", "demo_viewed", {}),
  ev("a", "booking_started", { channel: "whatsapp" }),
  ev("c", "link_clicked", { target: "book", channel: "whatsapp", automatic: true }), // vista previa WA
  ev("c", "demo_viewed", { operator: true }), // Nico
  ev("d", "email_bounced", { email: "x@y.z" }),
  ev("d", "email_opened", { message_id: "m5" }, "2026-09-16T20:00:10.000Z"), // escáner (<60 s)
];

const rows = buildFunnel(msgs, events, "2026-09-10T00:00:00Z");
assert.equal(rows.length, 4, "excluye el lead fuera de ventana");
const by = Object.fromEntries(rows.map((r) => [r.leadId, r]));
assert.deepEqual(
  { o: by.a.opened, w: by.a.web, p: by.a.proposal, c: by.a.contact, r: by.a.replied },
  { o: true, w: true, p: true, c: true, r: false },
);
assert.equal(by.b.replied, true);
assert.equal(by.b.opened, true);
assert.equal(by.c.channel, "whatsapp");
assert.equal(by.c.proposal, false, "vista previa y operador no cuentan");
assert.equal(by.d.problem, "bounced");
assert.equal(by.d.opened, false, "apertura de escáner no cuenta");
assert.deepEqual(funnelTotals(rows), { contacted: 4, opened: 2, web: 1, proposal: 1, contact: 1, replied: 1 });
console.log("funnel.test.ts OK");
