// poll-replies — Lee el buzón hola@nico-soto.es (API REST de Zoho Mail; el plan gratuito no da IMAP)
// y avisa a la Edge Function mark-replied de cada correo nuevo. mark-replied casa el remitente con
// un lead y marca sus mensajes como 'replied' (cron-followups deja de mandar el Email 2 y el 3).
//
//   node --env-file=.env orquestador/poll-replies.mjs            # una pasada
//   node --env-file=.env orquestador/poll-replies.mjs --dry-run  # solo muestra qué avisaría
//
// Estado en orquestador/.poll-replies-state.json (ids ya avisados). Primera pasada: últimos 14 días.
// Env: ZOHO_CLIENT_ID/SECRET, ZOHO_REFRESH_TOKEN, ZOHO_DC, SUPABASE_URL, INBOUND_REPLY_SECRET.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";

const e = process.env;
const DRY = process.argv.includes("--dry-run");
const STATE = fileURLToPath(new URL("./.poll-replies-state.json", import.meta.url));
const BACKFILL_MS = 14 * 24 * 3600 * 1000;

for (const k of ["ZOHO_CLIENT_ID", "ZOHO_CLIENT_SECRET", "ZOHO_REFRESH_TOKEN", "ZOHO_DC", "SUPABASE_URL", "INBOUND_REPLY_SECRET"]) {
  if (!e[k]) { console.error(`Falta ${k} en el .env`); process.exit(1); }
}

const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : { done: {} };

// Un fallo suelto (red caída) no molesta; 3 seguidos (~15 min) avisan con una notificación, como
// mucho cada 6 h. Ocurre p. ej. si Zoho invalida el refresh token.
function fail(msg) {
  console.error(msg);
  state.fails = (state.fails ?? 0) + 1;
  if (state.fails >= 3 && Date.now() - (state.lastAlert ?? 0) > 6 * 3600 * 1000) {
    state.lastAlert = Date.now();
    execFile("osascript", ["-e", `display notification "${msg.replace(/["\\]/g, "")}" with title "poll-replies: no lee las respuestas de hola@"`]);
  }
  writeFileSync(STATE, JSON.stringify(state));
  process.exit(1);
}
process.on("uncaughtException", (err) => fail(`Error: ${err.message}`));
process.on("unhandledRejection", (err) => fail(`Error: ${err?.message ?? err}`));

const tok = await (await fetch(`https://accounts.zoho.${e.ZOHO_DC}/oauth/v2/token`, {
  method: "POST",
  body: new URLSearchParams({
    grant_type: "refresh_token", client_id: e.ZOHO_CLIENT_ID,
    client_secret: e.ZOHO_CLIENT_SECRET, refresh_token: e.ZOHO_REFRESH_TOKEN,
  }),
})).json();
if (!tok.access_token) fail(`Zoho no dio access_token: ${tok.error}`);
const h = { Authorization: `Zoho-oauthtoken ${tok.access_token}` };
const api = `https://mail.zoho.${e.ZOHO_DC}/api`;

const acc = await (await fetch(`${api}/accounts`, { headers: h })).json();
const accountId = acc.data?.[0]?.accountId;
if (!accountId) fail("Zoho: sin cuenta de correo");

const list = await (await fetch(`${api}/accounts/${accountId}/messages/view?limit=200&sortBy=date&sortorder=false`, { headers: h })).json();
const msgs = list.data ?? [];
const since = Date.now() - BACKFILL_MS;

let nuevos = 0, casados = 0;
for (const m of msgs) {
  const id = String(m.messageId);
  const at = Number(m.receivedTime) || 0;
  if (state.done[id] || at < since) continue;
  nuevos++;
  const from = m.fromAddress || m.sender || "";
  if (DRY) { console.log(`[dry] ${new Date(at).toISOString().slice(0, 16)} ${from} — ${String(m.subject ?? "").slice(0, 70)}`); continue; }
  const r = await fetch(`${e.SUPABASE_URL}/functions/v1/mark-replied?token=${encodeURIComponent(e.INBOUND_REPLY_SECRET)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fromAddress: from, subject: m.subject ?? "", snippet: m.summary ?? "" }),
  });
  if (!r.ok) { console.error(`mark-replied ${r.status} para ${id}; se reintenta en la próxima pasada`); continue; }
  const j = await r.json();
  state.done[id] = at;
  if (j.matched) { casados++; console.log(`✔ ${from} → ${j.leads.map((l) => l.lead).join(", ")}`); }
}

// Poda del estado: solo lo que aún cae dentro de la ventana.
for (const [id, at] of Object.entries(state.done)) if (at < since) delete state.done[id];
state.fails = 0;
if (!DRY) writeFileSync(STATE, JSON.stringify(state));
console.log(`${DRY ? "[dry] " : ""}${msgs.length} leídos, ${nuevos} nuevos, ${casados} con lead.`);
