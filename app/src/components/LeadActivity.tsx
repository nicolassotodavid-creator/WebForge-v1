// LeadActivity — Actividad del prospecto en la ficha del lead: qué ha hecho con lo que le
// mandamos (aperturas, clics en la web / la propuesta / WhatsApp, visitas a /book, rebotes,
// bajas, pagos). Lo automático (escáneres, vistas previas, tú con sesión) se oculta por defecto.
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CreditCard,
  Eye,
  Globe,
  Loader2,
  Mail,
  MessageCircle,
  MousePointerClick,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  buildActivity,
  summarizeActivity,
  type ActivityKind,
  type ActivityMessage,
  type LeadEvent,
} from "@/lib/activity";

const ICONS: Record<ActivityKind, LucideIcon> = {
  sent: Mail,
  open: Eye,
  click: MousePointerClick,
  visit: Globe,
  intent: MessageCircle,
  paid: CreditCard,
  problem: AlertTriangle,
};

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function LeadActivity({ leadId, messages }: { leadId: string; messages: ActivityMessage[] }) {
  const [events, setEvents] = useState<LeadEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAuto, setShowAuto] = useState(false);

  // Se recarga cuando cambia el nº de mensajes (p.ej. tras enviar un email desde la ficha).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase
      .from("events")
      .select("id,lead_id,type,payload,created_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(300)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setError(error.message);
        else setEvents((data ?? []) as LeadEvent[]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [leadId, messages.length]);

  const items = useMemo(() => buildActivity(events, messages), [events, messages]);
  const summary = useMemo(() => summarizeActivity(events, messages), [events, messages]);
  const autoCount = items.filter((i) => i.automatic).length;
  const visible = showAuto ? items : items.filter((i) => !i.automatic);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando actividad…
      </div>
    );
  }
  if (error) {
    return <p className="text-sm text-destructive">No se pudo cargar la actividad: {error}</p>;
  }
  if (items.length === 0) return null;

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Actividad del prospecto
        </p>
        {autoCount > 0 && (
          <button
            type="button"
            onClick={() => setShowAuto((v) => !v)}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            {showAuto ? "Ocultar automáticos" : `Ver automáticos (${autoCount})`}
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {summary.opens} aperturas · {summary.webClicks} clics a la web · {summary.bookClicks} clics a la
        propuesta · {summary.bookVisits} visitas a /book · {summary.waClicks + summary.waIntents} a WhatsApp
      </p>

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Solo hay actividad automática (escáneres, vistas previas o tú con sesión).
        </p>
      ) : (
        <ul className="space-y-1.5">
          {visible.map((i) => {
            const Icon = ICONS[i.kind];
            return (
              <li
                key={i.id}
                className={`flex items-start gap-2 text-sm ${i.automatic ? "text-muted-foreground" : ""}`}
              >
                <Icon
                  className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                    i.kind === "problem" ? "text-destructive" : i.automatic ? "" : "text-blue-600"
                  }`}
                />
                <span className="min-w-0">
                  <span className={i.automatic ? "" : "font-medium"}>{i.label}</span>
                  <span className="text-xs text-muted-foreground"> · {fmtWhen(i.at)}</span>
                  {i.detail && <span className="block text-xs text-muted-foreground">{i.detail}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-[11px] text-muted-foreground">
        Los clics se registran desde el 13-sep-2026 (enlaces por www.nico-soto.es/r). Antes solo hay
        aperturas y visitas a /book. Las visitas que entran a la web por otro camino no llegan aquí.
      </p>
    </div>
  );
}
