// [SIMULADOR] A/B de CANAL en Madrid 5, 6 y 7 (26-sep-2026): formulario de su web vs email.
// Dentro de cada lote, las empresas van ordenadas por score; se emparejan de dos en dos (1-2, 3-4…) y en cada pareja
// una va a formulario y la otra a email, al azar con semilla fija (mismo reparto si se vuelve a correr).
// - Las de formulario quedan con enviar=FALSE en outreach_reformas_madridN.csv (enviar-email-lote.mjs las salta).
// - cowork-formularios/formularios-madrid567.csv = la lista para Cowork, con el MISMO asunto y cuerpo que el email 1
//   (solo cambia el canal) y la URL limpia de la demo.
// Se compara por sesiones en la demo (tabla `leads` de reform-wizard por slug), que se mide igual en los dos canales.
// Uso: node docs/prospeccion/repartir-canal-madrid567.mjs
import fs from "node:fs";
import path from "node:path";
const DIR = path.dirname(new URL(import.meta.url).pathname);

function parseCsv(txt) {
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) { if (c === '"' && txt[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; }
    else if (c !== "\r") f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const [cab, ...resto] = rows;
  return { cab, filas: resto.map((r) => Object.fromEntries(cab.map((k, i) => [k, r[i] ?? ""]))) };
}
const esc = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;

// mulberry32: azar reproducible
let s = 20260926;
const rnd = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const AVISO = "canal formulario (A/B canal 26-sep, lo envía Cowork)";
const salida = [];
for (const L of [5, 6, 7]) {
  const ruta = path.join(DIR, `outreach_reformas_madrid${L}.csv`);
  const { cab, filas } = parseCsv(fs.readFileSync(ruta, "utf8"));
  const pool = JSON.parse(fs.readFileSync(path.join(DIR, `madrid${L}-pool.json`), "utf8"));
  const porSlug = new Map(pool.map((p) => [p.slug, p]));
  for (let i = 0; i < filas.length; i += 2) {
    const pareja = filas.slice(i, i + 2);
    const iForm = pareja.length === 1 ? (rnd() < 0.5 ? 0 : -1) : (rnd() < 0.5 ? 0 : 1);
    pareja.forEach((f, j) => {
      const form = j === iForm;
      f.enviar = form ? "FALSE" : "TRUE";
      f.aviso = form ? AVISO : (f.aviso === AVISO ? "" : f.aviso);
      f.canal = form ? "formulario" : "email";
    });
  }
  fs.writeFileSync(ruta, [cab.join(","), ...filas.map((f) => cab.map((k) => esc(f[k])).join(","))].join("\n") + "\n");
  for (const f of filas.filter((x) => x.canal === "formulario")) {
    const p = porSlug.get(f.slug);
    if (!p) throw new Error(`Sin pool para ${f.slug}`);
    if (!f.cuerpo.includes("{link_demo}")) throw new Error(`Cuerpo sin {link_demo}: ${f.empresa}`);
    const demo = `https://presupuestos.nico-soto.es/demo/${f.slug}`;
    salida.push({
      n: p.n, lote: `madrid${L}`, empresa: f.empresa, ciudad: f.ciudad, web: p.url, demo_url: demo, slug: f.slug, lead_id: p.lead_id,
      asunto: f.asunto, mensaje: f.cuerpo.replaceAll("{link_demo}", demo),
      mensaje_corto: `Hola, he preparado un simulador de presupuestos para la web de ${f.empresa}: el cliente elige tipo de obra, metros y calidades, ve un precio orientativo y te escribe ya sabiendo cuánto cuesta. Ya está montado con tu nombre: ${demo} — ¿Hoy te llegan más clientes por tu web o por plataformas? Nico Soto · nico-soto.es`,
    });
  }
  const nf = filas.filter((x) => x.canal === "formulario").length;
  console.log(`madrid${L}: ${nf} formulario · ${filas.length - nf} email`);
}
const cab = ["n", "lote", "empresa", "ciudad", "web", "demo_url", "slug", "lead_id", "asunto", "mensaje", "mensaje_corto"];
fs.mkdirSync(path.join(DIR, "cowork-formularios"), { recursive: true });
fs.writeFileSync(path.join(DIR, "cowork-formularios", "formularios-madrid567.csv"),
  [cab.join(","), ...salida.map((r) => cab.map((k) => esc(r[k])).join(","))].join("\n") + "\n");
const res = path.join(DIR, "cowork-formularios", "resultados.csv");
if (!fs.existsSync(res)) fs.writeFileSync(res, "n,empresa,estado,fecha_hora,url_formulario,notas\n");
console.log(`formularios-madrid567.csv: ${salida.length} empresas`);
