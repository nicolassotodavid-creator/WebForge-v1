// [SIMULADOR] Madrid 2: genera el CSV de clusters (asunto/cuerpo/seguimiento) y la cola de envío.
//
// El test de asunto de esta tanda SÍ es un A/B legible, al revés que el del 16-17 sep
// (allí "Gancho" eran 25 asuntos distintos, uno por empresa: no se podía comparar nada):
//   A = "he probado tu formulario"  → asunto FIJO, el que mejor fue en la tanda anterior
//   B = asunto a medida de su web   → escrito por Sonnet con los datos de la auditoría
// 20 y 20, repartidas al azar con semilla fija y alternando por score para que las dos
// variantes lleven fichas igual de buenas (el error de la tanda anterior).
//
// Lo único que escribe el modelo es el párrafo con la cita de SU web y el asunto B. El
// resto de la plantilla es fija. Toda cita entrecomillada se verifica contra el texto de
// la auditoría: si el modelo se inventa una, la fila sale marcada y no se envía.
//
// Uso: node docs/prospeccion/generar-copy-madrid2.mjs [--lote madrid3] [--limit N]
//      (sin --lote hace Madrid 2; madrid3 = las 20 del 19-sep, numeradas desde el 116)
//      node docs/prospeccion/generar-copy-madrid2.mjs --solo slug1,slug2   (rehace solo esas filas)
import fs from "node:fs";
import path from "node:path";

const DIR = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(DIR, "../..");
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, ".env"), "utf8").split("\n")
  .filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const MODEL = env.ORQUESTADOR_MODEL || "claude-sonnet-4-6";
const LIMIT = process.argv.includes("--limit") ? Number(process.argv[process.argv.indexOf("--limit") + 1]) : Infinity;
const SOLO = process.argv.includes("--solo")
  ? new Set(process.argv[process.argv.indexOf("--solo") + 1].split(",").map((s) => s.trim()))
  : null;

const LOTE = process.argv.includes("--lote") ? process.argv[process.argv.indexOf("--lote") + 1] : "madrid2";
const PRIMER_N = { madrid2: 76, madrid3: 116 }[LOTE];
if (!PRIMER_N) throw new Error(`lote desconocido: ${LOTE}`);
const M = JSON.parse(fs.readFileSync(path.join(DIR, `${LOTE}-marca.json`), "utf8"));
const POOL = JSON.parse(fs.readFileSync(path.join(DIR, `${LOTE}-pool.json`), "utf8"));
const porScrape = new Map(POOL.map((p) => [p.nombre, p]));

const SYSTEM = `Escribes el segundo párrafo de un email frío a una empresa de reformas española, y un asunto.

Quien escribe es Nico, una persona sola, no una agencia. Vende Home Estimator: el cliente final
contesta en la web de la empresa metros, estancias, calidades y presupuesto, y a la empresa le llega
una estimación antes de la visita.

El párrafo dice lo que has visto en SU web y por qué eso les cuesta tiempo. Reglas:
- Dos frases como mucho y 45 palabras como mucho, contadas. Corta antes que alargar.
- Español de España, llano, sin marketing, sin "solución", sin "optimizar".
- Si entrecomillas algo, tiene que estar LITERAL en los datos que te doy. Si no hay nada literal, no
  entrecomilles nada y descríbelo con tus palabras.
- Nada de halagos ("me ha encantado vuestra web"), ni de cifras inventadas, ni de promesas.
- NUNCA el nombre de una persona, aunque te lo den en los datos: es un email frío y suena a acoso.
- No menciones el precio ni pidas una llamada.

El asunto: minúsculas, 3-6 palabras, concreto y sacado de SU caso, como lo escribiría una persona
con prisa. Nada de jerga de consultora ("cualificación", "proceso", "eficiencia"). Sin emoji, sin
signos de exclamación, sin la palabra gratis, sin el nombre de la empresa.

Devuelve SOLO un objeto JSON: {"parrafo": "...", "asunto": "..."}`;

async function redacta(r) {
  const a = porScrape.get(r.empresa) || {};
  const datos = {
    empresa: r.nombre_comercial, ciudad: r.ciudad, web: r.url,
    campos_del_formulario: a.campos_formulario, lo_que_dice_su_web: a.evidencia,
    proceso_actual: a.proceso_actual, dolor: a.dolor_principal, angulo: a.outreach_angle,
  };
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODEL, max_tokens: 400,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: JSON.stringify(datos) }],
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  const txt = j.content.map((c) => c.text || "").join("");
  const m = txt.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("sin JSON");
  return JSON.parse(m[0]);
}

