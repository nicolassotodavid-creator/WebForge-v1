// Cerebro del Orquestador: redacta el brief (JSON estricto) y el build-prompt (texto).
// Llama a la Anthropic Messages API por fetch (mismo patrón que supabase/functions/analyze-lead),
// con prompt caching en el system. NO conduce Lovable: eso va por el MCP
// (ver lovable.ts), donde la calidad la pone el build-prompt y las llamadas son deterministas.
//
// Modelo: claude-sonnet-4-6 por defecto (build-prompt + briefs complejos).
// Para extracciones a volumen se puede bajar a claude-haiku-4-5-20251001
// sobreescribiendo ORQUESTADOR_MODEL en el .env.

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const ORQUESTADOR_MODEL = process.env.ORQUESTADOR_MODEL ?? "claude-sonnet-4-6";
// Visión para curar fotos: Haiku 4.5 (barato, ~céntimos por web). Independiente de ORQUESTADOR_MODEL.
const VISION_MODEL = "haiku-4-5-20251001";

interface AnthropicResponse {
  content?: { type?: string; text?: string }[];
  error?: { message?: string };
}

// Una reseña real del scraper, normalizada. Conservamos autor y estrellas (no solo el texto)
// para poder pintar un carrusel de reseñas creíble: el build-prompt las transcribe literalmente.
export interface Review {
  author: string | null; // nombre del reseñador, si Google lo expone
  rating: number | null;  // estrellas 1-5, si vienen
  text: string;           // cuerpo de la reseña (siempre presente; las vacías se descartan)
}

// Saca las reseñas reales del raw_json del scraper (formato flexible de compass/crawler-google-places).
// A diferencia de la copia text-only de analyze-lead (que solo puntúa la web), aquí guardamos autor y
// estrellas para alimentar el carrusel de reseñas de la web. Tope 15 (las más recientes primero).
export function extractReviews(raw: unknown): Review[] {
  if (!raw || typeof raw !== "object") return [];
  const r = (raw as Record<string, unknown>).reviews;
  if (!Array.isArray(r)) return [];
  return r
    .map((item): Review => {
      if (typeof item === "string") return { author: null, rating: null, text: item };
      if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        const text = String(o.text ?? o.review ?? o.comment ?? o.snippet ?? "");
        const author = o.name ?? o.author ?? o.reviewerName ?? o.user ?? null;
        const rawRating = o.stars ?? o.rating ?? o.score ?? null;
        const rating = typeof rawRating === "number"
          ? rawRating
          : (rawRating != null && !Number.isNaN(Number(rawRating)) ? Number(rawRating) : null);
        return { author: author != null ? String(author) : null, rating, text };
      }
      return { author: null, rating: null, text: "" };
    })
    .filter((rev) => rev.text.trim().length > 0)
    .slice(0, 15);
}

// Claude debe devolver JSON puro, pero por si acaso quitamos vallas ```json y recortamos al objeto.
export function extractJson<T = Record<string, unknown>>(text: string): T {
  let t = text.trim();
  t = t.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("respuesta de Claude sin JSON válido");
  return JSON.parse(t.slice(start, end + 1)) as T;
}

type AnthropicMessage = { role: "user" | "assistant"; content: unknown };

// Core: manda `messages` con el `system` cacheado. Devuelve el texto del primer bloque.
async function callAnthropic(
  systemPrompt: string,
  messages: AnthropicMessage[],
  maxTokens: number,
  model: string,
): Promise<string> {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    throw new Error(
      "Falta ANTHROPIC_API_KEY en el entorno del Orquestador (raíz .env). " +
        "Es la API key de runtime, NO el plan Max.",
    );
  }
  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      messages,
    }),
  });
  const data = (await res.json()) as AnthropicResponse;
  if (!res.ok) {
    throw new Error(`Claude API devolvió ${res.status}: ${data?.error?.message ?? "error"}`);
  }
  const text = data.content?.find((c) => c.type === "text")?.text ?? data.content?.[0]?.text ?? "";
  if (!text) throw new Error("Claude devolvió una respuesta vacía");
  return text;
}

// Texto → texto (build/brief). Mantiene la firma que ya usan llmJson/llmText.
async function callClaude(systemPrompt: string, input: unknown, maxTokens = 2000): Promise<string> {
  const content = typeof input === "string" ? input : JSON.stringify(input);
  return callAnthropic(systemPrompt, [{ role: "user", content }], maxTokens, ORQUESTADOR_MODEL);
}

// Claude → JSON estricto (brief, outreach). Parsea con try/catch implícito en extractJson.
export async function llmJson<T = Record<string, unknown>>(
  systemPrompt: string,
  input: unknown,
  maxTokens = 2000,
): Promise<T> {
  const text = await callClaude(systemPrompt, input, maxTokens);
  return extractJson<T>(text);
}

// Claude → texto plano (el build-prompt para Lovable). Salida = texto, no JSON.
export async function llmText(
  systemPrompt: string,
  input: unknown,
  maxTokens = 2000,
): Promise<string> {
  const text = await callClaude(systemPrompt, input, maxTokens);
  return text.trim();
}

// Imágenes (por URL) + instrucción → JSON. Usado por la curación de fotos (photos.ts) con Haiku visión.
// Si Claude no puede descargar una URL, la ignora; nosotros degradamos a "sin fotos" aguas arriba.
export async function llmVisionJson<T = Record<string, unknown>>(
  systemPrompt: string,
  imageUrls: string[],
  userText: string,
  maxTokens = 500,
): Promise<T> {
  const content = [
    ...imageUrls.map((url) => ({ type: "image", source: { type: "url", url } })),
    { type: "text", text: userText },
  ];
  const text = await callAnthropic(systemPrompt, [{ role: "user", content }], maxTokens, VISION_MODEL);
  return extractJson<T>(text);
}

export { ORQUESTADOR_MODEL };
