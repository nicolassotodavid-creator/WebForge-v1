// ingest-leads — Contrato: ARQUITECTURA_webforge_v2.md sec. 8
// Input: { leads: [...] } | array | { csv: "..." } | cuerpo text/csv.
// Hace: autoriza (INGEST_WEBHOOK_SECRET o sesión de operador), normaliza, deduplica por
// google_place_id (upsert SIN pisar el status existente), inserta el resto, status='new' por defecto.
// Usa SUPABASE_SERVICE_ROLE_KEY (inyectada por Supabase en el runtime de Edge Functions).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type RawLead = Record<string, unknown>;

// ---------- helpers de normalización ----------
function s(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const str = String(v).trim();
  return str.length ? str : null;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  let str = String(v).trim();
  // Soporta decimales con coma (ej. "4,7")
  if (str.includes(",") && !str.includes(".")) str = str.replace(",", ".");
  const n = Number(str);
  return Number.isFinite(n) ? n : null;
}

function intNum(v: unknown): number | null {
  const n = num(v);
  return n === null ? null : Math.round(n);
}

function pick(o: RawLead, keys: string[]): unknown {
  for (const k of keys) {
    if (o[k] !== undefined && o[k] !== null && o[k] !== "") return o[k];
  }
  return undefined;
}

// Descarta correos basura típicos del HTML (assets, ejemplos, trackers).
const EMAIL_RX = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
function isJunkEmail(e: string): boolean {
  const x = e.toLowerCase();
  return (
    /\.(png|jpe?g|gif|webp|svg|css|js)$/.test(x) ||
    /(example|sentry|wixpress|\.wix|godaddy|placeholder|yourdomain|email@|user@|name@)/.test(x)
  );
}
function pickEmail(v: unknown): string | null {
  if (typeof v === "string") {
    const m = v.match(EMAIL_RX);
    if (m && !isJunkEmail(m[0])) return m[0].toLowerCase();
    return null;
  }
  if (Array.isArray(v)) {
    for (const item of v) {
      const e = pickEmail(item);
      if (e) return e;
    }
  } else if (v && typeof v === "object") {
    for (const val of Object.values(v as Record<string, unknown>)) {
      const e = pickEmail(val);
      if (e) return e;
    }
  }
  return null;
}

function firstEmail(o: RawLead): string | null {
  const direct = s(pick(o, ["email", "Email", "correo"]));
  if (direct && !isJunkEmail(direct)) return direct.toLowerCase();
  // Con scrapeContacts=true, el actor (compass~crawler-google-places) devuelve los contactos
  // enriquecidos en el array de nivel superior `emails` (crawleando la `website` de la ficha).
  // OJO: solo trae email si esa web tiene uno visible Y la web es la real del negocio — si en
  // Maps figura su Instagram, no saca nada (eso lo resuelve backfill-emails.ts descubriendo la
  // web real). `leadsEnrichment` va SIEMPRE vacío en este build: se mantiene como fallback
  // defensivo por si un build futuro lo repuebla, pero hoy no aporta.
  const emails = o["emails"] ?? o["email_1"];
  const fromList = pickEmail(emails);
  if (fromList) return fromList;
  return pickEmail(o["leadsEnrichment"]);
}

function deriveHasWebsite(o: RawLead): boolean {
  const ws = s(pick(o, ["website", "site", "web", "url", "domain"]));
  if (!ws) return false;
  // Ignorar enlaces a Google/Maps que no son una web propia
  if (/google\.|maps\.|facebook\.|instagram\./i.test(ws)) return false;
  return true;
}

// Guard geográfico: el actor a veces devuelve negocios de otros países (p.ej. "Valencia
// Automotive" en Nuevo México con la búsqueda vieja "talleres valencia"). Si el resultado trae
// countryCode/country y NO es España, lo descartamos. Sin ese dato (CSV/manual) no filtramos,
// para no perder importaciones legítimas.
const NON_ES_NAME = /\b(usa|united states|estados unidos|mexico|méxico|france|francia|portugal|italia|italy|deutschland|germany|reino unido|united kingdom)\b/i;
function inSpain(o: RawLead): boolean {
  const cc = s(pick(o, ["countryCode", "country_code"]));
  if (cc) {
    const v = cc.trim().toUpperCase();
    if (v !== "ES" && v !== "ESP" && v !== "ESPAÑA" && v !== "SPAIN") return false;
  }
  const country = s(pick(o, ["country"]));
  if (country && NON_ES_NAME.test(country)) return false;
  return true;
}

