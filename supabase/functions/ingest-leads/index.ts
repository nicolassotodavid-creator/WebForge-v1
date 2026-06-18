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

function firstEmail(o: RawLead): string | null {
  const direct = s(pick(o, ["email", "Email", "correo"]));
  if (direct) return direct;
  const emails = o["emails"] ?? o["email_1"];
  if (Array.isArray(emails) && emails.length) return s(emails[0]);
  return null;
}

function deriveHasWebsite(o: RawLead): boolean {
  const ws = s(pick(o, ["website", "site", "web", "url", "domain"]));
  if (!ws) return false;
  // Ignorar enlaces a Google/Maps que no son una web propia
  if (/google\.|maps\.|facebook\.|instagram\./i.test(ws)) return false;
  return true;
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
    whatsapp: s(pick(o, ["whatsapp", "whatsApp", "whatsapp_number"])),
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

  // --- Normalizar (descartar sin nombre) ---
  const normalized = rawLeads
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
    skipped_no_name: rawLeads.length - normalized.length,
    errors,
  });
});
