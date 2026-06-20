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
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  let authorized = false;
  if (token) {
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data?.user) authorized = true;
  }
  if (!authorized) return jsonResponse({ error: "No autorizado" }, 401);

  // --- Input ---
  let query: string, city: string;
  let max = 20;
  let language = "es";
  let maxReviews = 5;
  let onlyWithoutWebsite = true;
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
    if (body?.maxReviews !== undefined) maxReviews = Number(body.maxReviews) || 5;
    if (body?.onlyWithoutWebsite !== undefined) onlyWithoutWebsite = Boolean(body.onlyWithoutWebsite);
    if (body?.minRating !== undefined) minRating = Number(body.minRating) || 0;
    if (body?.categoryKeyword) categoryKeyword = String(body.categoryKeyword).trim().toLowerCase();
    if (body?.requirePhone !== undefined) requirePhone = Boolean(body.requirePhone);
    if (body?.requireEmail !== undefined) requireEmail = Boolean(body.requireEmail);
    if (body?.countryCode) countryCode = String(body.countryCode).trim().toLowerCase();
  } catch (_e) {
    return jsonResponse({ error: "Cuerpo no válido." }, 400);
  }

  // scrapeContacts hace que el actor visite la web/redes de CADA ficha para sacar el email.
  // Es lo que ralentiza el run (3-5x) y provoca los TIMED-OUT que recortan la profundidad.
  //
  // La clave: si buscas "Solo sin web", el email NO es la prioridad. Esos negocios (los
  // prospectos reales del producto) son pequeños y caen ABAJO en Maps, que ordena por
  // prominencia; lo que necesitas es PROFUNDIDAD (max alto) para llegar a ellos antes de que
  // el run se corte. Y para saber si un negocio TIENE web NO hace falta scrapeContacts: el
  // campo `website` viene en la ficha de Maps igual. Así que en este modo lo apagamos: el run
  // es rápido, cabe un tope mayor sin timeout, y el email de esos leads lo rellena después el
  // Orquestador (backfill-emails.ts) descubriendo su web/redes reales. No se pierde nada.
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
  const ACTOR = "compass~crawler-google-places";
  const RUN_TIMEOUT = 100;        // s — Apify aborta el actor aquí; deja headroom para leer el dataset bajo el límite ~150s de la Edge Function.
  const WALL_BUDGET_MS = 110_000; // tope de espera total antes de rescatar parciales.
  const TERMINAL = new Set(["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"]);

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
  };

  let items: Record<string, unknown>[] = [];
  let runStatus = "RUNNING";
  try {
    // 1. Lanzar el run (asíncrono). `timeout` aborta el actor; no esperamos a que acabe aquí.
    const startRes = await fetch(
      `https://api.apify.com/v2/acts/${ACTOR}/runs?token=${APIFY_TOKEN}&timeout=${RUN_TIMEOUT}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(runInput),
      },
    );
    if (!startRes.ok) {
      const txt = await startRes.text().catch(() => "");
      return jsonResponse({ error: `Apify no aceptó el run (${startRes.status}): ${txt.slice(0, 300)}` }, 502);
    }
    const startJson = await startRes.json();
    const runId = String(startJson?.data?.id ?? "");
    const datasetId = String(startJson?.data?.defaultDatasetId ?? "");
    runStatus = String(startJson?.data?.status ?? "RUNNING");
    if (!runId || !datasetId) {
      return jsonResponse({ error: "Apify no devolvió runId/datasetId." }, 502);
    }

    // 2. Esperar a estado terminal. `waitForFinish` bloquea hasta 20s por llamada; el actor
    //    se aborta solo a los RUN_TIMEOUT s, así que el bucle converge sin colgarse.
    const startedAt = Date.now();
    while (!TERMINAL.has(runStatus) && (Date.now() - startedAt) < WALL_BUDGET_MS) {
      const pollRes = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}&waitForFinish=20`,
      );
      if (!pollRes.ok) break; // si falla el poll, salimos y rescatamos lo que haya en el dataset.
      const pollJson = await pollRes.json().catch(() => null);
      runStatus = String(pollJson?.data?.status ?? runStatus);
    }

    // 3. Leer el dataset SIEMPRE: incluye los parciales aunque el run acabara TIMED-OUT.
    const itemsRes = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&format=json`,
    );
    if (!itemsRes.ok) {
      const txt = await itemsRes.text().catch(() => "");
      return jsonResponse({ error: `Apify devolvió ${itemsRes.status} al leer el dataset: ${txt.slice(0, 300)}` }, 502);
    }
    items = await itemsRes.json();
    if (!Array.isArray(items)) {
      return jsonResponse({ error: "Apify no devolvió un array.", raw: String(items).slice(0, 200) }, 502);
    }
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

  // --- Filtro "sin web" ---
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
      body: JSON.stringify({ leads: filtered, source: "apify" }),
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
