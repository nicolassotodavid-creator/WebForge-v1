// scrape-batch.ts — Barrido de prospección MULTI-CIUDAD (Apify → ingest-leads).
//
// Por qué existe: la Edge `run-scrape` es de una ciudad por click y vive bajo el límite de
// ~150 s de wall-time de las Edge Functions. Para peinar un área metropolitana entera (20-30
// municipios × 1-2 términos) hace falta un runner sin ese techo, que además pueda encadenar
// los runs en paralelo. Este script hace exactamente lo mismo que run-scrape (mismo actor,
// mismo runInput barato, mismos filtros) pero en lote y desde el Mac.
//
// Auth: NO usa sesión de operador (no la hay en CLI). Ingesta con INGEST_WEBHOOK_SECRET y
// marca `owner` explícitamente, que es la vía servidor↔servidor que ya soporta ingest-leads.
//
// NO contacta a nadie: solo mete leads en el pipeline (status 'new'). El gate de QA sigue
// intacto — nada sale hasta status 'approved' con visto bueno humano.
//
// Uso:
//   npx tsx scrape-batch.ts --query "reformas integrales" --cities "Torrent,Paterna" --mode con-web
//   npx tsx scrape-batch.ts --preset horta --query "reformas integrales" --min-reviews 8 --dry-run
import "./env.ts";

const ACTOR = "compass~crawler-google-places";
const APIFY_TOKEN = process.env.APIFY_TOKEN_2 ?? process.env.APIFY_TOKEN ?? "";
const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const INGEST_SECRET = process.env.INGEST_WEBHOOK_SECRET ?? "";
const OWNER = process.env.ADMIN_USER_ID ?? "";

/** Área metropolitana de València (l'Horta + Camp de Túria + Camp de Morvedre). */
const PRESETS: Record<string, string[]> = {
  horta: [
    "Torrent", "Paterna", "Mislata", "Burjassot", "Alboraya", "Manises", "Aldaia", "Alaquàs",
    "Quart de Poblet", "Xirivella", "Catarroja", "Alfafar", "Paiporta", "Picanya", "Sedaví",
    "Benetússer", "Godella", "Moncada", "Massamagrell", "Albal", "Silla", "Picassent",
  ],
  "camp-turia": ["Bétera", "L'Eliana", "Riba-roja de Túria", "Llíria", "San Antonio de Benagéber"],
  morvedre: ["Sagunt", "Puçol", "Puig de Santa Maria"],
  capital: ["València"],
};

interface Args {
  queries: string[];
  cities: string[];
  max: number;
  mode: "con-web" | "sin-web" | "todos";
  minRating: number;
  minReviews: number;
  categoryRx: RegExp | null;
  concurrency: number;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const split = (v: string | undefined): string[] =>
    (v ?? "").split(/[,;]/).map((s) => s.trim()).filter(Boolean);

  const cities = split(get("--cities"));
  for (const preset of split(get("--preset"))) {
    const list = PRESETS[preset];
    if (!list) throw new Error(`Preset desconocido: ${preset}. Hay: ${Object.keys(PRESETS).join(", ")}`);
    cities.push(...list);
  }
  const mode = (get("--mode") ?? "con-web") as Args["mode"];
  if (!["con-web", "sin-web", "todos"].includes(mode)) throw new Error(`--mode inválido: ${mode}`);

  return {
    queries: split(get("--query")),
    cities: [...new Set(cities)],
    max: Number(get("--max") ?? 20),
    mode,
    minRating: Number(get("--min-rating") ?? 0),
    minReviews: Number(get("--min-reviews") ?? 0),
    // Google mete en la misma búsqueda gremios vecinos (eléctricos, centros de negocio,
    // inmobiliarias). El filtro se aplica a categoría Y nombre: un "Reformas Pepe" catalogado
    // como "Contratista" pasa igual.
    categoryRx: get("--category") ? new RegExp(get("--category")!, "i") : null,
    concurrency: Number(get("--concurrency") ?? 4),
    dryRun: argv.includes("--dry-run"),
  };
}

