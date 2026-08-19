/**
 * Sectores (familias) del lead.
 *
 * La `category` que trae el scrape es la de Google Maps: muy granular y con
 * sinónimos ("Reformas", "Empresa constructora", "Contratista general" son el
 * mismo negocio para nosotros). Para filtrar por SECTOR se agrupan esas
 * categorías en unas pocas familias con reglas por palabra clave.
 *
 * El orden de REGLAS importa: gana la primera que casa. Por eso "Estética" va
 * antes que "Salud" (una "clínica estética" es estética, no dental) y
 * "Energía" antes que "Reformas" ("contratista de aire acondicionado" es
 * instalador, no albañil).
 */

export const SIN_SECTOR = "Sin sector";
export const OTROS = "Otros";

/** Minúsculas y sin acentos (ñ→n incluida) para que las reglas casen siempre. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ñ/g, "n");
}

const RULES: { family: string; kw: RegExp }[] = [
  {
    family: "Estética y belleza",
    kw: /estetic|esteticista|belleza|peluqu|barber|manicur|\bunas\b|\bspa\b|depilac|masaj|cirujano plastico|medicina estetica/,
  },
  {
    family: "Salud y dental",
    kw: /dental|dentista|ortodon|clinic|medic|doctor|farmacia|fisio|podolog|optic|veterinar|cirujano|psicolog|hospital|salud/,
  },
  {
    family: "Automoción",
    kw: /taller|automovil|coche|\bmoto|neumatic|chapa y pintura|bicicleta|vehiculo|desguace|grua/,
  },
  {
    family: "Energía e instalaciones",
    kw: /solar|fotovoltaic|energia|energetic|climatiz|aire acondicionado|calefaccion|caldera|fontaner|\bgas\b|electricist|electricidad|instalador|placas|aerotermia|bomba de calor/,
  },
  {
    family: "Reformas y construcción",
    kw: /reforma|constru|contratista|albanil|\bobra|arquitect|interior|pintor|carpinter|cocina|bano|aislamiento|impermeabiliz|tejado|fachada|restauracion de edificios|trabajos en altura|piscina|jardin|cerrajer|escayol|marmol|suelo/,
  },
  {
    family: "Comercio y tiendas",
    kw: /tienda|comercio|mueble|boutique|panaderi|pasteleri|chocolater|fabricante|distribuidor|mayorista|supermercado|floristeri|joyeri/,
  },
  {
    family: "Formación y servicios",
    kw: /formacion|educativ|academia|escuela|colegio|abogad|asesor|gestori|consultor|inmobiliar|seguro|contable|notari/,
  },
  {
    family: "Hostelería",
    kw: /restaurante|bar\b|cafeteri|hotel|hostal|catering|pizzeri|cerveceri/,
  },
];

/**
 * Familia de sector de una categoría de Google Maps.
 * Sin categoría → "Sin sector". Sin regla que case → "Otros".
 */
export function sectorFamily(category: string | null | undefined): string {
  const raw = (category ?? "").trim();
  if (!raw) return SIN_SECTOR;
  const n = normalize(raw);
  for (const r of RULES) if (r.kw.test(n)) return r.family;
  return OTROS;
}

/** Todas las familias posibles, en el orden de las reglas (para listados estables). */
export const SECTOR_FAMILIES: string[] = [
  ...RULES.map((r) => r.family),
  OTROS,
  SIN_SECTOR,
];
