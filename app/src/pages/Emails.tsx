// app/src/pages/Emails.tsx
// Vista de seguimiento de los emails enviados a clientes: enviado / abierto / clic / respondido.
// Envíos y respuestas salen de outreach_messages; aperturas y clics, de `events` (pixel de
// track-event y redirector track-click), separando lo automático (escáneres, vistas previas y
// aperturas a <1 min del envío) con messageEngagement. Solo lectura.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Eye, EyeOff, Check, MessageCircle, Loader2, MousePointerClick } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { messageEngagement, type LeadEvent } from "@/lib/activity";
import { messageLabel, messageProduct, type Product } from "@/lib/product";
import { cn } from "@/lib/utils";

const PRODUCT_TABS: { key: Product | "all"; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "webs", label: "Webs" },
  { key: "simulador", label: "Simulador" },
];

/** Fila de outreach con el nombre/email del lead (join). */
type EmailRow = {
  id: string;
  lead_id: string | null;
  channel: string;
  subject: string | null;
  status: string;
  email_number: number | null;
  sent_at: string | null;
  opened_at: string | null;
  created_at: string;
  leads: { name: string | null; email: string | null } | null;
};

const COLS =
  "id, lead_id, channel, subject, status, email_number, sent_at, opened_at, created_at, leads(name, email)";

const TARGET_SHORT: Record<string, string> = { web: "Web", book: "Propuesta", wa: "WhatsApp" };

