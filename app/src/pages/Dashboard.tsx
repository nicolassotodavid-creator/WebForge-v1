import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, Star, Globe, Trash2, ChevronUp, ChevronDown, ChevronsUpDown, Search, Upload, Inbox, Eye, EyeOff, MessageCircle, Facebook, Check } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  STATUS_LABELS,
  type Lead,
  type LeadStatus,
} from "@/lib/types";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { visibleStages, WEB_ONLY_STAGES } from "@/lib/pipeline";
import { StatusBadge } from "@/components/StatusBadge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { waLink } from "@/lib/contact";
import {
  matchesBaseFilters,
  matchesView,
  type LeadFilterState,
  type ViewFilter,
} from "@/lib/leadFilters";

type SortKey = "name" | "city" | "rating" | "status" | "created_at" | "score";
type SortDir = "asc" | "desc";

/** Filtros persistidos entre recargas (la vista no se pierde al refrescar). */
const FILTERS_KEY = "wf:dashboard:filters";
type SavedFilters = Partial<{
  search: string;
  statusFilter: LeadStatus | "all";
  city: string;
  category: string;
  view: ViewFilter;
  sortKey: SortKey;
  sortDir: SortDir;
}>;
function readSavedFilters(): SavedFilters {
  try {
    const raw = localStorage.getItem(FILTERS_KEY);
    return raw ? (JSON.parse(raw) as SavedFilters) : {};
  } catch {
    return {};
  }
}

