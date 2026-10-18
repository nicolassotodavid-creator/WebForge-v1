// Hallazgos manuales: lo que una persona ha comprobado a mano y no sale de ningún conector.
//   data/manual/hallazgos.csv   → señales extra por despacho (se suman a las de la investigación)
//   data/manual/revision.csv    → estado de revisión humana por despacho
//   data/research/*.json        → despachos completos (cualquier JSON con el esquema del brief vale)
import { readCsv } from '../lib/csv.mjs';
import { domainOf, p, today } from '../lib/util.mjs';

export const HALLAZGOS_HEADERS = ['dominio', 'tipo', 'subtipo', 'descripcion', 'url', 'fecha_evidencia', 'estado', 'fuente', 'fecha_comprobacion'];
export const REVISION_HEADERS = ['dominio', 'estado', 'nota', 'fecha'];

export function manualSignals() {
  const byDomain = new Map();
  for (const r of readCsv(p('data/manual/hallazgos.csv'))) {
    const d = domainOf(r.dominio) || r.dominio;
    if (!d || !r.tipo || !r.descripcion) continue;
    const list = byDomain.get(d) || [];
    list.push({
      tipo: r.tipo,
      subtipo: r.subtipo || 'otro',
      descripcion: r.descripcion,
      url: r.url || null,
      fecha_evidencia: r.fecha_evidencia || null,
      fecha_comprobacion: r.fecha_comprobacion || today(),
      estado: r.estado === 'verificado' ? 'verificado' : 'hipotesis',
      fuente: r.fuente || 'manual',
    });
    byDomain.set(d, list);
  }
  return byDomain;
}

export function reviewStates() {
  const m = new Map();
  for (const r of readCsv(p('data/manual/revision.csv'))) {
    const d = domainOf(r.dominio) || r.dominio;
    if (d && r.estado) m.set(d, r);
  }
  return m;
}
