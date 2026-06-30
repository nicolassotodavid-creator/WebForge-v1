// run-scrape — lanza un scrape de Google Maps vía Apify y mete los resultados en ingest-leads.
// Input: { query, city, max?, language?, maxReviews?, onlyWithoutWebsite? }
// Secret: APIFY_TOKEN_2 (la key de Apify). NUNCA se expone al frontend.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function deriveHasWebsite(o: Record<string, unknown>): boolean {
  const ws = (o["website"] ?? o["site"] ?? o["web"] ?? o["url"] ?? o["domain"] ?? "") as string;
  if (!ws || !ws.trim()) return false;
  if (/google\.|maps\.|facebook\.|instagram\./i.test(ws)) return false;
  return true;
}

const ACTOR = "compass~crawler-google-places";

// Lanza un run de Apify, espera a estado terminal (o a que se aborte por timeout) y SIEMPRE
// lee el dataset (un run TIMED-OUT igual deja sus parciales). Lo usan el scrape principal y el
// modo diagnóstico. Lanza Error con mensaje legible; el handler lo mapea a 502.
async function runApify(
  apifyToken: string,
  runInput: Record<string, unknown>,
  opts: { runTimeout: number; wallBudgetMs: number },
): Promise<{ items: Record<string, unknown>[]; runStatus: string }> {
  const TERMINAL = new Set(["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"]);

  // 1. Lanzar el run (asíncrono). `timeout` aborta el actor; no esperamos a que acabe aquí.
  const startRes = await fetch(
    `https://api.apify.com/v2/acts/${ACTOR}/runs?token=${apifyToken}&timeout=${opts.runTimeout}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(runInput),
    },
  );
  if (!startRes.ok) {
    const txt = await startRes.text().catch(() => "");
    throw new Error(`Apify no aceptó el run (${startRes.status}): ${txt.slice(0, 300)}`);
  }
  const startJson = await startRes.json();
  const runId = String(startJson?.data?.id ?? "");
  const datasetId = String(startJson?.data?.defaultDatasetId ?? "");
  let runStatus = String(startJson?.data?.status ?? "RUNNING");
  if (!runId || !datasetId) throw new Error("Apify no devolvió runId/datasetId.");

  // 2. Esperar a estado terminal. `waitForFinish` bloquea hasta 20s por llamada; el actor
  //    se aborta solo a los runTimeout s, así que el bucle converge sin colgarse.
  const startedAt = Date.now();
  while (!TERMINAL.has(runStatus) && (Date.now() - startedAt) < opts.wallBudgetMs) {
    const pollRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${apifyToken}&waitForFinish=20`,
    );
    if (!pollRes.ok) break; // si falla el poll, salimos y rescatamos lo que haya en el dataset.
    const pollJson = await pollRes.json().catch(() => null);
    runStatus = String(pollJson?.data?.status ?? runStatus);
  }

  // 3. Leer el dataset SIEMPRE: incluye los parciales aunque el run acabara TIMED-OUT.
  const itemsRes = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}&format=json`,
  );
  if (!itemsRes.ok) {
    const txt = await itemsRes.text().catch(() => "");
    throw new Error(`Apify devolvió ${itemsRes.status} al leer el dataset: ${txt.slice(0, 300)}`);
  }
  const items = await itemsRes.json();
  if (!Array.isArray(items)) throw new Error("Apify no devolvió un array.");
  return { items, runStatus };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Método no permitido" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const APIFY_TOKEN = Deno.env.get("APIFY_TOKEN_2");

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return jsonResponse({ error: "Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY." }, 500);
  }
  if (!APIFY_TOKEN) {
    return jsonResponse(
      { error: "Falta APIFY_TOKEN_2. Añádelo en Supabase → Edge Functions → Manage secrets." },
      500,
    );
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // --- Autorización: sesión de operador ---
  // Guardamos el id del operador: los leads que entren serán SUYOS (aislamiento por cuenta).
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  let authorized = false;
  let operatorId: string | null = null;
  if (token) {
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data?.user) {
      authorized = true;
      operatorId = data.user.id;
    }
  }
  if (!authorized) return jsonResponse({ error: "No autorizado" }, 401);

  // --- Input ---
  let query: string, city: string;
  let max = 20;
  let language = "es";
  // 0 en prospección: el actor COBRA por reseña (`maxReviews` lleva "($)" en su esquema) y las
  // reseñas solo hacen falta al CONSTRUIR la web. El Orquestador las trae en el build, una sola vez
  // y solo para el negocio aprobado (orquestador/reviews.ts). `reviewsCount` (el total) llega igual.
  let maxReviews = 0;
  let onlyWithoutWebsite = true;
  let diagnose = false; // modo diagnóstico: muestreo `allPlaces` para explicar un 0 sin-web.
  let countryCode = "es"; // España por defecto: el producto es para negocios locales españoles.
  // Filtros de calidad post-scrape
  let minRating = 0;          // ej: 4.5 — excluye negocios con peor nota
  let categoryKeyword = "";   // ej: "mecánico" — filtra por categoryName de Google Maps
  let requirePhone = false;   // solo negocios con teléfono
  let requireEmail = false;   // solo negocios con email visible

  try {
    const body = await req.json();
    query = String(body?.query ?? "").trim();
    city = String(body?.city ?? "").trim();
    if (!query || !city) return jsonResponse({ error: "Faltan query y city." }, 400);
    if (body?.max !== undefined) max = Math.min(Number(body.max) || 20, 60); // tope duro 60
    if (body?.language) language = String(body.language);
    if (body?.maxReviews !== undefined) {
      // OJO: `Number(0) || 15` daría 15 — usamos isFinite para respetar un 0 explícito.
      const mr = Number(body.maxReviews);
      maxReviews = Number.isFinite(mr) && mr >= 0 ? mr : 0;
    }
    if (body?.onlyWithoutWebsite !== undefined) onlyWithoutWebsite = Boolean(body.onlyWithoutWebsite);
    if (body?.minRating !== undefined) minRating = Number(body.minRating) || 0;
    if (body?.categoryKeyword) categoryKeyword = String(body.categoryKeyword).trim().toLowerCase();
    if (body?.requirePhone !== undefined) requirePhone = Boolean(body.requirePhone);
    if (body?.requireEmail !== undefined) requireEmail = Boolean(body.requireEmail);
    if (body?.countryCode) countryCode = String(body.countryCode).trim().toLowerCase();
    if (body?.diagnose !== undefined) diagnose = Boolean(body.diagnose);
  } catch (_e) {
    return jsonResponse({ error: "Cuerpo no válido." }, 400);
  }

  // --- Modo diagnóstico + rescate ------------------------------------------------------------
  // Cuando «Solo sin web» devuelve 0, el front nos vuelve a llamar con diagnose:true. Aquí NO nos
  // fiamos del filtro `withoutWebsite` de Google (en nichos reales devuelve fichas CON web): barremos
  // `allPlaces` EN PROFUNDIDAD (40), nos quedamos con los sin-web según deriveHasWebsite (nuestra
  // verdad, no la de Google) y los METEMOS al pipeline. Si no hay ninguno, devolvemos el % con web
  // para decir si el nicho está saturado. Solo se paga este barrido cuando el modo barato falló, así
  // que el coste extra es acotado, y es scrape básico (sin contactos/detalle/reseñas).
  if (diagnose) {
    const DEEP_MAX = 40;
    const deepInput = {
      searchStringsArray: [query],
      countryCode,
      city,
      maxCrawledPlacesPerSearch: DEEP_MAX,
      language,
      maxReviews: 0,
      reviewsSort: "newest",
      scrapeReviewsPersonalData: false,
      skipClosedPlaces: true,
      includeWebResults: false,
      scrapeContacts: false,
      scrapePlaceDetailPage: false,
      website: "allPlaces",
    };
    try {
      const { items, runStatus } = await runApify(APIFY_TOKEN, deepInput, {
        runTimeout: 90,
        wallBudgetMs: 100_000,
      });
      const sampled = items.length;
      const sinWeb = items.filter((i) => !deriveHasWebsite(i));
      const withoutWeb = sinWeb.length;
      const withWeb = sampled - withoutWeb;
      const pctWithWeb = sampled ? Math.round((withWeb / sampled) * 100) : 0;

      // Rescate: si el barrido profundo encontró sin-web, los metemos al pipeline. ingest-leads
      // deduplica por google_place_id, así que no duplica los que ya hubieran entrado antes.
      let rescued = 0;
      if (withoutWeb > 0) {
        const INGEST_SECRET = Deno.env.get("INGEST_WEBHOOK_SECRET") ?? "";
        try {
          const ingestRes = await fetch(`${SUPABASE_URL}/functions/v1/ingest-leads`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-ingest-secret": INGEST_SECRET,
              ...(INGEST_SECRET ? {} : { Authorization: `Bearer ${SERVICE_KEY}` }),
            },
            body: JSON.stringify({ leads: sinWeb, source: "apify", owner: operatorId }),
          });
          const ingestResult = await ingestRes.json().catch(() => ({}));
          rescued = Number(ingestResult?.inserted ?? 0);
        } catch (_e) {
          // El rescate es best-effort: si el ingest falla, devolvemos igual el diagnóstico.
        }
      }

      return jsonResponse({
        diagnose: true,
        sampled,
        with_web: withWeb,
        without_web: withoutWeb,
        pct_with_web: pctWithWeb,
        rescued,
        run_status: runStatus,
      });
    } catch (e) {
      return jsonResponse(
        { diagnose: true, error: e instanceof Error ? e.message : "Falló el diagnóstico." },
        502,
      );
    }
  }

  // scrapeContacts hace que el actor visite la web/redes de CADA ficha para sacar el email.
  // Es lo que ralentiza el run (3-5x) y provoca los TIMED-OUT que recortan la profundidad.
  //
  // En modo "Solo sin web" el email NO es la prioridad y lo apagamos: para saber si un negocio
  // tiene web NO hace falta scrapeContacts (el campo `website` viene en el scrape básico), y el
  // email de esos leads lo rellena después el Orquestador (backfill-emails.ts) descubriendo su
  // web/redes reales. Antes, además, tocaba scrapear en PROFUNDIDAD (max alto) porque los negocios
  // sin web caen abajo en Maps; ahora el filtro `website:"withoutWebsite"` del actor (ver runInput)
  // hace que devuelva directamente solo los sin-web, así que no hay que sobre-scrapear para llegar.
  //
  // Si NO filtras por "sin web" (quieres cualquier negocio), ahí sí lo encendemos: el email es
  // la pieza accionable del canal local (CLAUDE.md) y compensa ir más lento, con tope 12.
  const scrapeContacts = !onlyWithoutWebsite;
  max = Math.min(max, scrapeContacts ? 12 : 40);

  // requireEmail filtra por email YA scrapeado. En modo "sin web" no scrapeamos contactos, así
  // que no habría emails y el filtro dejaría el pipeline en 0 (justo el autosabotaje que
  // queremos evitar). Lo ignoramos y avisamos: el correo llega luego por backfill, el lead no
  // se descarta por no tenerlo todavía.
  const notes: string[] = [];
  if (requireEmail && !scrapeContacts) {
    requireEmail = false;
    notes.push(
      "«Solo con email» se ignoró: en modo «Solo sin web» el scrape va a por profundidad y no extrae correos en caliente (los rellena el backfill del Orquestador después).",
    );
  }

  // --- Llamada a Apify (asíncrona, con rescate de parciales) ---
  // Antes usábamos run-sync-get-dataset-items con timeout=120: si el run se pasaba de
  // tiempo, Apify respondía 400 (run-failed / TIMED-OUT) y se perdían TODOS los
  // resultados, aunque ya hubiera scrapeado parte. scrapeContacts visita la web/redes de
  // cada negocio (3-5x más lento), así que con max=20 el run rebasaba 120s a menudo.
  // Ahora: lanzamos el run, esperamos a estado terminal (o a que Apify lo aborte por
  // timeout) y SIEMPRE leemos el dataset — un run TIMED-OUT igual deja sus parciales.
  const RUN_TIMEOUT = 100;        // s — Apify aborta el actor aquí; deja headroom para leer el dataset bajo el límite ~150s de la Edge Function.
  const WALL_BUDGET_MS = 110_000; // tope de espera total antes de rescatar parciales.

  const runInput = {
    // El término va separado de la ubicación: así Google Maps geolocaliza bien.
    // Antes se concatenaba ("clinica dental valencia") y devolvía negocios de otros
    // países (p. ej. Valencia, México). countryCode + city lo fijan a España.
    searchStringsArray: [query],
    countryCode,
    city,
    maxCrawledPlacesPerSearch: max,
    language,
    maxReviews,
    reviewsSort: "newest",
    scrapeReviewsPersonalData: false,
    skipClosedPlaces: true,
    includeWebResults: false,
    // El email NO viene en los datos de Google Maps: hay que visitar la web/redes del
    // negocio. scrapeContacts lo activa para CADA resultado, tenga o no web propia
    // (Apify también rastrea las redes enlazadas). Siempre encendido: ver nota arriba.
    scrapeContacts,
    // ── Modo barato (máximo resultado, mínimo coste) ──────────────────────────────────────────
    // (1) scrapePlaceDetailPage:false → la prospección NO necesita la página de detalle (horarios,
    //     fotos, Q&A, popularTimes…). website, teléfono, rating, categoría y reviewsCount vienen
    //     del scrape BÁSICO. Con esto + maxReviews:0 ya no se cobra el add-on `place-details-scraped`
    //     (≈½ del coste por ficha; antes se disparaba solo por pedir reseñas).
    scrapePlaceDetailPage: false,
    // (2) website filter del ACTOR → en "sin web" que devuelva directamente solo negocios sin web
    //     propia, en vez de scrapear 40 mixtos y descartar 32. Así cada ficha pagada es un lead útil
    //     (más resultado por € sin subir el max). Seguimos pasando deriveHasWebsite abajo como red
    //     de precisión. "allPlaces" cuando no filtramos por sin-web (ahí queremos cualquier negocio).
    website: onlyWithoutWebsite ? "withoutWebsite" : "allPlaces",
  };

  let items: Record<string, unknown>[] = [];
  let runStatus = "RUNNING";
  try {
    const res = await runApify(APIFY_TOKEN, runInput, {
      runTimeout: RUN_TIMEOUT,
      wallBudgetMs: WALL_BUDGET_MS,
    });
    items = res.items;
    runStatus = res.runStatus;
  } catch (e) {
    return jsonResponse(
      { error: `No se pudo contactar con Apify: ${e instanceof Error ? e.message : "error"}` },
      502,
    );
  }

  // partial = el run no terminó con éxito (TIMED-OUT, abortado…), así que los datos pueden
  // estar incompletos. Lo propagamos para que la UI lo avise en vez de fingir que está todo.
  const partial = runStatus !== "SUCCEEDED";
  const found = items.length;

  // --- Filtro "sin web" (red de precisión sobre el filtro del actor) ---
  // El actor ya devuelve solo sin-web (website:"withoutWebsite"), pero su criterio es más burdo:
  // puede contar un Instagram/Facebook como "web propia" (o al revés). deriveHasWebsite afina —
  // descarta los que enlazan google/maps/facebook/instagram como si fuera su web. Doble malla =
  // precisión sin coste extra. Si en la calibración el actor dejara fuera negocios solo-Instagram
  // que sí queremos, basta con quitar el `website` filter del runInput y volver al barrido + este.
  let filtered = onlyWithoutWebsite ? items.filter((i) => !deriveHasWebsite(i)) : items;
  const withoutWebsite = filtered.length;

  // --- Filtros de calidad ---
  // 1. Categoría: descarta negocios cuya categoría no coincida con la keyword
  //    Ej: buscar "talleres mecánicos" y categoryKeyword="mecánico" elimina "talleres de repostería"
  if (categoryKeyword) {
    filtered = filtered.filter((i) => {
      const cat = String(i["categoryName"] ?? i["category"] ?? "").toLowerCase();
      const cats = Array.isArray(i["categories"])
        ? (i["categories"] as unknown[]).map((c) => String(c).toLowerCase()).join(" ")
        : "";
      // También mira el título como fallback (ej: "Taller Mecánico Pepe")
      const title = String(i["title"] ?? i["name"] ?? "").toLowerCase();
      return cat.includes(categoryKeyword) || cats.includes(categoryKeyword) || title.includes(categoryKeyword);
    });
  }

  // 2. Rating mínimo
  if (minRating > 0) {
    filtered = filtered.filter((i) => {
      const score = Number(i["totalScore"] ?? i["rating"] ?? i["stars"] ?? 0);
      return score >= minRating;
    });
  }

  // 3. Teléfono requerido
  if (requirePhone) {
    filtered = filtered.filter((i) => {
      const phone = i["phone"] ?? i["phoneUnformatted"] ?? i["phones"];
      return !!phone && String(phone).trim().length > 0;
    });
  }

  // 4. Email requerido
  if (requireEmail) {
    filtered = filtered.filter((i) => {
      const e = i["email"] ?? i["emails"];
      return e && String(e).includes("@");
    });
  }

  const afterQualityFilters = filtered.length;

  if (filtered.length === 0) {
    const warn = partial
      ? [`El run de Apify no terminó (${runStatus}): resultados parciales o vacíos. Repite la búsqueda o baja el máximo de resultados.`]
      : [];
    return jsonResponse({
      found,
      without_website: 0,
      after_filters: 0,
      inserted: 0,
      upserted: 0,
      with_email: 0,
      partial,
      run_status: runStatus,
      errors: warn,
      notes,
    });
  }

  // --- Pasar a ingest-leads via server-to-server ---
  const INGEST_SECRET = Deno.env.get("INGEST_WEBHOOK_SECRET") ?? "";
  let ingestResult: Record<string, unknown> = {};
  try {
    const ingestRes = await fetch(`${SUPABASE_URL}/functions/v1/ingest-leads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-ingest-secret": INGEST_SECRET,
        // Fallback: si no hay INGEST_WEBHOOK_SECRET, usamos la service key como Bearer
        ...(INGEST_SECRET ? {} : { Authorization: `Bearer ${SERVICE_KEY}` }),
      },
      body: JSON.stringify({ leads: filtered, source: "apify", owner: operatorId }),
    });
    ingestResult = await ingestRes.json().catch(() => ({}));
  } catch (e) {
    return jsonResponse(
      {
        error: `Apify OK (${found} resultados) pero falló ingest-leads: ${e instanceof Error ? e.message : "error"}`,
        found,
        without_website: withoutWebsite,
      },
      500,
    );
  }

  const withEmail = filtered.filter((i) => {
    const e = i["email"] ?? i["emails"];
    return e && String(e).includes("@");
  }).length;

  // Puntúa la web actual de los leads recién entrados, EN SEGUNDO PLANO (no bloquea la
  // respuesta del scrape). Así el Score aparece a los pocos minutos sin esperar al cron.
  // Best-effort y blindado: si falla, NUNCA rompe el scrape. Backstop: pg_cron (0012) re-barre
  // cada 15 min y cubre también los leads importados a mano.
  try {
    const scorePromise = fetch(`${SUPABASE_URL}/functions/v1/score-sites`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ limit: 8 }),
    }).catch(() => {});
    // EdgeRuntime es global en Supabase Edge Functions; mantiene viva la tarea tras responder.
    // deno-lint-ignore no-explicit-any
    const er = (globalThis as any).EdgeRuntime;
    if (er?.waitUntil) er.waitUntil(scorePromise);
  } catch (_e) {
    // El scoring es opcional; el scrape ya está hecho.
  }

  return jsonResponse({
    found,
    without_website: withoutWebsite,
    after_filters: afterQualityFilters,
    inserted: ingestResult.inserted ?? 0,
    upserted: ingestResult.upserted ?? 0,
    with_email: withEmail,
    partial,
    run_status: runStatus,
    errors: ingestResult.errors ?? [],
    notes,
  });
});
