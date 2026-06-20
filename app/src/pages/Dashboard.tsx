import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { RefreshCw, Star, Globe, Trash2, ChevronUp, ChevronDown, ChevronsUpDown, Search } from "lucide-react";
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

type SortKey = "name" | "city" | "rating" | "status" | "created_at";
type SortDir = "asc" | "desc";

/** Extrae la URL del sitio web actual del lead desde raw_json (campo del scraper). */
function getWebsiteUrl(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const url = r.website ?? r.websiteUrl ?? r.url ?? r.website_url ?? r.web ?? r.site ?? r.domain ?? null;
  return typeof url === "string" && url.startsWith("http") ? url : null;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [onlyNoWeb, setOnlyNoWeb] = useState(false);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      setError(error.message);
      setLeads([]);
    } else {
      setLeads((data as Lead[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const l of leads) c[l.status] = (c[l.status] ?? 0) + 1;
    return c;
  }, [leads]);

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
      if (city && !(l.city ?? "").toLowerCase().includes(city.toLowerCase()))
        return false;
      if (
        category &&
        !(l.category ?? "").toLowerCase().includes(category.toLowerCase())
      )
        return false;
      if (onlyNoWeb && l.has_website) return false;
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
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [leads, statusFilter, city, category, onlyNoWeb, search, sortKey, sortDir]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Pipeline de captación. {leads.length} leads en total.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/import" className={buttonVariants({ variant: "default" })}>
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
                "rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent",
                active && "ring-2 ring-ring",
              )}
            >
              <div className="text-2xl font-semibold">{counts[s] ?? 0}</div>
              <div className="text-xs text-muted-foreground">
                {STATUS_LABELS[s]}
              </div>
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
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
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
        <label className="flex items-center gap-2 text-sm whitespace-nowrap">
          <input
            type="checkbox"
            checked={onlyNoWeb}
            onChange={(e) => setOnlyNoWeb(e.target.checked)}
            className="h-4 w-4"
          />
          Solo sin web
        </label>
        {(statusFilter !== "all" || city || category || onlyNoWeb || search) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter("all");
              setCity("");
              setCategory("");
              setOnlyNoWeb(false);
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
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort("rating")}
                  >
                    Reseñas<SortIcon col="rating" />
                  </TableHead>
                  <TableHead>Web</TableHead>
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
                {filtered.map((l) => (
                  <TableRow
                    key={l.id}
                    className="group cursor-pointer"
                    onClick={() => navigate(`/leads/${l.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{l.name}</span>
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
                      <StatusBadge status={l.status} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(l.created_at).toLocaleDateString("es-ES")}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={(e) => handleDelete(e, l.id)}
                        disabled={deletingId === l.id}
                        className="rounded p-1 text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                        title="Eliminar lead"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}

                {!loading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="py-10 text-center text-muted-foreground"
                    >
                      {leads.length === 0
                        ? "Aún no hay leads. Ve a «Importar leads» para añadir los primeros."
                        : "Ningún lead coincide con los filtros."}
                    </TableCell>
                  </TableRow>
                )}

                {loading && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="py-10 text-center text-muted-foreground"
                    >
                      Cargando…
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
