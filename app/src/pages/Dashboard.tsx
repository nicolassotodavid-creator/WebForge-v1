import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, Star, Globe, Trash2, ChevronUp, ChevronDown, ChevronsUpDown, Search, Upload, Inbox, Eye, EyeOff } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  PIPELINE_ORDER,
  STATUS_LABELS,
  type Lead,
  type LeadStatus,
} from "@/lib/types";
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

type SortKey = "name" | "city" | "rating" | "status" | "created_at" | "score";
type SortDir = "asc" | "desc";
type ViewFilter = "all" | "unseen" | "favorites" | "noweb";

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

/** Extrae la URL del sitio web actual del lead desde raw_json (campo del scraper). */
function getWebsiteUrl(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const url = r.website ?? r.websiteUrl ?? r.url ?? r.website_url ?? r.web ?? r.site ?? r.domain ?? null;
  return typeof url === "string" && url.startsWith("http") ? url : null;
}

/** Color del badge de score: verde (buena), ámbar (revisar), rojo (floja). */
function scoreClasses(score: number): string {
  if (score >= 8) return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
  if (score >= 6) return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
  return "bg-red-500/15 text-red-600 dark:text-red-400";
}

export default function Dashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [saved] = useState(readSavedFilters);
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">(saved.statusFilter ?? "all");
  const [city, setCity] = useState(saved.city ?? "");
  const [category, setCategory] = useState(saved.category ?? "");
  const [view, setView] = useState<ViewFilter>(saved.view ?? "all");
  const [search, setSearch] = useState(saved.search ?? "");
  const [sortKey, setSortKey] = useState<SortKey>(saved.sortKey ?? "created_at");
  const [sortDir, setSortDir] = useState<SortDir>(saved.sortDir ?? "desc");
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  // Favorito: toggle optimista. Si Supabase falla (p.ej. migración 0008 sin aplicar), revierte.
  const toggleFavorite = async (e: React.MouseEvent, lead: Lead) => {
    e.stopPropagation();
    const next = !lead.is_favorite;
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, is_favorite: next } : l)));
    const { error } = await supabase.from("leads").update({ is_favorite: next }).eq("id", lead.id);
    if (error) {
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, is_favorite: !next } : l)));
      alert("No se pudo actualizar el favorito: " + error.message);
    }
  };

  // Visto/no-visto manual: toggle optimista con revert.
  const toggleSeen = async (e: React.MouseEvent, lead: Lead) => {
    e.stopPropagation();
    const next = lead.seen_at ? null : new Date().toISOString();
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, seen_at: next } : l)));
    const { error } = await supabase.from("leads").update({ seen_at: next }).eq("id", lead.id);
    if (error) {
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, seen_at: lead.seen_at } : l)));
      alert("No se pudo actualizar 'visto': " + error.message);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    // El score de la web ACTUAL del negocio vive en `leads.site_score` (lo escribe el Orquestador
    // o el botón manual). No hay que cruzar con `sites`: la nota es del lead.
    const leadsRes = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });
    if (leadsRes.error) {
      setError(leadsRes.error.message);
      setLeads([]);
    } else {
      setLeads((leadsRes.data as Lead[]) ?? []);
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

  const viewCounts = useMemo(
    () => ({
      all: leads.length,
      unseen: leads.filter((l) => !l.seen_at).length,
      favorites: leads.filter((l) => l.is_favorite).length,
      noweb: leads.filter((l) => !l.has_website).length,
    }),
    [leads],
  );

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
    let result = leads.filter((l) => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (view === "unseen" && l.seen_at) return false;
      if (view === "favorites" && !l.is_favorite) return false;
      if (view === "noweb" && l.has_website) return false;
      if (city && !(l.city ?? "").toLowerCase().includes(city.toLowerCase()))
        return false;
      if (
        category &&
        !(l.category ?? "").toLowerCase().includes(category.toLowerCase())
      )
        return false;
      if (search) {
        const q = search.toLowerCase();
        const matches =
          (l.name ?? "").toLowerCase().includes(q) ||
          (l.city ?? "").toLowerCase().includes(q) ||
          (l.category ?? "").toLowerCase().includes(q) ||
          (l.phone ?? "").toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });

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
  }, [leads, statusFilter, view, city, category, search, sortKey, sortDir]);

  const chips: { key: ViewFilter; label: string; star?: boolean }[] = flagsSupported
    ? [
        { key: "all", label: "Todos" },
        { key: "unseen", label: "No vistos" },
        { key: "favorites", label: "Favoritos", star: true },
        { key: "noweb", label: "Sin web" },
      ]
    : [
        { key: "all", label: "Todos" },
        { key: "noweb", label: "Sin web" },
      ];

  const colCount = flagsSupported ? 11 : 10;
  const filtersActive =
    statusFilter !== "all" || city || category || view !== "all" || search;

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
        {PIPELINE_ORDER.map((s) => {
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
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
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
      </div>

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
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort("rating")}
                  >
                    Reseñas<SortIcon col="rating" />
                  </TableHead>
                  <TableHead>Web</TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort("score")}
                    title="Score IA de la web actual del negocio (1-10). Ordena ascendente para ver las webs más flojas (mejores candidatos)."
                  >
                    Score<SortIcon col="score" />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort("status")}
                  >
                    Estado<SortIcon col="status" />
                  </TableHead>
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
                {filtered.map((l) => {
                  const unseen = flagsSupported && !l.seen_at;
                  return (
                  <TableRow
                    key={l.id}
                    className="group cursor-pointer"
                    onClick={() => window.open(`/leads/${l.id}`, "_blank", "noopener")}
                  >
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
                    <TableCell>
                      {l.has_website ? (
                        <a
                          href={getWebsiteUrl(l.raw_json) ?? "#"}
                          target="_blank"
                          rel="noreferrer"
                          title="Ver web actual"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center text-blue-500 hover:text-blue-700"
                        >
                          <Globe className="h-4 w-4" />
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">No</span>
                      )}
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
                    <TableCell>
                      <StatusBadge status={l.status} />
                    </TableCell>
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
