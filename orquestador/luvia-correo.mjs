// luvia-correo — El buzón marketing@luvia-ia.es (Google Workspace, por IMAP) + el embudo de los emails de Luvia.
// Los emails de Luvia salen y se responden en marketing@; poll-replies solo lee hola@nico-soto.es (Zoho),
// así que sin esto las respuestas de las clínicas no llegan al panel.
//
//   node --env-file=.env orquestador/luvia-correo.mjs sync            # avisa a mark-replied de cada correo nuevo
//   node --env-file=.env orquestador/luvia-correo.mjs sync --dry-run  # solo muestra qué avisaría
//   node --env-file=.env orquestador/luvia-correo.mjs leer [N]        # últimos N correos recibidos (def. 15), con texto
//   node --env-file=.env orquestador/luvia-correo.mjs embudo [días]   # por clínica: enviado, aperturas, clics, respuesta (def. 14)
//
// Estado en orquestador/.luvia-correo-state.json (UIDs ya avisados). Primera pasada: desde el 20-sep.
// Env: LUVIA_IMAP_USER (marketing@luvia-ia.es), LUVIA_IMAP_PASSWORD (contraseña de aplicación de Google),
//      SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, INBOUND_REPLY_SECRET, ADMIN_USER_ID.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

const e = process.env;
const [cmd = "sync", arg] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const DRY = process.argv.includes("--dry-run");
const STATE = fileURLToPath(new URL("./.luvia-correo-state.json", import.meta.url));
const BACKFILL = new Date("2026-09-20T00:00:00Z");

function need(...ks) {
  for (const k of ks) if (!e[k]) { console.error(`Falta ${k} en el .env`); process.exit(1); }
}

// ── IMAP ────────────────────────────────────────────────────────────────────────────────────────
async function withInbox(fn) {
  need("LUVIA_IMAP_USER", "LUVIA_IMAP_PASSWORD");
  const client = new ImapFlow({
    host: "imap.gmail.com", port: 993, secure: true, logger: false,
    auth: { user: e.LUVIA_IMAP_USER, pass: e.LUVIA_IMAP_PASSWORD.replace(/\s/g, "") },
  });
  await client.connect();
  const lock = await client.getMailboxLock("INBOX");
  try { return await fn(client); } finally { lock.release(); await client.logout(); }
}

async function fetchSince(client, since) {
  const uids = await client.search({ since }, { uid: true });
  const out = [];
  if (!uids.length) return out;
  for await (const m of client.fetch(uids, { uid: true, envelope: true, source: true }, { uid: true })) {
    const p = await simpleParser(m.source);
    out.push({
      uid: m.uid,
      date: p.date ?? m.envelope.date,
      from: p.from?.value?.[0]?.address ?? "",
      fromName: p.from?.value?.[0]?.name ?? "",
      subject: p.subject ?? "",
      // Sin el hilo citado: lo que el remitente ha escrito.
      text: (p.text ?? "").split(/\n(?:El .{5,80}escribió:|On .{5,80}wrote:|-----Original|>)/)[0].trim(),
    });
  }
  return out.sort((a, b) => a.date - b.date);
}

