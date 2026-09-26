// [SIMULADOR] Crea o actualiza el agente de voz "Simulador — ventas" en ElevenLabs (cuenta de Luvia, clave
// restringida "simulador" en .env como ELEVENLABS_API_KEY). Idempotente: si agente.json ya tiene agent_id, lo
// actualiza (PATCH); si no, lo crea y guarda el id. El guion vive en prompt.md.
// Uso: node docs/prospeccion/agente-simulador/crear-agente.mjs
//
// El agente se usa desde el widget de la demo (presupuestos.nico-soto.es/demo/<slug>): la conversación la abre
// la propia empresa, así que no hace falta consentimiento previo como en una llamada saliente. Dice que es una IA
// desde la primera frase (AI Act art. 50). Sin auth para que funcione el widget público, pero solo desde el
// dominio de las demos (allowlist) y con el tope de créditos de la clave.
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

// Voz y ajustes de "Luvia Ventas" (ya probados en español). El LLM no se copia: Luvia usa uno propio.
const LLM = process.env.LLM || "claude-haiku-4-5";
const config = {
  name: "Simulador — ventas (demo de presupuestos)",
  conversation_config: {
    agent: {
      language: "es",
      first_message: "Hola, soy el asistente automático de Nico, el que ha preparado este simulador para {{empresa}}. ¿Qué te gustaría saber?",
      dynamic_variables: { dynamic_variable_placeholders: { empresa: "tu empresa" } },
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
    auth: { enable_auth: false, allowlist: [{ hostname: "presupuestos.nico-soto.es" }] },
    // Textos del widget: los atributos del <elevenlabs-convai> (action-text…) no los aplica; van aquí.
    widget: {
      variant: "full", placement: "bottom-right",
      action_text: "¿Dudas o precio?", start_call_text: "Hablar con el asistente", end_call_text: "Colgar",
      text_contents: { main_label: "¿Dudas o precio?", start_call: "Hablar con el asistente", end_call: "Colgar" },
    },
    data_collection: {
      nombre: { type: "string", description: "Nombre de la persona con la que se habla, si lo dice." },
      email: { type: "string", description: "Email donde quiere recibir las solicitudes, tal y como lo confirmó." },
      whatsapp: { type: "string", description: "Número de WhatsApp donde quiere recibir las solicitudes, solo dígitos." },
      interesado: { type: "boolean", description: "true si quiere que Nico se lo monte; false si dijo que no le interesa." },
      objecion: { type: "string", description: "Lo que no le encaja o lo que le frena, con sus palabras. Vacío si no lo dijo." },
    },
    evaluation: {
      criteria: [{
        id: "datos_para_montarlo", name: "Datos para montarlo", type: "prompt",
        conversation_goal_prompt: "Éxito si la persona quiere el simulador y el agente consiguió y confirmó su email y su WhatsApp.",
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
