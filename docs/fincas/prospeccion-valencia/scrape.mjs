// [FINCAS] Prospección: administradores de fincas en Valencia ciudad + área metropolitana.
// Investigación aparte, no toca Supabase ni el pipeline de WEBS.
// Pasada 1: búsqueda sin reseñas (barata). Filtro. Pasada 2: 30 reseñas más recientes solo de las que pasan.
// Uso: node docs/fincas/prospeccion-valencia/scrape.mjs pass1 | pass2
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const envTxt = fs.readFileSync(path.join(DIR, "..", "..", "..", ".env"), "utf8");
const TOKEN = envTxt.match(/^APIFY_TOKEN_2=(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
if (!TOKEN) throw new Error("Falta APIFY_TOKEN_2");
const ACTOR = "compass~crawler-google-places";

async function runApify(input, timeout = 600) {
  const start = await fetch(`https://api.apify.com/v2/acts/${ACTOR}/runs?token=${TOKEN}&timeout=${timeout}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  });
  if (!start.ok) throw new Error(`Apify ${start.status}: ${(await start.text()).slice(0, 300)}`);
  const { data } = await start.json();
  let status = data.status;
  const t0 = Date.now();
  while (!["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(status) && Date.now() - t0 < (timeout + 60) * 1000) {
    const p = await (await fetch(`https://api.apify.com/v2/actor-runs/${data.id}?token=${TOKEN}&waitForFinish=30`)).json();
    status = p.data.status;
    console.error(`run ${data.id}: ${status}`);
  }
  const items = await (await fetch(`https://api.apify.com/v2/datasets/${data.defaultDatasetId}/items?token=${TOKEN}&format=json`)).json();
  const run = await (await fetch(`https://api.apify.com/v2/actor-runs/${data.id}?token=${TOKEN}`)).json();
  console.error(`status=${status} items=${items.length} usd=${run.data?.usageTotalUsd ?? "?"}`);
  return items;
}

// Franquicias/grandes redes de proptech que ya venden atención telefónica profesional como parte del producto
// (Housfy, Tecnocasa, Look&Find, Fincas Corral...) — no son el perfil, el dolor de "no contestan" no aplica igual.
const CHAINS = /housfy|tecnocasa|look\s*&?\s*find|fincas\s*corral|re\/?max|century\s*21|engel\s*&?\s*v[oö]lkers|gesfincas\s*group/i;

const SEARCHES = [
  "administrador de fincas Valencia",
  "administración de fincas Valencia",
  "gestión de comunidades de propietarios Valencia",
  "administrador de fincas Torrent",
  "administrador de fincas Paterna",
  "administrador de fincas Mislata",
  "administrador de fincas Burjassot",
  "administrador de fincas Alboraya",
  "administrador de fincas Catarroja",
  "administrador de fincas Xirivella",
];

if (process.argv[2] === "pass1") {
  const items = await runApify({
    searchStringsArray: SEARCHES,
    locationQuery: "Valencia, Spain",
    maxCrawledPlacesPerSearch: 20,
    language: "es",
    maxReviews: 0,
    scrapeReviewsPersonalData: false,
    skipClosedPlaces: true,
    includeWebResults: false,
    scrapeContacts: false,
    scrapePlaceDetailPage: false,
  });
  fs.writeFileSync(path.join(DIR, "raw-pass1.json"), JSON.stringify(items, null, 1));
  const seen = new Set();
  const rows = [];
  for (const i of items) {
    if (seen.has(i.placeId)) continue;
    seen.add(i.placeId);
    const n = i.reviewsCount ?? 0;
    const reason = n < 15 ? "<15 reseñas (poca muestra)" : CHAINS.test(`${i.title} ${i.website ?? ""}`) ? "franquicia proptech" : "";
    rows.push({ placeId: i.placeId, title: i.title, reviews: n, rating: i.totalScore, web: i.website, cat: i.categoryName, city: i.city, reason });
  }
  fs.writeFileSync(path.join(DIR, "pass1-filtro.json"), JSON.stringify(rows, null, 1));
  for (const r of rows) console.log(`${r.reason ? "✗ " + r.reason.padEnd(24) : "✓".padEnd(26)} ${r.reviews}\t${r.title} | ${r.web ?? "sin web"} | ${r.city ?? ""}`);
  console.log(`únicos=${rows.length} pasan=${rows.filter((r) => !r.reason).length}`);
}

if (process.argv[2] === "pass2") {
  const keep = JSON.parse(fs.readFileSync(path.join(DIR, "pass2-ids.json"), "utf8"));
  const items = await runApify({
    placeIds: keep,
    maxReviews: 30,
    reviewsSort: "newest",
    reviewsOrigin: "google",
    scrapeReviewsPersonalData: false,
    language: "es",
    scrapeContacts: false,
    maxImages: 0,
  }, 900);
  fs.writeFileSync(path.join(DIR, "raw-pass2.json"), JSON.stringify(items, null, 1));
  for (const i of items) console.log(`${(i.reviews ?? []).length} reseñas\t${i.title}`);
}
