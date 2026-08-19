// Test de un solo uso (no hay framework): se ejecuta con
//   node --experimental-strip-types src/lib/sectors.test.ts
// Comprueba que las categorías REALES que hay hoy en la base (las de Google
// Maps) caen en la familia de sector correcta. Los casos con trampa son los
// que mezclan palabras de dos familias: "Contratista de aire acondicionado"
// (instalador, no albañil) y "Cirujano plástico" (estética, no dental).
import { sectorFamily } from "./sectors.ts";

let failures = 0;
function assertEq(actual: unknown, expected: unknown, msg: string) {
  const ok = actual === expected;
  console.log(`${ok ? "✓" : "✗"} ${msg}  (got ${actual}, want ${expected})`);
  if (!ok) failures++;
}

const CASES: [string | null, string][] = [
  // Reformas y construcción
  ["Reformas", "Reformas y construcción"],
  ["Empresa constructora", "Reformas y construcción"],
  ["Contratista general", "Reformas y construcción"],
  ["Constructor", "Reformas y construcción"],
  ["Reformas de baños", "Reformas y construcción"],
  ["Reformas de cocinas", "Reformas y construcción"],
  ["Estudio de arquitectura", "Reformas y construcción"],
  ["Contratista de albañilería", "Reformas y construcción"],
  ["Interiorista", "Reformas y construcción"],
  ["Pintor", "Reformas y construcción"],
  ["Trabajos en altura", "Reformas y construcción"],
  ["Servicio de restauración de edificios", "Reformas y construcción"],
  ["Empresa de aislamientos", "Reformas y construcción"],
  // Energía e instalaciones
  ["Proveedor de equipos de energía solar", "Energía e instalaciones"],
  ["Planta de energía solar fotovoltaica", "Energía e instalaciones"],
  ["Companyia d'energia solar", "Energía e instalaciones"],
  ["Empresa de climatización", "Energía e instalaciones"],
  ["Contratista de aire acondicionado", "Energía e instalaciones"],
  ["Empresa de calefacción", "Energía e instalaciones"],
  ["Tienda de calderas", "Energía e instalaciones"],
  ["Electricista", "Energía e instalaciones"],
  ["Fontanero", "Energía e instalaciones"],
  ["Instalador de gas", "Energía e instalaciones"],
  // Salud y dental
  ["Clínica dental", "Salud y dental"],
  ["Dentista", "Salud y dental"],
  ["Servicio de urgencias dentales", "Salud y dental"],
  ["Centro médico", "Salud y dental"],
  ["Médico", "Salud y dental"],
  ["Clínica ambulatoria", "Salud y dental"],
  ["Farmacia", "Salud y dental"],
  // Estética (gana a salud: una clínica estética no es dental)
  ["Centro de estética", "Estética y belleza"],
  ["Esteticista", "Estética y belleza"],
  ["Cirujano plástico", "Estética y belleza"],
  ["Clínica de medicina estética", "Estética y belleza"],
  // Automoción
  ["Taller mecánico", "Automoción"],
  ["Taller de reparación de automóviles", "Automoción"],
  ["Taller de reparación de motos", "Automoción"],
  ["Taller de chapa y pintura", "Automoción"],
  ["Taller de bicicletas", "Automoción"],
  // Comercio
  ["Tienda de muebles", "Comercio y tiendas"],
  ["Comercio", "Comercio y tiendas"],
  ["Chocolatería", "Comercio y tiendas"],
  // Formación y servicios
  ["Centro de formación profesional", "Formación y servicios"],
  ["Institución educativa", "Formación y servicios"],
  ["Formación y manuales para policías", "Formación y servicios"],
  // Sin regla / sin dato
  ["Estudi d'art", "Otros"],
  ["Test", "Otros"],
  [null, "Sin sector"],
  ["", "Sin sector"],
  ["   ", "Sin sector"],
];

for (const [cat, want] of CASES) {
  assertEq(sectorFamily(cat), want, `sectorFamily(${JSON.stringify(cat)})`);
}

console.log(failures === 0 ? "\nTODO OK" : `\n${failures} FALLO(S)`);
process.exit(failures === 0 ? 0 : 1);
