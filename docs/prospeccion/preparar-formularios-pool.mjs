// [SIMULADOR] Lista única para Cowork (26-sep-2026): formulario de contacto a TODO el pool del simulador, no solo Madrid 5-7.
// Tipos de fila:
//  - ab_canal   → Madrid 5-7 que repartir-canal-madrid567.mjs mandó a formulario (1er contacto, mismo texto que el email).
//  - primer     → nunca les llegó nada: sin email, o el email rebotó. Llevan el texto del email 1 de su lote.
//  - rescate    → se les mandó el email y no consta que lo abrieran (ni sesión en la demo, ni clic, ni respuesta). Texto corto que lo menciona.
// Fuera: lote 1 (ya fue por formulario en agosto), bajas, quien respondió, quien ya tocó la demo o hizo clic (esos → llamada)
// y quien abrió el email y no contestó.
// Lee Supabase de WebForge (solo lectura) y necesita demo-sesiones.json = slugs con sesión en la demo (tabla `leads` de reform-wizard).
// Uso: node docs/prospeccion/preparar-formularios-pool.mjs
import fs from "node:fs";
import path from "node:path";
const DIR = path.dirname(new URL(import.meta.url).pathname);
const env = Object.fromEntries(fs.readFileSync(path.join(DIR, "../../.env"), "utf8").split("\n")
  .filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.split("=")[0], l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]));

function parseCsv(txt, sep) {
  const rows = []; let row = [], f = "", q = false;
  txt = txt.replace(/^﻿/, "");
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) { if (c === '"' && txt[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
    else if (c === '"') q = true;
    else if (c === sep) { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; }
    else if (c !== "\r") f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const [cab, ...resto] = rows;
  return resto.filter((r) => r.length > 1).map((r) => Object.fromEntries(cab.map((k, i) => [k, r[i] ?? ""])));
}
const esc = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
const leer = (f, sep) => parseCsv(fs.readFileSync(path.join(DIR, f), "utf8"), sep);

const LOTES = {
  lote2: ["outreach_reformas_lote2.csv", "home-estimator-outreach-16-30.csv"],
  lote3: ["outreach_reformas_lote3.csv", "home-estimator-outreach-31-45.csv"],
  lote4: ["outreach_reformas_lote4.csv", "home-estimator-outreach-46-60.csv"],
  madrid1: ["outreach_reformas_madrid1.csv", "home-estimator-outreach-madrid-61-75.csv"],
  madrid2: ["outreach_reformas_madrid2.csv", "home-estimator-outreach-madrid2.csv"],
  madrid3: ["outreach_reformas_madrid3.csv", "home-estimator-outreach-madrid3.csv"],
  madrid4: ["outreach_reformas_madrid4.csv", "home-estimator-outreach-madrid4.csv"],
};

const pool = [];
for (const [lote, [fCopy, fCola]] of Object.entries(LOTES)) {
  const copy = leer(fCopy, ",");
  const porSlug = new Map(copy.map((c) => [c.slug, c]));
  const porEmpresa = new Map(copy.map((c) => [c.empresa.trim().toLowerCase(), c]));
  for (const c of leer(fCola, ";")) {
    const cp = porSlug.get(c.slug) || porEmpresa.get(c.empresa.trim().toLowerCase());
    pool.push({ lote, n: c.n, empresa: c.empresa, web: c.web || c.url_contacto, url_contacto: c.url_contacto, slug: c.slug, lead_id: c.lead_id,
      email: (c.email || "").trim(), demo_url: c.demo_url || `https://presupuestos.nico-soto.es/demo/${c.slug}`,
      asunto: cp?.asunto || "", cuerpo: cp?.cuerpo || "", mensaje_cola: c.mensaje || "", enviar: cp?.enviar, aviso: cp?.aviso || "" });
  }
}

const SB = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` };
const g = async (q) => { const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${q}`, { headers: SB }); if (!r.ok) throw new Error(`${q} HTTP ${r.status}`); return r.json(); };
const ids = pool.map((p) => p.lead_id).filter(Boolean);
const leads = new Map((await g(`leads?select=id,do_not_contact,unsubscribed_at&id=in.(${ids})`)).map((l) => [l.id, l]));
const eventos = await g(`events?select=lead_id,type,payload&type=in.(email_bounced,unsubscribed,replied,link_clicked)&lead_id=in.(${ids})`);
const enviados = await g(`outreach_messages?select=lead_id,opened_at&status=in.(sent,replied)&email_number=gte.101&lead_id=in.(${ids})`);
const BOT = /bot|google-read-aloud|crawler|preview|scanner|proofpoint|barracuda|mimecast/i;
const ev = (id, t) => eventos.filter((e) => e.lead_id === id && e.type === t);
const recibioEmail = new Set(enviados.map((m) => m.lead_id));
// Abrió algún email del simulador (el píxel ya descarta escáneres): lo vio y no contestó. El seguimiento de los lotes
// 2-4 y Madrid 1 acaba en «Si no os interesa, lo dejo aquí», así que el rescate solo va a quien no consta que lo viera.
const abrio = new Set(enviados.filter((m) => m.opened_at).map((m) => m.lead_id));
const sesiones = new Set(JSON.parse(fs.readFileSync(path.join(DIR, "demo-sesiones.json"), "utf8")));

