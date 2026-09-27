// [FINCAS] Crea o actualiza el asistente de recepción "Administraciones Turia" (demo para administradores de
// fincas) en ElevenLabs (cuenta de Luvia, clave de .env ELEVENLABS_API_KEY). Idempotente: lo creado se guarda en
// agente.json y en la siguiente ejecución se actualiza en vez de duplicarse. El guion vive en prompt.md.
//
// Qué monta:
//  1. Un token para las herramientas: secreto en ElevenLabs (cabecera x-fincas-token) y FINCAS_TOOL_TOKEN en
//     Supabase. Nunca se imprime.
//  2. Dos herramientas webhook contra la función fincas-voz: avisar_guardia (/urgencia) y registrar_incidencia
//     (/incidencia). El móvil de guardia y el email del gestor NO los dice el LLM: salen de las variables que la
//     landing pasa al widget (guardia_movil, gestor_email).
//  3. El agente, con esas herramientas + end_call.
//  4. Webhook post-llamada propio (HMAC) → fincas-voz/post-call, como override solo de este agente (el webhook de
//     la cuenta, el de Luvia, no cambia). Guarda FINCAS_VOZ_WEBHOOK_SECRET, FINCAS_AGENT_ID y FINCAS_COPIA_EMAIL.
//
// Uso: node docs/fincas/agente-fincas/crear-agente.mjs <email-copia> [dominio-landing,otro-dominio]
//   <email-copia>: recibe copia de cada aviso y resumen (Nico), además del email del gestor que prueba la demo.
//   dominios: allowlist del widget. Sin dominios, el widget funciona desde cualquier web (solo para probar).
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DIR = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(DIR, "../../..");
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, ".env"), "utf8").split("\n")
  .filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")]));
if (!env.ELEVENLABS_API_KEY?.startsWith("sk_")) throw new Error("Falta ELEVENLABS_API_KEY (sk_…) en .env");
const COPIA = process.argv[2];
if (!COPIA?.includes("@")) throw new Error("Uso: crear-agente.mjs <email-copia> [dominios]");
const DOMINIOS = (process.argv[3] || "").split(",").map((d) => d.trim()).filter(Boolean);

