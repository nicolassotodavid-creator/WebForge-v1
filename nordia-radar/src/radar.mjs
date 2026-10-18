#!/usr/bin/env node
// Radar comercial NORDIA — CLI.
//   node src/radar.mjs build             une investigación + manual + caché, puntúa y exporta out/
//   node src/radar.mjs ads-checklist     (re)genera data/manual/publicidad.csv con los enlaces a revisar
//   node src/radar.mjs web [dominio]     pasada por la web de los despachos (o de uno) → caché
//   node src/radar.mjs meta-api          consulta oficial Meta Ad Library (requiere META_ADLIB_TOKEN)
//   node src/radar.mjs infojobs "q" prov consulta oficial InfoJobs (requiere INFOJOBS_CLIENT_ID/SECRET)
//   node src/radar.mjs borme AAAAMMDD [AAAAMMDD]  sociedades de abogados en el BORME (BOE datos abiertos)
import fs from 'node:fs';
import { writeCsv } from './lib/csv.mjs';
import { dedupe } from './lib/normalize.mjs';
import { scoreFirm } from './lib/score.mjs';
import { domainOf, monthsAgo, p, readJson, today, writeJson } from './lib/util.mjs';
import { adsResults, googleAtcUrl, metaSearchUrl, writeAdsChecklist } from './connectors/ads-manual.mjs';
import { manualSignals, reviewStates } from './connectors/manual.mjs';
import { scanWeb, webSignals } from './connectors/web.mjs';

const cfg = readJson(p('config/scoring.json'));
const REF = cfg.fecha_referencia || today();

function loadResearch() {
  const dir = process.env.RADAR_RESEARCH_DIR || p('data/research');
  const firms = [];
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    const data = readJson(`${dir}/${f}`);
    for (const firm of Array.isArray(data) ? data : data.despachos || []) firms.push({ ...firm, origen: [f.replace(/\.json$/, '')] });
  }
  return dedupe(firms);
}

function enrich(firms) {
  const manual = manualSignals();
  const ads = adsResults();
  const meta = readJson(p('data/cache/meta-api.json'), {});
  return firms.map((f) => {
    const a = ads.get(f.key) || {};
    const m = meta[f.key];
    const senales = [...(f.senales || []), ...(manual.get(f.key) || []), ...(a.senales || []), ...(m?.senales || []), ...webSignals(f.key)];
    return { ...f, senales, ads: { meta: m?.activa ?? a.meta ?? null, google: a.google ?? null } };
  });
}

const fmtMonth = (d) => (d ? String(d).slice(0, 7) : 'sin fecha');

function hiringLabel(f) {
  const hs = f.senales.filter((s) => s.tipo === 'contratacion' && s.estado === 'verificado');
  const admin = hs.filter((s) => s.subtipo !== 'abogado').sort((a, b) => String(b.fecha_evidencia).localeCompare(String(a.fecha_evidencia)));
  if (admin.length) {
    const s = admin[0];
    const m = monthsAgo(s.fecha_evidencia, REF);
    return m === null || m <= cfg.bloques.contratacion.admin_reciente_meses ? `sí (${fmtMonth(s.fecha_evidencia)}, ${s.fuente})` : `antigua (${fmtMonth(s.fecha_evidencia)}, ${s.fuente})`;
  }
  if (hs.length) return `solo abogados (${fmtMonth(hs[0].fecha_evidencia)})`;
  if (f.senales.some((s) => s.tipo === 'contratacion')) return 'por confirmar (hipótesis)';
  return 'no detectada';
}

function adsLabel(f) {
  const { meta, google } = f.ads;
  if (meta === 'si' || google === 'si') return `sí (${[meta === 'si' && 'Meta', google === 'si' && 'Google'].filter(Boolean).join(' + ')})`;
  if (meta === 'no' && google === 'no') return 'no';
  if (meta === 'no') return 'no en Meta · Google no comprobada';
  if (google === 'no') return 'no en Google · Meta no comprobada';
  return 'no comprobada';
}

const BLOQUE = { contratacion: 'Contratación', publicidad: 'Publicidad', perfil: 'Perfil', carga_documental: 'Carga documental', crecimiento: 'Crecimiento', intencion: 'Intención' };

