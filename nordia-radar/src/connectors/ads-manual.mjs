// Publicidad: verificación manual asistida.
// Ni Meta Ad Library ni Google Ads Transparency Center se consultan por scraping (sus términos lo
// prohíben). `ads-checklist` genera data/manual/publicidad.csv con los enlaces de búsqueda ya
// preparados; una persona los abre, mira y rellena las columnas de resultado. `build` lo lee.
// Si hay token oficial de Meta, `meta-api` rellena la parte de Meta sin intervención (ver meta-api.mjs).
import { readCsv, writeCsv } from '../lib/csv.mjs';
import { p, today } from '../lib/util.mjs';

export const ADS_HEADERS = [
  'dominio', 'nombre', 'ciudad',
  'meta_buscar', 'meta_activa', 'meta_evidencia_url',
  'google_buscar', 'google_activa', 'google_evidencia_url',
  'fecha_comprobacion', 'quien', 'notas',
];

export const metaSearchUrl = (q) =>
  `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ES&media_type=all&search_type=keyword_unordered&q=${encodeURIComponent(q)}`;

export const googleAtcUrl = (domain) => `https://adstransparency.google.com/?region=ES&domain=${encodeURIComponent(domain)}`;

const FILE = () => p('data/manual/publicidad.csv');

// Regenera la lista conservando lo que ya se haya rellenado a mano.
export function writeAdsChecklist(firms) {
  const prev = new Map(readCsv(FILE()).map((r) => [r.dominio, r]));
  const rows = firms.map((f) => {
    const old = prev.get(f.key) || {};
    return {
      dominio: f.key,
      nombre: f.nombre,
      ciudad: f.ciudad,
      meta_buscar: metaSearchUrl(f.nombre),
      meta_activa: old.meta_activa || '',
      meta_evidencia_url: old.meta_evidencia_url || '',
      google_buscar: f.key.includes('.') ? googleAtcUrl(f.key) : '',
      google_activa: old.google_activa || '',
      google_evidencia_url: old.google_evidencia_url || '',
      fecha_comprobacion: old.fecha_comprobacion || '',
      quien: old.quien || '',
      notas: old.notas || '',
    };
  });
  for (const [d, old] of prev) if (!rows.some((r) => r.dominio === d)) rows.push(old);
  writeCsv(FILE(), ADS_HEADERS, rows);
  return rows.length;
}

const yes = (v) => /^(s[ií]|si|yes|y|1|activa)$/i.test(String(v || '').trim());
const no = (v) => /^(no|n|0)$/i.test(String(v || '').trim());

// → Map(dominio → { meta: 'si'|'no'|null, google: ..., senales: [...] })
export function adsResults() {
  const out = new Map();
  for (const r of readCsv(FILE())) {
    const fecha = r.fecha_comprobacion || today();
    const res = { meta: yes(r.meta_activa) ? 'si' : no(r.meta_activa) ? 'no' : null, google: yes(r.google_activa) ? 'si' : no(r.google_activa) ? 'no' : null, senales: [] };
    if (res.meta === 'si') res.senales.push({ tipo: 'publicidad', subtipo: 'activa', descripcion: `Anuncios activos en Meta Ad Library (comprobado ${fecha}${r.quien ? ' por ' + r.quien : ''})`, url: r.meta_evidencia_url || r.meta_buscar, fecha_evidencia: fecha, fecha_comprobacion: fecha, estado: 'verificado', fuente: 'meta_ad_library_manual' });
    if (res.google === 'si') res.senales.push({ tipo: 'publicidad', subtipo: 'activa', descripcion: `Anuncios en Google Ads Transparency Center (comprobado ${fecha}${r.quien ? ' por ' + r.quien : ''})`, url: r.google_evidencia_url || r.google_buscar, fecha_evidencia: fecha, fecha_comprobacion: fecha, estado: 'verificado', fuente: 'google_atc_manual' });
    out.set(r.dominio, res);
  }
  return out;
}
