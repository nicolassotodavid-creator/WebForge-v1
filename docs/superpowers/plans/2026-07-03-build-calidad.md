# Build de calidad (design-system + fotos reales) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que las webs que el Orquestador construye en Lovable parezcan diseñadas (no "plantilla de IA"): fijar la gramática de diseño en una constante e inyectar fotos reales del negocio, curadas por visión, con fallback a web sin-fotos.

**Architecture:** El prompt final a Lovable = `[parte variable que escribe Sonnet]` + `[manifiesto de fotos determinista]` + `[constante DESIGN_SYSTEM]`. Las fotos se traen en una "pasada 2" en el build (solo el lead aprobado paga el detalle), se curan con Claude visión (Haiku) quedándose solo con las buenas/relevantes/seguras, y se re-hospedan al bucket. Si ninguna convence, la web va sin fotos.

**Tech Stack:** Node + tsx (orquestador), TypeScript, Anthropic Messages API (visión), Apify (`compass/crawler-google-places`), Supabase Storage. Tests puros con `node --experimental-strip-types`; la cola de red se verifica con `npm run typecheck` + `npm run dry-run`.

## Global Constraints

- Todo el contenido generado en **español**.
- Secrets solo en servidor (`ANTHROPIC_API_KEY`, `APIFY_TOKEN`, service key). Nunca en el frontend.
- Las fotos son *nice-to-have*: **nunca** bloquean ni rompen el build. En la duda, sin foto (jamás stock ni foto sin sentido).
- Modelo de visión: **Haiku 4.5** (`haiku-4-5-20251001`). NO toca `ORQUESTADOR_MODEL` (build/brief = Sonnet).
- NO tocar el carrusel de reseñas (6-8 reales, transcritas literales) ni el CTA + badge flotante de 397€ a booking: son contrato y funcionan.
- Alcance: solo builds **nuevos**. No re-generar webs ya enviadas.
- El orquestador no tiene framework de tests: la lógica pura se prueba con `node --experimental-strip-types <file>.test.ts` (patrón de `supabase/functions/_shared/*.test.ts`); la cola de red se cubre con `npm run typecheck` + `npm run dry-run`.

---

### Task 1: Helpers puros de fotos (`photos.ts`) + tests

**Files:**
- Create: `orquestador/photos.ts`
- Test: `orquestador/photos.test.ts`

**Interfaces:**
- Produces:
  - `extractPhotoCandidates(raw: unknown): string[]` — URLs candidatas del `raw_json` (portada + galería), únicas, http(s), máx 15.
  - `parseCurationResponse(text: string, n: number): number[]` — índices válidos [0,n) que devuelve la visión, en orden (hero primero), deduplicados, máx 6.
  - `photoManifest(photos: { hero: string | null; gallery: string[] }): string` — bloque de texto determinista para el prompt de Lovable.
  - `interface CuratedPhotos { hero: string | null; gallery: string[] }`

- [ ] **Step 1: Write the failing test**

Create `orquestador/photos.test.ts`:

```ts
// node --experimental-strip-types orquestador/photos.test.ts
import { extractPhotoCandidates, parseCurationResponse, photoManifest } from "./photos.ts";

let failures = 0;
function assertEq(actual: unknown, expected: unknown, msg: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  const ok = a === e;
  console.log(`${ok ? "✓" : "✗"} ${msg}  (got ${a}, want ${e})`);
  if (!ok) failures++;
}

// extractPhotoCandidates
assertEq(extractPhotoCandidates(null), [], "raw null → []");
assertEq(extractPhotoCandidates({}), [], "raw sin fotos → []");
assertEq(
  extractPhotoCandidates({ imageUrl: "https://a/cover.jpg" }),
  ["https://a/cover.jpg"],
  "solo imageUrl (portada)",
);
assertEq(
  extractPhotoCandidates({
    imageUrl: "https://a/cover.jpg",
    imageUrls: ["https://a/cover.jpg", "https://a/2.jpg", { imageUrl: "https://a/3.jpg" }, { url: "https://a/4.jpg" }],
  }),
  ["https://a/cover.jpg", "https://a/2.jpg", "https://a/3.jpg", "https://a/4.jpg"],
  "portada + galería (strings y objetos), dedupe de la portada",
);
assertEq(
  extractPhotoCandidates({ imageUrls: ["ftp://x", "not-a-url", "https://ok/1.jpg"] }),
  ["https://ok/1.jpg"],
  "descarta no-http(s)",
);
assertEq(
  extractPhotoCandidates({ imageUrls: Array.from({ length: 20 }, (_, i) => `https://a/${i}.jpg`) }).length,
  15,
  "tope 15",
);

