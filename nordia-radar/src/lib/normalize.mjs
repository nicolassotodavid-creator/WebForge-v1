import { domainOf, plain } from './util.mjs';

// Clave de deduplicado: dominio de la web; si no hay web, nombre normalizado + ciudad.
export function keyOf(firm) {
  const d = domainOf(firm.web);
  if (d) return d;
  const name = plain(firm.nombre)
    .replace(/\b(abogados?|advocats?|bufete|despacho|asociados|associats|slp|sl|s\.l\.p?\.?)\b/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${name}@${plain(firm.ciudad)}`;
}

const signalKey = (s) => [s.tipo, s.subtipo, (s.url || '').replace(/[#?].*$/, ''), plain(s.descripcion).slice(0, 60)].join('|');

const preferAbogados = (a, b) => {
  if (!a?.n) return b;
  if (!b?.n) return a;
  if (a.tipo === 'confirmado' && b.tipo !== 'confirmado') return a;
  if (b.tipo === 'confirmado' && a.tipo !== 'confirmado') return b;
  return a;
};

function mergeTwo(a, b) {
  const senales = [...(a.senales || [])];
  const seen = new Set(senales.map(signalKey));
  for (const s of b.senales || []) if (!seen.has(signalKey(s))) { senales.push(s); seen.add(signalKey(s)); }
  const longer = (x, y) => ((y || '').length > (x || '').length ? y : x);
  return {
    ...a,
    web: a.web || b.web,
    especialidades: [...new Set([...(a.especialidades || []), ...(b.especialidades || [])])],
    abogados: preferAbogados(a.abogados, b.abogados),
    decisor: a.decisor?.nombre ? a.decisor : b.decisor,
    contacto: { ...(b.contacto || {}), ...Object.fromEntries(Object.entries(a.contacto || {}).filter(([, v]) => v)) },
    senales,
    necesidad_nordia: longer(a.necesidad_nordia, b.necesidad_nordia),
    faltan: [a.faltan, b.faltan].filter(Boolean).join(' / ') || null,
    descartado: Boolean(a.descartado && b.descartado),
    motivo_descarte: a.descartado && b.descartado ? a.motivo_descarte || b.motivo_descarte : null,
    origen: [...new Set([...(a.origen || []), ...(b.origen || [])])],
  };
}

// Une los hallazgos de todas las fuentes por clave. Un despacho que una fuente descarta y otra no,
// se queda (descartado solo si todas las fuentes lo descartan) y lleva la nota del descarte en `avisos`.
export function dedupe(firms) {
  const byKey = new Map();
  for (const f of firms) {
    const k = keyOf(f);
    const prev = byKey.get(k);
    const avisos = [...(prev?.avisos || []), ...(f.descartado && prev && !prev.descartado ? [`Otra fuente lo descartó: ${f.motivo_descarte}`] : [])];
    byKey.set(k, prev ? { ...mergeTwo(prev, f), avisos } : { ...f, avisos: [] });
  }
  // Segunda pasada: una ficha sin web (clave nombre@ciudad) se une a la ficha con dominio del mismo
  // nombre y ciudad, cuando una fuente encontró la web y otra no.
  const nameKey = (f) => keyOf({ nombre: f.nombre.replace(/\(.*?\)/g, ''), ciudad: f.ciudad });
  for (const [k, f] of [...byKey]) {
    if (!k.includes('@')) continue;
    const twin = [...byKey].find(([k2, g]) => !k2.includes('@') && nameKey(g) === nameKey(f));
    if (twin) { byKey.set(twin[0], { ...mergeTwo(twin[1], f), avisos: twin[1].avisos }); byKey.delete(k); }
  }
  return [...byKey.entries()].map(([key, f]) => ({ key, ...f }));
}