// Primer string que casa `rx` dentro de un valor anidado (string/array/objeto).
function findMatch(v: unknown, rx: RegExp): string | null {
  if (typeof v === "string") {
    const m = v.match(rx);
    return m ? m[0] : null;
  }
  if (Array.isArray(v)) {
    for (const item of v) {
      const r = findMatch(item, rx);
      if (r) return r;
    }
  } else if (v && typeof v === "object") {
    for (const val of Object.values(v as Record<string, unknown>)) {
      const r = findMatch(val, rx);
      if (r) return r;
    }
  }
  return null;
}

const FB_RX = /https?:\/\/(?:www\.|m\.)?facebook\.com\/[A-Za-z0-9._%\-/?=&]+/i;
// Botones de compartir / pixel: NO son la página del negocio.
const FB_BAD = /facebook\.com\/(sharer|dialog|plugins|tr(\b|\/)|sharer\.php)/i;
function firstFacebook(o: RawLead): string | null {
  const direct = s(pick(o, ["facebook", "facebookUrl", "facebook_url"]));
  if (direct && FB_RX.test(direct) && !FB_BAD.test(direct)) return direct;
  // Apify mete las redes en leadsEnrichment.facebooks[] (o similar)
  for (const key of ["facebooks", "leadsEnrichment"]) {
    const found = findMatch(o[key], FB_RX);
    if (found && !FB_BAD.test(found)) return found;
  }
  // A veces el "website" del negocio ES su Facebook
  const ws = s(pick(o, ["website", "url", "site", "web"]));
  if (ws && FB_RX.test(ws) && !FB_BAD.test(ws)) return ws;
  return null;
}

// Solo WhatsApp EXPLÍCITO (wa.me / api.whatsapp.com / campo whatsapp). La derivación
// "móvil español = WhatsApp" se hace en el frontend, no se persiste como dato asumido.
const WA_RX = /(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=)\+?\d[\d ]{6,}/i;
function firstWhatsapp(o: RawLead): string | null {
  const direct = s(pick(o, ["whatsapp", "whatsApp", "whatsapp_number"]));
  if (direct) {
    const d = direct.replace(/\D/g, "");
    if (d.length >= 7) return d;
  }
  for (const key of ["leadsEnrichment", "website", "url"]) {
    const found = findMatch(o[key], WA_RX);
    if (found) {
      const d = found.replace(/\D/g, "");
      if (d.length >= 7) return d;
    }
  }
  return null;
}

function normalizeLead(o: RawLead, defaultSource: string) {
  return {
    name: s(pick(o, ["name", "title", "businessName", "business_name", "nombre"])),
    category: s(pick(o, ["category", "categoryName", "type", "categories", "categoria"])),
    phone: s(
      pick(o, [
        "phone",
        "phoneNumber",
        "phone_number",
        "internationalPhoneNumber",
        "telefono",
      ]),
    ),
    whatsapp: firstWhatsapp(o),
    facebook: firstFacebook(o),
    email: firstEmail(o),
    address: s(pick(o, ["address", "formattedAddress", "street", "direccion"])),
    city: s(pick(o, ["city", "town", "locality", "ciudad"])),
    country: s(pick(o, ["country", "countryCode"])) ?? "ES",
    google_place_id: s(
      pick(o, ["google_place_id", "placeId", "place_id", "placeID", "cid"]),
    ),
    rating: num(pick(o, ["rating", "totalScore", "stars", "score"])),
    review_count: intNum(
      pick(o, [
        "review_count",
        "reviewsCount",
        "reviewCount",
        "userRatingsTotal",
        "user_ratings_total",
      ]),
    ),
    has_website: deriveHasWebsite(o),
    raw_json: o,
    source: s(pick(o, ["source"])) ?? defaultSource,
    updated_at: new Date().toISOString(),
  };
}

