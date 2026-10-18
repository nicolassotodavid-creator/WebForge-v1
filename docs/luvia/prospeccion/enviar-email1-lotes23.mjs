// [LUVIA] Envía los email 1 de los lotes 2 y 3 (16-oct) vía send-email, espaciados, y deja log.
// Uso: node docs/luvia/prospeccion/enviar-email1-lotes23.mjs [--solo N] [--pausa segundos]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const root = new URL("../../../", import.meta.url);
const dir = new URL("./", import.meta.url);
const env = Object.fromEntries(readFileSync(new URL(".env", root), "utf8").split("\n").filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const args = process.argv.slice(2);
const solo = args.includes("--solo") ? Number(args[args.indexOf("--solo") + 1]) : Infinity;
const pausa = args.includes("--pausa") ? Number(args[args.indexOf("--pausa") + 1]) : 20;
const ids = ["lote2", "lote3"].flatMap((l) => JSON.parse(readFileSync(new URL(`${l}-borradores-ids-2026-10-16.json`, dir))).map((x) => ({ ...x, lote: l })));
const logUrl = new URL("email1-lotes23-envios-2026-10-18.json", dir);
const log = existsSync(logUrl) ? JSON.parse(readFileSync(logUrl)) : [];
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
console.log(`Hecho: ${log.filter((x) => x.ok).length} OK, ${log.filter((x) => !x.ok).length} con error`);