/** Abre el lead en pestaña nueva con un <a> real (a prueba de bloqueadores de popup). */
function openLead(id: string) {
  const a = document.createElement("a");
  a.href = `/leads/${id}`;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Web real del lead. Mismo criterio que el backend (_shared/website.ts): rechaza redes/mapas.
 *  Prioridad: website_url (descubierta por el Orquestador) > raw_json del scrape. */
function isRealWeb(v: unknown): v is string {
  if (typeof v !== "string" || !/^https?:\/\//i.test(v.trim())) return false;
  return !/google\.|maps\.|facebook\.|fb\.me|instagram\.|twitter\.|x\.com|linkedin\.|wa\.me|whatsapp|youtube\.|youtu\.be|tiktok\.|t\.me|pinterest\./i.test(v);
}
function getWebsiteUrl(lead: { website_url?: string | null; raw_json?: unknown }): string | null {
  if (isRealWeb(lead.website_url)) return lead.website_url.trim();
  const raw = lead.raw_json;
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  for (const k of ["website", "websiteUrl", "url", "web", "site", "domain"]) {
    if (isRealWeb(r[k])) return (r[k] as string).trim();
  }
  return null;
}

/** Color del badge de score: verde (buena), ámbar (revisar), rojo (floja). */
function scoreClasses(score: number): string {
  if (score >= 8) return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
  if (score >= 6) return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
  return "bg-red-500/15 text-red-600 dark:text-red-400";
}

/** Fecha + hora corta en es-ES para tooltips ("21 jun, 14:32"). "" si no hay fecha. */
function fmtWhen(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Estado agregado del email de contacto por lead (derivado de outreach_messages). */
type LeadEmailState = {
  sent: boolean;
  opened: boolean;
  replied: boolean;
  lastSentAt: string | null;
  lastOpenedAt: string | null;
  count: number; // nº de emails enviados (no borradores)
};

export default function Dashboard() {
  const isAdmin = useIsAdmin();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Estado del email de contacto por lead (enviado/abierto/respondido). Map vacío y
  // outreachSupported=false si la query falla (p. ej. migración 0003 sin aplicar).
  const [outreachByLead, setOutreachByLead] = useState<Map<string, LeadEmailState>>(new Map());
  const [outreachSupported, setOutreachSupported] = useState(false);

  const [saved] = useState(readSavedFilters);
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">(saved.statusFilter ?? "all");
  const [city, setCity] = useState(saved.city ?? "");
  const [category, setCategory] = useState(saved.category ?? "");
  const [view, setView] = useState<ViewFilter>(saved.view ?? "all");
  const [search, setSearch] = useState(saved.search ?? "");
  const [sortKey, setSortKey] = useState<SortKey>(saved.sortKey ?? "created_at");
  const [sortDir, setSortDir] = useState<SortDir>(saved.sortDir ?? "desc");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Bandeja: selección en lote + fila enfocada por teclado.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focusIdx, setFocusIdx] = useState(-1);
  const [bulkBusy, setBulkBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Persistir la vista (búsqueda, filtros y orden) para que sobreviva al refresco.
  useEffect(() => {
    try {
      localStorage.setItem(
        FILTERS_KEY,
        JSON.stringify({ search, statusFilter, city, category, view, sortKey, sortDir }),
      );
    } catch {
      /* almacenamiento no disponible: ignorar */
    }
  }, [search, statusFilter, city, category, view, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronsUpDown className="ml-1 inline h-3 w-3 text-muted-foreground" />;
    return sortDir === "asc"
      ? <ChevronUp className="ml-1 inline h-3 w-3" />
      : <ChevronDown className="ml-1 inline h-3 w-3" />;
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("¿Seguro que quieres eliminar este lead?")) return;
    setDeletingId(id);
    const { error } = await supabase.from("leads").delete().eq("id", id);
    if (error) {
      alert("Error al eliminar: " + error.message);
    } else {
      setLeads((prev) => prev.filter((l) => l.id !== id));
    }
    setDeletingId(null);
  };

  // Favorito y visto: núcleo (optimista con revert) + wrapper para el click.
  const setFavorite = async (lead: Lead, next: boolean) => {
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, is_favorite: next } : l)));
    const { error } = await supabase.from("leads").update({ is_favorite: next }).eq("id", lead.id);
    if (error) {
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, is_favorite: !next } : l)));
      alert("No se pudo actualizar el favorito: " + error.message);
    }
  };
  const toggleFavorite = (e: React.MouseEvent, lead: Lead) => {
    e.stopPropagation();
    setFavorite(lead, !lead.is_favorite);
  };

  const setSeen = async (lead: Lead, seen: boolean) => {
    const next = seen ? new Date().toISOString() : null;
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, seen_at: next } : l)));
    const { error } = await supabase.from("leads").update({ seen_at: next }).eq("id", lead.id);
    if (error) {
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, seen_at: lead.seen_at } : l)));
      alert("No se pudo actualizar 'visto': " + error.message);
    }
  };
  const toggleSeen = (e: React.MouseEvent, lead: Lead) => {
    e.stopPropagation();
    setSeen(lead, !lead.seen_at);
  };

  // Abrir un lead lo marca como "visto" (como el correo: abrir = leído). Así la pestaña
  // "No vistos" filtra de verdad conforme trabajas, en vez de quedar todo como no visto para
  // siempre. Se puede revertir a mano con el ojo. Solo si la migración de flags está aplicada.
  const openAndSeen = (lead: Lead) => {
    if (flagsSupported && !lead.seen_at) setSeen(lead, true);
    openLead(lead.id);
  };

  // ── Selección múltiple ──────────────────────────────────────────────────────
  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const clearSelection = () => setSelected(new Set());

  const bulkUpdate = async (patch: Partial<Lead>, label: string) => {
    const ids = [...selected];
    if (!ids.length) return;
    setBulkBusy(true);
    const snapshot = leads;
    setLeads((prev) => prev.map((l) => (selected.has(l.id) ? { ...l, ...patch } : l)));
    const { error } = await supabase.from("leads").update(patch).in("id", ids);
    setBulkBusy(false);
    if (error) {
      setLeads(snapshot);
      alert(`No se pudo ${label}: ` + error.message);
    }
  };
  const bulkSeen = (seen: boolean) =>
    bulkUpdate({ seen_at: seen ? new Date().toISOString() : null }, seen ? "marcar como visto" : "marcar como no visto");
  const bulkFavorite = (fav: boolean) =>
    bulkUpdate({ is_favorite: fav }, fav ? "marcar favorito" : "quitar favorito");
  const bulkDelete = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    if (!confirm(`¿Eliminar ${ids.length} lead${ids.length > 1 ? "s" : ""}?`)) return;
    setBulkBusy(true);
    const { error } = await supabase.from("leads").delete().in("id", ids);
    setBulkBusy(false);
    if (error) {
      alert("Error al eliminar: " + error.message);
      return;
    }
    setLeads((prev) => prev.filter((l) => !selected.has(l.id)));
    clearSelection();
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    // El score de la web ACTUAL del negocio vive en `leads.site_score` (lo escribe el Orquestador
    // o el botón manual). No hay que cruzar con `sites`: la nota es del lead.
    // En paralelo: estado del email de contacto por lead (enviado/abierto/respondido).
    const [leadsRes, outreachRes] = await Promise.all([
      supabase.from("leads").select("*").order("created_at", { ascending: false }),
      supabase
        .from("outreach_messages")
        .select("lead_id,status,sent_at,opened_at"),
    ]);
    if (leadsRes.error) {
      setError(leadsRes.error.message);
      setLeads([]);
    } else {
      setLeads((leadsRes.data as Lead[]) ?? []);
    }
    // Agregamos los mensajes por lead. Si la query falla (columna opened_at inexistente,
    // RLS, etc.) ocultamos la columna en vez de romper el Dashboard.
    if (outreachRes.error || !outreachRes.data) {
      setOutreachSupported(false);
      setOutreachByLead(new Map());
    } else {
      const map = new Map<string, LeadEmailState>();
      for (const m of outreachRes.data as Array<{
        lead_id: string | null;
        status: string | null;
        sent_at: string | null;
        opened_at: string | null;
      }>) {
        if (!m.lead_id) continue;
        const cur =
          map.get(m.lead_id) ??
          { sent: false, opened: false, replied: false, lastSentAt: null, lastOpenedAt: null, count: 0 };
        const wasSent = m.status === "sent" || m.status === "replied" || !!m.sent_at;
        if (wasSent) {
          cur.sent = true;
          cur.count += 1;
          if (m.sent_at && (!cur.lastSentAt || m.sent_at > cur.lastSentAt)) cur.lastSentAt = m.sent_at;
        }
        if (m.opened_at) {
          cur.opened = true;
          if (!cur.lastOpenedAt || m.opened_at > cur.lastOpenedAt) cur.lastOpenedAt = m.opened_at;
        }
        if (m.status === "replied") cur.replied = true;
        map.set(m.lead_id, cur);
      }
      setOutreachByLead(map);
      setOutreachSupported(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ¿La migración 0008 está aplicada? Si las columnas no existen, `select *` no las trae y
  // ocultamos la UI de bandeja (degradación limpia, sin marcar todo como "no visto").
  const flagsSupported = useMemo(
    () => leads.some((l) => "is_favorite" in l || "seen_at" in l),
    [leads],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const l of leads) c[l.status] = (c[l.status] ?? 0) + 1;
    return c;
  }, [leads]);

  // Filtros que NO dependen de la pestaña de vista. Tanto la tabla como los
  // contadores de las pestañas parten de aquí, así el número de cada pestaña
  // coincide siempre con lo que verás al pulsarla.
  const filterState = useMemo<LeadFilterState>(
    () => ({ statusFilter, city, category, search }),
    [statusFilter, city, category, search],
  );

  // Contadores de pestañas calculados sobre el MISMO conjunto base que la tabla
  // (respetan estado/ciudad/categoría/búsqueda), no sobre todos los leads.
  const viewCounts = useMemo(() => {
    const base = leads.filter((l) => matchesBaseFilters(l, filterState));
    return {
      all: base.length,
      unseen: base.filter((l) => matchesView(l, "unseen")).length,
      seen: base.filter((l) => matchesView(l, "seen")).length,
      favorites: base.filter((l) => matchesView(l, "favorites")).length,
      noweb: base.filter((l) => matchesView(l, "noweb")).length,
      chat: base.filter((l) => matchesView(l, "chat")).length,
      whatsapp: base.filter((l) => matchesView(l, "whatsapp")).length,
    };
  }, [leads, filterState]);

  // IDs del último lote scrapeado. Al insertar, todas las filas de un lote comparten
  // created_at (un único upsert en ingest-leads), así que el lote más reciente = las
  // creadas dentro de una ventana corta respecto a la más nueva (la ventana absorbe el
  // posible desfase entre el upsert con place_id y el insert sin él). Es por LOTE, no por
  // antigüedad: siempre se resalta el último, sea de hoy o de hace días.
  const latestBatchIds = useMemo(() => {
    const ids = new Set<string>();
    let maxTs = 0;
    for (const l of leads) {
      const t = new Date(l.created_at).getTime();
      if (Number.isFinite(t) && t > maxTs) maxTs = t;
    }
    if (maxTs === 0) return ids;
    const WINDOW_MS = 2 * 60 * 1000;
    for (const l of leads) {
      const t = new Date(l.created_at).getTime();
      if (Number.isFinite(t) && maxTs - t <= WINDOW_MS) ids.add(l.id);
    }
    return ids;
  }, [leads]);

  const filtered = useMemo(() => {
    let result = leads.filter(
      (l) => matchesBaseFilters(l, filterState) && matchesView(l, view),
    );

    result = [...result].sort((a, b) => {
      let va: string | number = "";
      let vb: string | number = "";
      if (sortKey === "name") { va = a.name ?? ""; vb = b.name ?? ""; }
      else if (sortKey === "city") { va = a.city ?? ""; vb = b.city ?? ""; }
      else if (sortKey === "rating") { va = a.rating ?? 0; vb = b.rating ?? 0; }
      else if (sortKey === "status") { va = a.status ?? ""; vb = b.status ?? ""; }
      else if (sortKey === "created_at") { va = a.created_at ?? ""; vb = b.created_at ?? ""; }
      else if (sortKey === "score") { va = a.site_score ?? -1; vb = b.site_score ?? -1; }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [leads, filterState, view, sortKey, sortDir]);

  // Atajos de teclado estilo bandeja (se ignoran si escribes en un input).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing =
        !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if (typing) {
        if (e.key === "Escape") t!.blur();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "/") { e.preventDefault(); searchRef.current?.focus(); return; }
      if (e.key === "Escape") { setSelected(new Set()); setFocusIdx(-1); return; }

      const n = filtered.length;
      if (!n) return;
      const lead = focusIdx >= 0 && focusIdx < n ? filtered[focusIdx] : null;

      switch (e.key) {
        case "j":
        case "ArrowDown":
          e.preventDefault();
          setFocusIdx((i) => Math.min((i < 0 ? -1 : i) + 1, n - 1));
          break;
        case "k":
        case "ArrowUp":
          e.preventDefault();
          setFocusIdx((i) => (i <= 0 ? 0 : i - 1));
          break;
        case "x":
          if (lead) { e.preventDefault(); toggleSelect(lead.id); }
          break;
        case "f":
          if (lead && flagsSupported) { e.preventDefault(); setFavorite(lead, !lead.is_favorite); }
          break;
        case "e":
          if (lead && flagsSupported) { e.preventDefault(); setSeen(lead, !lead.seen_at); }
          break;
        case "Enter":
        case "o":
          if (lead) { e.preventDefault(); openAndSeen(lead); }
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, focusIdx, flagsSupported]);

  // Mantener la fila enfocada visible.
  useEffect(() => {
    if (focusIdx < 0) return;
    document
      .querySelector(`[data-row-idx="${focusIdx}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [focusIdx]);

  const allChips: { key: ViewFilter; label: string; star?: boolean }[] = flagsSupported
    ? [
        { key: "all", label: "Todos" },
        { key: "unseen", label: "No vistos" },
        { key: "seen", label: "Vistos" },
        { key: "favorites", label: "Favoritos", star: true },
        { key: "noweb", label: "Sin web" },
        { key: "chat", label: "Con chat web" },
        { key: "whatsapp", label: "Con WhatsApp" },
      ]
    : [
        { key: "all", label: "Todos" },
        { key: "noweb", label: "Sin web" },
        { key: "chat", label: "Con chat web" },
        { key: "whatsapp", label: "Con WhatsApp" },
      ];
  // No-admin (Luvia) no tiene webs: fuera los chips de web. "Con WhatsApp" se queda.
  const chips = allChips.filter(
    (c) => isAdmin || (c.key !== "noweb" && c.key !== "chat"),
  );

  // No-admin oculta 2 columnas (Web, Score), así que el colspan del estado vacío baja en 2.
  const colCount =
    (flagsSupported ? 13 : 12) + (outreachSupported ? 1 : 0) - (isAdmin ? 0 : 2);
  const filtersActive =
    statusFilter !== "all" || city || category || view !== "all" || search;
  const selectedCount = selected.size;
  const allVisibleSelected = filtered.length > 0 && filtered.every((l) => selected.has(l.id));
  const someVisibleSelected = filtered.some((l) => selected.has(l.id));
  const toggleSelectAll = () =>
    setSelected((prev) =>
      filtered.length > 0 && filtered.every((l) => prev.has(l.id))
        ? new Set<string>()
        : new Set(filtered.map((l) => l.id)),
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Pipeline de captación ·{" "}
            <span className="font-medium text-foreground tabular-nums">
              {leads.length}
            </span>{" "}
            leads en total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/import" className={buttonVariants({ variant: "default" })}>
            <Upload className="h-4 w-4" />
            Importar leads
          </Link>
          <Button variant="outline" size="icon" onClick={load} title="Recargar">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Contadores del pipeline */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {visibleStages(isAdmin).map((s) => {
          const active = statusFilter === s;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(active ? "all" : s)}
              className={cn(
                "group rounded-xl border p-3 text-left transition-all duration-150 hover:-translate-y-0.5 hover:shadow-elevated",
                active
                  ? "border-primary/40 bg-primary/5 ring-1 ring-primary/30"
                  : "border-border/70 bg-card hover:border-border",
              )}
            >
              <div
                className={cn(
                  "text-2xl font-semibold tabular-nums tracking-tight transition-colors",
                  active ? "text-primary" : "text-foreground",
                )}
              >
                {counts[s] ?? 0}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {STATUS_LABELS[s]}
              </div>
            </button>
          );
        })}
      </div>

      {/* Chips de vista rápida (bandeja) */}
      <div className="flex flex-wrap items-center gap-1.5">
        {chips.map((c) => {
          const active = view === c.key;
          return (
            <button
              key={c.key}
              onClick={() => setView(c.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/70 text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {c.star && (
                <Star className={cn("h-3.5 w-3.5", active && "fill-current")} />
              )}
              {c.label}
              <span
                className={cn(
                  "tabular-nums text-xs",
                  active ? "text-primary/70" : "text-muted-foreground/70",
                )}
              >
                {viewCounts[c.key]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Buscador + Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            placeholder="Buscar negocio, ciudad, teléfono…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 w-[260px]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as LeadStatus | "all")
          }
          className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-[color,box-shadow,border-color] duration-150 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
        >
          <option value="all">Todos los estados</option>
          {Object.entries(STATUS_LABELS)
            // No-admin (Luvia) no construye webs: ocultar las etapas de web del filtro.
            .filter(([value]) => isAdmin || !WEB_ONLY_STAGES.includes(value as LeadStatus))
            .map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
        </select>
        <Input
          placeholder="Ciudad…"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="max-w-[160px]"
        />
        <Input
          placeholder="Categoría…"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="max-w-[160px]"
        />
        {filtersActive && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter("all");
              setCity("");
              setCategory("");
              setView("all");
              setSearch("");
            }}
          >
            Limpiar filtros
          </Button>
        )}
        <span className="ml-auto hidden text-xs text-muted-foreground lg:inline">
          Atajos: <kbd className="font-sans">j/k</kbd> mover · <kbd className="font-sans">f</kbd> ★ ·{" "}
          <kbd className="font-sans">e</kbd> visto · <kbd className="font-sans">x</kbd> sel ·{" "}
          <kbd className="font-sans">↵</kbd> abrir · <kbd className="font-sans">/</kbd> buscar
        </span>
      </div>

      {/* Barra de acciones en lote */}
      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
          <span className="text-sm font-medium tabular-nums">
            {selectedCount} seleccionado{selectedCount > 1 ? "s" : ""}
          </span>
          <div className="mx-1 h-4 w-px bg-border" />
          {flagsSupported && (
            <>
              <Button size="sm" variant="ghost" disabled={bulkBusy} onClick={() => bulkSeen(true)}>
                <Eye className="h-4 w-4" /> Visto
              </Button>
              <Button size="sm" variant="ghost" disabled={bulkBusy} onClick={() => bulkSeen(false)}>
                <EyeOff className="h-4 w-4" /> No visto
              </Button>
              <Button size="sm" variant="ghost" disabled={bulkBusy} onClick={() => bulkFavorite(true)}>
                <Star className="h-4 w-4" /> Favorito
              </Button>
              <Button size="sm" variant="ghost" disabled={bulkBusy} onClick={() => bulkFavorite(false)}>
                <Star className="h-4 w-4" /> Quitar ★
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            disabled={bulkBusy}
            onClick={bulkDelete}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" /> Eliminar
          </Button>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={clearSelection}>
            Limpiar selección
          </Button>
        </div>
      )}

      {/* Estados de error / carga / vacío */}
      {error && (
        <Card>
          <CardContent className="space-y-2 p-6 text-sm">
            <p className="font-medium text-destructive">
              No se pudieron cargar los leads.
            </p>
            <p className="text-muted-foreground">{error}</p>
            <p className="text-muted-foreground">
              {!isSupabaseConfigured
                ? "Parece que faltan las variables de Supabase (app/.env.local)."
                : "Comprueba que has aplicado la migración 0001_init.sql en tu Supabase."}
            </p>
          </CardContent>
        </Card>
      )}

      {!error && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-9 pr-0">
                    <input
                      type="checkbox"
                      aria-label="Seleccionar todo"
                      className="h-4 w-4 align-middle accent-primary"
                      checked={allVisibleSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected;
                      }}
                      onChange={toggleSelectAll}
                    />
                  </TableHead>
                  {flagsSupported && <TableHead className="w-9" />}
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort("name")}
                  >
                    Negocio<SortIcon col="name" />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort("city")}
                  >
                    Ciudad<SortIcon col="city" />
                  </TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort("rating")}
                  >
                    Reseñas<SortIcon col="rating" />
                  </TableHead>
                  {isAdmin && (
                    <>
                      <TableHead>Web</TableHead>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => handleSort("score")}
                        title="Score IA de la web actual del negocio (1-10). Ordena ascendente para ver las webs más flojas (mejores candidatos)."
                      >
                        Score<SortIcon col="score" />
                      </TableHead>
                    </>
                  )}
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort("status")}
                  >
                    Estado<SortIcon col="status" />
                  </TableHead>
                  {outreachSupported && (
                    <TableHead title="Email de contacto: enviado / abierto / respondido">
                      Email
                    </TableHead>
                  )}
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort("created_at")}
                  >
                    Creado<SortIcon col="created_at" />
                  </TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((l, idx) => {
                  const unseen = flagsSupported && !l.seen_at;
                  const isSelected = selected.has(l.id);
                  const focused = idx === focusIdx;
                  return (
                  <TableRow
                    key={l.id}
                    data-row-idx={idx}
                    onClick={() => openAndSeen(l)}
                    className={cn(
                      "group cursor-pointer transition-colors",
                      // Visto = fila atenuada (como un correo leído). Selección y foco pintan
                      // su propio fondo y van después, así que ganan sobre este sombreado.
                      l.seen_at && "bg-muted/40 text-muted-foreground",
                      isSelected && "bg-primary/5",
                      focused && "bg-accent/60 ring-1 ring-inset ring-primary/40",
                    )}
                  >
                    <TableCell className="w-9 pr-0" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar ${l.name}`}
                        className="h-4 w-4 align-middle accent-primary"
                        checked={isSelected}
                        onChange={() => toggleSelect(l.id)}
                      />
                    </TableCell>
                    {flagsSupported && (
                      <TableCell className="w-9 pr-0">
                        <button
                          onClick={(e) => toggleFavorite(e, l)}
                          title={l.is_favorite ? "Quitar de favoritos" : "Marcar favorito"}
                          className="rounded p-1 text-muted-foreground transition-colors hover:text-amber-500"
                        >
                          <Star
                            className={cn(
                              "h-4 w-4",
                              l.is_favorite && "fill-amber-400 text-amber-400",
                            )}
                          />
                        </button>
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {unseen && (
                          <span
                            title="No visto"
                            className="h-2 w-2 shrink-0 rounded-full bg-primary"
                          />
                        )}
                        <span className={cn(unseen ? "font-semibold" : "font-medium")}>
                          {l.name}
                        </span>
                        {latestBatchIds.has(l.id) && (
                          <span
                            title="Del último lote scrapeado"
                            className="inline-flex items-center rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide text-emerald-600 dark:text-emerald-400"
                          >
                            Nuevo
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {l.category ?? "—"}
                      </div>
                    </TableCell>
                    <TableCell>{l.city ?? "—"}</TableCell>
                    <TableCell>{l.phone ?? "—"}</TableCell>
                    <TableCell className="max-w-[200px]">
                      {l.email ? (
                        <a
                          href={`mailto:${l.email}`}
                          onClick={(e) => e.stopPropagation()}
                          title={l.email}
                          className="block truncate text-xs text-blue-500 hover:text-blue-700"
                        >
                          {l.email}
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const wa = waLink(l);
                        if (!wa && !l.facebook)
                          return <span className="text-xs text-muted-foreground">—</span>;
                        return (
                          <div className="flex items-center gap-1.5">
                            {wa && (
                              <a
                                href={wa}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                title={`WhatsApp: ${wa.replace("https://wa.me/", "")}`}
                                className="text-green-600 hover:text-green-700"
                              >
                                <MessageCircle className="h-4 w-4" />
                              </a>
                            )}
                            {l.facebook && (
                              <a
                                href={l.facebook}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                title="Facebook"
                                className="text-blue-600 hover:text-blue-700"
                              >
                                <Facebook className="h-4 w-4" />
                              </a>
                            )}
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      {l.rating != null ? (
                        <span className="inline-flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                          {l.rating}
                          <span className="text-muted-foreground">
                            ({l.review_count ?? 0})
                          </span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    {isAdmin && (
                    <>
                    <TableCell className="max-w-[180px]">
                      {(() => {
                        const url = getWebsiteUrl(l);
                        if (url) {
                          let host = url;
                          try {
                            host = new URL(url).hostname.replace(/^www\./, "");
                          } catch {
                            /* URL rara: mostramos la cadena tal cual */
                          }
                          return (
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              title={url}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex max-w-full items-center gap-1.5 text-xs text-blue-500 hover:text-blue-700"
                            >
                              <Globe className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{host}</span>
                            </a>
                          );
                        }
                        return l.has_website ? (
                          <span
                            className="text-xs text-muted-foreground"
                            title="Marcada con web, pero sin URL real detectada (solo RRSS/Maps)"
                          >
                            Sí
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">No</span>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      {l.site_score != null ? (
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
                            scoreClasses(l.site_score),
                          )}
                          title="Score IA de la web actual del negocio (1-10). Bajo = web floja = buen candidato."
                        >
                          {l.site_score}/10
                        </span>
                      ) : !l.has_website ? (
                        <span
                          className="inline-flex items-center rounded-full bg-sky-500/15 px-2 py-0.5 text-xs font-semibold text-sky-600 dark:text-sky-400"
                          title="No tiene web propia — el mejor candidato a contactar."
                        >
                          Sin web
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground" title="Web propia aún sin analizar">—</span>
                      )}
                    </TableCell>
                    </>
                    )}
                    <TableCell>
                      <StatusBadge status={l.status} />
                    </TableCell>
                    {outreachSupported && (
                      <TableCell>
                        {(() => {
                          const o = outreachByLead.get(l.id);
                          if (!o || !o.sent)
                            return <span className="text-xs text-muted-foreground">—</span>;
                          return (
                            <div className="flex items-center gap-1.5">
                              {o.replied ? (
                                <span
                                  className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400"
                                  title="El lead respondió al email"
                                >
                                  <MessageCircle className="h-3 w-3" /> Respondió
                                </span>
                              ) : o.opened ? (
                                <span
                                  className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400"
                                  title={`Abierto ${fmtWhen(o.lastOpenedAt)}`}
                                >
                                  <Eye className="h-3 w-3" /> Abierto
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground"
                                  title={`Enviado ${fmtWhen(o.lastSentAt)} · sin abrir aún`}
                                >
                                  <Check className="h-3 w-3" /> Enviado
                                </span>
                              )}
                              {o.count > 1 && (
                                <span
                                  className="text-[10px] text-muted-foreground"
                                  title={`${o.count} emails enviados`}
                                >
                                  ×{o.count}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </TableCell>
                    )}
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(l.created_at).toLocaleDateString("es-ES")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-0.5">
                        {flagsSupported && (
                          <button
                            onClick={(e) => toggleSeen(e, l)}
                            title={l.seen_at ? "Marcar como no visto" : "Marcar como visto"}
                            className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                          >
                            {l.seen_at ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                          </button>
                        )}
                        <button
                          onClick={(e) => handleDelete(e, l.id)}
                          disabled={deletingId === l.id}
                          className="rounded p-1 text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                          title="Eliminar lead"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}

                {loading &&
                  leads.length === 0 &&
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={`sk-${i}`} className="hover:bg-transparent">
                      <TableCell className="w-9 pr-0">
                        <div className="h-4 w-4 animate-pulse rounded bg-muted" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                        <div className="mt-1.5 h-3 w-20 animate-pulse rounded bg-muted/60" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 w-12 animate-pulse rounded bg-muted" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 w-14 animate-pulse rounded bg-muted" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 w-6 animate-pulse rounded bg-muted" />
                      </TableCell>
                      <TableCell>
                        <div className="h-5 w-12 animate-pulse rounded-full bg-muted" />
                      </TableCell>
                      <TableCell>
                        <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 w-4 animate-pulse rounded bg-muted" />
                      </TableCell>
                    </TableRow>
                  ))}

                {!loading && filtered.length === 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={colCount} className="py-16 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
                        <div className="grid h-12 w-12 place-items-center rounded-full border border-border bg-muted/50 text-muted-foreground">
                          <Inbox className="h-5 w-5" />
                        </div>
                        {leads.length === 0 ? (
                          <>
                            <p className="text-sm font-medium text-foreground">
                              Aún no hay leads
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Importa los primeros negocios para arrancar el
                              pipeline de captación.
                            </p>
                            <Link
                              to="/import"
                              className={cn(
                                buttonVariants({ variant: "outline", size: "sm" }),
                                "mt-1",
                              )}
                            >
                              <Upload className="h-4 w-4" />
                              Importar leads
                            </Link>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-medium text-foreground">
                              Ningún lead coincide
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Prueba a ajustar la búsqueda o a limpiar los
                              filtros activos.
                            </p>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