// ---------- parser CSV minimalista ----------
function parseCsv(text: string): RawLead[] {
  const rows = csvRows(text);
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  const out: RawLead[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 1 && row[0].trim() === "") continue;
    const obj: RawLead = {};
    header.forEach((key, idx) => {
      obj[key] = (row[idx] ?? "").trim();
    });
    out.push(obj);
  }
  return out;
}

function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  const str = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (inQuotes) {
      if (c === '"') {
        if (str[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  row.push(field);
  rows.push(row);
  return rows;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Método no permitido" }, 405);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return jsonResponse(
      { error: "Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el entorno." },
      500,
    );
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // --- Autorización: secret del webhook O sesión de operador ---
  let authorized = false;
  const secret = Deno.env.get("INGEST_WEBHOOK_SECRET");
  const providedSecret = req.headers.get("x-ingest-secret");
  if (secret && providedSecret && providedSecret === secret) {
    authorized = true;
  }
  if (!authorized) {
    const token = (req.headers.get("Authorization") ?? "")
      .replace(/^Bearer\s+/i, "")
      .trim();
    if (token) {
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data?.user) authorized = true;
    }
  }
  if (!authorized) {
    return jsonResponse({ error: "No autorizado" }, 401);
  }

  // --- Parsear cuerpo ---
  let rawLeads: RawLead[] = [];
  let defaultSource = "manual";
  const contentType = req.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("text/csv")) {
      rawLeads = parseCsv(await req.text());
      defaultSource = "import-csv";
    } else {
      const body = await req.json();
      if (Array.isArray(body)) {
        rawLeads = body;
      } else if (body && Array.isArray(body.leads)) {
        rawLeads = body.leads;
        if (typeof body.source === "string") defaultSource = body.source;
      } else if (body && typeof body.csv === "string") {
        rawLeads = parseCsv(body.csv);
        defaultSource = "import-csv";
      } else {
        return jsonResponse(
          { error: 'Formato no válido. Usa { "leads": [...] }, un array, o { "csv": "..." }.' },
          400,
        );
      }
    }
  } catch (_e) {
    return jsonResponse({ error: "Cuerpo no válido (JSON o CSV mal formado)." }, 400);
  }

  // --- Filtro geográfico (descartar fuera de España) ---
  const inEs = rawLeads.filter(inSpain);
  const skippedOutsideEs = rawLeads.length - inEs.length;

  // --- Normalizar (descartar sin nombre) ---
  const normalized = inEs
    .map((o) => normalizeLead(o, defaultSource))
    .filter((l) => l.name);

  const withPid = normalized.filter((l) => l.google_place_id);
  const withoutPid = normalized.filter((l) => !l.google_place_id);

  const errors: string[] = [];
  let upserted = 0;
  let inserted = 0;

  // Dedup por google_place_id. No incluimos `status`: las filas nuevas usan el default 'new'
  // y las existentes conservan su estado (no se pisa el pipeline).
  if (withPid.length) {
    const map = new Map<string, (typeof withPid)[number]>();
    for (const l of withPid) map.set(l.google_place_id as string, l);
    const { data, error } = await supabase
      .from("leads")
      .upsert([...map.values()], { onConflict: "google_place_id" })
      .select("id");
    if (error) errors.push(`place_id: ${error.message}`);
    else upserted = data?.length ?? 0;
  }

  if (withoutPid.length) {
    const { data, error } = await supabase
      .from("leads")
      .insert(withoutPid)
      .select("id");
    if (error) errors.push(`sin place_id: ${error.message}`);
    else inserted = data?.length ?? 0;
  }

  return jsonResponse({
    received: rawLeads.length,
    normalized: normalized.length,
    inserted,
    upserted,
    skipped_no_name: inEs.length - normalized.length,
    skipped_outside_es: skippedOutsideEs,
    errors,
  });
});
