// Página de lectura del radar: out/radar-nordia.html, generada desde out/radar-view.json.
// Se rehace con `node src/radar.mjs build && node src/radar.mjs page`.
import fs from 'node:fs';
import { p, readJson } from './lib/util.mjs';

const BLOQUES = [
  ['contratacion', 'Contratación'],
  ['publicidad', 'Publicidad'],
  ['perfil', 'Perfil'],
  ['carga_documental', 'Carga documental'],
  ['crecimiento', 'Crecimiento'],
  ['intencion', 'Necesidad o intención'],
];

export function run() {
  const view = readJson(p('out/radar-view.json'));
  const data = JSON.stringify(view).replace(/</g, '\\u003c');
  const html = TEMPLATE.replace('__DATA__', data).replace('__BLOQUES__', JSON.stringify(BLOQUES));
  fs.writeFileSync(p('out/radar-nordia.html'), html);
  console.log('→ out/radar-nordia.html');
}

const TEMPLATE = String.raw`<title>Radar de despachos NORDIA</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,500;8..60,650&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* Layout: una carpeta de expedientes — cabecera de sumario, leyenda del baremo, y una fila por despacho que se abre como un folio. */
:root {
  --paper: #f6f7f9;
  --sheet: #ffffff;
  --ink: #141a24;
  --ink-2: #4a5363;
  --ink-3: #6f7889;
  --rule: #dde1e8;
  --toga: #23406e;
  --toga-soft: #e6ecf6;
  --ok: #1d7a46;
  --ok-soft: #e3f3ea;
  --warn: #8a5a00;
  --warn-soft: #fbf0d9;
  --none-soft: #eef0f3;
  --s1: #2a78d6; --s2: #eb6834; --s3: #1baf7a; --s4: #eda100; --s5: #e87ba4; --s6: #008300;
  --display: "Source Serif 4", Georgia, "Times New Roman", serif;
  --body: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --paper: #11151c; --sheet: #181d26; --ink: #eef1f6; --ink-2: #b9c1cf; --ink-3: #8a93a3; --rule: #2a313d;
    --toga: #9db8e8; --toga-soft: #1f2a3d; --ok: #6fcf97; --ok-soft: #173326; --warn: #e8b85a; --warn-soft: #3a2d12; --none-soft: #232934;
    --s1: #3987e5; --s2: #d95926; --s3: #199e70; --s4: #c98500; --s5: #d55181; --s6: #008300;
  }
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --paper: #11151c; --sheet: #181d26; --ink: #eef1f6; --ink-2: #b9c1cf; --ink-3: #8a93a3; --rule: #2a313d;
  --toga: #9db8e8; --toga-soft: #1f2a3d; --ok: #6fcf97; --ok-soft: #173326; --warn: #e8b85a; --warn-soft: #3a2d12; --none-soft: #232934;
  --s1: #3987e5; --s2: #d95926; --s3: #199e70; --s4: #c98500; --s5: #d55181; --s6: #008300;
}
* { box-sizing: border-box; }
body { background: var(--paper); color: var(--ink); font: 15px/1.55 var(--body); padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
.wrap { max-width: 1120px; margin: 0 auto; padding-block: 40px 64px; display: grid; gap: 32px; }
h1, h2 { font-family: var(--display); font-weight: 650; text-wrap: balance; margin: 0; letter-spacing: -0.01em; }
h1 { font-size: clamp(30px, 4.4vw, 44px); line-height: 1.1; }
h2 { font-size: 22px; }
.eyebrow { font: 500 12px/1 var(--mono); letter-spacing: 0.08em; text-transform: uppercase; color: var(--toga); }
.lede { max-width: 68ch; color: var(--ink-2); margin: 0; font-size: 16px; }
header { display: grid; gap: 14px; }
.facts { display: flex; flex-wrap: wrap; gap: 8px 28px; margin: 6px 0 0; padding: 14px 0 0; border-top: 1px solid var(--rule); }
.facts div { display: grid; gap: 2px; }
.facts dt { font: 500 11px/1.2 var(--mono); letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-3); }
.facts dd { margin: 0; font: 600 20px/1.2 var(--body); font-variant-numeric: tabular-nums; }
.facts dd small { font-weight: 400; font-size: 13px; color: var(--ink-2); }
.notice { background: var(--warn-soft); color: var(--ink); border-radius: 6px; padding: 14px 16px; max-width: 80ch; font-size: 14px; }
.notice b { color: var(--warn); }
.legend { display: grid; gap: 10px; }
.legend ul { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 8px 18px; font-size: 13px; color: var(--ink-2); }
.legend li { display: flex; align-items: center; gap: 7px; }
.sw { width: 12px; height: 12px; border-radius: 3px; flex: none; }
.sw.hatch, .seg.hatch { background: repeating-linear-gradient(135deg, var(--rule) 0 3px, transparent 3px 6px); outline: 1px solid var(--rule); outline-offset: -1px; }
.tools { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.chip { font: 500 13px/1 var(--body); padding: 8px 12px; border-radius: 999px; border: 1px solid var(--rule); background: var(--sheet); color: var(--ink-2); cursor: pointer; }
.chip[aria-pressed="true"] { background: var(--toga); border-color: var(--toga); color: var(--sheet); }
.chip:focus-visible, .row:focus-visible, input:focus-visible { outline: 2px solid var(--toga); outline-offset: 2px; }
.tools input { flex: 1 1 220px; min-width: 0; max-width: 320px; font: 14px var(--body); padding: 8px 12px; border-radius: 6px; border: 1px solid var(--rule); background: var(--sheet); color: var(--ink); }
.table { background: var(--sheet); border: 1px solid var(--rule); border-radius: 8px; overflow: hidden; }
.head, .row { display: grid; grid-template-columns: 44px minmax(0, 2.2fr) 92px minmax(0, 1.25fr) minmax(0, 1fr) 190px; gap: 14px; align-items: center; padding: 12px 16px; }
.head { font: 500 11px/1.2 var(--mono); letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-3); border-bottom: 1px solid var(--rule); }
.row { border-top: 1px solid var(--rule); cursor: pointer; width: 100%; text-align: left; background: none; border-left: 0; border-right: 0; border-bottom: 0; color: inherit; font: inherit; }
.row:first-of-type { border-top: 0; }
.row:hover { background: var(--toga-soft); }
.rank { font: 500 14px var(--mono); color: var(--ink-3); font-variant-numeric: tabular-nums; }
.rank.top { color: var(--toga); font-weight: 600; }
.name b { display: block; font-weight: 600; }
.name span { font-size: 13px; color: var(--ink-2); }
.cell { font-size: 13px; color: var(--ink-2); }
.pill { display: inline-flex; align-items: center; gap: 6px; font: 500 12px/1.3 var(--body); padding: 3px 8px; border-radius: 999px; }
.pill.ok { background: var(--ok-soft); color: var(--ok); }
.pill.warn { background: var(--warn-soft); color: var(--warn); }
.pill.none { background: var(--none-soft); color: var(--ink-2); }
.pill::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.score { display: grid; grid-template-columns: 34px 1fr; gap: 10px; align-items: center; }
.score strong { font: 600 18px var(--mono); font-variant-numeric: tabular-nums; text-align: right; }
.bar { display: flex; gap: 2px; height: 10px; background: var(--none-soft); border-radius: 4px; overflow: hidden; }
.seg { height: 100%; }
.seg:first-child { border-radius: 4px 0 0 4px; }
.detail { border-top: 1px dashed var(--rule); padding: 18px 16px 22px 74px; display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); background: var(--paper); }
.detail h3 { font: 500 11px/1.2 var(--mono); letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-3); margin: 0 0 6px; }
.detail p { margin: 0; font-size: 14px; }
.detail .wide { grid-column: 1 / -1; }
.hyp { color: var(--warn); font: 500 11px var(--mono); letter-spacing: 0.04em; text-transform: uppercase; }
.signals { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; font-size: 14px; }
.signals li { display: grid; grid-template-columns: 150px 1fr; gap: 12px; }
.signals .pts { font: 500 12px/1.5 var(--mono); color: var(--ink-2); display: flex; gap: 6px; align-items: flex-start; }
.signals .pts .sw { margin-top: 3px; }
.signals li.zero { color: var(--ink-3); }
a { color: var(--toga); text-underline-offset: 2px; overflow-wrap: anywhere; }
.empty { padding: 28px 16px; color: var(--ink-2); }
footer { display: grid; gap: 10px; font-size: 14px; color: var(--ink-2); max-width: 80ch; }
footer code { font: 13px var(--mono); }
#tip { position: fixed; pointer-events: none; background: var(--ink); color: var(--paper); font: 12px/1.4 var(--body); padding: 6px 9px; border-radius: 5px; max-width: 260px; z-index: 5; }
@media (max-width: 820px) {
  .head { display: none; }
  .row { grid-template-columns: 34px minmax(0, 1fr); gap: 6px 10px; }
  .row > :nth-child(n+3) { grid-column: 2; }
  .detail { padding-left: 16px; }
  .signals li { grid-template-columns: 1fr; gap: 2px; }
}
@media (prefers-reduced-motion: no-preference) { .row { transition: background .15s; } }
</style>

<div class="wrap">
  <header>
    <span class="eyebrow" id="eyebrow">NORDIA · Radar comercial</span>
    <h1>Despachos que merece la pena llamar</h1>
    <p class="lede">Despachos reales de Madrid, Barcelona y Valencia, ordenados por señales públicas de que pueden invertir en sus operaciones. Solo puntúa lo verificado con enlace. La necesidad de NORDIA de cada uno es una hipótesis que hay que confirmar en la llamada.</p>
    <dl class="facts" id="facts"></dl>
  </header>

  <p class="notice"><b>Publicidad sin comprobar en todos.</b> Meta y Google no permiten consultarla de forma automática sin cuentas verificadas. Por eso ningún despacho tiene aún esos 20 puntos y el máximo práctico es 80. Cada fila indica también qué ofertas de empleo hay que abrir para confirmar quién la publica.</p>

  <section class="legend" aria-label="Cómo se compone la puntuación">
    <h2>Cómo se lee la puntuación</h2>
    <ul id="legend"></ul>
  </section>

  <section style="display:grid;gap:14px">
    <div class="tools" role="toolbar" aria-label="Filtros">
      <button class="chip" type="button" id="f-all" aria-pressed="true">Todos</button>
      <button class="chip" type="button" id="f-top" aria-pressed="false">Top 10</button>
      <button class="chip" type="button" id="f-Madrid" aria-pressed="false">Madrid</button>
      <button class="chip" type="button" id="f-Barcelona" aria-pressed="false">Barcelona</button>
      <button class="chip" type="button" id="f-Valencia" aria-pressed="false">Valencia</button>
      <input id="q" type="search" placeholder="Buscar despacho o especialidad" aria-label="Buscar despacho o especialidad">
    </div>
    <div class="table" aria-label="Despachos puntuados">
      <div class="head" aria-hidden="true"><span>#</span><span>Despacho</span><span>Abogados</span><span>Contratación</span><span>Estado</span><span>Puntuación</span></div>
      <div id="rows"></div>
    </div>
  </section>

  <footer>
    <h2>De dónde sale esto</h2>
    <p>Cinco investigadores revisaron webs de despachos, ofertas de empleo, bolsas de colegios y prensa jurídica el 18 de octubre de 2026. Descartaron por tamaño, redes nacionales o falta de datos a todos los que no aparecen aquí (lista en <code>out/descartados.csv</code>). La tabla completa para Google Sheets es <code>out/radar-nordia.csv</code>. Las comprobaciones pendientes, de una en una, están en <code>out/verificar-a-mano.csv</code>.</p>
    <p>No se ha contactado a ningún despacho. El email comercial en frío no es una opción (art. 21 de la LSSI). El canal es una llamada de una persona, comprobando antes la Lista Robinson.</p>
  </footer>
</div>
<div id="tip" hidden></div>

<script>
const V = __DATA__;
const B = __BLOQUES__;
const COLOR = Object.fromEntries(B.map(([k], i) => [k, 'var(--s' + (i + 1) + ')']));
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const link = (u) => /^https?:/.test(u) ? '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60)) + '</a>' : esc(u);
const fecha = new Date(V.fecha + 'T12:00:00Z').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
document.getElementById('eyebrow').textContent = 'NORDIA · Radar comercial · ' + fecha;

const D = V.despachos;
const count = (fn) => D.filter(fn).length;
const cities = ['Barcelona', 'Madrid', 'Valencia'].map((c) => c + ' ' + count((d) => d.fila.Ciudad === c)).join(' · ');
document.getElementById('facts').innerHTML = [
  ['En la tabla', D.length + ' <small>de ' + V.totales.validos + ' válidos</small>'],
  ['Por ciudad', '<small style="font-size:15px;color:var(--ink)">' + cities + '</small>'],
  ['Contratación administrativa verificada', count((d) => d.bloques.contratacion > 0)],
  ['Necesidad tecnológica verificada', count((d) => d.bloques.intencion > 0)],
  ['Publicidad comprobada', count((d) => d.bloques.publicidad > 0)],
].map(([k, v]) => '<div><dt>' + k + '</dt><dd>' + v + '</dd></div>').join('');

document.getElementById('legend').innerHTML = B.map(([k, l], i) => '<li><span class="sw" style="background:' + COLOR[k] + '"></span>' + l + ' · hasta ' + V.pesos[k] + '</li>').join('') +
  '<li><span class="sw hatch"></span>Publicidad por comprobar</li>';

function bar(d) {
  return '<div class="bar" aria-hidden="true">' + B.map(([k, l]) => d.bloques[k] ? '<span class="seg" data-tip="' + esc(l + ': ' + d.bloques[k] + ' de ' + V.pesos[k]) + '" style="width:' + d.bloques[k] + '%;background:' + COLOR[k] + '"></span>' : '').join('') +
    (d.bloques.publicidad ? '' : '<span class="seg hatch" data-tip="Publicidad sin comprobar (hasta 20)" style="width:' + V.pesos.publicidad + '%"></span>') + '</div>';
}
function hiringPill(t) {
  if (/^sí/.test(t)) return '<span class="pill ok">' + esc(t) + '</span>';
  if (/^(antigua|solo|por)/.test(t)) return '<span class="pill warn">' + esc(t) + '</span>';
  return '<span class="pill none">' + esc(t) + '</span>';
}
function statePill(d) {
  const t = d.fila['Estado de revisión'];
  if (/no contactar|verificar/i.test(t)) return '<span class="pill warn">' + esc(t) + '</span>';
  return '<span class="pill none">' + esc(d.revisar ? 'Pendiente · ' + d.revisar + ' oferta' + (d.revisar > 1 ? 's' : '') + ' por abrir' : t) + '</span>';
}
function detail(d) {
  const f = d.fila;
  const sig = d.desglose.slice().sort((a, b) => b.puntos - a.puntos).map((s) => {
    const label = (B.find(([k]) => k === s.bloque) || [0, s.bloque])[1];
    return '<li class="' + (s.puntos ? '' : 'zero') + '"><span class="pts"><span class="sw" style="background:' + (s.puntos ? COLOR[s.bloque] : 'transparent') + '"></span>' + esc(label) + (s.puntos ? ' +' + s.puntos : ' · 0') + '</span><span>' + esc(s.motivo) + (s.url ? ' · ' + link(s.url) : '') + '</span></li>';
  }).join('');
  return '<div class="detail" role="region">' +
    '<div class="wide"><h3>Por qué priorizarlo</h3><p>' + esc(f['Motivo concreto de priorización']) + '</p></div>' +
    '<div class="wide"><h3>Qué le resolvería NORDIA <span class="hyp">hipótesis</span></h3><p>' + esc(f['Necesidad potencial de NORDIA'].replace(/^\[hipótesis\]\s*/, '')) + '</p></div>' +
    '<div><h3>Decisor</h3><p>' + esc(f['Decisor (nombre y cargo)']) + '</p></div>' +
    '<div><h3>Contacto publicado</h3><p>' + (f['Canal de contacto profesional'] ? f['Canal de contacto profesional'].split(' · ').map(link).join('<br>') : 'no publicado') + '</p></div>' +
    '<div><h3>Web y especialidad</h3><p>' + (f['Página web'] ? link(f['Página web']) + '<br>' : '') + esc(f.Especialidad) + '</p></div>' +
    '<div class="wide"><h3>Señales y puntos</h3><ul class="signals">' + sig + '</ul></div>' +
    '<div class="wide"><h3>Antes de llamar</h3><p>' + esc(f['Qué falta verificar'] || '—') + '</p></div>' +
    '</div>';
}

let filter = 'all';
const open = new Set();
function render() {
  const q = document.getElementById('q').value.trim().toLowerCase();
  const list = D.filter((d) => filter === 'all' || (filter === 'top' ? d.fila['Top 10'].startsWith('★') : d.fila.Ciudad === filter))
    .filter((d) => !q || (d.fila['Nombre del despacho'] + ' ' + d.fila.Especialidad).toLowerCase().includes(q));
  document.getElementById('rows').innerHTML = list.length ? list.map((d) => {
    const f = d.fila;
    const top = f['Top 10'].startsWith('★');
    return '<button class="row" type="button" aria-expanded="' + open.has(d.key) + '" data-key="' + esc(d.key) + '">' +
      '<span class="rank' + (top ? ' top' : '') + '">' + esc(f['Top 10'].replace('★ ', '')) + '</span>' +
      '<span class="name"><b>' + esc(f['Nombre del despacho']) + '</b><span>' + esc(f.Ciudad + ' · ' + f.Especialidad) + '</span></span>' +
      '<span class="cell">' + esc(f['Número de abogados']) + '</span>' +
      '<span class="cell">' + hiringPill(f['Contratación activa']) + '</span>' +
      '<span class="cell">' + statePill(d) + '</span>' +
      '<span class="score"><strong>' + f.Puntuación + '</strong>' + bar(d) + '</span>' +
      '</button>' + (open.has(d.key) ? detail(d) : '');
  }).join('') : '<p class="empty">Ningún despacho coincide con el filtro. Prueba con «Todos» o borra la búsqueda.</p>';
}
document.querySelector('.tools').addEventListener('click', (e) => {
  const b = e.target.closest('.chip'); if (!b) return;
  filter = b.id.slice(2);
  document.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', c === b));
  render();
});
document.getElementById('q').addEventListener('input', render);
document.getElementById('rows').addEventListener('click', (e) => {
  if (e.target.closest('a')) return;
  const r = e.target.closest('.row'); if (!r) return;
  const k = r.dataset.key; open.has(k) ? open.delete(k) : open.add(k); render();
});
const tip = document.getElementById('tip');
document.addEventListener('pointermove', (e) => {
  const s = e.target.closest('[data-tip]');
  if (!s) { tip.hidden = true; return; }
  tip.textContent = s.dataset.tip; tip.hidden = false;
  tip.style.left = Math.min(e.clientX + 12, innerWidth - 270) + 'px'; tip.style.top = (e.clientY + 14) + 'px';
});
open.add(D[0]?.key);
render();
</script>
`;
