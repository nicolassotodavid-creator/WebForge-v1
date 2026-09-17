// [SIMULADOR] Comprueba el lote Madrid 2 ANTES de que Nico lance el envío.
// Hace las mismas comprobaciones que enviar-email-lote.mjs, pero no habla con Resend ni
// con la base: solo lee los dos CSV y dice qué saldría. Uso: node docs/prospeccion/verificar-lote-madrid2.mjs [--ver N]
import fs from "node:fs";
import path from "node:path";

const DIR = path.dirname(new URL(import.meta.url).pathname);
const VER = process.argv.includes("--ver") ? Number(process.argv[process.argv.indexOf("--ver") + 1]) : 1;

function parse(txt, sep) {
  txt = txt.replace(/^﻿/, "");
  const filas = []; let fila = [], campo = "", q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) { if (c === '"' && txt[i + 1] === '"') { campo += '"'; i++; } else if (c === '"') q = false; else campo += c; }
    else if (c === '"') q = true;
    else if (c === sep) { fila.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && txt[i + 1] === "\n") i++; fila.push(campo); campo = ""; if (fila.some((x) => x !== "")) filas.push(fila); fila = []; }
    else campo += c;
  }
  fila.push(campo); if (fila.some((x) => x !== "")) filas.push(fila);
  const [cab, ...resto] = filas;
  return resto.map((f) => Object.fromEntries(cab.map((k, j) => [k, f[j] ?? ""])));
}

const cola = parse(fs.readFileSync(path.join(DIR, "home-estimator-outreach-madrid2.csv"), "utf8"), ";");
const leads = parse(fs.readFileSync(path.join(DIR, "outreach_reformas_madrid2.csv"), "utf8"), ",");
const demoPorEmail = new Map(cola.map((r) => [r.email.trim().toLowerCase(), r]));

const problemas = [];
const listos = [];
for (const l of leads.filter((r) => r.enviar === "TRUE")) {
  const c = demoPorEmail.get(l.email.trim().toLowerCase());
  if (!c?.demo_url) { problemas.push(`${l.empresa}: sin demo en la cola`); continue; }
  const text = l.cuerpo.replaceAll("{link_demo}", c.demo_url);
  if (/\{[a-z_]+\}/.test(text + l.asunto)) problemas.push(`${l.empresa}: placeholder sin rellenar`);
  if (!l.asunto.trim()) problemas.push(`${l.empresa}: sin asunto`);
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(l.email.trim())) problemas.push(`${l.empresa}: email raro (${l.email})`);
  listos.push({ ...l, demo_url: c.demo_url, text });
}

const dup = Object.entries(listos.reduce((a, l) => (a[l.email.toLowerCase()] = (a[l.email.toLowerCase()] || 0) + 1, a), {})).filter(([, n]) => n > 1);
if (dup.length) problemas.push(`emails repetidos: ${dup.map(([e]) => e).join(", ")}`);

const porVariante = listos.reduce((a, l) => (a[l.variante] = (a[l.variante] || 0) + 1, a), {});
console.log(`listos para enviar: ${listos.length} de ${leads.length}`);
console.log(`variantes: ${JSON.stringify(porVariante)}`);
console.log(`asuntos B distintos: ${new Set(listos.filter((l) => l.variante === "B-medida").map((l) => l.asunto)).size}`);
console.log(problemas.length ? `\nPROBLEMAS:\n  ${problemas.join("\n  ")}` : "\nsin problemas");

for (const l of listos.slice(0, VER)) {
  console.log(`\n${"─".repeat(62)}\npara: ${l.email}  (${l.empresa}, ${l.variante})\nasunto: ${l.asunto}\n\n${l.text}`);
}
