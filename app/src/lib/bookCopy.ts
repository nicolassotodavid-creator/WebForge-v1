// Textos derivados para la landing pública /book: los datos vienen de Google Maps y hay que
// "traducirlos" a español natural antes de enseñárselos al prospecto.

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Reglas por palabras clave (el orden importa: "contratista de aire acondicionado" es
// climatización, no reformas; "taller de chapa" es taller). Devuelve el sustantivo sin "tu".
const CATEGORY_RULES: Array<[RegExp, string]> = [
  [/aire acondicionado|climatiz|calefacc|aerotermia|refrigeracion/, "empresa de climatización"],
  [/solar|fotovoltai|placas|renovable|energia/, "empresa de energía solar"],
  [/concesionario/, "concesionario"],
  [/taller|mecanic|automovil|coche|vehicul|neumatic|chapa|carrocer|moto/, "taller"],
  [/fontaner/, "empresa de fontanería"],
  [/electricist|instalaciones electricas/, "empresa de instalaciones eléctricas"],
  [/cerrajer/, "cerrajería"],
  [/carpinter/, "carpintería"],
  [/limpieza/, "empresa de limpieza"],
  [/reforma|construc|contratista|albanil|interiorismo|cocinas|\bbanos\b|pintor|\bobras?\b/, "empresa de reformas"],
  [/clinica|dental|dentist|odontolog|estetic|fisioterap|medic|podolog|veterinari|psicolog/, "clínica"],
  [/farmacia/, "farmacia"],
  [/optica/, "óptica"],
  [/peluquer|barberia|salon de belleza/, "peluquería"],
  [/restaurante|bar\b|cafeteria|pizzeria|asador/, "restaurante"],
  [/gimnasio|fitness|crossfit/, "gimnasio"],
  [/inmobiliaria/, "inmobiliaria"],
  [/abogad|asesoria|gestoria/, "despacho"],
  [/tienda/, "tienda"],
];

/** Categoría de Google Maps → sustantivo natural ("taller", "empresa de reformas"…). Sin "tu". */
export function categoryNoun(category: string | null | undefined): string {
  if (!category) return "negocio";
  const c = normalize(category);
  for (const [re, noun] of CATEGORY_RULES) if (re.test(c)) return noun;
  return "negocio";
}

/** Categoría → frase con posesivo: "tu taller", "tu clínica", "tu negocio" por defecto. */
export function categoryPhrase(category: string | null | undefined): string {
  return `tu ${categoryNoun(category)}`;
}

/**
 * Nombre del negocio sin el relleno de Google Maps:
 * "Construcciones United | Reformas | Valencia" → "Construcciones United";
 * "Auto Service Valencia- Servicio de automóviles premium 🇪🇸🇬🇧" → "Auto Service Valencia";
 * "Talleres Gabaldon S.L." → "Talleres Gabaldon".
 */
export function cleanBusinessName(raw: string | null | undefined): string {
  const original = (raw ?? "").trim();
  if (!original) return "";
  let s = original
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[\u{1F1E6}-\u{1F1FF}️‍]/gu, "");
  // Cortar en separadores de relleno (sin romper "Coca-Cola").
  s = s.split(/\s\|\s|\|\s|\s\||\s[-–—]\s|[-–—]\s|\s·\s|·/)[0] ?? s;
  // Sufijos societarios al final (con o sin puntos).
  s = s
    .replace(/[\s,]+S\.\s?L\.?\s?U?\.?$/i, "")
    .replace(/[\s,]+S\.\s?A\.?\s?U?\.?$/i, "")
    .replace(/[\s,]+(SLU|SL|SAU|SA|SLL|SCP|CB)$/, "");
  s = s.replace(/\s{2,}/g, " ").replace(/[\s,.;:–—-]+$/, "").trim();
  return s || original;
}

/** Dominio orientativo para el mini-navegador: sin cortar a mitad de palabra. */
export function domainHintFrom(name: string, maxLen = 22): string {
  const words = normalize(name)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  let slug = words.join("");
  while (slug.length > maxLen && words.length > 1) {
    words.pop();
    slug = words.join("");
  }
  return `${slug || "tunegocio"}.es`;
}
