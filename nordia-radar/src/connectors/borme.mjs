// BORME (BOE datos abiertos, acceso libre y autorizado): actos inscritos de sociedades de abogados.
// Sumario: https://www.boe.es/datosabiertos/api/borme/sumario/AAAAMMDD (Accept: application/json)
// Cada provincia de la Sección A trae `url_html` (txt.php) con el texto de cada acto (<h5 class="articulo">
// + <p class="parrafo">). Se usa la versión HTML porque el robots.txt del BOE excluye `xml.php?`. Detecta constituciones, ampliaciones de capital, cambios de domicilio y
// nombramientos de sociedades cuyo nombre suena a despacho. Es una lista PARA TRIAR: que «X ABOGADOS
// SLP» sea el despacho comercial «X Abogados» hay que confirmarlo antes de usarlo como señal.
import { p, today, writeJson } from '../lib/util.mjs';

const PROVINCIAS = (process.env.BORME_PROVINCIAS || 'MADRID,BARCELONA,VALENCIA').split(',');
const NOMBRE = /(ABOGAD|ADVOCAT|BUFETE|LETRAD|JURIDIC|\bLEGAL\b|\bLAW\b|ABOGACIA)/i;
const ACTOS = [
  ['constitucion', /Constituci[oó]n\./i],
  ['ampliacion_capital', /Ampliaci[oó]n de capital/i],
  ['cambio_domicilio', /Cambio de domicilio social/i],
  ['nombramientos', /Nombramientos\./i],
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const decode = (s) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();

function* days(from, to) {
  const d = new Date(`${from.slice(0, 4)}-${from.slice(4, 6)}-${from.slice(6, 8)}T12:00:00Z`);
  const end = new Date(`${to.slice(0, 4)}-${to.slice(4, 6)}-${to.slice(6, 8)}T12:00:00Z`);
  for (; d <= end; d.setUTCDate(d.getUTCDate() + 1)) if (d.getUTCDay() % 6) yield d.toISOString().slice(0, 10).replace(/-/g, '');
}

export async function run(from, to = from) {
  if (!/^\d{8}$/.test(from || '')) return console.log('Uso: node src/radar.mjs borme AAAAMMDD [AAAAMMDD]');
  const hallazgos = [];
  for (const day of days(from, to)) {
    const res = await fetch(`https://www.boe.es/datosabiertos/api/borme/sumario/${day}`, { headers: { accept: 'application/json' } });
    if (res.status === 404) continue; // sin BORME ese día
    if (!res.ok) { console.error(`${day}: sumario ${res.status}`); continue; }
    const diario = (await res.json()).data?.sumario?.diario?.[0];
    const secA = (diario?.seccion || []).find((s) => s.codigo === 'A');
    const items = [secA?.item].flat().filter(Boolean).filter((i) => PROVINCIAS.some((pr) => i.titulo.toUpperCase().startsWith(pr)));
    for (const it of items) {
      await sleep(800);
      const html = await (await fetch(it.url_html, { headers: { 'user-agent': 'NordiaRadar/0.1 (datos abiertos BOE)' } })).text();
      const parts = [...html.matchAll(/<(?:h5|p) class="(articulo|parrafo)">([\s\S]*?)<\/(?:h5|p)>/g)];
      for (let i = 0; i < parts.length; i++) {
        if (parts[i][1] !== 'articulo') continue;
        const empresa = decode(parts[i][2]).replace(/^\d+\s*-\s*/, '').replace(/\.$/, '');
        const texto = parts[i + 1]?.[1] === 'parrafo' ? decode(parts[i + 1][2]) : '';
        if (!NOMBRE.test(empresa)) continue;
        const actos = ACTOS.filter(([, re]) => re.test(texto)).map(([k]) => k);
        if (!actos.length) continue;
        hallazgos.push({ fecha_borme: `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6)}`, provincia: it.titulo, empresa, actos, texto: texto.slice(0, 600), url: it.url_html });
      }
    }
    console.log(`${day}: ${items.length} provincias revisadas, ${hallazgos.length} hallazgos acumulados`);
  }
  const file = p('data/cache/borme', `${from}-${to}.json`);
  writeJson(file, { generado: today(), provincias: PROVINCIAS, hallazgos });
  console.log(`→ ${file}`);
  for (const h of hallazgos) console.log(`  ${h.fecha_borme} ${h.provincia}: ${h.empresa} [${h.actos.join(', ')}]`);
}
