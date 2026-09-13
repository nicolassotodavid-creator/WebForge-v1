// Hechos REALES de la ficha de Google Maps, compactos, para el brief y el build de la web.
//
// Por qué existe: a Lovable solo le llegaban nombre, dirección, teléfono, nota y reseñas. Se perdían el
// horario, las categorías (lo que Google dice que hace el negocio), la info adicional (pagos, cita
// previa, accesibilidad), el barrio y el enlace de Maps. Resultado: webs de "reseñas y poco más", con
// relleno inventado para tapar huecos ("llevamos años", "fácil acceso"…).
// Todo lo de aquí es PURO (sin red) y se prueba en facts.test.ts.

export interface FactsLeadInput {
  name: string;
  category?: string | null;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  rating?: number | null;
  review_count?: number | null;
  google_place_id?: string | null;
  facebook?: string | null;
}

export interface OpeningRow {
  dia: string;
  horario: string;
}

const DAY_ORDER = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const EN_DAYS: Record<string, string> = {
  monday: "lunes", tuesday: "martes", wednesday: "miércoles", thursday: "jueves",
  friday: "viernes", saturday: "sábado", sunday: "domingo",
};

type Meridiem = "AM" | "PM" | null;

// "9 AM" · "8:30 AM" · "12 PM" · "16:00" → minutos desde medianoche. Sin AM/PM propio hereda `inherit`.
function parseClock(s: string, inherit: Meridiem): { min: number; hadMeridiem: boolean } | null {
  const m = s.trim().match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?\s?m\.?|p\.?\s?m\.?)?$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const mi = m[2] ? Number(m[2]) : 0;
  if (h > 24 || mi > 59) return null;
  const own: Meridiem = m[3] ? (m[3].toLowerCase().startsWith("a") ? "AM" : "PM") : null;
  const mer = own ?? inherit;
  if (mer && h <= 12) {
    if (h === 12) h = mer === "AM" ? 0 : 12;
    else if (mer === "PM") h += 12;
  }
  return { min: h * 60 + mi, hadMeridiem: own !== null };
}

function clock(min: number): string {
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;
}

// "9 AM to 2 PM, 4 to 7 PM" → "9:00–14:00 y 16:00–19:00". Formato desconocido → el texto tal cual.
export function formatHoursText(text: string): string {
  const t = String(text ?? "").trim();
  if (!t) return t;
  if (/^(closed|cerrado)$/i.test(t)) return "Cerrado";
  if (/24\s*(hours|horas)/i.test(t)) return "Abierto 24 horas";
  const out: string[] = [];
  for (const part of t.split(/\s*,\s*/)) {
    const ends = part.split(/\s*(?:\bto\b|–|—|-)\s*/i);
    if (ends.length !== 2) return t;
    const endTxt = ends[1].trim();
    const endOwn: Meridiem = /p\.?\s?m\.?$/i.test(endTxt) ? "PM" : /a\.?\s?m\.?$/i.test(endTxt) ? "AM" : null;
    const end = parseClock(endTxt, null);
    let start = parseClock(ends[0], endOwn);
    if (!start || !end) return t;
    // "8 to 1 PM": heredar PM daría 20:00 > 13:00 → en realidad era por la mañana.
    if (!start.hadMeridiem && endOwn && start.min > end.min) {
      start = parseClock(ends[0], endOwn === "PM" ? "AM" : "PM") ?? start;
    }
    out.push(`${clock(start.min)}–${clock(end.min)}`);
  }
  return out.join(" y ");
}

// openingHours del actor ([{day, hours}]) → filas en español, de lunes a domingo, en formato 24 h.
export function formatOpeningHours(raw: unknown): OpeningRow[] | null {
  if (!Array.isArray(raw)) return null;
  const rows: OpeningRow[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const d = String(o.day ?? "").trim().toLowerCase();
    const h = String(o.hours ?? "").trim();
    if (!d || !h) continue;
    rows.push({ dia: EN_DAYS[d] ?? d, horario: formatHoursText(h) });
  }
  const rank = (d: string) => {
    const i = DAY_ORDER.indexOf(d);
    return i < 0 ? 99 : i;
  };
  rows.sort((a, b) => rank(a.dia) - rank(b.dia));
  return rows.length ? rows : null;
}