function priorityReason(f) {
  const top = f.score.desglose.filter((d) => d.puntos > 0).sort((a, b) => b.puntos - a.puntos).slice(0, 3);
  return top.map((d) => `${BLOQUE[d.bloque]} +${d.puntos}: ${d.motivo}`).join(' · ');
}

function extraSignals(f) {
  return f.senales
    .filter((s) => !(s.tipo === 'contratacion' && s.estado === 'verificado' && s.subtipo !== 'abogado'))
    .map((s) => `${s.estado === 'verificado' ? '' : '[hipótesis] '}${s.descripcion}${s.fecha_evidencia ? ` (${fmtMonth(s.fecha_evidencia)})` : ''}`)
    .join(' · ');
}

function evidenceLinks(f) {
  const urls = [...f.senales.filter((s) => s.estado === 'verificado').map((s) => s.url), f.abogados?.fuente, f.decisor?.fuente].filter(Boolean);
  return [...new Set(urls)].join(' | ');
}

function lastChecked(f) {
  const ds = f.senales.map((s) => s.fecha_comprobacion).filter(Boolean).sort();
  return ds.at(-1) || null;
}

const CSV_HEADERS = [
  'Top 10', 'Nombre del despacho', 'Ciudad', 'Página web', 'Especialidad', 'Número de abogados',
  'Publicidad activa', 'Contratación activa', 'Señales adicionales', 'Necesidad potencial de NORDIA',
  'Puntuación', 'Motivo concreto de priorización', 'Decisor (nombre y cargo)', 'Canal de contacto profesional',
  'Enlaces a las evidencias', 'Fecha de verificación', 'Estado de revisión',
  'Desglose de la puntuación', 'Qué falta verificar', 'Origen',
];