const REF = "khscikqchvjxyvoaruas";
const FN = `https://${REF}.supabase.co/functions/v1/fincas-voz`;
const EL = { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" };
const ESTADO = path.join(DIR, "agente.json");
const estado = fs.existsSync(ESTADO) ? JSON.parse(fs.readFileSync(ESTADO, "utf8")) : {};
const guardar = () => fs.writeFileSync(ESTADO, JSON.stringify({ ...estado, actualizado: new Date().toISOString() }, null, 2) + "\n");

async function el(metodo, ruta, body) {
  const r = await fetch(`https://api.elevenlabs.io${ruta}`, { method: metodo, headers: EL, body: body ? JSON.stringify(body) : undefined });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${metodo} ${ruta}: HTTP ${r.status} ${JSON.stringify(b).slice(0, 800)}`);
  return b;
}

async function secretosSupabase(lista) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/secrets`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(lista),
  });
  if (!r.ok) throw new Error(`Secretos de Supabase: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
}

// 1) Token de las herramientas (una sola vez: el secreto de ElevenLabs no se puede volver a leer).
if (!estado.tool_secret_id) {
  const token = crypto.randomBytes(32).toString("hex");
  const s = await el("POST", "/v1/convai/secrets", { type: "new", name: "fincas_tool_token", value: token });
  await secretosSupabase([{ name: "FINCAS_TOOL_TOKEN", value: token }]);
  estado.tool_secret_id = s.secret_id;
  guardar();
  console.log("Token de herramientas creado y guardado en ElevenLabs y Supabase.");
}

// 2) Herramientas.
const dyn = (v) => ({ type: "string", dynamic_variable: v });
const str = (description) => ({ type: "string", description });
const comunes = {
  conversation_id: dyn("system__conversation_id"),
  gestor_email: dyn("gestor_email"),
  guardia_movil: dyn("guardia_movil"),
  idioma: { type: "string", description: "Idioma en que habla el vecino: 'es' (castellano) o 'va' (valenciano).", enum: ["es", "va"] },
};
const CATEGORIAS = ["agua", "ascensor_atrapados", "gas", "sin_luz", "acceso_abierto", "riesgo_personas", "otra"];
const herramientas = {
  avisar_guardia: {
    ruta: "urgencia",
    description: "Avisa YA al responsable de guardia de una URGENCIA (SMS y email) y crea la incidencia. Úsala en cuanto sepas la dirección y qué pasa, sin esperar al nombre ni al teléfono. Solo una vez por llamada. Devuelve la referencia y si el aviso ha salido (avisado).",
    properties: {
      direccion: str("Dirección de la comunidad: calle y número, tal como la ha dicho el vecino."),
      comunidad_gestionada: { type: "boolean", description: "true si la dirección está en la lista de comunidades que gestionamos; false si no." },
      ubicacion: str("Piso y puerta, o la zona común (portal, ascensor, garaje, azotea, escalera). Vacío si aún no se sabe."),
      descripcion: str("Qué pasa, en una o dos frases, con las palabras del vecino."),
      categoria: { type: "string", description: "Tipo de urgencia.", enum: CATEGORIAS },
      nombre: str("Nombre del vecino, si ya lo ha dicho."),
      telefono: str("Teléfono de contacto confirmado, solo cifras, si ya lo tienes."),
      ...comunes,
    },
    required: ["direccion", "descripcion", "categoria", "comunidad_gestionada"],
  },
  registrar_incidencia: {
    ruta: "incidencia",
    description: "Registra la incidencia (o la llamada de alguien que no es vecino) y devuelve la referencia real que hay que leer al llamante, la hora de España y si estamos en horario de oficina. Si antes usaste avisar_guardia, pasa su referencia para completar la misma incidencia.",
    properties: {
      referencia: str("Referencia que devolvió avisar_guardia en esta llamada (p. ej. INC-1003). Vacío si no hubo aviso de guardia."),
      tipo_llamada: { type: "string", description: "'vecino' si llama un vecino; 'no_vecino' si es un proveedor, un banco, alguien que quiere contratar la administración u otro.", enum: ["vecino", "no_vecino"] },
      direccion: str("Dirección de la comunidad (calle y número). Vacío si es un no vecino sin comunidad."),
      comunidad_gestionada: { type: "boolean", description: "true si la dirección está en la lista de comunidades que gestionamos; false si no o si no hay dirección." },
      ubicacion: str("Piso y puerta, o la zona común (portal, ascensor, garaje, azotea, escalera)."),
      descripcion: str("Qué pasa, con las palabras del vecino. Para dudas de cuotas, juntas o documentos, la duda."),
      urgente: { type: "boolean", description: "true si es una urgencia según el guion." },
      categoria_urgencia: { type: "string", description: "Tipo de urgencia, solo si urgente es true.", enum: CATEGORIAS },
      nombre: str("Nombre de quien llama, tal como lo ha dicho. Nunca 'Por confirmar': si aún no lo tienes, pídelo antes de usar la herramienta. 'no_facilitado' solo si se niega a darlo."),
      telefono: str("Teléfono de contacto confirmado en voz alta, solo cifras. Nunca 'Por confirmar': si aún no lo tienes, pídelo antes de usar la herramienta. 'no_facilitado' solo si se niega a darlo."),
      empresa: str("Empresa, solo si es un no vecino y la ha dicho."),
      motivo: str("Motivo de la llamada, solo si es un no vecino."),
      ...comunes,
    },
    required: ["tipo_llamada", "nombre", "telefono"],
  },
};
estado.tool_ids ??= {};
for (const [nombre, h] of Object.entries(herramientas)) {
  const tool_config = {
    type: "webhook",
    name: nombre,
    description: h.description,
    response_timeout_secs: 20,
    api_schema: {
      url: `${FN}/${h.ruta}`,
      method: "POST",
      request_headers: { "x-fincas-token": { secret_id: estado.tool_secret_id } },
      request_body_schema: { type: "object", description: "Datos de la incidencia", properties: h.properties, required: h.required },
    },
  };
  if (estado.tool_ids[nombre]) {
    await el("PATCH", `/v1/convai/tools/${estado.tool_ids[nombre]}`, { tool_config });
  } else {
    estado.tool_ids[nombre] = (await el("POST", "/v1/convai/tools", { tool_config })).id;
    guardar();
  }
  console.log(`Herramienta ${nombre}: ${estado.tool_ids[nombre]}`);
}

// 3) Agente. Voz y ajustes de los agentes del simulador y de webs (ya probados en español).
const LLM = process.env.LLM || "claude-haiku-4-5";
const config = {
  name: "Fincas — recepción (demo Administraciones Turia)",
  conversation_config: {
    agent: {
      language: "es",
      first_message: "Hola, has llamado a Administraciones Turia. Soy el asistente automático de recepción y esta llamada se graba para gestionar tu aviso. ¿En qué te ayudo?",
      dynamic_variables: { dynamic_variable_placeholders: { gestor_email: "", guardia_movil: "", telefono_entrante: "desconocido" } },
      prompt: {
        prompt: fs.readFileSync(path.join(DIR, "prompt.md"), "utf8"),
        llm: LLM,
        temperature: 0.2,
        tool_ids: Object.values(estado.tool_ids),
        built_in_tools: {
          end_call: { type: "system", name: "end_call", description: "", params: { system_tool_type: "end_call" } },
        },
      },
    },
    tts: { model_id: "eleven_v3_conversational", voice_id: "1eHrpOW5l98cxiSRjbzJ", stability: 0.4, speed: 0.95, similarity_boost: 0.8 },
    conversation: { max_duration_seconds: 600 },
  },
  platform_settings: {
    // Con dominios: solo desde la landing, y sin cabecera Origin no entra (lección del simulador, 26-sep).
    auth: DOMINIOS.length
      ? { enable_auth: false, allowlist: DOMINIOS.map((hostname) => ({ hostname })), require_origin_header: true }
      : { enable_auth: false, allowlist: [] },
    call_limits: { agent_concurrency_limit: 5, daily_limit: 60, bursting_enabled: false },
    summary_language: "es",
    widget: {
      variant: "full", placement: "bottom-right",
      action_text: "Llama a recepción", start_call_text: "Llamar", end_call_text: "Colgar",
      text_contents: { main_label: "Recepción de Administraciones Turia", start_call: "Llamar", end_call: "Colgar" },
    },
    ...(estado.post_call_webhook_id ? { workspace_overrides: { webhooks: {
      post_call_webhook_id: estado.post_call_webhook_id, events: ["transcript"], transcript_format: "json", send_audio: false,
    } } } : {}),
    evaluation: {
      criteria: [{
        id: "incidencia_completa", name: "Incidencia completa", type: "prompt",
        conversation_goal_prompt: "Éxito si el agente registró la llamada con registrar_incidencia (dirección, qué pasa, nombre y teléfono confirmado, o nombre, motivo y teléfono si no es vecino) y leyó la referencia que devolvió la herramienta. En una urgencia, además, usó avisar_guardia antes de pedir el resto de datos.",
      }],
    },
  },
};
if (estado.agent_id) await el("PATCH", `/v1/convai/agents/${estado.agent_id}`, config);
else { estado.agent_id = (await el("POST", "/v1/convai/agents/create", config)).agent_id; guardar(); }
console.log(`Agente: ${estado.agent_id} (LLM ${LLM})`);

// 4) Webhook post-llamada propio.
const NOMBRE_WH = "Fincas post-call → WebForge";
if (!estado.post_call_webhook_id) {
  const lista = await el("GET", "/v1/workspace/webhooks");
  const existente = (lista.webhooks || []).find((w) => w.name === NOMBRE_WH)?.webhook_id;
  if (existente) {
    estado.post_call_webhook_id = existente;
    console.log(`El webhook ya existía (${existente}): no se toca su secreto.`);
  } else {
    const w = await el("POST", "/v1/workspace/webhooks", { settings: { auth_type: "hmac", name: NOMBRE_WH, webhook_url: `${FN}/post-call` } });
    if (!w.webhook_id || !w.webhook_secret) throw new Error("ElevenLabs no devolvió el secreto del webhook");
    await secretosSupabase([{ name: "FINCAS_VOZ_WEBHOOK_SECRET", value: w.webhook_secret }]);
    estado.post_call_webhook_id = w.webhook_id;
    console.log(`Webhook post-llamada creado (${w.webhook_id}).`);
  }
  await el("PATCH", `/v1/convai/agents/${estado.agent_id}`, { platform_settings: { workspace_overrides: { webhooks: {
    post_call_webhook_id: estado.post_call_webhook_id, events: ["transcript"], transcript_format: "json", send_audio: false,
  } } } });
}
await secretosSupabase([{ name: "FINCAS_AGENT_ID", value: estado.agent_id }, { name: "FINCAS_COPIA_EMAIL", value: COPIA }]);
estado.llm = LLM;
estado.dominios = DOMINIOS;
guardar();
console.log("Listo.");
