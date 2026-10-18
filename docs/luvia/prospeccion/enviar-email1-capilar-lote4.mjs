// [LUVIA] Envía los email 1 del lote capilar y del lote 4 de estéticas (18-oct) vía send-email,
// INTERCALADOS (capilar, estética, capilar…) para que los dos salgan a la misma hora y se puedan comparar.
// Espaciados y reanudables, con log. Programado para el lunes 20-oct 08:30 (launchd).
// Uso: node docs/luvia/prospeccion/enviar-email1-capilar-lote4.mjs [--solo N] [--pausa segundos] [--dia AAAA-MM-DD]
//   --dia: solo envía si hoy (hora de Madrid) es ese día; si no, sale sin enviar (evita disparos tardíos).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const root = new URL("../../../", import.meta.url);
const dir = new URL("./", import.meta.url);
const env = Object.fromEntries(readFileSync(new URL(".env", root), "utf8").split("\n").filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const args = process.argv.slice(2);
const solo = args.includes("--solo") ? Number(args[args.indexOf("--solo") + 1]) : Infinity;
const pausa = args.includes("--pausa") ? Number(args[args.indexOf("--pausa") + 1]) : 20;
const dia = args.includes("--dia") ? args[args.indexOf("--dia") + 1] : null;
const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
if (dia && hoy !== dia) {
  console.log(`${new Date().toISOString()} hoy es ${hoy}, no ${dia}: no se envía nada.`);
  process.exit(0);
}
const capilar = JSON.parse(readFileSync(new URL("capilar-borradores-ids-2026-10-18.json", dir))).map((x) => ({ ...x, lote: "capilar" }));
const lote4 = JSON.parse(readFileSync(new URL("lote4-borradores-ids-2026-10-18.json", dir))).map((x) => ({ ...x, lote: "lote4" }));
const ids = [];
for (let i = 0; i < Math.max(capilar.length, lote4.length); i++) {
  if (capilar[i]) ids.push(capilar[i]);
  if (lote4[i]) ids.push(lote4[i]);
}
const logUrl = new URL("email1-capilar-lote4-envios-2026-10-20.json", dir);
const log = existsSync(logUrl) ? JSON.parse(readFileSync(logUrl)) : [];
console.log(`${new Date().toISOString()} empieza: ${ids.length} mensajes (${capilar.length} capilar + ${lote4.length} lote4), pausa ${pausa}s`);
let n = 0;
for (const m of ids) {
  if (n >= solo) break;
  if (log.some((x) => x.id === m.id && x.ok)) continue;
  const r = await fetch(`${env.SUPABASE_URL}/functions/v1/send-email`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, apikey: KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ message_id: m.id }),
  });
  const j = await r.json().catch(() => ({}));
  const ok = r.ok && !j.error;
  log.push({ id: m.id, lead_id: m.lead_id, lote: m.lote, subject: m.subject, ok, resend_id: j.resend_id ?? null, error: ok ? null : (j.error ?? `HTTP ${r.status}`), at: new Date().toISOString() });
  writeFileSync(logUrl, JSON.stringify(log, null, 2));
  console.log(`${ok ? "OK " : "ERR"} ${m.lote} ${m.subject}${ok ? "" : " → " + log.at(-1).error}`);
  n++;
  if (n < solo && n < ids.length) await new Promise((res) => setTimeout(res, pausa * 1000));
}
console.log(`${new Date().toISOString()} hecho: ${log.filter((x) => x.ok).length} OK, ${log.filter((x) => !x.ok).length} con error`);
