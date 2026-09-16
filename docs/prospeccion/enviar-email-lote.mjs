// [SIMULADOR] Lotes 2, 3, 4 y Madrid 1 por email (nunca contactados antes), desde hola@nico-soto.es vía Resend. Mismo flujo que enviar-email-lote1.mjs.
// Fuente: outreach_reformas_lote<N>.csv (asunto/cuerpo/seguimiento por cluster). {link_demo} = demo_url de la cola (home-estimator-outreach-<rango>.csv).
// Uso: node docs/prospeccion/enviar-email-lote.mjs --lote 3                          → simulación
//      node docs/prospeccion/enviar-email-lote.mjs --lote 3 --enviar                 → email 1
//      node docs/prospeccion/enviar-email-lote.mjs --lote 3 --seguimiento --enviar   → email 2 (seguimiento)
//      node docs/prospeccion/enviar-email-lote.mjs --lote 3 [--seguimiento] --registrar → solo apunta en el panel lo ya enviado (log)
// Cada envío se apunta en outreach_messages con email_number 101 (email 1) / 102 (seguimiento):
// así el panel lo etiqueta como "Simulador" (app/src/lib/product.ts) y los crons de webs no lo tocan.
// NO cambia leads.status: el pipeline de webs no se entera.
import fs from "node:fs";
import path from "node:path";

const DIR = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(DIR, "../..");
const ENVIAR = process.argv.includes("--enviar");
const SEGUIMIENTO = process.argv.includes("--seguimiento");
const REGISTRAR = process.argv.includes("--registrar");
const LOTE = process.argv[process.argv.indexOf("--lote") + 1];
// lote → [CSV de clusters, cola con demo_url]
const LOTES = {
  2: ["outreach_reformas_lote2.csv", "home-estimator-outreach-16-30.csv"],
  3: ["outreach_reformas_lote3.csv", "home-estimator-outreach-31-45.csv"],
  4: ["outreach_reformas_lote4.csv", "home-estimator-outreach-46-60.csv"],
  madrid1: ["outreach_reformas_madrid1.csv", "home-estimator-outreach-madrid-61-75.csv"],
};
if (!process.argv.includes("--lote") || !LOTES[LOTE]) { console.error(`Falta --lote ${Object.keys(LOTES).join(" | ")}`); process.exit(1); }
// Emails corregidos respecto a la cola: email del CSV de clusters → email que figura en la cola.
const ALIAS = { "administracion@bonoproyectos.com": "info@bonoporyectos.com" };
const EMAIL_NUMBER = SEGUIMIENTO ? 102 : 101;
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, ".env"), "utf8").split("\n")
  .filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));

// CSV con comillas, "" escapadas y saltos de línea dentro de campos.
function parseCsv(txt, sep) {
  const filas = []; let fila = [], campo = "", q = false;
  txt = txt.replace(/^﻿/, "");
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) {
      if (c === '"' && txt[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') q = false;
      else campo += c;
    } else if (c === '"') q = true;
    else if (c === sep) { fila.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && txt[i + 1] === "\n") i++;
      fila.push(campo); campo = "";
      if (fila.some((x) => x !== "")) filas.push(fila);
      fila = [];
    } else campo += c;
  }
  fila.push(campo); if (fila.some((x) => x !== "")) filas.push(fila);
  const [cab, ...resto] = filas;
  return resto.map((f) => Object.fromEntries(cab.map((k, j) => [k, f[j] ?? ""])));
}

const cola = parseCsv(fs.readFileSync(path.join(DIR, LOTES[LOTE][1]), "utf8"), ";");
const demoPorEmail = new Map(cola.map((r) => [r.email.trim().toLowerCase(), r]));

const LEADS = parseCsv(fs.readFileSync(path.join(DIR, LOTES[LOTE][0]), "utf8"), ",")
  .filter((r) => r.enviar === "TRUE")
  .map((r) => {
    const c = demoPorEmail.get(ALIAS[r.email.trim().toLowerCase()] || r.email.trim().toLowerCase());
    if (!c?.demo_url) throw new Error(`Sin demo para ${r.empresa} (${r.email})`);
    const link = c.demo_url;
    return {
      n: Number(c.n), lead_id: c.lead_id, empresa: r.empresa, to: r.email.trim(), slug: c.slug, cluster: r.cluster, link,
      asunto: SEGUIMIENTO ? r.followup_asunto : r.asunto,
      text: (SEGUIMIENTO ? r.followup_cuerpo : r.cuerpo).replaceAll("{link_demo}", link),
    };
  });

for (const l of LEADS) if (/\{[a-z_]+\}/.test(l.text + l.asunto)) throw new Error(`Placeholder sin rellenar en ${l.empresa}`);

const LOG = path.join(DIR, `home-estimator-lote${LOTE}-${SEGUIMIENTO ? "seguimiento" : "email1"}-envios.json`);
const previos = fs.existsSync(LOG) ? JSON.parse(fs.readFileSync(LOG, "utf8")) : [];
const yaEnviados = new Set(previos.filter((r) => r.http === 200).map((r) => r.n));

// Apunta el envío en el panel. Idempotente por el índice único (lead_id, email_number).
async function registrarEnPanel(l, sentAt) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/outreach_messages?on_conflict=lead_id,email_number`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=minimal",
    },
    body: JSON.stringify({
      lead_id: l.lead_id, channel: "email", email_number: EMAIL_NUMBER, subject: l.asunto, body: l.text,
      status: "sent", sent_at: sentAt, generated_by_model: "manual:simulador",
    }),
  });
  return res.ok ? "apuntado en el panel" : `panel HTTP ${res.status} ${await res.text()}`;
}

if (REGISTRAR) {
  const porN = new Map(LEADS.map((l) => [l.n, l]));
  for (const r of previos.filter((x) => x.http === 200)) {
    const l = porN.get(r.n);
    if (!l) { console.log(`${r.n} ${r.empresa} · no está en el CSV, salto`); continue; }
    console.log(`${r.n} ${r.empresa} · ${await registrarEnPanel(l, r.at)}`);
  }
  process.exit(0);
}

console.log(`${LEADS.length} emails · ${SEGUIMIENTO ? "seguimiento" : "email 1"} · ${ENVIAR ? "ENVÍO REAL" : "simulación"}`);
const registro = [...previos];
for (const l of LEADS) {
  if (yaEnviados.has(l.n)) { console.log(`${l.n} ${l.empresa} · ya enviado, salto`); continue; }
  if (!ENVIAR) { console.log(`\n=== ${l.n} [${l.cluster}] ${l.empresa} → ${l.to}\nAsunto: ${l.asunto}\n\n${l.text}`); continue; }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Nico <hola@nico-soto.es>", to: [l.to], reply_to: "hola@nico-soto.es", subject: l.asunto, text: l.text }),
  });
  const body = await res.json().catch(() => ({}));
  const r = { n: l.n, empresa: l.empresa, slug: l.slug, cluster: l.cluster, to: l.to, asunto: l.asunto, http: res.status, resend_id: body.id || null, error: body.message || null, at: new Date().toISOString() };
  registro.push(r);
  fs.writeFileSync(LOG, JSON.stringify(registro, null, 2));
  const panel = res.ok ? await registrarEnPanel(l, r.at) : "";
  console.log(`${r.n} [${r.cluster}] ${r.empresa} → ${r.to} · HTTP ${r.http} ${r.resend_id || r.error} · ${panel}`);
  await new Promise((ok) => setTimeout(ok, 1500));
}
