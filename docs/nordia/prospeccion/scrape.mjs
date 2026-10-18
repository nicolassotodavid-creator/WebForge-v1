// Nordia: prospección de despachos de abogados pequeños para venderles los agentes de IA
// (Panel de Control con LexNET y plazos, Recepción, Comercial y Cobros).
// No toca Supabase ni el pipeline de WebForge: Nordia no tiene panel aquí.
// Pasada 1: búsqueda sin reseñas (barata) + filtro. Pasada 2 (opcional): 30 reseñas más recientes de los elegidos.
// Uso: node docs/nordia/prospeccion/scrape.mjs pass1 <lote> <Ciudad1,Ciudad2,...> | pass2 <lote>
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const envTxt = fs.readFileSync(path.join(DIR, "..", "..", "..", ".env"), "utf8");
const TOKEN_VAR = process.env.APIFY_TOKEN_VAR ?? "APIFY_TOKEN_2";
const TOKEN = envTxt.match(new RegExp(`^${TOKEN_VAR}=(.+)$`, "m"))?.[1]?.trim().replace(/^["']|["']$/g, "");
if (!TOKEN) throw new Error(`Falta ${TOKEN_VAR}`);
const ACTOR = "compass~crawler-google-places";
const LOTE = process.argv[3] ?? "valencia";
const CITIES = (process.argv[4] ?? "Valencia").split(",").map((c) => c.trim()).filter(Boolean);
const OUT = path.join(DIR, LOTE.toLowerCase());
fs.mkdirSync(OUT, { recursive: true });

async function runApify(input, timeout = 1800) {
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

// Despachos que litigan para particulares: LexNET y plazos a diario, consultas nuevas y minutas que cobrar.
const AREAS = ["despacho de abogados", "abogado de familia", "abogado laboralista", "abogado penalista"];
// Grandes firmas, franquicias, redes y servicios que no son un despacho que decide solo.
const GRANDES = /garrigues|cuatrecasas|uría|uria menendez|pérez-llorca|perez-llorca|baker|deloitte|kpmg|\bpwc\b|\bey\b|ernst|broseta|ontier|ecija|écija|andersen|legálitas|legalitas|arriaga|abogados para todos|reclamador|repara tu deuda|mi abogado en casa|legal ?consulting group|hereditas|toro pujol|asesoría|asesoria|gestoría|gestoria|colegio de abogados|turno de oficio|juzgado|ciudad de la justicia|notar|procurador|segunda oportunidad|libertiun|deudout|loanko|borra ?tu ?deuda|organiza tus deudas|bufete ?online/i;

if (process.argv[2] === "pass1") {
  const items = await runApify({
    searchStringsArray: CITIES.flatMap((c) => AREAS.map((a) => `${a} ${c}`)),
    maxCrawledPlacesPerSearch: 30,
    language: "es",
    countryCode: "es",
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
    const ciudad = CITIES.find((c) => (i.searchString ?? "").endsWith(c)) ?? i.city;
    const reason = !/abogad|bufete|jur[ií]dic|legal/i.test(`${cat} ${i.title}`) ? "no es despacho"
      : !i.website ? "sin web" : n < 20 ? "<20 reseñas" : n > 350 ? ">350 reseñas"
      : GRANDES.test(`${i.title} ${i.website}`) ? "grande/red" : "";
    rows.push({ placeId: i.placeId, title: i.title, reviews: n, rating: i.totalScore, web: i.website, phone: i.phone, cat: i.categoryName, address: i.address, city: i.city, ciudad, search: i.searchString, reason });
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
