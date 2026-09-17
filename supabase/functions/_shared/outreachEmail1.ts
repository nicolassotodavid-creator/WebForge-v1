// outreachEmail1.ts — Piezas DETERMINISTAS del Email 1 [WEBS] (generate-outreach).
// La IA solo redacta la intro (2 párrafos). Saludo, firma, orden (intro → enlace/captura → firma)
// y la honestidad de las citas los fija el sistema aquí, sin depender del modelo.
// Puro y sin Deno/env → testeable con: node --experimental-strip-types outreachEmail1.test.ts

// Firma canónica (docs/email-design/EMAIL1-DISENO-DEFINITIVO.html): va DEBAJO de la captura y CTAs.
export const EMAIL1_SIGNATURE = "Nico\nDiseño webs para negocios locales.";

// Límite de la intro (sin saludo ni firma). El prompt pide ~80; por encima de esto se pide corrección.
export const EMAIL1_MAX_WORDS = 90;

const EMOJI_RE = /[\p{Extended_Pictographic}\p{Regional_Indicator}\u{FE0F}\u{200D}\u{20E3}]/gu;
const SMALL_WORDS = new Set(["y", "de", "del", "la", "las", "el", "los", "en", "e", "a"]);

// Nombre de Google Maps → nombre de negocio presentable.
// "Auto Service Valencia- Servicio de automóviles premium 🇪🇦🇬🇧" → "Auto Service Valencia"
// "TALLERES HUGAL S.L CHAPA Y PINTURA" → "Talleres Hugal" · "Construcciones United | Reformas" → "Construcciones United"
export function cleanBusinessName(name: string | null | undefined): string {
  let n = String(name ?? "").replace(EMOJI_RE, " ").replace(/\s+/g, " ").trim();
  if (!n) return "";
  // Coletillas SEO de Maps: " - Servicio de…", " | Reformas", "Valencia- …", " (…)", " · …"
  n = n.split(/\s*[|·–—(]\s*|\s+-\s*|\s*-\s+/)[0].trim();
  // Forma jurídica y lo que venga detrás ("S.L CHAPA Y PINTURA").
  n = n
    .replace(/[\s,]+S\.\s?L\.?(\s?U\.?)?(?=\s|$).*$/i, "")
    .replace(/[\s,]+S\.\s?A\.?(\s?U\.?)?(?=\s|$).*$/i, "")
    .replace(/[\s,]+S\.?\s?Coop\.?.*$/i, "")
    .replace(/[\s,]+(SL|SLU|SLL|SA|SAU|SC|SCVL|CB|C\.B\.)(?=\s|$).*$/, "")
    .replace(/[\s,.\-]+$/, "")
    .trim();
  // TODO MAYÚSCULAS → Tipo Título (mantiene siglas cortas tipo "JM", "ADM").
  if (n.length > 4 && !/\p{Ll}/u.test(n)) {
    n = n
      .split(" ")
      .map((w, i) => {
        const lw = w.toLocaleLowerCase("es");
        if (i > 0 && SMALL_WORDS.has(lw)) return lw;
        if (w.length <= 3 && /^\p{Lu}+$/u.test(w) && i > 0) return w; // sigla
        return lw.charAt(0).toLocaleUpperCase("es") + lw.slice(1);
      })
      .join(" ");
  }
  return n || String(name ?? "").replace(EMOJI_RE, "").trim();
}

// Saludo fijo del sistema: con persona de contacto, su nombre de pila; si no, "Hola," a secas
// (NUNCA el nombre largo de Maps).
export function greetingLine(contactName: string | null | undefined): string {
  const first = String(contactName ?? "").replace(EMOJI_RE, "").trim().split(/\s+/)[0] ?? "";
  const clean = first.replace(/[^\p{L}'-]/gu, "");
  return clean.length >= 2 ? `Hola ${clean.charAt(0).toLocaleUpperCase("es")}${clean.slice(1)},` : "Hola,";
}

const ES_WORDS = new Set([
  "muy", "que", "el", "la", "los", "las", "con", "por", "para", "de", "y", "en", "me", "nos", "un",
  "una", "es", "son", "todo", "trato", "han", "ha", "mi", "coche", "gracias", "sin", "siempre", "rápido",
]);
const EN_WORDS = new Set(["the", "and", "very", "with", "was", "they", "my", "great", "is", "were", "car", "service"]);
const NEGATIVE_RE =
  /\b(pero|aunque|mal|malo|mala|peor|lástima|lastima|queja|desastre|nunca m[aá]s|no lo recomiendo|no recomiendo|tardaron|caro|cara)\b/i;

type RawReview = { text?: unknown; stars?: unknown; rating?: unknown; textTranslated?: unknown };

// Fragmentos LITERALES cortos de reseñas reales (lead.raw_json.reviews, formato Apify compass) para
// que el Email 1 pueda citar entre comillas algo que un cliente dijo DE VERDAD. Solo elogios de
// 4-5 estrellas, en español, una frase de 4 a 16 palabras, máximo uno por reseña.
export function pickReviewQuotes(rawJson: unknown, max = 2): string[] {
  const reviews = (rawJson && typeof rawJson === "object")
    ? (rawJson as Record<string, unknown>).reviews
    : null;
  if (!Array.isArray(reviews)) return [];
  const scored: { quote: string; stars: number; score: number }[] = [];
  for (const item of reviews as RawReview[]) {
    if (!item || typeof item !== "object") continue;
    const stars = Number(item.stars ?? item.rating ?? 0);
    if (!(stars >= 4)) continue;
    const text = typeof item.text === "string" ? item.text : "";
    if (!text.trim()) continue;
    let best: { quote: string; score: number } | null = null;
    for (const rawSentence of text.split(/(?<=[.!?…])\s+|\n+/)) {
      const s = rawSentence.replace(/\s+/g, " ").trim().replace(/^[¡¿"“«']+|["”»']+$/g, "").trim();
      const sentence = s.replace(/[\s.…!]+$/, "").trim();
      // Frase completa: empieza en mayúscula (descarta trozos partidos por un salto de línea).
      if (!sentence || !/^\p{Lu}/u.test(sentence) || EMOJI_RE.test(sentence)) { EMOJI_RE.lastIndex = 0; continue; }
      EMOJI_RE.lastIndex = 0;
      if (/https?:|www\.|@|["“”«»]/.test(sentence) || NEGATIVE_RE.test(sentence) || VOSOTROS_RE.test(sentence)) continue;
      const words = sentence.split(" ");
      if (words.length < 4 || words.length > 16 || sentence.length > 110) continue;
      const lw = words.map((w) => w.toLocaleLowerCase("es").replace(/[^\p{L}]/gu, ""));
      if (lw.filter((w) => ES_WORDS.has(w)).length < 2 || lw.some((w) => EN_WORDS.has(w))) continue;
      // Preferimos frases de 6-12 palabras (concretas, no un "Muy recomendable" suelto).
      const score = (words.length >= 6 && words.length <= 12 ? 2 : 1) + stars / 10;
      if (!best || score > best.score) best = { quote: sentence, score };
    }
    if (best) scored.push({ quote: best.quote, stars, score: best.score });
  }
  scored.sort((a, b) => b.score - a.score);
  const out: string[] = [];
  for (const s of scored) {
    if (out.length >= max) break;
    if (!out.some((q) => q.toLowerCase() === s.quote.toLowerCase())) out.push(s.quote);
  }
  return out;
}

function norm(s: string): string {
  return s
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const QUOTE_RE = /["“«]([^"”»\n]{1,200})["”»]/g;

// Quita las comillas de cualquier "cita" que NO sea literal de `quotes` (se queda el texto como
// paráfrasis). Así el email nunca pone entre comillas algo que ningún cliente dijo.
export function stripUnverifiedQuotes(text: string, quotes: string[]): { text: string; removed: string[] } {
  const allowed = quotes.map(norm).filter(Boolean);
  const removed: string[] = [];
  const out = text.replace(QUOTE_RE, (full, inner: string) => {
    const n = norm(inner);
    if (n && allowed.some((q) => q.includes(n))) return full;
    removed.push(inner);
    return inner;
  });
  return { text: out, removed };
}

const SIGNOFF_LINE_RE =
  /^(—\s*)?(nico\b.*|diseño webs.*|un saludo.*|saludos.*|un abrazo.*|atentamente.*|gracias.*nico.*)$/i;
const GREETING_RE = /^\s*(hola|buenas(\s+tardes|\s+noches)?|buenos\s+d[ií]as)\b[^,\n.!]*[,.!]?\s*/i;

// Limpia la intro que devuelve la IA: sin saludo ni firma propios (los pone el sistema), sin URLs
// sueltas, sin markdown.
export function cleanIntro(body: string): string {
  let t = body.replace(/\r\n/g, "\n").replace(/\*\*?|__/g, "").trim();
  // Fuera URLs (el sistema añade el enlace).
  t = t.replace(/https?:\/\/\S+/g, "").replace(/[ \t]+\n/g, "\n");
  // Firma / despedida al final (una o varias líneas).
  let lines = t.split("\n");
  while (lines.length && (!lines[lines.length - 1].trim() || SIGNOFF_LINE_RE.test(lines[lines.length - 1].trim()))) {
    lines.pop();
  }
  // Saludo al principio (en su línea o pegado a la primera frase).
  while (lines.length && !lines[0].trim()) lines.shift();
  if (lines.length) {
    const first = lines[0].replace(GREETING_RE, "");
    if (first.trim()) lines[0] = first.charAt(0).toLocaleUpperCase("es") + first.slice(1);
    else lines.shift();
  }
  t = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return t;
}

export function countWords(s: string): number {
  return s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

// "vosotros": os, vuestro/a/s, sois y cualquier forma en -áis/-éis (tenéis, podéis, dudéis…).
const VOSOTROS_RE = /(?<!\p{L})(os|vosotr[oa]s|vuestr[oa]s?|sois|\p{L}+(?:áis|éis))(?!\p{L})/iu;

export interface Email1Facts {
  rating?: number | null;
  review_count?: number | null;
  name?: string | null;
}

// Problemas que justifican pedir UNA corrección al modelo (lo que no se puede arreglar a máquina).
export function email1Issues(intro: string, quotes: string[], facts: Email1Facts = {}): string[] {
  const issues: string[] = [];
  const words = countWords(intro);
  if (words > EMAIL1_MAX_WORDS) issues.push(`tiene ${words} palabras; máximo 80`);
  const paras = intro.split(/\n{2,}/).filter((p) => p.trim()).length;
  if (paras > 2) issues.push(`tiene ${paras} párrafos; máximo 2`);
  const vos = intro.match(VOSOTROS_RE);
  if (vos) issues.push(`mezcla "vosotros" ("${vos[0]}"); tutea siempre de "tú"`);
  const { removed } = stripUnverifiedQuotes(intro, quotes);
  if (removed.length) {
    issues.push(`pone entre comillas texto que no es una cita literal de review_quotes: ${removed.map((r) => `"${r}"`).join(", ")}`);
  }
  if (/\b\d[\d.,]*\s+clientes\b/i.test(intro)) issues.push("convierte reseñas en clientes (N clientes)");
  const years = intro.match(/\b(\d+|m[aá]s de \d+)\s+años\b/i);
  if (years) issues.push(`menciona "${years[0]}" y ese dato no está en los datos`);
  // Cifras que no salen de los datos (se toleran la nota y el nº de reseñas).
  const allowedNums = new Set<string>(["5"]); // "4,9 de 5"
  for (const d of String(facts.name ?? "").match(/\d+/g) ?? []) allowedNums.add(d); // "Garaje 34"
  if (facts.rating != null) {
    allowedNums.add(String(facts.rating));
    allowedNums.add(String(facts.rating).replace(".", ","));
  }
  if (facts.review_count != null) allowedNums.add(String(facts.review_count));
  for (const m of intro.matchAll(/\b\d+(?:[.,]\d+)?\b/g)) {
    if (!allowedNums.has(m[0])) {
      issues.push(`usa la cifra "${m[0]}", que no está en los datos`);
      break;
    }
  }
  return issues;
}

// Cuerpo final del Email 1 (canal email), en el orden del diseño canónico:
//   saludo → intro (IA) → línea-URL (renderEmail la sustituye por captura + CTAs) → firma.
// El pie de WhatsApp lo añade después withWhatsappFooter, como párrafo propio bajo la firma.
export function assembleEmail1Body(opts: {
  intro: string;
  greeting: string;
  link: string;
  quotes: string[];
}): string {
  const intro = stripUnverifiedQuotes(cleanIntro(opts.intro), opts.quotes).text;
  return `${opts.greeting}\n\n${intro}\n\n${opts.link}\n\n${EMAIL1_SIGNATURE}`;
}