// parseCurationResponse
assertEq(parseCurationResponse('{"order":[3,0,7]}', 10), [3, 0, 7], "índices válidos en orden");
assertEq(parseCurationResponse('```json\n{"order":[1,1,2]}\n```', 10), [1, 2], "dedupe y quita vallas ```");
assertEq(parseCurationResponse('{"order":[0,5,99,-1]}', 6), [0, 5], "descarta fuera de rango");
assertEq(parseCurationResponse('{"order":[]}', 10), [], "vacío = sin fotos");
assertEq(parseCurationResponse("no soy json", 10), [], "no-JSON → [] (nunca lanza)");
assertEq(parseCurationResponse('{"order":[0,1,2,3,4,5,6,7]}', 10), [0, 1, 2, 3, 4, 5], "tope 6");

// photoManifest
assertEq(
  photoManifest({ hero: null, gallery: [] }).includes("No hay fotos"),
  true,
  "sin fotos → instrucción tipográfica",
);
{
  const m = photoManifest({ hero: "https://h/hero.jpg", gallery: ["https://g/1.jpg", "https://g/2.jpg"] });
  assertEq(m.includes("https://h/hero.jpg") && m.includes("https://g/1.jpg") && m.includes("https://g/2.jpg"), true, "con fotos → incluye todas las URLs");
  assertEq(m.includes("hero"), true, "con fotos → marca el hero");
}

console.log(failures === 0 ? "\nOK" : `\n${failures} FALLO(S)`);
if (failures > 0) process.exit(1);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types orquestador/photos.test.ts`
Expected: FAIL — `Cannot find module './photos.ts'` (aún no existe).

- [ ] **Step 3: Write minimal implementation**

Create `orquestador/photos.ts` (solo los helpers puros por ahora; `curatePhotos` llega en la Task 5):

```ts
// Curación de fotos reales del negocio para el build en Lovable.
// Helpers PUROS (extractPhotoCandidates, parseCurationResponse, photoManifest) + la cola de red
// (curatePhotos, Task 5). Mismo patrón que llm.ts: lógica pura y llamada de red en un módulo.

export interface CuratedPhotos {
  hero: string | null;
  gallery: string[];
}

const MAX_CANDIDATES = 15;
const MAX_WINNERS = 6;

function isHttpUrl(v: unknown): v is string {
  return typeof v === "string" && /^https?:\/\//i.test(v.trim());
}

// URLs candidatas del raw_json del scraper: portada (imageUrl) + galería (imageUrls, strings u objetos).
// Únicas, en orden, solo http(s), tope 15. No inventa nada; vacío si no hay.
export function extractPhotoCandidates(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return [];
  const r = raw as Record<string, unknown>;
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (v: unknown) => {
    let url: string | null = null;
    if (isHttpUrl(v)) url = v.trim();
    else if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      const cand = o.imageUrl ?? o.url ?? o.src;
      if (isHttpUrl(cand)) url = cand.trim();
    }
    if (url && !seen.has(url)) {
      seen.add(url);
      out.push(url);
    }
  };
  push(r.imageUrl);
  if (Array.isArray(r.imageUrls)) for (const item of r.imageUrls) push(item);
  return out.slice(0, MAX_CANDIDATES);
}

