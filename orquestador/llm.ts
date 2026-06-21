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

// Llamada base al orquestador. Devuelve el texto del primer bloque de la respuesta.
async function callClaude(
  systemPrompt: string,
  input: unknown,
  maxTokens = 2000,
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
      model: ORQUESTADOR_MODEL,
      max_tokens: maxTokens,
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      messages: [
        { role: "user", content: typeof input === "string" ? input : JSON.stringify(input) },
      ],
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

export { ORQUESTADOR_MODEL };
