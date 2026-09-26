// [SIMULADOR] Conecta el asistente de voz con la función simulador-voz-webhook (aviso por email a Nico).
// 1) Crea en ElevenLabs un webhook de workspace "Simulador post-call → WebForge" con firma HMAC.
// 2) Guarda su secreto en Supabase (SIMULADOR_VOZ_WEBHOOK_SECRET) y el destinatario del aviso
//    (SIMULADOR_AVISO_EMAIL), vía Management API con SUPABASE_ACCESS_TOKEN. El secreto no se imprime.
// 3) Pone ese webhook como override SOLO del agente del simulador: el webhook de la cuenta (el de Luvia)
//    sigue igual para los agentes de Luvia.
// Uso: node docs/prospeccion/agente-simulador/conectar-aviso.mjs <email-destino>
// Solo hace falta una vez; si el webhook ya existe, no lo recrea (el secreto no se puede volver a leer).
import fs from "node:fs";
import path from "node:path";

const DIR = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(DIR, "../../..");
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, ".env"), "utf8").split("\n")
  .filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")]));
const DESTINO = process.argv[2];
if (!DESTINO || !DESTINO.includes("@")) throw new Error("Uso: conectar-aviso.mjs <email-destino>");
const REF = "khscikqchvjxyvoaruas";
const NOMBRE = "Simulador post-call → WebForge";
const URL_FN = `https://${REF}.supabase.co/functions/v1/simulador-voz-webhook`;
const EL = { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" };
const ESTADO = path.join(DIR, "agente.json");
const estado = JSON.parse(fs.readFileSync(ESTADO, "utf8"));

const lista = await (await fetch("https://api.elevenlabs.io/v1/workspace/webhooks", { headers: EL })).json();
let webhookId = (lista.webhooks || []).find((w) => w.name === NOMBRE)?.webhook_id;
if (webhookId) {
  console.log(`El webhook ya existía (${webhookId}): no se toca el secreto.`);
} else {
  const r = await fetch("https://api.elevenlabs.io/v1/workspace/webhooks", {
    method: "POST", headers: EL,
    body: JSON.stringify({ settings: { auth_type: "hmac", name: NOMBRE, webhook_url: URL_FN } }),
  });
  const b = await r.json().catch(() => ({}));
  if (!r.ok || !b.webhook_id || !b.webhook_secret) throw new Error(`Crear webhook: HTTP ${r.status} ${JSON.stringify(b).slice(0, 300)}`);
  webhookId = b.webhook_id;
  const s = await fetch(`https://api.supabase.com/v1/projects/${REF}/secrets`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify([
      { name: "SIMULADOR_VOZ_WEBHOOK_SECRET", value: b.webhook_secret },
      { name: "SIMULADOR_AVISO_EMAIL", value: DESTINO },
    ]),
  });
  if (!s.ok) throw new Error(`Secretos de Supabase: HTTP ${s.status} ${(await s.text()).slice(0, 200)}`);
  console.log(`Webhook creado (${webhookId}) y secretos guardados en Supabase.`);
}

const p = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${estado.agent_id}`, {
  method: "PATCH", headers: EL,
  body: JSON.stringify({ platform_settings: { workspace_overrides: { webhooks: { post_call_webhook_id: webhookId, events: ["transcript"], transcript_format: "json", send_audio: false } } } }),
});
if (!p.ok) throw new Error(`Override del agente: HTTP ${p.status} ${(await p.text()).slice(0, 300)}`);
fs.writeFileSync(ESTADO, JSON.stringify({ ...estado, post_call_webhook_id: webhookId }, null, 2) + "\n");
console.log("Agente apuntado a su webhook propio.");