function build() {
  const all = enrich(loadResearch());
  const reviews = reviewStates();
  const scored = all.map((f) => ({ ...f, score: scoreFirm(f, cfg, REF) }));
  const valid = scored.filter((f) => !f.descartado).sort((a, b) => b.score.total - a.score.total || a.nombre.localeCompare(b.nombre));
  const discarded = scored.filter((f) => f.descartado);
  valid.forEach((f, i) => (f.rank = i + 1));

  const portal = (s) => cfg.portales_empleo.includes(s.fuente) && s.tipo === 'contratacion';
  const toConfirm = (f) => f.senales.filter((s) => portal(s) || (s.tipo === 'contratacion' && s.estado !== 'verificado'));

  const rows = valid.map((f) => ({
    'Top 10': f.rank <= 10 ? `★ ${f.rank}` : String(f.rank),
    'Nombre del despacho': f.nombre,
    Ciudad: f.ciudad,
    'Página web': f.web || '',
    Especialidad: (f.especialidades || []).join(', '),
    'Número de abogados': f.abogados?.n ? `${f.abogados.n} (${f.abogados.tipo})` : 'sin dato',
    'Publicidad activa': adsLabel(f),
    'Contratación activa': hiringLabel(f),
    'Señales adicionales': extraSignals(f),
    'Necesidad potencial de NORDIA': f.necesidad_nordia ? `[hipótesis] ${f.necesidad_nordia}` : '',
    Puntuación: f.score.total,
    'Motivo concreto de priorización': priorityReason(f),
    'Decisor (nombre y cargo)': f.decisor?.nombre ? `${f.decisor.nombre} — ${f.decisor.cargo || 'cargo sin publicar'}` : 'no publicado',
    'Canal de contacto profesional': [f.contacto?.email, f.contacto?.telefono, f.contacto?.formulario].filter(Boolean).join(' · '),
    'Enlaces a las evidencias': evidenceLinks(f),
    'Fecha de verificación': lastChecked(f) || '',
    'Estado de revisión': reviews.get(f.key)?.estado || cfg.estado_revision_por_defecto,
    'Desglose de la puntuación': Object.entries(f.score.bloques).map(([k, v]) => `${BLOQUE[k]} ${v}/${cfg.bloques[k].max}`).join(' · '),
    'Qué falta verificar': [
      adsLabel(f) === 'no comprobada' ? 'publicidad (Meta y Google)' : null,
      toConfirm(f).length ? `abrir ${toConfirm(f).length} oferta(s) de portal y confirmar anunciante y fecha` : null,
      f.faltan, ...(f.avisos || []),
    ].filter(Boolean).join(' / '),
    Origen: (f.origen || []).join(', '),
  }));

  const N = cfg.entrega_max || rows.length;
  writeCsv(p('out/radar-nordia.csv'), CSV_HEADERS, rows.slice(0, N));
  writeCsv(p('out/reserva.csv'), CSV_HEADERS, rows.slice(N));

  // Lista de comprobación manual para la entrega: cada fila es un clic.
  const checks = [];
  for (const f of valid.slice(0, N)) {
    if (adsLabel(f) === 'no comprobada') {
      checks.push({ Puesto: f.rank, Despacho: f.nombre, Qué: 'Publicidad en Meta: ¿anuncios activos? → apuntar en data/manual/publicidad.csv', Enlace: metaSearchUrl(f.nombre) });
      if (f.key.includes('.')) checks.push({ Puesto: f.rank, Despacho: f.nombre, Qué: 'Publicidad en Google (región ES): ¿anuncios? → data/manual/publicidad.csv', Enlace: googleAtcUrl(f.key) });
    }
    for (const s of toConfirm(f)) checks.push({ Puesto: f.rank, Despacho: f.nombre, Qué: `${s.estado === 'verificado' ? 'Confirmar anunciante y fecha' : 'HIPÓTESIS: confirmar que la oferta existe y es suya'}: ${s.descripcion.slice(0, 160)}`, Enlace: s.url || '' });
  }
  writeCsv(p('out/verificar-a-mano.csv'), ['Puesto', 'Despacho', 'Qué', 'Enlace', 'Resultado'], checks);
  writeCsv(p('out/descartados.csv'), ['Nombre del despacho', 'Ciudad', 'Página web', 'Motivo del descarte', 'Origen'], discarded.map((f) => ({ 'Nombre del despacho': f.nombre, Ciudad: f.ciudad, 'Página web': f.web || '', 'Motivo del descarte': f.motivo_descarte || '', Origen: (f.origen || []).join(', ') })));
  writeJson(p('out/radar-nordia.json'), { generado: new Date().toISOString(), fecha_referencia: REF, pesos: Object.fromEntries(Object.entries(cfg.bloques).map(([k, v]) => [k, v.max])), despachos: valid, descartados: discarded.map(({ key, nombre, ciudad, web, motivo_descarte, origen }) => ({ key, nombre, ciudad, web, motivo_descarte, origen })) });
  writeTop10(valid.slice(0, 10));
  writeJson(p('out/radar-view.json'), {
    fecha: REF,
    pesos: Object.fromEntries(Object.entries(cfg.bloques).map(([k, v]) => [k, v.max])),
    totales: { validos: valid.length, descartados: discarded.length, verificaciones: checks.length },
    despachos: valid.slice(0, N).map((f, i) => ({
      fila: rows[i], key: f.key, bloques: f.score.bloques,
      desglose: f.score.desglose,
      revisar: toConfirm(f).length,
    })),
  });

  const byCity = valid.reduce((a, f) => ((a[f.ciudad] = (a[f.ciudad] || 0) + 1), a), {});
  console.log(`${valid.length} despachos válidos (${Object.entries(byCity).map(([c, n]) => `${c} ${n}`).join(', ')}), ${discarded.length} descartados.`);
  console.log(`Contratación admin verificada: ${valid.filter((f) => f.score.bloques.contratacion > 0).length} · publicidad verificada: ${valid.filter((f) => f.score.bloques.publicidad > 0).length} · intención/necesidad: ${valid.filter((f) => f.score.bloques.intencion > 0).length}`);
  console.log('Top 10:'); valid.slice(0, 10).forEach((f) => console.log(`  ${String(f.rank).padStart(2)}. ${f.score.total.toString().padStart(3)}  ${f.nombre} (${f.ciudad})`));
  console.log(`→ out/radar-nordia.csv (${Math.min(N, rows.length)}) · out/reserva.csv (${Math.max(0, rows.length - N)}) · out/verificar-a-mano.csv (${checks.length}) · out/radar-nordia.json · out/top10.md · out/descartados.csv`);
}