type Item = Record<string, unknown>;

/** Misma verdad que run-scrape / ingest-leads: un perfil de redes NO es web propia. */
function hasWebsite(o: Item): boolean {
  const ws = String(o["website"] ?? o["site"] ?? o["web"] ?? o["url"] ?? o["domain"] ?? "").trim();
  if (!ws) return false;
  return !/google\.|maps\.|facebook\.|instagram\./i.test(ws);
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Lanza un run de Apify, espera a estado terminal y SIEMPRE lee el dataset (un run TIMED-OUT
 * deja igualmente sus parciales — perderlos sería tirar fichas ya pagadas).
 */
async function runApify(runInput: Item, runTimeout = 180): Promise<Item[]> {
  const TERMINAL = new Set(["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"]);
  const startRes = await fetch(
    `https://api.apify.com/v2/acts/${ACTOR}/runs?token=${APIFY_TOKEN}&timeout=${runTimeout}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(runInput) },
  );
  if (!startRes.ok) throw new Error(`Apify ${startRes.status}: ${(await startRes.text()).slice(0, 200)}`);
  const start = await startRes.json();
  const runId = String(start?.data?.id ?? "");
  const datasetId = String(start?.data?.defaultDatasetId ?? "");
  let status = String(start?.data?.status ?? "RUNNING");
  if (!runId || !datasetId) throw new Error("Apify no devolvió runId/datasetId.");

  const startedAt = Date.now();
  while (!TERMINAL.has(status) && Date.now() - startedAt < (runTimeout + 40) * 1000) {
    const poll = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}&waitForFinish=20`);
    if (!poll.ok) break;
    status = String((await poll.json().catch(() => null))?.data?.status ?? status);
  }

  const items = await (await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&format=json`,
  )).json();
  return Array.isArray(items) ? items : [];
}

/** Un (término × ciudad). Devuelve los items que pasan los filtros + el embudo para el informe. */
async function scrapeOne(query: string, city: string, a: Args) {
  const runInput: Item = {
    searchStringsArray: [query],
    countryCode: "es",
    city,
    maxCrawledPlacesPerSearch: a.max,
    language: "es",
    // Modo barato: sin reseñas y sin página de detalle (se cobran aparte y no hacen falta para
    // prospectar). El build sí las trae después, y solo para el negocio aprobado.
    maxReviews: 0,
    reviewsSort: "newest",
    scrapeReviewsPersonalData: false,
    skipClosedPlaces: true,
    includeWebResults: false,
    scrapeContacts: false,
    scrapePlaceDetailPage: false,
    website: a.mode === "sin-web" ? "withoutWebsite" : "allPlaces",
  };

  const items = await runApify(runInput);
  const conWeb = items.filter(hasWebsite);
  const base = a.mode === "con-web" ? conWeb : a.mode === "sin-web" ? items.filter((i) => !hasWebsite(i)) : items;
  const kept = base.filter((i) => {
    if (num(i["totalScore"]) < a.minRating || num(i["reviewsCount"]) < a.minReviews) return false;
    if (!a.categoryRx) return true;
    const haystack = [i["categoryName"], i["title"], ...(Array.isArray(i["categories"]) ? i["categories"] : [])]
      .filter(Boolean).join(" | ");
    return a.categoryRx.test(haystack);
  });
  return { city, query, found: items.length, conWeb: conWeb.length, kept };
}

/** Ejecuta `jobs` con concurrencia limitada (los runs de Apify son de red, no de CPU). */
async function pooled<T>(jobs: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const out: T[] = new Array(jobs.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, jobs.length) }, async () => {
      while (next < jobs.length) {
        const i = next++;
        out[i] = await jobs[i]();
      }
    }),
  );
  return out;
}

async function ingest(leads: Item[]): Promise<{ inserted: number; upserted: number; errors: string[] }> {
  const totals = { inserted: 0, upserted: 0, errors: [] as string[] };
  for (let i = 0; i < leads.length; i += 40) {
    const chunk = leads.slice(i, i + 40);
    const res = await fetch(`${SUPABASE_URL}/functions/v1/ingest-leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-ingest-secret": INGEST_SECRET },
      body: JSON.stringify({ leads: chunk, source: "apify", owner: OWNER || undefined }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      totals.errors.push(`HTTP ${res.status}: ${JSON.stringify(json).slice(0, 200)}`);
      continue;
    }
    totals.inserted += Number(json?.inserted ?? 0);
    totals.upserted += Number(json?.upserted ?? 0);
    if (Array.isArray(json?.errors)) totals.errors.push(...json.errors.map(String));
  }
  return totals;
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  if (!APIFY_TOKEN) throw new Error("Falta APIFY_TOKEN_2 en .env");
  if (!a.queries.length || !a.cities.length) throw new Error("Faltan --query y --cities/--preset");
  if (!a.dryRun && !INGEST_SECRET) throw new Error("Falta INGEST_WEBHOOK_SECRET en .env");

  const pairs = a.queries.flatMap((q) => a.cities.map((c) => ({ q, c })));
  console.log(
    `▶ ${pairs.length} barridos (${a.queries.length} término(s) × ${a.cities.length} ciudades) · ` +
      `modo ${a.mode} · max ${a.max}/barrido · rating ≥ ${a.minRating} · reseñas ≥ ${a.minReviews}` +
      (a.dryRun ? " · DRY-RUN" : ""),
  );

  const results = await pooled(
    pairs.map(({ q, c }) => async () => {
      try {
        const r = await scrapeOne(q, c, a);
        console.log(`  ${c.padEnd(24)} ${String(r.found).padStart(3)} fichas · ${String(r.conWeb).padStart(3)} con web · ${String(r.kept.length).padStart(3)} válidos`);
        return r;
      } catch (e) {
        console.log(`  ${c.padEnd(24)} ERROR: ${e instanceof Error ? e.message : e}`);
        return { city: c, query: q, found: 0, conWeb: 0, kept: [] as Item[] };
      }
    }),
    a.concurrency,
  );

  // Dedupe por placeId: el mismo negocio sale en varios municipios limítrofes y con varios términos.
  const seen = new Set<string>();
  const leads: Item[] = [];
  for (const r of results) {
    for (const item of r.kept) {
      const id = String(item["placeId"] ?? item["place_id"] ?? item["title"] ?? "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      leads.push(item);
    }
  }

  const found = results.reduce((n, r) => n + r.found, 0);
  console.log(`\n∑ ${found} fichas scrapeadas → ${leads.length} candidatos únicos tras filtros.`);

  if (a.dryRun) {
    for (const l of leads.slice(0, 60)) {
      console.log(`  · ${String(l["title"]).slice(0, 38).padEnd(40)} ${String(l["totalScore"] ?? "-").padStart(3)}★ ${String(l["reviewsCount"] ?? 0).padStart(4)} res · ${String(l["categoryName"] ?? "").slice(0, 22).padEnd(24)} ${String(l["website"] ?? "").slice(0, 40)}`);
    }
    console.log("\n(dry-run: no se ha ingerido nada)");
    return;
  }

  const r = await ingest(leads);
  // OJO: `upserted` de ingest-leads = TODAS las fichas con google_place_id (altas + actualizaciones
  // de las que ya estaban); `inserted` son solo las que llegan sin place_id. No es "nuevos vs
  // existentes": el reparto real se ve en la DB por created_at.
  console.log(`✔ ingest-leads: ${r.upserted + r.inserted} fichas ingeridas (altas + actualizaciones de las ya conocidas)`);
  if (r.errors.length) console.log(`⚠ ${r.errors.length} avisos: ${r.errors.slice(0, 5).join(" | ")}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
