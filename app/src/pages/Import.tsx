import { useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { Search, Loader2 } from "lucide-react";
import { supabase, edgeFunctionErrorMessage } from "@/lib/supabase";
import { parseCsv } from "@/lib/csv";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";


interface IngestResult {
  received?: number;
  normalized?: number;
  inserted?: number;
  upserted?: number;
  errors?: string[];
}

interface ScrapeResult {
  found?: number;
  without_website?: number;
  after_filters?: number;
  inserted?: number;
  upserted?: number;
  with_email?: number;
  partial?: boolean;
  run_status?: string;
  errors?: string[];
}

/**
 * Traduce el embudo del scrape (encontrados → sin web → tras filtros → insertados) a una
 * frase clara. Resuelve la confusión de "dijo que encontró N pero no aparece ninguno":
 * casi siempre es un filtro que se los come, no un fallo. Devuelve null si todo fue bien
 * (entraron negocios nuevos).
 */
function scrapeNotice(r: ScrapeResult): string | null {
  const found = r.found ?? 0;
  const sinWeb = r.without_website ?? 0;
  const trasFiltros = r.after_filters ?? sinWeb;
  const nuevos = r.inserted ?? 0;
  const actualizados = r.upserted ?? 0;

  if (found === 0) {
    return "Google no devolvió ningún negocio para esa búsqueda. Prueba otro término o ciudad.";
  }
  if (trasFiltros === 0) {
    if (sinWeb === 0) {
      return `Se encontraron ${found} negocios, pero todos tienen web → con «Solo sin web» activado no pasa ninguno al pipeline. Las webs salen en los más prominentes: sube el máximo de resultados (los pequeños sin web caen más abajo) o desactiva el filtro.`;
    }
    return `Se encontraron ${found} negocios y ${sinWeb} sin web, pero los filtros de calidad (categoría / rating / teléfono / email) descartaron el resto. Afloja esos filtros.`;
  }
  if (nuevos === 0 && actualizados > 0) {
    return `Los ${actualizados} negocios que pasaron el filtro ya estaban en el pipeline: se actualizaron, no son nuevos. No verás filas nuevas, pero están ahí.`;
  }
  if (nuevos === 0 && actualizados === 0) {
    return `Pasaron ${trasFiltros} el filtro pero no se insertó ninguno. Revisa los avisos de abajo.`;
  }
  return null;
}

export default function Import() {
  const [jsonText, setJsonText] = useState("");
  const [fileLeads, setFileLeads] = useState<Record<string, string>[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<IngestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Opción C — scraper
  const [scrapeQuery, setScrapeQuery] = useState("");
  const [scrapeCity, setScrapeCity] = useState("");
  const [scrapeMax, setScrapeMax] = useState(12);
  const [scrapeOnlyNoWeb, setScrapeOnlyNoWeb] = useState(true);
  // Filtros de calidad
  const [scrapeCategoryKeyword, setScrapeCategoryKeyword] = useState("");
  const [scrapeMinRating, setScrapeMinRating] = useState(0);
  const [scrapeRequirePhone, setScrapeRequirePhone] = useState(false);
  const [scrapeRequireEmail, setScrapeRequireEmail] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<ScrapeResult | null>(null);
  const [scrapeError, setScrapeError] = useState<string | null>(null);

  async function handleScrape() {
    if (!scrapeQuery.trim() || !scrapeCity.trim()) {
      setScrapeError("Escribe un nicho y una ciudad.");
      return;
    }
    setScraping(true);
    setScrapeError(null);
    setScrapeResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("run-scrape", {
        body: {
          query: scrapeQuery.trim(),
          city: scrapeCity.trim(),
          max: scrapeMax,
          onlyWithoutWebsite: scrapeOnlyNoWeb,
          categoryKeyword: scrapeCategoryKeyword.trim() || undefined,
          minRating: scrapeMinRating > 0 ? scrapeMinRating : undefined,
          requirePhone: scrapeRequirePhone || undefined,
          requireEmail: scrapeRequireEmail || undefined,
        },
      });
      if (error) throw error;
      setScrapeResult(data as ScrapeResult);
    } catch (e) {
      setScrapeError(await edgeFunctionErrorMessage(e, "Error al buscar en Google."));
    } finally {
      setScraping(false);
    }
  }

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    setError(null);
    setResult(null);
    const file = e.target.files?.[0];
    if (!file) {
      setFileLeads(null);
      setFileName(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseCsv(String(reader.result ?? ""));
        setFileLeads(rows);
        setFileName(file.name);
      } catch {
        setError("No se pudo leer el CSV. Revisa el formato.");
      }
    };
    reader.readAsText(file);
  }

  function buildLeads(): Record<string, unknown>[] {
    if (fileLeads && fileLeads.length > 0) return fileLeads;
    const raw = jsonText.trim();
    if (!raw) throw new Error("Pega un JSON o sube un CSV primero.");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.leads)) return parsed.leads;
    throw new Error(
      'El JSON debe ser un array [...] o un objeto { "leads": [...] }.',
    );
  }

  async function handleImport() {
    setError(null);
    setResult(null);
    let leads: Record<string, unknown>[];
    try {
      leads = buildLeads();
    } catch (e) {
      setError(e instanceof Error ? e.message : "JSON no válido.");
      return;
    }
    if (leads.length === 0) {
      setError("No hay leads que importar.");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("ingest-leads", {
        body: { leads, source: "manual" },
      });
      if (error) throw error;
      setResult(data as IngestResult);
    } catch (e) {
      setError(
        (await edgeFunctionErrorMessage(e, "Error llamando a ingest-leads.")) +
          " · Comprueba que la función ingest-leads está desplegada en tu Supabase.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const count = fileLeads?.length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Importar leads</h1>
        <p className="text-muted-foreground">
          Pega el JSON del scraper o sube un CSV. Se normaliza, se deduplica por{" "}
          <code>google_place_id</code> y entra como <code>nuevo</code>.
        </p>
      </div>

      {/* Opción C — scraper automático */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Opción C · Buscar en Google Maps</CardTitle>
          <CardDescription>
            Escribe un nicho y una ciudad. WebForge busca en Google Maps y trae los negocios directamente al pipeline.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Búsqueda principal */}
          <div className="flex flex-wrap gap-3">
            <Input
              placeholder="Nicho (ej: taller mecánico)"
              value={scrapeQuery}
              onChange={(e) => setScrapeQuery(e.target.value)}
              className="max-w-[220px]"
            />
            <Input
              placeholder="Ciudad (ej: Salamanca)"
              value={scrapeCity}
              onChange={(e) => setScrapeCity(e.target.value)}
              className="max-w-[200px]"
            />
            <Input
              type="number"
              min={1}
              max={12}
              value={scrapeMax}
              onChange={(e) => setScrapeMax(Number(e.target.value))}
              className="max-w-[90px]"
              title="Máx. negocios (tope 60)"
            />
          </div>

          {/* Filtros de calidad */}
          <div className="rounded-md border p-3 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Filtros de calidad</p>

            {/* Categoría keyword — el más importante */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Palabra clave en categoría</label>
              <Input
                placeholder='ej: "mecánico" — descarta talleres de repostería, etc.'
                value={scrapeCategoryKeyword}
                onChange={(e) => setScrapeCategoryKeyword(e.target.value)}
                className="max-w-[340px]"
              />
              <p className="text-xs text-muted-foreground">
                Filtra por la categoría que Google Maps asigna a cada negocio.
              </p>
            </div>

            {/* Rating mínimo */}
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium min-w-[140px]">Valoración mínima</label>
              <Input
                type="number"
                min={0}
                max={5}
                step={0.1}
                value={scrapeMinRating}
                onChange={(e) => setScrapeMinRating(Number(e.target.value))}
                className="max-w-[80px]"
                placeholder="0"
              />
              <span className="text-sm text-muted-foreground">/ 5 · (0 = sin filtro)</span>
            </div>

            {/* Checkboxes */}
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={scrapeOnlyNoWeb}
                  onChange={(e) => setScrapeOnlyNoWeb(e.target.checked)}
                  className="h-4 w-4"
                />
                Solo sin web propia
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={scrapeRequirePhone}
                  onChange={(e) => setScrapeRequirePhone(e.target.checked)}
                  className="h-4 w-4"
                />
                Teléfono visible
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={scrapeRequireEmail}
                  onChange={(e) => setScrapeRequireEmail(e.target.checked)}
                  className="h-4 w-4"
                />
                Solo con email
              </label>
            </div>

            <p className="text-xs text-muted-foreground">
              ℹ️ El email se extrae automáticamente en cada búsqueda (se visita la web/redes de
              cada negocio), por eso tarda algo más y el máximo efectivo se limita a 12. Marca «Solo
              con email» si quieres descartar los negocios de los que no se haya podido sacar correo.
            </p>
          </div>
          <Button onClick={handleScrape} disabled={scraping}>
            {scraping ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Buscando… (puede tardar 1–2 min)</>
            ) : (
              <><Search className="h-4 w-4" /> Buscar en Google</>
            )}
          </Button>
          {scrapeError && (
            <p className="text-sm text-destructive">{scrapeError}</p>
          )}
          {scrapeResult && (
            <div className="rounded-md border p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 text-center">
                <div className="rounded-md bg-muted p-2">
                  <div className="text-2xl font-bold">{scrapeResult.found ?? 0}</div>
                  <div className="text-xs text-muted-foreground">Encontrados</div>
                </div>
                <div className="rounded-md bg-muted p-2">
                  <div className="text-2xl font-bold">{scrapeResult.without_website ?? 0}</div>
                  <div className="text-xs text-muted-foreground">Sin web</div>
                </div>
                <div className="rounded-md bg-muted p-2">
                  <div className="text-2xl font-bold">{scrapeResult.after_filters ?? scrapeResult.without_website ?? 0}</div>
                  <div className="text-xs text-muted-foreground">Tras filtros</div>
                </div>
                <div className="rounded-md bg-muted p-2">
                  <div className="text-2xl font-bold">{scrapeResult.inserted ?? 0}</div>
                  <div className="text-xs text-muted-foreground">Nuevos</div>
                </div>
                <div className="rounded-md bg-muted p-2">
                  <div className="text-2xl font-bold">{scrapeResult.with_email ?? 0}</div>
                  <div className="text-xs text-muted-foreground">Con email</div>
                </div>
              </div>
              {scrapeNotice(scrapeResult) && (
                <p className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400">
                  ⚠️ {scrapeNotice(scrapeResult)}
                </p>
              )}
              {scrapeResult.partial && (
                <p className="text-sm text-amber-600 dark:text-amber-500">
                  ⚠️ Resultados parciales: el scrape no terminó ({scrapeResult.run_status ?? "TIMED-OUT"}).
                  Apify cortó por tiempo, así que esto es lo que dio tiempo a traer. Repite la
                  búsqueda o baja el máximo de resultados para completar.
                </p>
              )}
              {scrapeResult.errors && scrapeResult.errors.length > 0 && (
                <p className="text-sm text-destructive">Avisos: {scrapeResult.errors.join(" · ")}</p>
              )}
              <Link to="/" className={buttonVariants({ variant: "default", size: "default" })}>
                Ver pipeline →
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Opción A · Pegar JSON</CardTitle>
          <CardDescription>
            Un array <code>[...]</code> o un objeto <code>{`{ "leads": [...] }`}</code>.
            Acepta campos de Apify/Outscraper (title, placeId, totalScore…).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={jsonText}
            onChange={(e) => {
              setJsonText(e.target.value);
              setFileLeads(null);
              setFileName(null);
              setResult(null);
              setError(null);
            }}
            placeholder='[ { "title": "Mi negocio", "placeId": "..." } ]'
            className="min-h-[220px] font-mono text-xs"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Opción B · Subir CSV</CardTitle>
          <CardDescription>
            La primera fila debe ser la cabecera (name, category, phone, city,
            google_place_id, rating, review_count…).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFile}
            className="block w-full text-sm file:mr-4 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-accent"
          />
          {fileName && (
            <p className="text-sm text-muted-foreground">
              {fileName}: {count} fila{count === 1 ? "" : "s"} detectada
              {count === 1 ? "" : "s"}.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={handleImport} disabled={submitting}>
          {submitting ? "Importando…" : "Importar"}
        </Button>
        <Link to="/" className={buttonVariants({ variant: "outline" })}>
          Ver pipeline
        </Link>
      </div>

      {error && (
        <Card>
          <CardContent className="p-4 text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Importación completada</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <span>
                Recibidos: <strong>{result.received ?? 0}</strong>
              </span>
              <span>
                Válidos: <strong>{result.normalized ?? 0}</strong>
              </span>
              <span>
                Nuevos: <strong>{result.inserted ?? 0}</strong>
              </span>
              <span>
                Actualizados: <strong>{result.upserted ?? 0}</strong>
              </span>
            </div>
            {result.errors && result.errors.length > 0 && (
              <div className="text-destructive">
                Avisos: {result.errors.join(" · ")}
              </div>
            )}
            <Link
              to="/"
              className={buttonVariants({ variant: "default", size: "sm" })}
            >
              Ir al pipeline
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
