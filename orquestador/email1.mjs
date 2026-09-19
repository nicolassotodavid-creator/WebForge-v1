// Email 1 [WEBS] desde terminal, en dos pasos (lo mismo que los botones de la ficha):
//   node orquestador/email1.mjs borrador <lead_id> [2|3] → genera el borrador (generate-outreach) y lo imprime;
//                                                        sin número = Email 1, con 2/3 = recordatorios
//   node orquestador/email1.mjs enviar <message_id>   → lo envía (send-email; mantiene el gate de web aprobada)
// Usa SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY del .env de la raíz.
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: KEY } = env;
const [cmd, id, num = "1"] = process.argv.slice(2);
if (!["borrador", "enviar"].includes(cmd) || !id || !["1", "2", "3"].includes(num)) {
  console.error("Uso: node orquestador/email1.mjs borrador <lead_id> [1|2|3] | enviar <message_id>");
  process.exit(1);
}

const call = async (fn, body) => {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, apikey: KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok || json.error) {
    console.error(`${fn} → HTTP ${r.status}: ${json.error ?? JSON.stringify(json)}`);
    process.exit(1);
  }
  return json;
};

if (cmd === "borrador") {
  const { message } = await call("generate-outreach", { lead_id: id, email_number: Number(num) });
  console.log(`message_id: ${message.id}\nAsunto: ${message.subject}\n\n${message.body}`);
} else {
  const res = await call("send-email", { message_id: id });
  console.log(`Enviado. resend_id: ${res.resend_id}`);
}
