// node --experimental-strip-types orquestador/llm.test.ts
import { creativeProvider, llmText } from "./llm.ts";

let failures = 0;
function assert(ok: boolean, msg: string, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${msg}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

const originalFetch = globalThis.fetch;
const originalProvider = process.env.CREATIVE_PROVIDER;
const originalOpenAiKey = process.env.OPENAI_API_KEY;
const originalOpenAiModel = process.env.OPENAI_CREATIVE_MODEL;
const originalAnthropicKey = process.env.ANTHROPIC_API_KEY;

try {
  // El proveedor creativo se decide por entorno y OpenAI nunca debe usar la clave de Anthropic.
  process.env.CREATIVE_PROVIDER = "openai";
  process.env.OPENAI_API_KEY = "test-openai-key";
  process.env.OPENAI_CREATIVE_MODEL = "gpt-5";
  delete process.env.ANTHROPIC_API_KEY;

  let requestUrl = "";
  let requestInit: RequestInit | undefined;
  globalThis.fetch = async (url, init) => {
    requestUrl = String(url);
    requestInit = init;
    return new Response(JSON.stringify({ output_text: "Prompt creativo para Lovable" }), { status: 200 });
  };

  const result = await llmText("Sistema", { negocio: "Prueba" });
  assert(result === "Prompt creativo para Lovable", "OpenAI devuelve el texto creativo");
  assert(requestUrl === "https://api.openai.com/v1/responses", "OpenAI usa Responses API", requestUrl);
  assert(
    requestInit?.headers instanceof Headers
      ? requestInit.headers.get("authorization") === "Bearer test-openai-key"
      : (requestInit?.headers as Record<string, string>)?.authorization === "Bearer test-openai-key",
    "OpenAI usa solo OPENAI_API_KEY",
  );
  const body = JSON.parse(String(requestInit?.body));
  assert(body.model === "gpt-5", "respeta OPENAI_CREATIVE_MODEL", String(body.model));
  assert(body.instructions === "Sistema", "envía el prompt de sistema a OpenAI");

  process.env.CREATIVE_PROVIDER = "anthropic";
  assert(creativeProvider() === "anthropic", "Anthropic sigue siendo el proveedor por defecto configurable");
  process.env.CREATIVE_PROVIDER = "proveedor-invalido";
  let invalidProviderRejected = false;
  try { creativeProvider(); } catch { invalidProviderRejected = true; }
  assert(invalidProviderRejected, "rechaza proveedores creativos desconocidos");
} finally {
  globalThis.fetch = originalFetch;
  if (originalProvider === undefined) delete process.env.CREATIVE_PROVIDER; else process.env.CREATIVE_PROVIDER = originalProvider;
  if (originalOpenAiKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalOpenAiKey;
  if (originalOpenAiModel === undefined) delete process.env.OPENAI_CREATIVE_MODEL; else process.env.OPENAI_CREATIVE_MODEL = originalOpenAiModel;
  if (originalAnthropicKey === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
}

console.log(failures === 0 ? "\nOK — llm.test.ts" : `\nFALLOS: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