const rescate = (p) => `Hola,

Te escribí por email hace unos días y no sé si te llegó, así que te lo dejo también por aquí.

He preparado un simulador de presupuestos para la web de ${p.empresa}: el cliente elige tipo de obra, metros y calidades, ve un precio orientativo y te escribe ya sabiendo cuánto cuesta. Ya está montado con tu nombre:
${p.demo_url}

Son dos minutos. ¿Hoy te llegan más clientes por tu web o por plataformas?

Nico Soto
nico-soto.es`;
const corto = (p) => `Hola, he preparado un simulador de presupuestos para la web de ${p.empresa}: el cliente elige tipo de obra, metros y calidades, ve un precio orientativo y te escribe ya sabiendo cuánto cuesta. Ya está montado con tu nombre: ${p.demo_url} — ¿Hoy te llegan más clientes por tu web o por plataformas? Nico Soto · nico-soto.es`;

const fuera = { baja: [], respondio: [], uso_demo_o_clic: [], abrio_y_no_contesto: [], sin_lead: [] };
const filas = [];
for (const p of pool) {
  const l = leads.get(p.lead_id);
  if (!l) { fuera.sin_lead.push(p.empresa); continue; }
  const clicHumano = ev(p.lead_id, "link_clicked").some((e) => !BOT.test(JSON.stringify(e.payload || {})));
  // El webhook de Resend también pone unsubscribed_at/do_not_contact en los rebotes: eso NO es una baja, es que el
  // email no llegó (y el formulario es justo la forma de llegarles). Baja = clic en «darse de baja» o queja de spam.
  const reboto = ev(p.lead_id, "email_bounced").length > 0 || /inexistente/.test(p.aviso);
  const queja = ev(p.lead_id, "email_bounced").some((e) => /complain/i.test(e.payload?.resend_type || ""));
  if (ev(p.lead_id, "unsubscribed").length || queja || (l.unsubscribed_at && !reboto)) { fuera.baja.push(p.empresa); continue; }
  if (ev(p.lead_id, "replied").length || /Contestó/.test(p.aviso)) { fuera.respondio.push(p.empresa); continue; }
  if (sesiones.has(p.slug) || clicHumano) { fuera.uso_demo_o_clic.push(p.empresa); continue; }
  const llego = recibioEmail.has(p.lead_id) && !reboto;
  if (llego && abrio.has(p.lead_id)) { fuera.abrio_y_no_contesto.push(p.empresa); continue; }
  const tipo = llego ? "rescate" : "primer";
  const base = p.cuerpo ? p.cuerpo.replaceAll("{link_demo}", p.demo_url) : p.mensaje_cola;
  filas.push({ n: p.n, lote: p.lote, tipo, empresa: p.empresa, web: p.web, demo_url: p.demo_url, slug: p.slug, lead_id: p.lead_id,
    asunto: tipo === "rescate" ? "Simulador de presupuestos para tu web" : (p.asunto || "Simulador de presupuestos para tu web"),
    mensaje: tipo === "rescate" ? rescate(p) : base, mensaje_corto: corto(p) });
}

// Madrid 5-7 (A/B de canal) primero: su día de envío importa para la comparación.
const ab = leer("cowork-formularios/formularios-madrid567.csv", ",").map((r) => ({ ...r, tipo: "ab_canal" }));
const todas = [...ab, ...filas];
const dup = todas.map((r) => r.n).filter((n, i, a) => a.indexOf(n) !== i);
if (dup.length) throw new Error(`n repetidos: ${dup}`);
const vacias = todas.filter((r) => !r.mensaje.includes("presupuestos.nico-soto.es/demo/"));
if (vacias.length) throw new Error(`Mensaje sin enlace a la demo: ${vacias.map((r) => r.empresa)}`);

const cab = ["n", "lote", "tipo", "empresa", "web", "demo_url", "slug", "lead_id", "asunto", "mensaje", "mensaje_corto"];
fs.writeFileSync(path.join(DIR, "cowork-formularios", "formularios-todos.csv"),
  [cab.join(","), ...todas.map((r) => cab.map((k) => esc(r[k])).join(","))].join("\n") + "\n");
const cuenta = {}; for (const r of todas) cuenta[r.tipo] = (cuenta[r.tipo] || 0) + 1;
console.log(`formularios-todos.csv: ${todas.length} empresas`, cuenta);
for (const [k, v] of Object.entries(fuera)) console.log(`fuera · ${k} (${v.length}): ${v.join(", ")}`);
