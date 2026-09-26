// [WEBS] Email 1 SIN web construida: señala 2-3 mejoras concretas de la web actual del negocio
// (vistas con Playwright) y enlaza a la portada www.nico-soto.es, con webs reales ya hechas.
// Lo pidió Nico el 26-sep para los 12 descartados del simulador (Madrid 5-7): no se les construye web.
// Uso: node orquestador/propuesta-sin-web.mjs orquestador/lotes/<lote>.json            → simulación
//      node orquestador/propuesta-sin-web.mjs orquestador/lotes/<lote>.json --enviar   → envío real
// Cada fila del lote: { lead_id, empresa, to, asunto, cuerpo } con {link} donde va la portada.
// Registro igual que send-email: outreach_messages (email_number 1) + events email_sent + lead → contacted.
// El enlace en HTML pasa por /r/<lead>/home (track-click). cron-followups NO manda el 2 y el 3
// porque exige sites.live_url: estos leads no tienen web.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, ".env"), "utf8").split("\n")
  .filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const LOTE = process.argv[2];
const ENVIAR = process.argv.includes("--enviar");
if (!LOTE || !fs.existsSync(LOTE)) { console.error("Uso: node orquestador/propuesta-sin-web.mjs <lote.json> [--enviar]"); process.exit(1); }

const HOME = "https://www.nico-soto.es/";
const APP = (env.APP_URL || "https://www.nico-soto.es").replace(/\/$/, "");
const FROM = env.FROM_EMAIL || "hola@nico-soto.es";
const PIE = "\n\n—\nTe escribo a título profesional; encontré tu contacto en tu web. Si no quieres recibir más correos, responde BAJA y no vuelvo a escribir.\nDavid Nicolás Soto · diseño web (autónomo)";

const SB = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" };
const REST = `${env.SUPABASE_URL}/rest/v1`;
const get = async (q) => { const r = await fetch(`${REST}/${q}`, { headers: SB }); if (!r.ok) throw new Error(`${q} → HTTP ${r.status}`); return r.json(); };

const filas = JSON.parse(fs.readFileSync(LOTE, "utf8"));
for (const f of filas) {
  if (!/^[0-9a-f-]{36}$/.test(f.lead_id) || !f.to || !f.asunto || !f.cuerpo?.includes("{link}")) throw new Error(`Fila incompleta: ${f.empresa}`);
  f.text = f.cuerpo.replace("{link}", HOME) + PIE;
}

const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function html(f, messageId) {
  const link = `${APP}/r/${f.lead_id}/home?m=${messageId}&c=email`;
  const cuerpo = esc(f.text).replace(HOME, `<a href="${link}">${HOME}</a>`).replace(/\n/g, "<br>\n");
  const pixel = `${env.SUPABASE_URL}/functions/v1/track-event?lead_id=${f.lead_id}&type=email_opened&message_id=${messageId}`;
  return `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#222">${cuerpo}</div>` +
    `<img src="${pixel}" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px">`;
}

const ids = filas.map((f) => f.lead_id).join(",");
const leads = new Map((await get(`leads?select=id,email,status,do_not_contact&id=in.(${ids})`)).map((l) => [l.id, l]));
const previos = await get(`outreach_messages?select=lead_id,email_number,status&channel=eq.email&email_number=lt.100&lead_id=in.(${ids})`);
const LOG = LOTE.replace(/\.json$/, "-envios.json");
const registro = fs.existsSync(LOG) ? JSON.parse(fs.readFileSync(LOG, "utf8")) : [];

console.log(`${filas.length} emails · ${ENVIAR ? "ENVÍO REAL" : "simulación"}`);
for (const f of filas) {
  const lead = leads.get(f.lead_id);
  if (!lead) { console.log(`${f.empresa} · lead no encontrado, salto`); continue; }
  if (lead.do_not_contact) { console.log(`${f.empresa} · no contactar, salto`); continue; }
  if (previos.some((m) => m.lead_id === f.lead_id && ["sent", "sending", "replied"].includes(m.status))) { console.log(`${f.empresa} · ya contactado por webs, salto`); continue; }
  if (!ENVIAR) { console.log(`\n=== ${f.empresa} → ${f.to}${lead.email !== f.to ? ` (en la ficha: ${lead.email})` : ""}\nAsunto: ${f.asunto}\n\n${f.text}`); continue; }

  // El email bueno es el de su web: la ficha pasa a tenerlo para que respuestas, bajas y rebotes cuadren.
  if (lead.email !== f.to) await fetch(`${REST}/leads?id=eq.${f.lead_id}`, { method: "PATCH", headers: SB, body: JSON.stringify({ email: f.to }) });

  // Borrador (o el de un intento fallido) para tener el id del mensaje en el píxel y en el enlace.
  const [borrador] = await get(`outreach_messages?select=id&lead_id=eq.${f.lead_id}&email_number=eq.1&status=eq.draft`);
  let messageId = borrador?.id;
  if (!messageId) {
    const r = await fetch(`${REST}/outreach_messages`, {
      method: "POST", headers: { ...SB, Prefer: "return=representation" },
      body: JSON.stringify({ lead_id: f.lead_id, channel: "email", email_number: 1, subject: f.asunto, body: f.text, status: "draft", generated_by_model: "manual:propuesta-sin-web" }),
    });
    if (!r.ok) throw new Error(`borrador ${f.empresa} → HTTP ${r.status} ${await r.text()}`);
    messageId = (await r.json())[0].id;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `outreach-${messageId}` },
    body: JSON.stringify({
      from: `Nico <${FROM}>`, to: [f.to], reply_to: "hola@nico-soto.es", subject: f.asunto, text: f.text, html: html(f, messageId),
      headers: { "List-Unsubscribe": `<mailto:hola@nico-soto.es?subject=BAJA>` },
    }),
  });
  const body = await res.json().catch(() => ({}));
  const at = new Date().toISOString();
  registro.push({ empresa: f.empresa, lead_id: f.lead_id, to: f.to, asunto: f.asunto, http: res.status, resend_id: body.id || null, message_id: messageId, error: body.message || null, at });
  fs.writeFileSync(LOG, JSON.stringify(registro, null, 2));
  if (!res.ok) { await fetch(`${REST}/outreach_messages?id=eq.${messageId}`, { method: "DELETE", headers: SB }); console.log(`${f.empresa} → ${f.to} · HTTP ${res.status} ${body.message} · borrador borrado`); continue; }

  await fetch(`${REST}/outreach_messages?id=eq.${messageId}`, { method: "PATCH", headers: SB, body: JSON.stringify({ status: "sent", sent_at: at, subject: f.asunto, body: f.text }) });
  await fetch(`${REST}/events`, { method: "POST", headers: SB, body: JSON.stringify({ lead_id: f.lead_id, type: "email_sent", payload: { message_id: messageId, to: f.to, resend_id: body.id, sin_web: true } }) });
  await fetch(`${REST}/leads?id=eq.${f.lead_id}&status=in.(new,analyzed)`, { method: "PATCH", headers: SB, body: JSON.stringify({ status: "contacted", updated_at: at }) });
  console.log(`${f.empresa} → ${f.to} · enviado ${body.id}`);
  await new Promise((ok) => setTimeout(ok, 1500));
}
