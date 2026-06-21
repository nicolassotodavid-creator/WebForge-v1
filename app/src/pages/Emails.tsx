// app/src/pages/Emails.tsx
// Vista de seguimiento de los emails enviados a clientes: enviado / abierto / respondido.
// Aprovecha el tracking que ya vive en outreach_messages (sent_at, opened_at, email_number,
// migración 0003_followup_tracking.sql). Solo lectura.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Eye, EyeOff, Check, MessageCircle, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    const { data, error } = await supabase
      .from("outreach_messages")
      .select(COLS)
      .order("sent_at", { ascending: false, nullsFirst: false });
    if (error) setError(error.message);
    else setRows((data ?? []) as unknown as EmailRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Solo emails (no notas de LinkedIn) que se hayan enviado de verdad.
  const sent = useMemo(
    () =>
      rows.filter(
        (m) =>
          m.channel === "email" &&
          (!!m.sent_at || m.status === "sent" || m.status === "replied"),
      ),
    [rows],
  );

  const kpis = useMemo(() => {
    const enviados = sent.length;
    const abiertos = sent.filter((m) => m.opened_at).length;
    const respondidos = sent.filter((m) => m.status === "replied").length;
    const openRate = enviados ? Math.round((abiertos / enviados) * 100) : 0;
    return { enviados, abiertos, respondidos, openRate, sinAbrir: enviados - abiertos };
  }, [sent]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Mail className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Emails</h1>
          <p className="text-sm text-muted-foreground">
            Seguimiento de los correos enviados a clientes: enviados, aperturas y respuestas.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([
          ["Enviados", String(kpis.enviados)],
          ["Abiertos", `${kpis.abiertos} · ${kpis.openRate}%`],
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
                <th scope="col" className="px-3 py-2">Respuesta</th>
              </tr>
            </thead>
            <tbody>
              {sent.map((m) => (
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
                  <td className="px-3 py-2">Email {m.email_number ?? 1}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{fmtWhen(m.sent_at)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {m.opened_at ? (
                      <Badge variant="default" className="gap-1">
                        <Eye className="h-3 w-3" /> {fmtWhen(m.opened_at)}
                      </Badge>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <EyeOff className="h-3 w-3" /> Sin abrir
                      </span>
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
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        La apertura se detecta con un píxel de seguimiento (puede no registrarse si el cliente
        bloquea imágenes). «Respondió» aún no se captura automáticamente.
      </p>
    </div>
  );
}