// Quita vallas ```json y recorta al objeto (mismo criterio que extractJson de llm.ts). Nunca lanza.
function looseJson(text: string): Record<string, unknown> | null {
  try {
    let t = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    return JSON.parse(t.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// La respuesta de la visión: { "order": [índices de candidatas, hero primero] }. Devuelve índices
// válidos [0,n), deduplicados, en orden, tope 6. Cualquier basura → [] (sesgo conservador).
export function parseCurationResponse(text: string, n: number): number[] {
  const obj = looseJson(text);
  const order = obj?.order;
  if (!Array.isArray(order)) return [];
  const out: number[] = [];
  const seen = new Set<number>();
  for (const v of order) {
    const i = typeof v === "number" ? v : Number(v);
    if (Number.isInteger(i) && i >= 0 && i < n && !seen.has(i)) {
      seen.add(i);
      out.push(i);
      if (out.length >= MAX_WINNERS) break;
    }
  }
  return out;
}

// Bloque determinista que run.ts añade al prompt de Lovable según el resultado de la curación.
export function photoManifest(photos: CuratedPhotos): string {
  if (!photos.hero && photos.gallery.length === 0) {
    return [
      "FOTOS: no hay fotos disponibles de este negocio.",
      "NO uses fotos de stock ni imágenes de relleno. Construye un diseño tipográfico limpio:",
      "hero de texto, iconos para los servicios, y apóyate en el carrusel de reseñas como prueba social.",
    ].join(" ");
  }
  const lines = ["FOTOS: usa EXCLUSIVAMENTE estas fotos reales del negocio (no añadas stock)."];
  if (photos.hero) lines.push(`Hero (foto principal): ${photos.hero}`);
  if (photos.gallery.length) lines.push(`Galería: ${photos.gallery.join(", ")}`);
  lines.push("Son fotos reales; respétalas, no las deformes ni recortes las caras.");
  return lines.join(" ");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types orquestador/photos.test.ts`
Expected: PASS — todas las líneas `✓`, termina en `OK`.

- [ ] **Step 5: Commit**

```bash
git add orquestador/photos.ts orquestador/photos.test.ts
git commit -m "feat(orquestador): helpers puros de curación de fotos (extract/parse/manifest)"
```

---

### Task 2: Re-host genérico a bucket (`preview.ts`)

**Files:**
- Modify: `orquestador/preview.ts`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `rehostToBucket(supabase: SupabaseClient, bucket: string, pathNoExt: string, url?: string): Promise<string | null>` — descarga `url`, la sube a `bucket/pathNoExt.<ext>` y devuelve la URL pública; `null` en cualquier fallo (NO cae a la URL original: para fotos, mejor descartar que servir una URL de Google que puede romperse).
- `rehostScreenshot(...)` mantiene su firma y su comportamiento (cae a la URL de Lovable si el re-host falla), pero ahora delega en `rehostToBucket`.

- [ ] **Step 1: Extraer el core genérico**

Reemplaza el cuerpo de `orquestador/preview.ts` (deja `PREVIEW_BUCKET` y el import) por:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export const PREVIEW_BUCKET = "site-previews";

// Descarga una imagen y la re-sube a Supabase Storage. Devuelve la URL pública, o null si algo falla.
// NUNCA lanza. No cae a la URL original a propósito: el caller decide el fallback.
export async function rehostToBucket(
  supabase: SupabaseClient,
  bucket: string,
  pathNoExt: string,
  url?: string,
): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`  ⚠ imagen HTTP ${res.status} (${url.slice(0, 60)}…) — no re-hospedada`);
      return null;
    }
    const contentType = res.headers.get("content-type") ?? "image/png";
    const ext = contentType.includes("webp") ? "webp"
      : (contentType.includes("jpeg") || contentType.includes("jpg")) ? "jpg"
      : "png";
    const bytes = new Uint8Array(await res.arrayBuffer());
    const path = `${pathNoExt}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(bucket)
      .upload(path, bytes, { contentType, upsert: true, cacheControl: "86400" });
    if (upErr) {
      console.warn(`  ⚠ no se pudo subir ${path} a Storage: ${upErr.message}`);
      return null;
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  } catch (e) {
    console.warn(`  ⚠ error re-hospedando ${url.slice(0, 60)}…: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

// Re-hospeda la captura del build de Lovable. Mantiene el comportamiento previo: si el re-host falla,
// cae a la URL original de Lovable (mejor algo que nada); null solo si no hay captura.
export async function rehostScreenshot(
  supabase: SupabaseClient,
  leadId: string,
  screenshotUrl?: string,
): Promise<string | null> {
  if (!screenshotUrl) return null;
  const rehosted = await rehostToBucket(supabase, PREVIEW_BUCKET, leadId, screenshotUrl);
  return rehosted ?? screenshotUrl;
}
```

- [ ] **Step 2: Verificar que compila y que el backfill sigue cuadrando**

Run: `cd orquestador && npm run typecheck`
Expected: sin errores. `rehostScreenshot` conserva firma → `run.ts` y `backfill-previews.ts` compilan igual.

- [ ] **Step 3: Commit**

```bash
git add orquestador/preview.ts
git commit -m "refactor(orquestador): rehostToBucket genérico; rehostScreenshot delega en él"
```

---

### Task 3: Helper de visión en `llm.ts`

**Files:**
- Modify: `orquestador/llm.ts`

**Interfaces:**
- Produces: `llmVisionJson<T>(systemPrompt: string, imageUrls: string[], userText: string, maxTokens?: number): Promise<T>` — manda las imágenes (por URL) + un texto a Claude visión (Haiku) y parsea la respuesta como JSON.
- Refactor interno: `callAnthropic(system, messages, maxTokens, model)` como core; `callClaude` pasa a usarlo.

- [ ] **Step 1: Refactor del core + añadir el helper de visión**

En `orquestador/llm.ts`:

(a) Añade la constante del modelo de visión bajo `ORQUESTADOR_MODEL`:

```ts
// Visión para curar fotos: Haiku 4.5 (barato, ~céntimos por web). Independiente de ORQUESTADOR_MODEL.
const VISION_MODEL = "haiku-4-5-20251001";
```

(b) Sustituye `callClaude` por un core reutilizable + wrapper. Reemplaza la función `callClaude` por:

```ts
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
```

(c) Añade el helper de visión al final del archivo (antes del `export { ORQUESTADOR_MODEL }`):

```ts
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
```

- [ ] **Step 2: Verificar que compila**

Run: `cd orquestador && npm run typecheck`
Expected: sin errores. `llmJson`/`llmText` siguen funcionando (usan `callClaude`, misma firma).

- [ ] **Step 3: Commit**

```bash
git add orquestador/llm.ts
git commit -m "feat(orquestador): llmVisionJson (Haiku visión) + core callAnthropic reutilizable"
```

---

### Task 4: Traer fotos en pasada 2 (`reviews.ts`)

**Files:**
- Modify: `orquestador/reviews.ts`

**Interfaces:**
- Consumes: `placeIdFromLead` (ya en `reviews.ts`), `APIFY_SYNC`/`apifyToken()` (ya en `reviews.ts`).
- Produces: `fetchPhotosForPlace(placeId: string, opts?: { maxImages?: number }): Promise<string[]>` — llamada dirigida al actor para UNA ficha con `scrapePlaceDetailPage: true` + `maxImages`, devuelve las URLs de foto (`imageUrls` + `imageUrl` de portada). `[]` si no hay o si el actor no las trae.

- [ ] **Step 1: Añadir `fetchPhotosForPlace`**

Al final de `orquestador/reviews.ts` (mismo patrón que `fetchReviewsForPlace`; reutiliza `APIFY_SYNC` y `apifyToken`):

```ts
// Pasada 2 de FOTOS: la prospección corre con scrapePlaceDetailPage:false (barato) y ahí no hay
// galería. Aquí, solo para el lead APROBADO, pagamos el detalle de UNA ficha para traer sus fotos.
// maxReviews:0 → no re-pagamos reseñas (ya vienen por su propia pasada 2).
export async function fetchPhotosForPlace(
  placeId: string,
  opts: { maxImages?: number } = {},
): Promise<string[]> {
  const maxImages = opts.maxImages ?? 10;
  const input = {
    placeIds: [placeId],
    maxReviews: 0,
    maxImages,
    scrapePlaceDetailPage: true,
    maxCrawledPlacesPerSearch: 1,
    language: "es",
  };
  const res = await fetch(`${APIFY_SYNC}?token=${apifyToken()}&timeout=120`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Apify devolvió ${res.status} al traer fotos: ${txt.slice(0, 200)}`);
  }
  const items = (await res.json()) as unknown;
  if (!Array.isArray(items) || items.length === 0) return [];
  const item = items[0] as Record<string, unknown>;
  const urls: string[] = [];
  const seen = new Set<string>();
  const add = (v: unknown) => {
    let u: string | null = null;
    if (typeof v === "string" && /^https?:\/\//i.test(v)) u = v;
    else if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      const c = o.imageUrl ?? o.url;
      if (typeof c === "string" && /^https?:\/\//i.test(c)) u = c;
    }
    if (u && !seen.has(u)) { seen.add(u); urls.push(u); }
  };
  add(item.imageUrl);
  if (Array.isArray(item.imageUrls)) for (const x of item.imageUrls) add(x);
  return urls;
}
```

- [ ] **Step 2: Verificar que compila**

Run: `cd orquestador && npm run typecheck`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add orquestador/reviews.ts
git commit -m "feat(orquestador): fetchPhotosForPlace (pasada 2 de fotos en el build)"
```

---

### Task 5: `curatePhotos` — la cola de red (`photos.ts`)

**Files:**
- Modify: `orquestador/photos.ts`

**Interfaces:**
- Consumes: `parseCurationResponse`, `extractPhotoCandidates` (Task 1); `llmVisionJson` (Task 3); `rehostToBucket`, `PREVIEW_BUCKET` (Task 2).
- Produces: `curatePhotos(supabase: SupabaseClient, leadId: string, candidates: string[], ctx: { name: string; category?: string | null; city?: string | null }): Promise<CuratedPhotos>` — visión → ganadoras → re-host; `{ hero: null, gallery: [] }` si nada convence o ante cualquier fallo. NUNCA lanza.

- [ ] **Step 1: Añadir imports y `curatePhotos` a `photos.ts`**

Al principio de `orquestador/photos.ts`, añade los imports:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { llmVisionJson } from "./llm.ts";
import { rehostToBucket, PREVIEW_BUCKET } from "./preview.ts";
```

Al final del archivo, añade el system prompt y la orquestación:

```ts
const CURATION_SYSTEM = `Eres director de arte seleccionando fotos para la web profesional de un negocio.
Recibes varias imágenes numeradas desde 0 y los datos del negocio. Devuelve ÚNICAMENTE un objeto JSON
válido (sin markdown): { "order": [índices] }, con los índices de las 4-6 MEJORES fotos, la primera = la
mejor para el hero. Incluye SOLO fotos que sean: (a) de buena calidad y CLARAMENTE relevantes a este
negocio, y (b) seguras para publicar: NADA de caras identificables en primer plano, capturas de pantalla,
tiques, menús como texto, memes, ni fotos borrosas u oscuras. Si ninguna cumple con confianza, devuelve
{ "order": [] }. Ante la duda, EXCLUYE (mejor sin foto que una foto mala).`;

// Curación por visión + re-host de solo las ganadoras. Degradación total ante cualquier fallo.
export async function curatePhotos(
  supabase: SupabaseClient,
  leadId: string,
  candidates: string[],
  ctx: { name: string; category?: string | null; city?: string | null },
): Promise<CuratedPhotos> {
  const empty: CuratedPhotos = { hero: null, gallery: [] };
  if (candidates.length === 0) return empty;
  try {
    const userText = `Negocio: ${ctx.name}${ctx.category ? ` (${ctx.category})` : ""}${ctx.city ? ` en ${ctx.city}` : ""}. Hay ${candidates.length} imágenes numeradas 0..${candidates.length - 1} en el orden en que se te envían.`;
    const parsed = await llmVisionJson<{ order?: unknown }>(CURATION_SYSTEM, candidates, userText);
    const order = parseCurationResponse(JSON.stringify(parsed), candidates.length);
    if (order.length === 0) {
      console.log("  · curación de fotos: ninguna pasó el filtro → web sin fotos.");
      return empty;
    }
    // Re-hospedar en orden; hero = primera superviviente, galería = resto.
    const survivors: string[] = [];
    for (let i = 0; i < order.length; i++) {
      const slot = i === 0 ? "hero" : `g${i}`;
      const rehosted = await rehostToBucket(supabase, PREVIEW_BUCKET, `photos/${leadId}/${slot}`, candidates[order[i]]);
      if (rehosted) survivors.push(rehosted);
    }
    if (survivors.length === 0) return empty;
    console.log(`  · curación de fotos: ${survivors.length} foto(s) seleccionada(s) y re-hospedada(s).`);
    return { hero: survivors[0], gallery: survivors.slice(1) };
  } catch (e) {
    console.error(`  · curación de fotos falló (no crítico, web sin fotos): ${e instanceof Error ? e.message : e}`);
    return empty;
  }
}
```

- [ ] **Step 2: Verificar que el test puro sigue verde y que compila**

Run: `node --experimental-strip-types orquestador/photos.test.ts`
Expected: PASS (los helpers puros no cambian; el test importa `photos.ts`, que ahora también importa `llm.ts`/`preview.ts` sin efectos secundarios al cargar).

Run: `cd orquestador && npm run typecheck`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add orquestador/photos.ts
git commit -m "feat(orquestador): curatePhotos — visión (Haiku) + re-host de las ganadoras, fallback sin-fotos"
```

---

### Task 6: `DESIGN_SYSTEM` + adelgazar `BUILD_PROMPT` (`prompts.ts`)

**Files:**
- Modify: `supabase/functions/_shared/prompts.ts`

**Interfaces:**
- Produces: `export const DESIGN_SYSTEM: string` — la gramática de diseño invariante.
- `BUILD_PROMPT` adelgazado: se le quitan las reglas de diseño (ahora en `DESIGN_SYSTEM`); conserva el carrusel de reseñas y el CTA+badge; se le avisa de que el design-system y las fotos se añaden aparte y de que recibe `photos: { hero: boolean, gallery: number }` en el input.

- [ ] **Step 1: Reescribir `BUILD_PROMPT`**

Reemplaza la constante `BUILD_PROMPT` en `supabase/functions/_shared/prompts.ts` por:

```ts
export const BUILD_PROMPT = `
Eres director creativo web. Recibes un brief de negocio (JSON), una URL de reserva ({{BOOKING_URL}}) y
un objeto "photos" ({ "hero": boolean, "gallery": number }) que indica si hay fotos reales curadas.
Tu salida es UN PROMPT DE CONSTRUCCIÓN para Lovable: texto plano en español. NO devuelvas JSON ni
explicaciones: solo el prompt. IMPORTANTE: el SISTEMA DE DISEÑO y el detalle de las FOTOS se añaden
automáticamente DESPUÉS de tu texto — NO redactes reglas de tipografía, color, espaciado ni listas de
fotos; céntrate en el CONTENIDO y la ESTRUCTURA del negocio.

El prompt que generes debe pedir a Lovable una web one-page A MEDIDA para este negocio con:
- Las secciones de recommended_sections, con copy en español basado en value_props y hero_copy.
  Si photos.hero es false, NO incluyas una sección de galería de fotos; apóyate en el carrusel de reseñas.
- Una sección "Reseñas" SIEMPRE, montada como un CARRUSEL de reseñas reales de Google. Reglas:
  · Usa SOLO las reseñas reales del input (business.reviews). Transcribe TAL CUAL —el texto, el nombre del
    autor (si viene) y las estrellas (si vienen)— para que Lovable tenga el contenido literal que renderizar.
    NUNCA inventes reseñas, nombres ni valoraciones.
  · Incluye entre 6 y 8 reseñas en el carrusel: elige las más representativas (variedad de autores, que
    mencionen cosas concretas). Si hay menos de 6 reales, incluye TODAS las que haya y NO rellenes con
    falsas. No pongas más de 8 aunque haya más disponibles —el carrusel debe ir ligero.
  · Carrusel bien hecho: tarjetas con estrellas (1-5), nombre del autor y la cita; deslizable en móvil
    (swipe), con flechas y puntos de navegación en escritorio y autoplay suave y pausable. Encabeza la
    sección con la nota media y el nº de reseñas reales (business.rating y business.review_count) bajo la
    etiqueta "Reseñas de Google". Usa highlights_from_reviews solo para titular la sección, no como citas.
- Horario y datos de contacto SOLO si vienen en el brief.
- Un CTA prominente "Reservar / Aceptar" (en hero y al final) que enlace EXACTAMENTE a {{BOOKING_URL}}.
- Un badge/botón flotante fijo en la esquina inferior derecha, discreto y cerrable (con una "x"),
  con el texto "✦ ¿Te gusta esta web? Te la dejo lista por 397€ — Contrátala", que enlace a
  {{BOOKING_URL}}. Visible durante todo el scroll, sin tapar el contenido ni el CTA principal.
- Sin texto de relleno tipo lorem ipsum ni datos inventados.

Devuelve solo el prompt para Lovable.
`;
```

- [ ] **Step 2: Añadir la constante `DESIGN_SYSTEM`**

Justo después de `BUILD_PROMPT`, añade:

```ts
// Gramática de diseño INVARIANTE. run.ts la añade tal cual al final del prompt de Lovable en cada
// build (no la parafrasea el modelo → no deriva). La variación entre webs la ponen paleta, fotos y copy.
export const DESIGN_SYSTEM = `
SISTEMA DE DISEÑO (aplícalo estrictamente; estas reglas mandan sobre cualquier estilo por defecto):

TIPOGRAFÍA
- Usa DOS fuentes de Google Fonts de un par curado (display para titulares + texto para el cuerpo). Elige
  UNO acorde al tono del brief: Fraunces + Inter · Playfair Display + Source Sans 3 · Sora + Inter ·
  Libre Franklin + Lora. Nada de la fuente por defecto.
- Escala tipográfica modular (ratio ~1.25), titulares grandes y con peso, cuerpo 16-18px, line-height
  1.5-1.7. Jerarquía clara: nunca dos textos del mismo tamaño compitiendo.

COLOR
- Fondo neutro (blanco / gris muy claro), texto casi-negro (#1a1a1a). UN color de acento (el primary del
  brief) SOLO en CTAs, enlaces y detalles. Contraste AA como mínimo.
- PROHIBIDO: gradientes morado→rosa o azul→violeta "de IA", fondos saturados a pantalla completa, texto
  gris claro sobre blanco.

RITMO Y LAYOUT
- Ancho máximo de contenido 1100-1200px, centrado. Whitespace generoso.
- Padding vertical de sección amplio y CONSISTENTE (≈96-120px en escritorio, 56-64px en móvil).
- Separa secciones alternando fondo blanco / gris muy claro, sin líneas divisorias duras.

COMPONENTES E ICONOS
- Iconos SVG de un set consistente (estilo lucide). NUNCA emojis como iconos.
- Botones con estado hover, radios de borde y sombras sutiles y uniformes. Tarjetas homogéneas.

HERO
- Sobre el pliegue: titular (hero_copy), subtítulo corto, UN CTA primario a la reserva, y una señal de
  confianza (⭐ nota media + nº de reseñas reales). Con foto de hero, úsala con buen contraste del texto.

MICRO-INTERACCIONES
- Transiciones sutiles (fade/slide suave al entrar en viewport). Nada de rebotes ni animaciones llamativas.

MARCA Y SEO
- Header con wordmark: el nombre del negocio en la fuente display (no un genérico). Favicon con la inicial.
- <title> y meta description reales; Open Graph (title, description e imagen).
- Horario en tabla legible y NAP (nombre/dirección/teléfono) consistentes en el footer, SOLO si vienen.

PROHIBIDO EXPLÍCITO (evita estos "AI tells")
- Nada de lorem ipsum. Nada de estadísticas inventadas ("+500 clientes", "Nº1"). Nada de sellos/badges
  falsos. Nada de todo centrado por defecto. Nada de secciones vacías de relleno. Nada de stock genérico
  (solo las fotos que se te indiquen). Nada de emojis como iconos.
`;
```

- [ ] **Step 3: Verificar que compila en ambos árboles**

Run: `cd orquestador && npm run typecheck`
Expected: sin errores (run.ts importa de `prompts.ts`).

Run (opcional, si hay Deno): `deno check supabase/functions/_shared/prompts.ts`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/_shared/prompts.ts
git commit -m "feat(prompts): constante DESIGN_SYSTEM + BUILD_PROMPT adelgazado (contenido, no diseño)"
```

---

### Task 7: Cablear en `run.ts` (pasada 2 de fotos + curación + ensamblado)

**Files:**
- Modify: `orquestador/run.ts`

**Interfaces:**
- Consumes: `extractPhotoCandidates`, `curatePhotos`, `photoManifest` (photos.ts); `fetchPhotosForPlace` (reviews.ts); `DESIGN_SYSTEM` (prompts.ts); `placeIdFromLead` (ya importado desde reviews.ts).
- Produces: el prompt final a Lovable = `buildPrompt + photoManifest + DESIGN_SYSTEM`, guardado en `sites.build_prompt` y enviado a `lovableBuild`.

- [ ] **Step 1: Añadir imports**

En `orquestador/run.ts`, junto a los imports existentes:

```ts
import { BRIEF_PROMPT, BUILD_PROMPT, REVIEW_HIGHLIGHTS_PROMPT, DESIGN_SYSTEM } from "../supabase/functions/_shared/prompts.ts";
import { extractPhotoCandidates, curatePhotos, photoManifest } from "./photos.ts";
```

Y añade `fetchPhotosForPlace` al import existente de `./reviews.ts` (junto a `placeIdFromLead`, `fetchReviewsForPlace`).

- [ ] **Step 2: Pasada 2 de fotos + curación, antes de construir el build-prompt**

En `processBuild`, JUSTO ANTES de la línea `const bookingUrl = ...` (actual `run.ts:208`), inserta:

```ts
  // ── Pasada 2 de FOTOS (idempotente, molde de las reseñas) ───────────────────────────────────────
  // Solo el lead aprobado paga el detalle de su ficha. Si ya tiene galería suficiente, no se re-paga.
  if (!DRY_RUN && extractPhotoCandidates(lead.raw_json).length < 3) {
    const photoPlaceId = placeIdFromLead(lead);
    if (photoPlaceId) {
      try {
        const fetchedPhotos = await fetchPhotosForPlace(photoPlaceId, { maxImages: 10 });
        if (fetchedPhotos.length > 0) {
          const raw = { ...((lead.raw_json ?? {}) as Record<string, unknown>), imageUrls: fetchedPhotos };
          lead.raw_json = raw;
          await supabase.from("leads")
            .update({ raw_json: raw, updated_at: new Date().toISOString() })
            .eq("id", lead.id);
          console.log(`  · fotos traídas para la galería: ${fetchedPhotos.length}`);
        }
      } catch (e) {
        console.error(`  · no se pudieron traer fotos (no crítico, sigue el build): ${e instanceof Error ? e.message : e}`);
      }
    }
  }

  // ── Curación por visión (Haiku): solo ganadoras, re-hospedadas. Fallback: sin fotos ────────────
  const curated = DRY_RUN
    ? { hero: null, gallery: [] as string[] }
    : await curatePhotos(supabase, lead.id, extractPhotoCandidates(lead.raw_json), {
        name: lead.name,
        category: lead.category ?? null,
        city: lead.city ?? null,
      });
```

- [ ] **Step 3: Pasar `photos` a Sonnet y ensamblar el prompt final**

Reemplaza el bloque actual (`run.ts:209-214`):

```ts
  const buildPrompt = await llmText(
    BUILD_PROMPT.replaceAll("{{BOOKING_URL}}", bookingUrl),
    { brief, business: leadPayload(lead) },
    2800,
  );
  console.log(`  · build-prompt listo (${buildPrompt.length} chars), reserva → ${bookingUrl}`);
```

por:

```ts
  const variablePrompt = await llmText(
    BUILD_PROMPT.replaceAll("{{BOOKING_URL}}", bookingUrl),
    { brief, business: leadPayload(lead), photos: { hero: curated.hero != null, gallery: curated.gallery.length } },
    2800,
  );
  // Prompt final a Lovable = parte variable (Sonnet) + manifiesto de fotos + design-system invariante.
  const buildPrompt = `${variablePrompt}\n\n${photoManifest(curated)}\n\n${DESIGN_SYSTEM}`;
  console.log(`  · build-prompt listo (${buildPrompt.length} chars; fotos: hero=${curated.hero != null}, galería=${curated.gallery.length}), reserva → ${bookingUrl}`);
```

(A partir de aquí `buildPrompt` es el prompt COMPLETO; el resto de `processBuild` —el print de DRY-RUN, `sites.build_prompt` y `lovableBuild(buildPrompt, …)`— no cambia y ya usa `buildPrompt`.)

- [ ] **Step 4: Verificar que compila**

Run: `cd orquestador && npm run typecheck`
Expected: sin errores.

- [ ] **Step 5: Smoke con dry-run (sin gastar créditos ni red de fotos)**

Run: `cd orquestador && npm run dry-run`
Expected: para un lead en `build_queued`, imprime el BUILD-PROMPT y se ve, al final, el bloque `SISTEMA DE DISEÑO` y una línea `FOTOS:` (en dry-run, la de "no hay fotos disponibles"). No toca Lovable ni escribe en `sites`.

- [ ] **Step 6: Commit**

```bash
git add orquestador/run.ts
git commit -m "feat(orquestador): cablear fotos curadas + DESIGN_SYSTEM en el prompt del build"
```

---

### Task 8: Verificación end-to-end y cierre

**Files:** ninguno (verificación).

- [ ] **Step 1: Typecheck completo del orquestador**

Run: `cd orquestador && npm run typecheck`
Expected: sin errores.

- [ ] **Step 2: Test puro de fotos**

Run: `node --experimental-strip-types orquestador/photos.test.ts`
Expected: PASS (`OK`).

- [ ] **Step 3: Build real de UN lead y revisión a ojo**

Encola un lead de prueba (`status='build_queued'` con brief) y corre `cd orquestador && npm start`. Verifica en la web resultante:
- Fotos reales del negocio en hero/galería (o web tipográfica limpia sin stock si no había fotos buenas).
- Tipografía con par de fuentes real, un solo acento de color, sin gradiente "de IA", ritmo/espaciado consistentes, iconos SVG (no emojis).
- Intactos: carrusel de reseñas reales, CTA y badge de 397€ a `/book/:leadId`.

Confirma en logs la línea `· curación de fotos: N foto(s)…` o `· ninguna pasó el filtro → web sin fotos.`

- [ ] **Step 4: Comprobar el score**

Tras el build, revisa la nota que escribe `analyze` para ese `site`. Compárala con builds previos para confirmar la subida (criterio de éxito del spec §6). Documenta la nota observada.

- [ ] **Step 5: Marcar el plan como completado** (no requiere commit de código).

---

## Self-Review (hecho al escribir el plan)

**Cobertura del spec:**
- §1 separar invariante/variable → Task 6 (DESIGN_SYSTEM) + Task 7 (ensamblado). ✓
- §2.1 `extractPhotoCandidates` → Task 1 (ubicado en `photos.ts`, no en `website.ts`: es lógica solo-orquestador, junto al resto de la curación, como `extractReviews` vive en `llm.ts`). ✓
- §2.2 `photos.ts` curación por visión + re-host + degradación → Tasks 1 y 5. ✓
- §2.3 `DESIGN_SYSTEM` → Task 6. ✓
- §2.4 adelgazar `BUILD_PROMPT` → Task 6. ✓
- §2.5 cablear en `run.ts` → Task 7. ✓
- §2.6 fotos en pasada 2 (no en run-scrape) → Task 4 (`fetchPhotosForPlace`) + Task 7 (pasada 2). ✓
- §4 manifiesto de fotos → Task 1 (`photoManifest`). ✓
- §5 errores/degradación → Task 5 (`curatePhotos` nunca lanza) + Task 7 (pasada 2 no crítica). ✓
- §6 criterio de éxito → Task 8. ✓

**Nota de desviación consciente del spec:** `extractPhotoCandidates` vive en `orquestador/photos.ts`, no en `supabase/functions/_shared/website.ts` como decía §2.1. Razón: solo lo usa el orquestador (la construcción es solo-Node); mantenerlo junto al resto de la curación es más cohesivo y evita arrastrar dependencias Node al árbol Deno. El análogo real (`extractReviews`) también vive en el orquestador (`llm.ts`), no en `_shared`.

**Consistencia de tipos:** `CuratedPhotos { hero: string|null; gallery: string[] }` usado igual en photos.ts (Tasks 1/5) y run.ts (Task 7). `curatePhotos(supabase, leadId, candidates, ctx)` y `photoManifest(photos)` con las mismas firmas en definición y uso. `rehostToBucket(supabase, bucket, pathNoExt, url)` definido en Task 2 y consumido en Task 5. `llmVisionJson(system, imageUrls, userText, maxTokens)` definido en Task 3 y consumido en Task 5. `fetchPhotosForPlace(placeId, {maxImages})` definido en Task 4, consumido en Task 7.

**Placeholders:** ninguno — cada step lleva el código o comando real.

**Riesgo a verificar en implementación (no placeholder, verificación explícita en Task 4/7):** que el actor `compass/crawler-google-places` devuelva `imageUrls` con `maxImages` + `scrapePlaceDetailPage:true`. Si el nombre del campo difiere en el esquema del actor, ajústalo en `fetchPhotosForPlace`; el resto del pipeline (curación, degradación a sin-fotos) funciona igual porque `extractPhotoCandidates` ya tolera la ausencia de galería.
