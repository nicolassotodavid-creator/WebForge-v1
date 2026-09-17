// [SIMULADOR] Envío por email del lote 2 (16-30) desde hola@nico-soto.es vía Resend.
// Cuerpo = el mensaje de la cola (home-estimator-outreach-16-30.csv) + firma. Texto plano, uno a uno.
// Uso: node docs/prospeccion/enviar-email-lote2.mjs            → simulación (no envía)
//      node docs/prospeccion/enviar-email-lote2.mjs --enviar   → envía y guarda el registro
import fs from "node:fs";
import path from "node:path";

const DIR = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(DIR, "../..");
const ENVIAR = process.argv.includes("--enviar");

const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, ".env"), "utf8").split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);

// Asunto de persona, no de campaña: corto y diciendo lo que hay dentro.
const NOMBRE_CORTO = {
  16: "Gabi Reformas", 17: "Reformas Bailén", 18: "Grupo G Reformas", 19: "Azahar Reformas",
  20: "Todo Reformas Valencia", 21: "Reformas Orcu", 22: "Obras VIP", 23: "Bono Proyectos",
  24: "VGA Reformas", 26: "Valltro", 27: "Reformas Cecever", 28: "Reformas Ferreira",
  29: "Dekorinex", 30: "Incoval",
};
const ASUNTOS = Object.fromEntries(Object.entries(NOMBRE_CORTO).map(([n, nombre]) => [n, `demo para ${nombre}`]));
// La web de BONO publica info@bonoporyectos.com (errata, dominio sin MX). La ficha tiene el bueno.
const EMAIL_CORREGIDO = { 23: "administracion@bonoproyectos.com" };

const FIRMA = "\n\nNico\nhola@nico-soto.es · 600 78 22 11";

function leerCsv(file) {
  const txt = fs.readFileSync(file, "utf8").replace(/^﻿/, "");
  const filas = []; let fila = [], campo = "", comillas = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (comillas) {
      if (c === '"' && txt[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === ";") { fila.push(campo); campo = ""; }
    else if (c === "\n") { fila.push(campo.replace(/\r$/, "")); filas.push(fila); fila = []; campo = ""; }
    else campo += c;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  const [cab, ...resto] = filas;
  return resto.filter((f) => f.length === cab.length).map((f) => Object.fromEntries(cab.map((k, i) => [k, f[i]])));
}

const leads = leerCsv(path.join(DIR, "home-estimator-outreach-16-30.csv"))
  .map((l) => ({ ...l, to: EMAIL_CORREGIDO[l.n] || l.email.trim(), asunto: ASUNTOS[l.n] }))
  .filter((l) => l.to && l.asunto);

console.log(`${leads.length} emails · ${ENVIAR ? "ENVÍO REAL" : "simulación"}`);
const registro = [];
for (const [i, l] of leads.entries()) {
  const text = l.mensaje.trim() + FIRMA;
  if (!ENVIAR) {
    if (i === 0) console.log(`\n--- ejemplo ---\nPara: ${l.to}\nAsunto: ${l.asunto}\n\n${text}\n---------------\n`);
    console.log(`${l.n} ${l.empresa} → ${l.to}`);
    continue;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Nico <hola@nico-soto.es>", to: [l.to], reply_to: "hola@nico-soto.es", subject: l.asunto, text }),
  });
  const body = await res.json().catch(() => ({}));
  const r = { n: l.n, empresa: l.empresa, to: l.to, asunto: l.asunto, http: res.status, resend_id: body.id || null, error: body.message || null, at: new Date().toISOString() };
  registro.push(r);
  console.log(`${r.n} ${r.empresa} → ${r.to} · HTTP ${r.http} ${r.resend_id || r.error}`);
  fs.writeFileSync(path.join(DIR, "home-estimator-lote2-email-envios.json"), JSON.stringify(registro, null, 2) + "\n");
  // Espaciado de 40-80 s entre envíos: ritmo de persona, no de ráfaga.
  if (i < leads.length - 1) await new Promise((ok) => setTimeout(ok, 40000 + Math.random() * 40000));
}
