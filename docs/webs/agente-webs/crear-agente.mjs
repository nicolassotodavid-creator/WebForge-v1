// [WEBS] Crea o actualiza el agente de voz "Webs — ventas" en ElevenLabs (misma cuenta y clave que el del
// simulador: ELEVENLABS_API_KEY en .env). Idempotente: si agente.json ya tiene agent_id, lo actualiza (PATCH);
// si no, lo crea y guarda el id. El guion vive en prompt.md.
// Uso: node docs/webs/agente-webs/crear-agente.mjs
//
// Se usa desde el widget de la portada pública (nico-soto.es). Dice que es una IA desde la primera frase
// (AI Act art. 50). Sin auth, pero solo desde nico-soto.es (allowlist + Origin obligatorio) y con límite diario:
// las conversaciones se cobran a la cuenta, así que sin llamadas no hay gasto.
import fs from "node:fs";
import path from "node:path";

const DIR = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(DIR, "../../..");
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, ".env"), "utf8").split("\n")
  .filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")]));
if (!env.ELEVENLABS_API_KEY?.startsWith("sk_")) throw new Error("Falta ELEVENLABS_API_KEY (sk_…) en .env");
const H = { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" };
const ESTADO = path.join(DIR, "agente.json");
const estado = fs.existsSync(ESTADO) ? JSON.parse(fs.readFileSync(ESTADO, "utf8")) : {};

const LLM = process.env.LLM || "claude-haiku-4-5";
const config = {
  name: "Webs — ventas (portada de nico-soto.es)",
  conversation_config: {
    agent: {
      language: "es",
      first_message: "Hola, soy el asistente automático de Nico. Hace webs a medida para negocios locales. ¿Qué te gustaría saber?",
      prompt: {
        prompt: fs.readFileSync(path.join(DIR, "prompt.md"), "utf8"),
        llm: LLM,
        temperature: 0.3,
        built_in_tools: {
          end_call: { type: "system", name: "end_call", description: "", params: { system_tool_type: "end_call" } },
        },
      },
    },
    tts: { model_id: "eleven_v3_conversational", voice_id: "1eHrpOW5l98cxiSRjbzJ", stability: 0.4, speed: 0.95, similarity_boost: 0.8 },
    conversation: { max_duration_seconds: 600 },
  },
  platform_settings: {
    auth: {
      enable_auth: false,
      allowlist: [{ hostname: "nico-soto.es" }, { hostname: "www.nico-soto.es" }],
      require_origin_header: true,
    },
    call_limits: { agent_concurrency_limit: 3, daily_limit: 40, bursting_enabled: false },
    summary_language: "es",
    widget: {
      variant: "full", placement: "bottom-right",
      action_text: "¿Dudas o precio?", start_call_text: "Hablar con el asistente", end_call_text: "Colgar",
      text_contents: { main_label: "¿Dudas o precio?", start_call: "Hablar con el asistente", end_call: "Colgar" },
    },
    data_collection: {
      nombre: { type: "string", description: "Nombre de la persona con la que se habla, si lo dice." },
      negocio: { type: "string", description: "Nombre de su negocio, si lo dice." },
      whatsapp: { type: "string", description: "Número de WhatsApp donde quiere que Nico le escriba, solo dígitos." },
      email: { type: "string", description: "Email, si lo da, tal y como lo confirmó." },
      interesado: { type: "boolean", description: "true si quiere que Nico hable con él; false si dijo que no le interesa." },
      objecion: { type: "string", description: "Lo que no le encaja o lo que le frena, con sus palabras. Vacío si no lo dijo." },
    },
    evaluation: {
      criteria: [{
        id: "datos_para_contactar", name: "Datos para contactar", type: "prompt",
        conversation_goal_prompt: "Éxito si la persona quiere que Nico le escriba y el agente consiguió y confirmó su WhatsApp.",
      }],
    },
  },
};

const url = estado.agent_id
  ? `https://api.elevenlabs.io/v1/convai/agents/${estado.agent_id}`
  : "https://api.elevenlabs.io/v1/convai/agents/create";
const res = await fetch(url, { method: estado.agent_id ? "PATCH" : "POST", headers: H, body: JSON.stringify(config) });
const body = await res.json().catch(() => ({}));
if (!res.ok) { console.error(`HTTP ${res.status}`, JSON.stringify(body).slice(0, 1500)); process.exit(1); }
const agentId = estado.agent_id || body.agent_id;
fs.writeFileSync(ESTADO, JSON.stringify({ agent_id: agentId, llm: LLM, actualizado: new Date().toISOString() }, null, 2) + "\n");
console.log(`${estado.agent_id ? "Actualizado" : "Creado"}: ${agentId} (LLM ${LLM})`);
