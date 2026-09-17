// LoteFunnel.tsx — Embudo del lote de outreach de webs (Emails → pestaña Webs): cuántos leads
// contactados en los últimos N días abrieron, vieron la web, la propuesta, pidieron contacto y
// respondieron, y la fila de cada lead. Solo actividad humana (sin escáneres ni el operador).
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Loader2, Minus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { LeadEvent } from "@/lib/activity";
import { buildFunnel, FUNNEL_STEPS, funnelTotals, type FunnelMessage } from "@/lib/funnel";
import { cn } from "@/lib/utils";

const WINDOWS = [
  { days: 3, label: "3 días" },
  { days: 7, label: "7 días" },
  { days: 30, label: "30 días" },
];

type LeadInfo = { id: string; name: string | null; status: string; do_not_contact: boolean | null };

function Mark({ on }: { on: boolean }) {
  return on ? (
    <Check className="mx-auto h-4 w-4 text-emerald-600" />
  ) : (
    <Minus className="mx-auto h-3 w-3 text-muted-foreground/40" />
  );
}

export function LoteFunnel() {
  const [days, setDays] = useState(7);
  const [messages, setMessages] = useState<FunnelMessage[]>([]);
  const [events, setEvents] = useState<LeadEvent[]>([]);
  const [leads, setLeads] = useState<Record<string, LeadInfo>>({});
  const [loading, setLoading] = useState(true);

  const since = useMemo(() => new Date(Date.now() - days * 86400000).toISOString(), [days]);

  const load = useCallback(async () => {
    setLoading(true);
    // Leads con primer contacto (Email 1 o WhatsApp manual) en la ventana.
    const { data: firsts } = await supabase
      .from("outreach_messages")
      .select("lead_id")
      .in("email_number", [0, 1])
      .gte("sent_at", since);
    const ids = Array.from(new Set((firsts ?? []).map((m) => m.lead_id).filter(Boolean))) as string[];
    if (ids.length === 0) {
      setMessages([]);
      setEvents([]);
      setLeads({});
      setLoading(false);
      return;
    }
    const [msgRes, evRes, leadRes] = await Promise.all([
      supabase
        .from("outreach_messages")
        .select("id,lead_id,channel,email_number,status,sent_at,opened_at")
        .in("lead_id", ids)
        .lte("email_number", 3),
      supabase.from("events").select("id,lead_id,type,payload,created_at").in("lead_id", ids),
      supabase.from("leads").select("id,name,status,do_not_contact").in("id", ids),
    ]);
    setMessages((msgRes.data ?? []) as FunnelMessage[]);
    setEvents((evRes.data ?? []) as LeadEvent[]);
    setLeads(Object.fromEntries(((leadRes.data ?? []) as LeadInfo[]).map((l) => [l.id, l])));
    setLoading(false);
  }, [since]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => buildFunnel(messages, events, since), [messages, events, since]);
  const totals = useMemo(() => funnelTotals(rows), [rows]);

  return (
    <section className="space-y-3 rounded-xl border border-border/70 bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Embudo del lote</h2>
          <p className="text-xs text-muted-foreground">
            Leads contactados (Email 1 o WhatsApp) en los últimos {days} días. Solo cuenta lo que hizo el negocio.
          </p>
        </div>
        <div className="flex gap-1">
          {WINDOWS.map((w) => (
            <button
              key={w.days}
              onClick={() => setDays(w.days)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs",
                days === w.days
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/70 text-muted-foreground hover:text-foreground",
              )}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nadie contactado en esta ventana.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {FUNNEL_STEPS.map(([key, label]) => {
              const n = totals[key];
              const pct = totals.contacted ? Math.round((n / totals.contacted) * 100) : 0;
              return (
                <div key={key} className="rounded-lg border border-border/60 p-3">
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums">
                    {n}
                    {key !== "contacted" && <span className="ml-1 text-xs font-normal text-muted-foreground">{pct}%</span>}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="overflow-x-auto rounded-lg border border-border/60">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left">Negocio</th>
                  <th scope="col" className="px-3 py-2 text-left">Contacto</th>
                  {FUNNEL_STEPS.slice(1).map(([key, label]) => (
                    <th key={key} scope="col" className="px-2 py-2 text-center font-normal">{label}</th>
                  ))}
                  <th scope="col" className="px-3 py-2 text-left">Estado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const lead = leads[r.leadId];
                  return (
                    <tr key={r.leadId} className="border-t border-border/60">
                      <td className="px-3 py-2">
                        <Link to={`/leads/${r.leadId}`} className="font-medium text-primary hover:underline">
                          {lead?.name ?? "—"}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                        {r.channel === "whatsapp" ? "WhatsApp" : "Email"} ·{" "}
                        {new Date(r.firstContact).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                      </td>
                      <td className="px-2 py-2"><Mark on={r.opened} /></td>
                      <td className="px-2 py-2"><Mark on={r.web} /></td>
                      <td className="px-2 py-2"><Mark on={r.proposal} /></td>
                      <td className="px-2 py-2"><Mark on={r.contact} /></td>
                      <td className="px-2 py-2"><Mark on={r.replied} /></td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs">
                        {r.problem === "bounced" ? (
                          <span className="text-destructive">Rebotó</span>
                        ) : r.problem === "unsubscribed" || lead?.do_not_contact ? (
                          <span className="text-destructive">Baja</span>
                        ) : (
                          <span className="text-muted-foreground">{lead?.status ?? "—"}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
