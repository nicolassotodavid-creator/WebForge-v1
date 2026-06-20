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

  // scrapeContacts (Email visible) visita la web de cada negocio para sacar el email:
  // es ~3-5x más lento. Para no agotar el límite de ~150s de la Edge Function, bajamos
  // el tope de resultados en esa ruta. Sin email, el tope normal (hasta 60) se mantiene.
  if (requireEmail) max = Math.min(max, 10);

  // --- Llamada a Apify (síncrona) ---
  const apifyUrl =
    `https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=120`;

  let items: Record<string, unknown>[] = [];
  try {
    const res = await fetch(apifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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
        // El email NO viene en los datos de Google Maps: hay que visitar la web del
        // negocio. scrapeContacts lo activa, pero es más lento y caro, así que solo lo
        // encendemos cuando el operador pide "Email visible". Sin web propia → sin email.
        scrapeContacts: requireEmail,
      }),
      // Edge Functions tienen un límite de 150s; Apify tiene timeout=120 por encima.
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return jsonResponse({ error: `Apify devolvió ${res.status}: ${txt.slice(0, 300)}` }, 502);
    }
    items = await res.json();
    if (!Array.isArray(items)) {
      return jsonResponse({ error: "Apify no devolvió un array.", raw: String(items).slice(0, 200) }, 502);
    }
  } catch (e) {
    return jsonResponse(
      { error: `No se pudo contactar con Apify: ${e instanceof Error ? e.message : "error"}` },
      502,
    );
  }

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
    return jsonResponse({ found, without_website: 0, inserted: 0, upserted: 0, with_email: 0, errors: [] });
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

  return jsonResponse({
    found,
    without_website: withoutWebsite,
    after_filters: afterQualityFilters,
    inserted: ingestResult.inserted ?? 0,
    upserted: ingestResult.upserted ?? 0,
    with_email: withEmail,
    errors: ingestResult.errors ?? [],
  });
});