// Atributos sin valor para la web del cliente.
const NOISE = new Set(["sanitario", "sanitarios"]);

// additionalInfo del actor ({grupo: [{atributo: true}]}) → {grupo: [atributos a true]}, sin duplicados.
export function flattenAdditionalInfo(raw: unknown): Record<string, string[]> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Record<string, string[]> = {};
  for (const [group, items] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(items)) continue;
    const vals: string[] = [];
    for (const it of items) {
      if (!it || typeof it !== "object") continue;
      for (const [k, v] of Object.entries(it as Record<string, unknown>)) {
        if (v === true && !NOISE.has(k.toLowerCase()) && !vals.includes(k)) vals.push(k);
      }
    }
    if (vals.length) out[group] = vals;
  }
  return Object.keys(out).length ? out : null;
}

// Móvil español (6xx/7xx) en 9 dígitos, o null si es fijo o no se reconoce.
export function spanishMobile(phone?: string | null): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("0034")) d = d.slice(4);
  else if (d.startsWith("34") && d.length === 11) d = d.slice(2);
  return /^[67]\d{8}$/.test(d) ? d : null;
}

// Solo los móviles tienen WhatsApp de forma fiable: a un fijo no se le puede escribir.
export function whatsappUrl(phone?: string | null): string | null {
  const m = spanishMobile(phone);
  return m ? `https://wa.me/34${m}` : null;
}

export function phoneHref(phone?: string | null): string | null {
  if (!phone) return null;
  const d = phone.replace(/[^\d+]/g, "");
  return d.replace(/\D/g, "").length >= 9 ? `tel:${d}` : null;
}

export function googleMapsUrl(lead: FactsLeadInput, raw: Record<string, unknown>): string | null {
  const u = raw.url;
  if (typeof u === "string" && /^https:\/\/(www\.)?google\.[a-z.]+\/maps/i.test(u)) return u;
  const q = [lead.name, lead.address].filter(Boolean).join(", ");
  if (!q) return null;
  const pid = [lead.google_place_id, raw.placeId]
    .find((p): p is string => typeof p === "string" && p.startsWith("ChIJ"));
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}${pid ? `&query_place_id=${pid}` : ""}`;
}

const SOCIAL_RX = /^https?:\/\/(www\.|m\.)?(facebook\.com|instagram\.com|tiktok\.com|linktr\.ee)\//i;

export function socialLinks(lead: FactsLeadInput, raw: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const v of [lead.facebook, raw.website, raw.instagram]) {
    if (typeof v !== "string") continue;
    const s = v.trim().replace(/\?.*$/, "");
    if (SOCIAL_RX.test(s) && !out.includes(s)) out.push(s);
  }
  return out;
}

// Payload compacto de hechos reales. `reviews` ya viene extraído (extractReviews de llm.ts).
export function businessFacts(lead: FactsLeadInput, raw: unknown, reviews: unknown[]) {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const categories = Array.isArray(r.categories)
    ? (r.categories as unknown[]).filter((c): c is string => typeof c === "string" && c.trim() !== "")
    : [];
  return {
    name: lead.name,
    category: lead.category ?? str(r.categoryName),
    categories,
    city: lead.city ?? null,
    neighborhood: str(r.neighborhood),
    address: lead.address ?? null,
    phone: lead.phone ?? null,
    phone_href: phoneHref(lead.phone),
    whatsapp_url: whatsappUrl(lead.phone),
    google_maps_url: googleMapsUrl(lead, r),
    rating: lead.rating ?? null,
    review_count: lead.review_count ?? null,
    opening_hours: formatOpeningHours(r.openingHours),
    additional_info: flattenAdditionalInfo(r.additionalInfo),
    google_description: str(r.description),
    social_links: socialLinks(lead, r),
    reviews,
  };
}
