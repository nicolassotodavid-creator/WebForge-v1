// [SIMULADOR] Madrid 2: rehace SOLO los asuntos de la variante B (a medida).
//
// La primera tanda de asuntos B salió inservible: 15 de 20 eran la misma frase
// ("formulario sin datos de la obra"). Si B converge en un asunto genérico, el A/B no
// compara "fijo contra a medida", compara dos fijos, que es el error que veníamos a
// corregir. Aquí se le prohíbe la palabra que los hacía converger y se le exige un dato
// que solo valga para esa empresa; al final se comprueba que no se repitan.
//
// Uso: node docs/prospeccion/asuntos-b-madrid2.mjs [--escribir]
import fs from "node:fs";
import path from "node:path";

const DIR = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(DIR, "../..");
const ESCRIBIR = process.argv.includes("--escribir");
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, ".env"), "utf8").split("\n")
  .filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const MODEL = env.ORQUESTADOR_MODEL || "claude-sonnet-4-6";
const CSV = path.join(DIR, "outreach_reformas_madrid2.csv");

function parse(txt) {
  txt = txt.replace(/^﻿/, "");
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
  return { cab, filas: resto.map((f) => Object.fromEntries(cab.map((k, j) => [k, f[j] ?? ""]))) };
}

const SYSTEM = `Escribes el ASUNTO de un email frío a una empresa de reformas española.

El email va de que su web pide presupuesto sin preguntar nada de la obra. Pero el asunto NO
puede decir eso en abstracto: tiene que sonar a que quien escribe ha estado en ESA web.

Reglas duras:
- 3 a 6 palabras, todo en minúsculas. Sin punto final, sin emoji, sin exclamaciones.
- PROHIBIDO usar las palabras: formulario, datos, obra, lead, presupuesto sin, cualificar.
- Tiene que llevar algo que SOLO valga para esta empresa: una frase suya literal, su promesa
  ("respuesta en 24h", "precio cerrado"), lo que anuncian, su tipo de obra o su ciudad.
- Que parezca escrito por una persona, no por una herramienta. Vale una pregunta corta.
- Nunca el nombre de una persona.

Devuelve SOLO: {"asunto": "..."}`;

const { cab, filas } = parse(fs.readFileSync(CSV, "utf8"));
const POOL = JSON.parse(fs.readFileSync(path.join(DIR, "madrid2-pool.json"), "utf8"));
const M = JSON.parse(fs.readFileSync(path.join(DIR, "madrid2-marca.json"), "utf8"));
const scrapePorSlug = new Map(M.map((r) => [r.slug, r.empresa]));
const porNombre = new Map(POOL.map((p) => [p.nombre, p]));

const PROHIBIDAS = /\b(formulario|datos|obra|lead|cualific)/i;
const out = [];
for (const f of filas) {
  if (f.variante !== "B-medida") { out.push(f); continue; }
  const a = porNombre.get(scrapePorSlug.get(f.slug)) || {};
  const datos = { empresa: f.empresa, ciudad: f.ciudad, lo_que_dice_su_web: a.evidencia, angulo: a.outreach_angle, tipo: a.categoria_google };
  let asunto = "";
  for (let intento = 0; intento < 3 && !asunto; intento++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL, max_tokens: 150, temperature: 1,
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: JSON.stringify(datos) + (intento ? "\n\n(el anterior usaba palabras prohibidas o era genérico: hazlo más concreto de esta empresa)" : "") }],
      }),
    });
    if (!res.ok) { console.log("  fallo API", res.status); continue; }
    const j = await res.json();
    const m = j.content.map((c) => c.text || "").join("").match(/\{[\s\S]*\}/);
    const cand = m ? (JSON.parse(m[0]).asunto || "").toLowerCase().trim().replace(/\.$/, "") : "";
    if (cand && !PROHIBIDAS.test(cand) && cand.split(/\s+/).length <= 7) asunto = cand;
  }
  f.asunto = asunto || f.asunto;
  f.followup_asunto = `Re: ${f.asunto}`;
  if (!asunto) f.aviso = "no salió asunto B válido: se queda el anterior";
  out.push(f);
  process.stdout.write(asunto ? "." : "!");
}
console.log("");

const bs = out.filter((f) => f.variante === "B-medida").map((f) => f.asunto);
const rep = Object.entries(bs.reduce((a, s) => (a[s] = (a[s] || 0) + 1, a), {})).filter(([, n]) => n > 1);
console.log(`asuntos B distintos: ${new Set(bs).size}/${bs.length}`);
if (rep.length) console.log("repetidos:", rep.map(([s, n]) => `${s} (x${n})`).join(" · "));
bs.forEach((s) => console.log("  -", s));

if (ESCRIBIR) {
  const esc = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  fs.writeFileSync(CSV, [cab.join(","), ...out.map((f) => cab.map((k) => esc(f[k])).join(","))].join("\n"));
  console.log("\nCSV actualizado");
} else console.log("\n(simulación: añade --escribir para guardar)");