function writeTop10(top) {
  const L = [`# Top 10 del radar NORDIA (${REF})`, '', 'Puntuación = herramienta de priorización, no probabilidad de conversión. Solo puntúan señales verificadas con URL. La publicidad está **sin comprobar** salvo que se diga lo contrario (ver `data/manual/publicidad.csv`).', ''];
  for (const f of top) {
    L.push(`## ${f.rank}. ${f.nombre} — ${f.ciudad} · ${f.score.total}/100`, '');
    L.push(`- **Web:** ${f.web || '—'} · **Especialidad:** ${(f.especialidades || []).join(', ') || '—'} · **Abogados:** ${f.abogados?.n ? `${f.abogados.n} (${f.abogados.tipo})` : 'sin dato'}`);
    L.push(`- **Decisor:** ${f.decisor?.nombre ? `${f.decisor.nombre}, ${f.decisor.cargo || 'cargo sin publicar'}` : 'no publicado'} · **Contacto:** ${[f.contacto?.email, f.contacto?.telefono, f.contacto?.formulario].filter(Boolean).join(' · ') || '—'}`);
    L.push(`- **Por qué merece una conversación:** ${f.necesidad_nordia || '—'} _(hipótesis apoyada en las señales de abajo)_`);
    L.push('- **Señales verificadas:**');
    for (const d of f.score.desglose.filter((d) => d.puntos > 0)) L.push(`  - ${BLOQUE[d.bloque]} +${d.puntos}: ${d.motivo}${d.url ? ` — ${d.url}` : ''}`);
    const hyp = f.score.desglose.filter((d) => d.puntos === 0);
    if (hyp.length) { L.push('- **Sin puntos (hipótesis o fuera de ventana):**'); for (const d of hyp) L.push(`  - ${d.motivo}${d.url ? ` — ${d.url}` : ''}`); }
    const ofertas = f.senales.filter((s) => s.tipo === 'contratacion' && (cfg.portales_empleo.includes(s.fuente) || s.estado !== 'verificado')).length;
    L.push(`- **Antes de llamar:** ${['comprobar publicidad (Meta y Google)', ofertas && `abrir ${ofertas} oferta(s) y confirmar anunciante y fecha (out/verificar-a-mano.csv)`, f.faltan].filter(Boolean).join('; ')}`, '');
  }
  fs.writeFileSync(p('out/top10.md'), L.join('\n'));
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  if (cmd === 'build') return build();
  if (cmd === 'page') return (await import('./page.mjs')).run();
  if (cmd === 'ads-checklist') {
    const n = writeAdsChecklist(loadResearch().filter((f) => !f.descartado));
    return console.log(`data/manual/publicidad.csv: ${n} despachos con enlaces de Meta y Google listos para revisar.`);
  }
  if (cmd === 'web') {
    const firms = loadResearch().filter((f) => !f.descartado && f.web && (!args[0] || f.key === domainOf(args[0])));
    for (const f of firms) {
      const r = await scanWeb(f);
      console.log(`${f.key}: robots ${r?.robots}${r?.bloqueado ? ' (bloquea visitas automáticas: se conserva la pasada anterior)' : ''} · páginas ${JSON.stringify(r?.paginas || {})} · ${r?.senales.length || 0} señales nuevas`);
    }
    return;
  }
  if (cmd === 'meta-api') return (await import('./connectors/meta-api.mjs')).run(loadResearch().filter((f) => !f.descartado));
  if (cmd === 'infojobs') return (await import('./connectors/infojobs-api.mjs')).run(args[0], args[1]);
  if (cmd === 'borme') return (await import('./connectors/borme.mjs')).run(args[0], args[1]);
  console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 9).join('\n').replace(/^\/\/ ?/gm, ''));
}

main().catch((e) => { console.error(e.message); process.exit(1); });