/** Fecha + hora corta en es-ES ("21 jun, 14:32"). "—" si no hay fecha. */
function fmtWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Emails() {
  const [rows, setRows] = useState<EmailRow[]>([]);
  const [events, setEvents] = useState<LeadEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<Product | "all">("all");

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    const [msgRes, evRes] = await Promise.all([
      supabase
        .from("outreach_messages")
        .select(COLS)
        .order("sent_at", { ascending: false, nullsFirst: false }),
      supabase
        .from("events")
        .select("id,lead_id,type,payload,created_at")
        .in("type", ["email_opened", "link_clicked"]),
    ]);
    if (msgRes.error) setError(msgRes.error.message);
    else setRows((msgRes.data ?? []) as unknown as EmailRow[]);
    // Si no se pueden leer los eventos, la tabla sigue funcionando con opened_at.
    if (!evRes.error) setEvents((evRes.data ?? []) as LeadEvent[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Solo emails (no notas de LinkedIn) que se hayan enviado de verdad.
  const allSent = useMemo(
    () =>
      rows.filter(
        (m) =>
          m.channel === "email" &&
          (!!m.sent_at || m.status === "sent" || m.status === "replied"),
      ),
    [rows],
  );
  const counts = useMemo(
    () => ({
      all: allSent.length,
      webs: allSent.filter((m) => messageProduct(m) === "webs").length,
      simulador: allSent.filter((m) => messageProduct(m) === "simulador").length,
    }),
    [allSent],
  );
  const sent = useMemo(
    () => (product === "all" ? allSent : allSent.filter((m) => messageProduct(m) === product)),
    [allSent, product],
  );

  const engagement = useMemo(() => messageEngagement(events, sent), [events, sent]);

  const kpis = useMemo(() => {
    const enviados = sent.length;
    const abiertos = sent.filter((m) => engagement[m.id]?.firstOpen).length;
    const conClic = sent.filter((m) => (engagement[m.id]?.clicks.length ?? 0) > 0).length;
    const respondidos = sent.filter((m) => m.status === "replied").length;
    const pct = (n: number) => (enviados ? Math.round((n / enviados) * 100) : 0);
    return {
      enviados,
      abiertos,
      conClic,
      respondidos,
      openRate: pct(abiertos),
      clickRate: pct(conClic),
      sinAbrir: enviados - abiertos,
    };
  }, [sent, engagement]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Mail className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Emails</h1>
          <p className="text-sm text-muted-foreground">
            Seguimiento de los correos enviados a clientes: enviados, aperturas, clics y respuestas.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {PRODUCT_TABS.map((t) => {
          const active = product === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setProduct(t.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/70 text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {t.label}
              <span
                className={cn(
                  "tabular-nums text-xs",
                  active ? "text-primary/70" : "text-muted-foreground/70",
                )}
              >
                {counts[t.key]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {([
          ["Enviados", String(kpis.enviados)],
          ["Abiertos", `${kpis.abiertos} · ${kpis.openRate}%`],
          ["Con clic", `${kpis.conClic} · ${kpis.clickRate}%`],
          ["Sin abrir", String(kpis.sinAbrir)],
          ["Respondidos", String(kpis.respondidos)],
        ] as const).map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border/70 bg-card p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-lg font-semibold">{value}</p>
          </div>
        ))}
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </div>
      ) : sent.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Todavía no se ha enviado ningún email a clientes.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/70">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2">Negocio</th>
                <th scope="col" className="px-3 py-2">Email</th>
                <th scope="col" className="px-3 py-2">Secuencia</th>
                <th scope="col" className="px-3 py-2">Enviado</th>
                <th scope="col" className="px-3 py-2">Apertura</th>
                <th scope="col" className="px-3 py-2">Clics</th>
                <th scope="col" className="px-3 py-2">Respuesta</th>
              </tr>
            </thead>
            <tbody>
              {sent.map((m) => {
                const eng = engagement[m.id];
                const simulador = messageProduct(m) === "simulador";
                const targets = eng
                  ? Array.from(new Set(eng.clicks.map((c) => TARGET_SHORT[c.target] ?? c.target)))
                  : [];
                return (
                  <tr key={m.id} className="border-t border-border/60">
                    <td className="px-3 py-2">
                      {m.lead_id ? (
                        <Link
                          to={`/leads/${m.lead_id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {m.leads?.name ?? "—"}
                        </Link>
                      ) : (
                        m.leads?.name ?? "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {m.leads?.email ?? "—"}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 whitespace-nowrap",
                        simulador && "font-medium text-violet-600 dark:text-violet-400",
                      )}
                    >
                      {messageLabel(m)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{fmtWhen(m.sent_at)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {simulador ? (
                        <span
                          className="text-xs text-muted-foreground"
                          title="Correo de texto plano enviado por script: sin píxel de apertura ni enlaces de seguimiento"
                        >
                          Sin seguimiento
                        </span>
                      ) : eng?.firstOpen ? (
                        <Badge variant="default" className="gap-1">
                          <Eye className="h-3 w-3" /> {fmtWhen(eng.firstOpen)}
                        </Badge>
                      ) : eng?.autoOpens ? (
                        <span
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                          title="Apertura a menos de 1 min del envío: escáner del correo o prueba"
                        >
                          <EyeOff className="h-3 w-3" /> Solo automática
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <EyeOff className="h-3 w-3" /> Sin abrir
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {targets.length > 0 ? (
                        <Badge variant="default" className="gap-1">
                          <MousePointerClick className="h-3 w-3" /> {targets.join(" · ")}
                        </Badge>
                      ) : eng?.autoClicks ? (
                        <span
                          className="text-xs text-muted-foreground"
                          title="Clic de un escáner, una vista previa o una prueba"
                        >
                          Solo automáticos
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {m.status === "replied" ? (
                        <Badge variant="success" className="gap-1">
                          <MessageCircle className="h-3 w-3" /> Respondió
                        </Badge>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Check className="h-3 w-3" /> —
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        La apertura se detecta con un píxel (puede no registrarse si el cliente bloquea imágenes) y
        los clics con los enlaces de seguimiento (desde el 13-sep-2026). No cuentan los escáneres, las
        vistas previas ni las aperturas a menos de 1 min del envío. «Respondió» aún no se captura
        automáticamente.
      </p>
    </div>
  );
}
