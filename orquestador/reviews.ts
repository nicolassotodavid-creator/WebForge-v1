// reviews.ts — "Pasada 2" del scrape: trae las RESEÑAS de UN solo negocio ya aprobado, justo al
// construir su web. En prospección (supabase/functions/run-scrape) NO se scrapean reseñas: el actor
// de Google Maps cobra POR RESEÑA (el parámetro `maxReviews` está marcado "($)" en su esquema), así
// que pagar 12-15 reseñas de CADA prospecto —cuando solo construimos web para los aprobados— es
// tirar dinero. Aquí las pedimos únicamente para el placeId del lead que SÍ se va a construir.
// `reviewsCount` (el total) ya venía del scrape original; lo que faltaba eran los TEXTOS del carrusel.

const APIFY_ACTOR = "compass~crawler-google-places";
const APIFY_SYNC = `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items`;

function apifyToken(): string {
  const t = process.env.APIFY_TOKEN ?? process.env.APIFY_TOKEN_2;
  if (!t) throw new Error("Falta APIFY_TOKEN en el .env del Orquestador (raíz).");
  return t;
}

// El placeId canónico de Google ("ChIJ…"). Lo trae el scrape de compass en raw_json.placeId; como
// respaldo, la columna google_place_id si quedó con ese formato (NO el cid numérico, que no sirve
// para apuntar la ficha con `placeIds`).
export function placeIdFromLead(
  lead: { raw_json?: unknown; google_place_id?: string | null },
): string | null {
  const raw = (lead.raw_json ?? {}) as Record<string, unknown>;
  const fromRaw = raw["placeId"];
  if (typeof fromRaw === "string" && /^ChIJ/i.test(fromRaw)) return fromRaw;
  const col = lead.google_place_id;
  if (typeof col === "string" && /^ChIJ/i.test(col)) return col;
  return null;
}

// Lanza el actor SOLO para ese placeId y devuelve el array crudo de reseñas (formato compass), tal
// cual lo espera extractReviews() de llm.ts. Usa run-sync porque es un único lugar (rápido) y el
// Orquestador, al contrario que una Edge Function, no tiene límite de tiempo. Si Apify falla (p.ej.
// 402 por saldo agotado), lanza: el caller en run.ts lo captura y construye la web sin carrusel en
// vez de tumbar todo el build.
export async function fetchReviewsForPlace(
  placeId: string,
  opts: { maxReviews?: number; language?: string } = {},
): Promise<Record<string, unknown>[]> {
  const maxReviews = opts.maxReviews ?? 15;
  const language = opts.language ?? "es";
  const input = {
    placeIds: [placeId],
    maxReviews,
    reviewsSort: "newest",
    scrapeReviewsPersonalData: false,
    language,
    // Sin extras (contactos, imágenes…): solo las reseñas de esta ficha, lo más barato posible.
    maxCrawledPlacesPerSearch: 1,
  };
  const res = await fetch(`${APIFY_SYNC}?token=${apifyToken()}&timeout=120`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Apify devolvió ${res.status} al traer reseñas: ${txt.slice(0, 200)}`);
  }
  const items = (await res.json()) as unknown;
  if (!Array.isArray(items) || items.length === 0) return [];
  const reviews = (items[0] as Record<string, unknown> | undefined)?.["reviews"];
  return Array.isArray(reviews) ? (reviews as Record<string, unknown>[]) : [];
}

// Pasada 2 de FOTOS: la prospección corre con scrapePlaceDetailPage:false (barato) y ahí no hay
// galería. Aquí, solo para el lead APROBADO, pagamos el detalle de UNA ficha para traer sus fotos.
// maxReviews:0 → no re-pagamos reseñas (ya vienen por su propia pasada 2).
export async function fetchPhotosForPlace(
  placeId: string,
  opts: { maxImages?: number } = {},
): Promise<string[]> {
  const maxImages = opts.maxImages ?? 15;
  const input = {
    placeIds: [placeId],
    maxReviews: 0,
    maxImages,
    scrapePlaceDetailPage: true,
    maxCrawledPlacesPerSearch: 1,
    language: "es",
  };
  const res = await fetch(`${APIFY_SYNC}?token=${apifyToken()}&timeout=120`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Apify devolvió ${res.status} al traer fotos: ${txt.slice(0, 200)}`);
  }
  const items = (await res.json()) as unknown;
  if (!Array.isArray(items) || items.length === 0) return [];
  const item = items[0] as Record<string, unknown>;
  const urls: string[] = [];
  const seen = new Set<string>();
  const add = (v: unknown) => {
    let u: string | null = null;
    if (typeof v === "string" && /^https?:\/\//i.test(v)) u = v;
    else if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      const c = o.imageUrl ?? o.url;
      if (typeof c === "string" && /^https?:\/\//i.test(c)) u = c;
    }
    if (u && !seen.has(u)) { seen.add(u); urls.push(u); }
  };
  add(item.imageUrl);
  if (Array.isArray(item.imageUrls)) for (const x of item.imageUrls) add(x);
  return urls;
}
