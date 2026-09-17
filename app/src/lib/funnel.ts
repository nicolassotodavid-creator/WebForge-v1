// funnel.ts — Embudo por lead de un lote de outreach de webs: primer contacto (Email 1 o WhatsApp
// manual) → abrió → vio la web → vio la propuesta (/book) → pidió contacto (WhatsApp, email o pago)
// → respondió. Solo cuenta lo que hizo el prospecto (describeEvent marca escáneres, vistas previas
// y al operador como automáticos). Puro: node --experimental-strip-types src/lib/funnel.test.ts
import { describeEvent, type ActivityMessage, type LeadEvent } from "./activity.ts";

export interface FunnelMessage extends ActivityMessage {
  lead_id: string | null;
  status: string;
}

export interface FunnelRow {
  leadId: string;
  firstContact: string;
  channel: "email" | "whatsapp";
  opened: boolean;
  web: boolean;
  proposal: boolean;
  contact: boolean;
  replied: boolean;
  problem: "bounced" | "unsubscribed" | null;
}

export const FUNNEL_STEPS = [
  ["contacted", "Contactados"],
  ["opened", "Abrieron"],
  ["web", "Vieron la web"],
  ["proposal", "Vieron la propuesta"],
  ["contact", "Pidieron contacto"],
  ["replied", "Respondieron"],
] as const;

/** Mensajes de la secuencia de webs que abren un lote: Email 1 (1) o WhatsApp manual (0). */
function isFirstContact(m: FunnelMessage): boolean {
  return !!m.sent_at && (m.email_number === 1 || m.email_number === 0);
}

export function buildFunnel(
  messages: FunnelMessage[],
  events: LeadEvent[],
  sinceIso: string,
): FunnelRow[] {
  const byLead = new Map<string, FunnelMessage[]>();
  for (const m of messages) {
    if (!m.lead_id) continue;
    const list = byLead.get(m.lead_id) ?? [];
    list.push(m);
    byLead.set(m.lead_id, list);
  }

  const rows: FunnelRow[] = [];
  for (const [leadId, msgs] of byLead) {
    const first = msgs.filter(isFirstContact).sort((a, b) => a.sent_at!.localeCompare(b.sent_at!))[0];
    if (!first || first.sent_at! < sinceIso) continue;

    const row: FunnelRow = {
      leadId,
      firstContact: first.sent_at!,
      channel: first.channel === "whatsapp" ? "whatsapp" : "email",
      opened: false,
      web: false,
      proposal: false,
      contact: false,
      replied: msgs.some((m) => m.status === "replied"),
      problem: null,
    };

    for (const e of events) {
      if (e.lead_id !== leadId) continue;
      if (e.type === "email_bounced") row.problem = "bounced";
      if (e.type === "unsubscribed" && !row.problem) row.problem = "unsubscribed";
      if (e.type === "replied") row.replied = true;
      const item = describeEvent(e, msgs);
      if (!item || item.automatic) continue;
      const target = e.payload?.target;
      if (e.type === "email_opened") row.opened = true;
      else if (e.type === "link_clicked") {
        if (target === "web") row.web = true;
        else if (target === "book") row.proposal = true;
        else if (target === "wa") row.contact = true;
      } else if (e.type === "demo_viewed") row.proposal = true;
      else if (e.type === "booking_started" || e.type === "checkout_started" || e.type === "booking_paid") {
        row.contact = true;
      } else if (e.type === "book_link_clicked") {
        if (target === "web") row.web = true;
        else row.contact = true;
      }
    }
    // Quien hizo clic, vio algo o respondió también abrió (el píxel falla si bloquean imágenes).
    if (row.web || row.proposal || row.contact || row.replied) row.opened = true;
    rows.push(row);
  }
  return rows.sort((a, b) => b.firstContact.localeCompare(a.firstContact));
}

export function funnelTotals(rows: FunnelRow[]): Record<(typeof FUNNEL_STEPS)[number][0], number> {
  return {
    contacted: rows.length,
    opened: rows.filter((r) => r.opened).length,
    web: rows.filter((r) => r.web).length,
    proposal: rows.filter((r) => r.proposal).length,
    contact: rows.filter((r) => r.contact).length,
    replied: rows.filter((r) => r.replied).length,
  };
}