// ── sync ────────────────────────────────────────────────────────────────────────────────────────
async function sync() {
  need("SUPABASE_URL", "INBOUND_REPLY_SECRET");
  const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : { done: {} };
  const fail = (msg) => {
    console.error(msg);
    state.fails = (state.fails ?? 0) + 1;
    if (state.fails >= 3 && Date.now() - (state.lastAlert ?? 0) > 6 * 3600 * 1000) {
      state.lastAlert = Date.now();
      execFile("osascript", ["-e", `display notification "${msg.replace(/["\\]/g, "")}" with title "luvia-correo: no lee marketing@"`]);
    }
    writeFileSync(STATE, JSON.stringify(state));
    process.exit(1);
  };
  let msgs;
  try { msgs = await withInbox((c) => fetchSince(c, BACKFILL)); } catch (err) { fail(`IMAP: ${err.message}`); }

  let nuevos = 0, casados = 0;
  for (const m of msgs) {
    if (state.done[m.uid]) continue;
    nuevos++;
    if (DRY) { console.log(`[dry] ${m.date.toISOString().slice(0, 16)} ${m.from} — ${m.subject.slice(0, 70)}`); continue; }
    const r = await fetch(`${e.SUPABASE_URL}/functions/v1/mark-replied?token=${encodeURIComponent(e.INBOUND_REPLY_SECRET)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromAddress: m.from, subject: m.subject, snippet: m.text.slice(0, 300) }),
    });
    if (!r.ok) { console.error(`mark-replied ${r.status} para uid ${m.uid}; se reintenta en la próxima pasada`); continue; }
    const j = await r.json();
    state.done[m.uid] = m.date.getTime();
    if (j.matched) { casados++; console.log(`✔ ${m.from} → ${j.leads.map((l) => l.lead).join(", ")}`); }
  }
  state.fails = 0;
  if (!DRY) writeFileSync(STATE, JSON.stringify(state));
  console.log(`${DRY ? "[dry] " : ""}${msgs.length} en el buzón desde ${BACKFILL.toISOString().slice(0, 10)}, ${nuevos} nuevos, ${casados} con lead.`);
}

// ── leer ────────────────────────────────────────────────────────────────────────────────────────
async function leer(n) {
  const msgs = await withInbox((c) => fetchSince(c, new Date(Date.now() - 30 * 86400e3)));
  for (const m of msgs.slice(-n)) {
    console.log(`\n── ${m.date.toISOString().slice(0, 16).replace("T", " ")} · ${m.fromName} <${m.from}>\n   ${m.subject}`);
    console.log(m.text.slice(0, 800).replace(/^/gm, "   "));
  }
}

// ── embudo ──────────────────────────────────────────────────────────────────────────────────────
async function embudo(dias) {
  need("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_USER_ID");
  const h = { apikey: e.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${e.SUPABASE_SERVICE_ROLE_KEY}` };
  const get = async (path) => {
    const r = await fetch(`${e.SUPABASE_URL}/rest/v1/${path}`, { headers: h });
    if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
    return r.json();
  };
  const desde = new Date(Date.now() - dias * 86400e3).toISOString();
  const msgs = await get(`outreach_messages?select=id,lead_id,subject,status,sent_at,email_number,leads!inner(name,owner)` +
    `&channel=eq.email&sent_at=gte.${desde}&leads.owner=neq.${e.ADMIN_USER_ID}&order=sent_at.asc&limit=1000`);
  if (!msgs.length) { console.log(`Sin emails de Luvia enviados en los últimos ${dias} días.`); return; }
  const leadIds = [...new Set(msgs.map((m) => m.lead_id))];
  const evs = [];
  for (let i = 0; i < leadIds.length; i += 100) {
    evs.push(...await get(`events?select=lead_id,type,created_at,payload&created_at=gte.${desde}` +
      `&type=in.(email_opened,link_clicked,replied,email_bounced,unsubscribed)&lead_id=in.(${leadIds.slice(i, i + 100).join(",")})`));
  }
  const by = new Map(leadIds.map((id) => [id, { opens: 0, clicks: [], replied: null, bounced: false, unsub: false, firstOpen: null }]));
  for (const ev of evs) {
    const s = by.get(ev.lead_id);
    if (ev.type === "email_opened") { s.opens++; s.firstOpen ??= ev.created_at; }
    if (ev.type === "link_clicked" && !ev.payload?.automatic) s.clicks.push(ev.payload?.target ?? "?");
    if (ev.type === "replied") s.replied ??= ev.created_at;
    if (ev.type === "email_bounced") s.bounced = true;
    if (ev.type === "unsubscribed") s.unsub = true;
  }
  const fila = new Map();
  for (const m of msgs) fila.set(m.lead_id, m); // último email enviado a cada clínica
  const rows = [...fila.values()].map((m) => ({ m, s: by.get(m.lead_id) }));
  const rank = ({ s }) => (s.replied ? 0 : s.clicks.length ? 1 : s.opens ? 2 : s.bounced ? 4 : 3);
  rows.sort((a, b) => rank(a) - rank(b) || b.s.opens - a.s.opens);
  const t = (iso) => iso ? new Date(iso).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
  for (const { m, s } of rows) {
    const estado = s.replied ? `RESPONDIÓ ${t(s.replied)}` : s.bounced ? "rebotado" : s.unsub ? "baja" : "";
    console.log([
      (m.leads.name ?? "").slice(0, 38).padEnd(38),
      `E${m.email_number ?? 1} ${t(m.sent_at)}`,
      `abre ${String(s.opens).padStart(2)}${s.firstOpen ? ` (1ª ${t(s.firstOpen)})` : "".padEnd(17)}`,
      `clics ${s.clicks.length ? s.clicks.join(",") : "0"}`.padEnd(14),
      estado,
    ].join(" │ "));
  }
  const n = rows.length, c = (f) => rows.filter(({ s }) => f(s)).length;
  console.log(`\n${n} clínicas · abrieron ${c((s) => s.opens)} · clic ${c((s) => s.clicks.length)} · respondieron ${c((s) => s.replied)} · rebotes ${c((s) => s.bounced)} · bajas ${c((s) => s.unsub)}`);
  console.log("Aperturas orientativas: el proxy de Gmail y Apple Mail cargan la imagen sin que nadie lea.");
}

if (cmd === "sync") await sync();
else if (cmd === "leer") await leer(Number(arg) || 15);
else if (cmd === "embudo") await embudo(Number(arg) || 14);
else { console.error("Uso: luvia-correo.mjs sync [--dry-run] | leer [N] | embudo [días]"); process.exit(1); }
