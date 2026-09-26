// [SIMULADOR] Madrid 5, 6 y 7 (26-sep-2026): reparte en espiral (1,2,3,3,2,1…) por score las empresas seleccionadas del
// pool ya auditado (madrid-1 y madrid-4 sin contactar) y escribe, por lote: madridN-pool.json, outreach_reformas_madridN.csv
// (esqueleto; el copy lo pone copy-dolor-madrid.mjs) y home-estimator-outreach-madridN.csv (cola con demo_url y lead_id).
// Entrada: seleccion-madrid567.json = [{lead_id,nombre_google,nombre,slug,servicios,ciudad,email,url,clase,score,resenas,lote_origen,verificacion}]
// ya filtrada (clase A/B, sin contactar, sin botón de cálculo, sin duplicados, buzón no inexistente) y ORDENADA por score desc.
// Numeración de la cola (columna n): Madrid 4 acabó en 165 → Madrid 5 = 166-188, Madrid 6 = 189-212, Madrid 7 = 213-236.
// Uso: node docs/prospeccion/preparar-lotes-madrid567.mjs
import fs from "node:fs";
import path from "node:path";
const DIR = path.dirname(new URL(import.meta.url).pathname);
const sel = JSON.parse(fs.readFileSync(path.join(DIR, "seleccion-madrid567.json"), "utf8"));
const espiral = [5, 6, 7, 7, 6, 5];
const lotes = { 5: [], 6: [], 7: [] };
sel.forEach((x, i) => lotes[espiral[i % 6]].push({ ...x, rank: i + 1 }));
const esc = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
let n = 166;
for (const L of [5, 6, 7]) {
  const filas = lotes[L].map((x, i) => ({ ...x, n: n++, variante: i % 2 === 0 ? "A-leads" : "B-contesta" }));
  fs.writeFileSync(path.join(DIR, `madrid${L}-pool.json`), JSON.stringify(filas, null, 1));
  const cab1 = ["empresa", "ciudad", "email", "slug", "variante", "cluster", "asunto", "cuerpo", "followup_asunto", "followup_cuerpo", "email3_asunto", "email3_cuerpo", "enviar", "aviso"];
  fs.writeFileSync(path.join(DIR, `outreach_reformas_madrid${L}.csv`), [cab1.join(","),
    ...filas.map((f) => cab1.map((k) => esc({ empresa: f.nombre, ciudad: f.ciudad, email: f.email, slug: f.slug, variante: f.variante, cluster: f.variante, enviar: "TRUE" }[k] ?? "")).join(","))].join("\n") + "\n");
  const cab2 = ["n", "empresa", "score", "url_contacto", "mensaje", "demo_url", "slug", "lead_id", "email", "web"];
  fs.writeFileSync(path.join(DIR, `home-estimator-outreach-madrid${L}.csv`), [cab2.join(";"),
    ...filas.map((f) => [f.n, f.nombre, f.score, f.url, "", `https://presupuestos.nico-soto.es/demo/${f.slug}`, f.slug, f.lead_id, f.email, f.url].map(esc).join(";"))].join("\n") + "\n");
  console.log(`madrid${L}: ${filas.length} empresas · n ${filas[0].n}-${filas.at(-1).n} · score medio ${(filas.reduce((a, f) => a + f.score, 0) / filas.length).toFixed(2)}`);
}
