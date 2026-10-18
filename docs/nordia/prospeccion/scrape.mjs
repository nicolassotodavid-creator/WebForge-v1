// Nordia: prospección de despachos de abogados pequeños (agentes de Recepción, Comercial y Cobros).
// No toca Supabase ni el pipeline de WebForge: Nordia no tiene panel aquí.
// Pasada 1: búsqueda sin reseñas (barata) + filtro. Pasada 2: 30 reseñas más recientes solo de las que pasan.
// Uso: node docs/nordia/prospeccion/scrape.mjs pass1 <ciudad> | pass2 <ciudad>
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const envTxt = fs.readFileSync(path.join(DIR, "..", "..", "..", ".env"), "utf8");
const TOKEN = envTxt.match(/^APIFY_TOKEN_2=(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
if (!TOKEN) throw new Error("Falta APIFY_TOKEN_2");
const ACTOR = "compass~crawler-google-places";
const CITY = process.argv[3] ?? "Valencia";
const OUT = path.join(DIR, CITY.toLowerCase());
fs.mkdirSync(OUT, { recursive: true });

async function runApify(input, timeout = 900) {
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

// Áreas con mucho cliente particular = muchas llamadas, WhatsApp y cobro de honorarios.
const AREAS = [
  "abogado de familia", "abogado divorcios", "abogado extranjería", "abogado laboralista",
  "abogado penalista", "abogado herencias", "abogado accidentes de tráfico",
  "abogado ley segunda oportunidad", "despacho de abogados",
];
// Grandes firmas, franquicias, redes y servicios que no son un despacho que decide solo.
const GRANDES = /garrigues|cuatrecasas|uría|uria menendez|pérez-llorca|perez-llorca|baker|deloitte|kpmg|\bpwc\b|\bey\b|ernst|broseta|ontier|ecija|écija|andersen|legálitas|legalitas|arriaga|abogados para todos|reclamador|repara tu deuda|mi abogado en casa|legal ?consulting group|asesoría|asesoria|gestoría|gestoria|colegio de abogados|\bicav\b|turno de oficio|juzgado|ciudad de la justicia|notar|procurador/i;

if (process.argv[2] === "pass1") {
  const items = await runApify({
    searchStringsArray: AREAS.map((a) => `${a} ${CITY}`),
    locationQuery: `${CITY}, Spain`,
    maxCrawledPlacesPerSearch: 40,
    language: "es",
    maxReviews: 0,
    scrapeReviewsPersonalData: false,
    skipClosedPlaces: true,
    includeWebResults: false,
    scrapeContacts: false,
    scrapePlaceDetailPage: false,
  });
  fs.writeFileSync(path.join(OUT, "raw-pass1.json"), JSON.stringify(items, null, 1));
  const seen = new Set();
  const rows = [];
  for (const i of items) {
    if (seen.has(i.placeId)) continue;
    seen.add(i.placeId);
    const n = i.reviewsCount ?? 0;
    const cat = `${i.categoryName ?? ""} ${(i.categories ?? []).join(" ")}`;
    const reason = !/abogad|bufete|jur[ií]dic|legal/i.test(`${cat} ${i.title}`) ? "no es despacho"
      : !i.website ? "sin web" : n < 20 ? "<20 reseñas" : n > 400 ? ">400 reseñas"
      : GRANDES.test(`${i.title} ${i.website}`) ? "grande/red" : "";
    rows.push({ placeId: i.placeId, title: i.title, reviews: n, rating: i.totalScore, web: i.website, phone: i.phone, cat: i.categoryName, address: i.address, city: i.city, search: i.searchString, reason });
  }
  fs.writeFileSync(path.join(OUT, "pass1-filtro.json"), JSON.stringify(rows, null, 1));
  const by = {};
  for (const r of rows) by[r.reason || "pasa"] = (by[r.reason || "pasa"] ?? 0) + 1;
  console.log(`únicos=${rows.length}`, by);
}

if (process.argv[2] === "pass2") {
  const keep = JSON.parse(fs.readFileSync(path.join(OUT, "pass2-ids.json"), "utf8"));
  const items = await runApify({
    placeIds: keep,
    maxReviews: 30,
    reviewsSort: "newest",
    reviewsOrigin: "google",
    scrapeReviewsPersonalData: false,
    language: "es",
    scrapeContacts: false,
    maxImages: 0,
  });
  fs.writeFileSync(path.join(OUT, "raw-pass2.json"), JSON.stringify(items, null, 1));
  console.log(`pass2 fichas=${items.length}`);
}