// Una cita solo vale si está literal en lo que la auditoría leyó de su web.
function citasInventadas(parrafo, r) {
  const a = porScrape.get(r.empresa) || {};
  const fuente = [a.campos_formulario, a.evidencia, a.proceso_actual, a.outreach_angle, a.dolor_principal, r.nombre_comercial]
    .filter(Boolean).join(" ").toLowerCase().replace(/\s+/g, " ");
  const entre = [
    ...parrafo.matchAll(/[“”«"]([^“”»"]{4,})[“”»"]/g),
    ...parrafo.matchAll(/[‘’']([^‘’']{4,})[‘’']/g),
  ];
  return entre.map((x) => x[1]).filter((c) => !fuente.includes(c.toLowerCase().replace(/\s+/g, " ")));
}

const cuerpo = (parrafo) => `Hola,

${parrafo}

Estoy montando una herramienta para empresas de reformas: el cliente contesta en tu web metros, estancias, calidades y cuánto quiere invertir, y te llega una estimación antes de la visita.

Así se ve: {link_demo}

¿Te encaja? Si no te interesa, dímelo y no vuelvo a escribir.

Nico Soto
nico-soto.es`;

const seguimiento = (empresa) => `Hola de nuevo,

¿Quién lleva los presupuestos en ${empresa}? Si no eres tú, ¿me dices a quién le paso la demo?

{link_demo}

Si no os interesa, lo dejo aquí.

Nico Soto
nico-soto.es`;

// A/B: alternando por score (ya vienen ordenadas) para que las dos variantes lleven fichas iguales.
const ASUNTO_A = "he probado tu formulario";
const CSV = path.join(DIR, `outreach_reformas_${LOTE}.csv`);

// Con --solo, las demás filas se conservan tal cual estaban.
function leePrevias() {
  if (!fs.existsSync(CSV)) return new Map();
  const txt = fs.readFileSync(CSV, "utf8").replace(/^﻿/, "");
  const filas = []; let fila = [], campo = "", q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) { if (c === '"' && txt[i + 1] === '"') { campo += '"'; i++; } else if (c === '"') q = false; else campo += c; }
    else if (c === '"') q = true;
    else if (c === ",") { fila.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && txt[i + 1] === "\n") i++; fila.push(campo); campo = ""; if (fila.some((x) => x !== "")) filas.push(fila); fila = []; }
    else campo += c;
  }
  fila.push(campo); if (fila.some((x) => x !== "")) filas.push(fila);
  const [cab, ...resto] = filas;
  return new Map(resto.map((f) => { const o = Object.fromEntries(cab.map((k, j) => [k, f[j] ?? ""])); return [o.slug, o]; }));
}
const previas = SOLO ? leePrevias() : new Map();

const filas = [];
let i = 0;
for (const r of M.slice(0, LIMIT === Infinity ? M.length : LIMIT)) {
  const variante = i % 2 === 0 ? "A-fijo" : "B-medida";
  if (SOLO && !SOLO.has(r.slug) && previas.has(r.slug)) { filas.push(previas.get(r.slug)); i++; process.stdout.write("="); continue; }
  let out, aviso = "";
  try { out = await redacta(r); } catch (e) { out = null; aviso = `fallo del modelo: ${String(e.message).slice(0, 80)}`; }
  const inventadas = out ? citasInventadas(out.parrafo, r) : [];
  if (inventadas.length) aviso = `cita sin respaldo: ${inventadas.join(" | ").slice(0, 120)}`;
  const asunto = variante === "A-fijo" ? ASUNTO_A : (out?.asunto || "").toLowerCase().trim();
  filas.push({
    empresa: r.nombre_comercial, ciudad: r.ciudad, email: r.email, slug: r.slug,
    variante, cluster: variante, asunto,
    cuerpo: out ? cuerpo(out.parrafo) : "",
    followup_asunto: `Re: ${asunto}`, followup_cuerpo: seguimiento(r.nombre_comercial),
    enviar: out && !aviso ? "TRUE" : "FALSE", aviso,
  });
  process.stdout.write(aviso ? "!" : ".");
  i++;
}
console.log("");

const esc = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
const cab = ["empresa", "ciudad", "email", "slug", "variante", "cluster", "asunto", "cuerpo", "followup_asunto", "followup_cuerpo", "enviar", "aviso"];
fs.writeFileSync(CSV,
  [cab.join(","), ...filas.map((f) => cab.map((k) => esc(f[k])).join(","))].join("\n"));

// Cola con el enlace de cada demo, en el formato que espera enviar-email-lote.mjs
const cabCola = ["n", "empresa", "score", "url_contacto", "mensaje", "demo_url", "slug", "lead_id", "email", "web"];
const cola = M.map((r, n) => {
  const a = porScrape.get(r.empresa) || {};
  return [n + PRIMER_N, r.nombre_comercial, a.home_estimator_score ?? "", a.url_presupuesto || r.url, "",
    `https://presupuestos.nico-soto.es/demo/${r.slug}`, r.slug, r.lead_id ?? a.lead_id ?? "", r.email, r.url];
});
fs.writeFileSync(path.join(DIR, `home-estimator-outreach-${LOTE}.csv`),
  [cabCola.join(";"), ...cola.map((f) => f.map(esc).join(";"))].join("\n"));

const ok = filas.filter((f) => f.enviar === "TRUE").length;
console.log(`listas ${ok}/${filas.length} · A ${filas.filter((f) => f.variante === "A-fijo" && f.enviar === "TRUE").length} · B ${filas.filter((f) => f.variante === "B-medida" && f.enviar === "TRUE").length}`);
for (const f of filas.filter((f) => f.aviso)) console.log(`  REVISAR ${f.empresa}: ${f.aviso}`);
