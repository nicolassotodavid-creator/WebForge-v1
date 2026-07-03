# Lead manual por URL — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir en la página "Importar leads" una tarjeta para crear un lead pegando la URL de su web: propone el nombre, evita duplicados, crea el lead y lanza el análisis automáticamente.

**Architecture:** Una Edge Function nueva `add-lead-by-url` con dos modos (preview: propone nombre + detecta duplicados; create: inserta el lead y devuelve su id). El panel encadena: preview → confirmación del operador → create → invocación de la función EXISTENTE `analyze-site` (que no se toca). Los helpers compartidos (`_shared/html.ts`, `_shared/website.ts`) ganan funciones puras nuevas, testeadas con los runners caseros del repo.

**Tech Stack:** Deno Edge Functions (Supabase), supabase-js v2, React + shadcn/ui (panel en `app/`), tests con `node --experimental-strip-types`.

**Spec:** `docs/superpowers/specs/2026-07-03-lead-manual-por-url-design.md` (aprobada por Nico el 2026-07-03).

## Global Constraints

- Todo el copy visible del panel en **español**, tono claro para operador no técnico.
- El front NO inserta en DB directo: siempre vía Edge Functions (regla de `CLAUDE.md`).
- **Sin migraciones**: solo columnas existentes de `leads` (`name`, `city`, `country`, `has_website`, `website_url`, `raw_json`, `source`, `owner`; `status` usa su default `new`).
- No tocar `analyze-site`, `ingest-leads` ni `ANALYSIS_PROMPT`. Cambios en `_shared/` solo ADITIVOS.
- El análisis devuelve `score` **1–10** (no sobre 100) y `summary` (ver `ANALYSIS_PROMPT` en `supabase/functions/_shared/prompts.ts:146-147`).
- Ruta de la ficha del lead: `/leads/:id` (ver `app/src/App.tsx:26`).
- Tests: runners caseros sin framework, patrón de `supabase/functions/_shared/replyTo.test.ts` (asserts a mano, `process.exit(1)` si falla), ejecutados con `node --experimental-strip-types <archivo>`.
- Commits frecuentes, mensajes en español estilo repo (`feat(...)`, `docs(...)`), con `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- NADA de WhatsApp (regla dura del proyecto).

---

### Task 1: Helpers de URL en `_shared/website.ts` (`normalizeUrlInput`, `siteHost`)

**Files:**
- Modify: `supabase/functions/_shared/website.ts` (añadir al final; no tocar lo existente)
- Test: `supabase/functions/_shared/website.test.ts` (nuevo)

**Interfaces:**
- Consumes: nada (funciones puras).
- Produces:
  - `normalizeUrlInput(input: unknown): string | null` — limpia lo que pega el operador: trim, antepone `https://` si falta esquema, valida con `URL`; null si no es una URL http(s) con dominio con punto. OJO: devuelve `parsed.toString()`, que añade `/` final a dominios pelados (`https://talleres.com/`).
  - `siteHost(url: unknown): string | null` — hostname en minúsculas sin `www.`; null si no parsea. Es la clave de comparación de duplicados.

- [ ] **Step 1: Escribir el test que falla**

Crear `supabase/functions/_shared/website.test.ts`:

```ts
// node --experimental-strip-types supabase/functions/_shared/website.test.ts
import { normalizeUrlInput, siteHost } from "./website.ts";

let failures = 0;
function assertEq(actual: unknown, expected: unknown, msg: string) {
  const ok = actual === expected;
  console.log(`${ok ? "✓" : "✗"} ${msg}  (got ${actual}, want ${expected})`);
  if (!ok) failures++;
}

// normalizeUrlInput — lo que pega el operador
assertEq(normalizeUrlInput("talleres-garcia.com"), "https://talleres-garcia.com/", "sin esquema → https://");
assertEq(normalizeUrlInput("  https://talleres.com/inicio "), "https://talleres.com/inicio", "trim y respeta path");
assertEq(normalizeUrlInput("http://viejo.es"), "http://viejo.es/", "http se respeta");
assertEq(normalizeUrlInput(""), null, "vacío → null");
assertEq(normalizeUrlInput("   "), null, "espacios → null");
assertEq(normalizeUrlInput("no es una url"), null, "texto sin dominio → null");
assertEq(normalizeUrlInput("ftp://cosa.com"), null, "esquema no http(s) → null");
assertEq(normalizeUrlInput(null), null, "null → null");

// siteHost — clave de duplicados
assertEq(siteHost("https://www.Talleres-Garcia.COM/contacto"), "talleres-garcia.com", "minúsculas y sin www");
assertEq(siteHost("http://talleres.com"), "talleres.com", "sin www ya");
assertEq(siteHost("no-url"), null, "no URL → null");
assertEq(siteHost(undefined), null, "undefined → null");

console.log(failures === 0 ? "\nOK" : `\n${failures} FALLO(S)`);
if (failures) process.exit(1);
```

- [ ] **Step 2: Ejecutarlo y verificar que falla**

Run: `node --experimental-strip-types supabase/functions/_shared/website.test.ts`
Expected: FAIL — `SyntaxError: The requested module './website.ts' does not provide an export named 'normalizeUrlInput'`

- [ ] **Step 3: Implementar los helpers**

Añadir AL FINAL de `supabase/functions/_shared/website.ts`:

```ts
// ── Entrada manual de URL (panel → add-lead-by-url) ─────────────────────────────────────────
// Normaliza lo que pega el operador: trim, https:// si falta esquema, y valida que sea una URL
// http(s) con un dominio real (con punto). Null = no se puede usar.
export function normalizeUrlInput(input: unknown): string | null {
  if (typeof input !== "string") return null;
  let u = input.trim();
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  try {
    const parsed = new URL(u);
    if (!/^https?:$/.test(parsed.protocol)) return null;
    if (!parsed.hostname.includes(".")) return null;
    return parsed.toString();
  } catch (_e) {
    return null;
  }
}

// Clave de comparación de duplicados: hostname en minúsculas, sin "www.". La misma web puede
// estar guardada con o sin www / con distinto path; el host pelado las iguala.
export function siteHost(url: unknown): string | null {
  if (typeof url !== "string") return null;
  try {
    const h = new URL(url.trim()).hostname.toLowerCase().replace(/^www\./, "");
    return h || null;
  } catch (_e) {
    return null;
  }
}
```

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `node --experimental-strip-types supabase/functions/_shared/website.test.ts`
Expected: todas ✓ y `OK` final, exit code 0.

- [ ] **Step 5: Ejecutar los tests existentes (no romper nada)**

Run: `node --experimental-strip-types supabase/functions/_shared/replyTo.test.ts && node --experimental-strip-types supabase/functions/_shared/luvia.test.ts`
Expected: ambos `OK`.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared/website.ts supabase/functions/_shared/website.test.ts
git commit -m "feat(shared): normalizeUrlInput y siteHost para el alta manual de leads por URL"
```

---

### Task 2: Extracción del nombre del negocio en `_shared/html.ts` (`extractSiteTitle` + campo `title`)

**Files:**
- Modify: `supabase/functions/_shared/html.ts`
- Test: `supabase/functions/_shared/html.test.ts` (nuevo)

**Interfaces:**
- Consumes: nada nuevo (función pura sobre el HTML crudo).
- Produces:
  - `extractSiteTitle(html: unknown): string | null` — nombre propuesto del negocio: `og:site_name` si existe; si no, `<title>` quedándose con el primer tramo antes de separadores SEO (`|`, `·`, `—`, `–`, ` - `). Decodifica entidades básicas. Null si no hay nada usable.
  - `FetchedPage.title: string | null` — campo NUEVO en la interfaz existente; `fetchPageForAnalysis()` lo rellena (null en la rama de error). Cambio aditivo: `analyze-site` y `score-sites` lo ignoran sin romperse.

- [ ] **Step 1: Escribir el test que falla**

Crear `supabase/functions/_shared/html.test.ts`:

```ts
// node --experimental-strip-types supabase/functions/_shared/html.test.ts
import { extractSiteTitle } from "./html.ts";

let failures = 0;
function assertEq(actual: unknown, expected: unknown, msg: string) {
  const ok = actual === expected;
  console.log(`${ok ? "✓" : "✗"} ${msg}  (got ${actual}, want ${expected})`);
  if (!ok) failures++;
}

assertEq(
  extractSiteTitle("<html><head><title>Talleres García | Inicio</title></head></html>"),
  "Talleres García",
  "corta el sufijo SEO tras |",
);
assertEq(
  extractSiteTitle("<title>Peluquería Loli - Peluquería en Salamanca</title>"),
  "Peluquería Loli",
  "corta el sufijo tras ' - ' (con espacios)",
);
assertEq(
  extractSiteTitle("<title>Semi-nuevos García</title>"),
  "Semi-nuevos García",
  "NO corta guiones sin espacios (parte del nombre)",
);
assertEq(
  extractSiteTitle('<meta property="og:site_name" content="Bar Casa Paco"/><title>Inicio | Bar</title>'),
  "Bar Casa Paco",
  "og:site_name gana al <title>",
);
assertEq(
  extractSiteTitle('<meta content="Bar Casa Paco" property="og:site_name"/>'),
  "Bar Casa Paco",
  "og:site_name con atributos en orden inverso",
);
assertEq(
  extractSiteTitle("<title>Peluquer&iacute;a Espa&ntilde;a &amp; M&aacute;s</title>"),
  "Peluquería España & Más",
  "decodifica entidades HTML comunes",
);
assertEq(extractSiteTitle("<html><body>sin titulo</body></html>"), null, "sin título → null");
assertEq(extractSiteTitle(""), null, "vacío → null");
assertEq(extractSiteTitle(null), null, "null → null");
assertEq(
  extractSiteTitle("<title>   \n  </title>"),
  null,
  "título en blanco → null",
);

console.log(failures === 0 ? "\nOK" : `\n${failures} FALLO(S)`);
if (failures) process.exit(1);
```

- [ ] **Step 2: Ejecutarlo y verificar que falla**

Run: `node --experimental-strip-types supabase/functions/_shared/html.test.ts`
Expected: FAIL — export `extractSiteTitle` no existe.

- [ ] **Step 3: Implementar**

En `supabase/functions/_shared/html.ts`:

3a. Ampliar la interfaz (campo nuevo al final):

```ts
export interface FetchedPage {
  ok: boolean; // ¿se pudo bajar el HTML? (false = web caída / bloqueada / timeout)
  snippet: string; // texto visible limpio, recortado a 4000 chars (lo que se le pasa a Claude)
  signals: WidgetSignals | null; // detección de chat/WhatsApp sobre el HTML CRUDO; null si !ok
  title: string | null; // nombre propuesto del negocio (og:site_name o <title> sin sufijos SEO)
}
```

3b. Añadir al final del archivo:

```ts
// ── Nombre propuesto del negocio a partir del HTML ──────────────────────────────────────────
// Para el alta manual por URL: og:site_name es el nombre "oficial" del sitio; el <title> suele
// llevar sufijos de SEO ("Talleres García | Taller en Salamanca") — nos quedamos con el primer
// tramo. Heurística, no verdad absoluta: el operador SIEMPRE confirma/edita el nombre en el panel.
const HTML_ENTITIES: Record<string, string> = {
  amp: "&", quot: '"', apos: "'", nbsp: " ",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ", ccedil: "ç",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú", Ntilde: "Ñ",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)))
    .replace(/&([a-zA-Z]+);/g, (m, name: string) => HTML_ENTITIES[name] ?? m);
}

export function extractSiteTitle(html: unknown): string | null {
  const src = typeof html === "string" ? html : "";
  if (!src) return null;
  const og =
    src.match(/<meta[^>]+property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i) ??
    src.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:site_name["']/i);
  let title = og?.[1] ?? src.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  title = decodeEntities(title).replace(/\s+/g, " ").trim();
  if (!og && title) {
    // Separadores SEO: |, ·, — y – siempre; el guion normal SOLO con espacios (" - "),
    // para no partir nombres como "Semi-nuevos García".
    const first = title.split(/\s*[|·—–]\s*|\s+-\s+/)[0].trim();
    if (first.length >= 3) title = first;
  }
  if (title.length < 2) return null;
  return title.slice(0, 120);
}
```

3c. En `fetchPageForAnalysis()`, rellenar el campo:
- En la rama de éxito, cambiar el `return` a:
  ```ts
  return { ok: true, snippet, signals, title: extractSiteTitle(html) };
  ```
- En las DOS ramas de fallo (`!res.ok` y el `catch`), cambiar a:
  ```ts
  return { ok: false, snippet: "", signals: null, title: null };
  ```

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `node --experimental-strip-types supabase/functions/_shared/html.test.ts`
Expected: todas ✓, `OK`.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/html.ts supabase/functions/_shared/html.test.ts
git commit -m "feat(shared): extractSiteTitle — nombre propuesto del negocio desde su HTML"
```

---

### Task 3: Edge Function `add-lead-by-url`

**Files:**
- Create: `supabase/functions/add-lead-by-url/index.ts`

**Interfaces:**
- Consumes (de Tasks 1-2): `normalizeUrlInput(input)`, `siteHost(url)`, `isRealWebsite(url)`, `resolveWebsite(lead)` de `../_shared/website.ts`; `fetchPageForAnalysis(url)` (con `.title`) de `../_shared/html.ts`; `corsHeaders` de `../_shared/cors.ts`.
- Produces (contrato HTTP para Task 4):
  - `POST { mode: "preview", url }` → `200 { proposed_name: string|null, page_ok: boolean, url: string }` · o `200 { duplicate: { id, name, status }, url }` · o `409 { error }` (red social / URL inválida).
  - `POST { mode: "create", url, name, city? }` → `200 { lead_id: string }` · o `409 { error, duplicate? }` · errores `400/401/500 { error }`.
  - El lead creado: `source: 'manual-url'`, `owner` = usuario de la sesión, `website_url` = URL normalizada, `raw_json: { website, manual_url: true }`, `has_website: true`, `country: 'ES'`, `status` default (`new`).

No hay test automatizado de la función (el repo no testea Edge Functions — requieren runtime Deno + DB). La lógica con riesgo está en los helpers puros ya testeados; la función se verifica a mano en Task 5.

- [ ] **Step 1: Escribir la función completa**

Crear `supabase/functions/add-lead-by-url/index.ts`:

```ts
// add-lead-by-url — alta manual de un lead pegando la URL de su web (panel → Importar leads).
// Dos modos en el mismo endpoint:
//   { mode:"preview", url }            → propone nombre (título de la web) y detecta duplicados.
//   { mode:"create",  url, name, city }→ inserta el lead y devuelve { lead_id }.
// El ANÁLISIS no vive aquí: el panel invoca analyze-site con el lead_id devuelto (cero
// duplicación de esa lógica). Auth: sesión de operador (igual que analyze-site). El lead
// entra con owner = operador, source='manual-url' y status default 'new'.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import {
  isRealWebsite,
  normalizeUrlInput,
  resolveWebsite,
  siteHost,
} from "../_shared/website.ts";
import { fetchPageForAnalysis } from "../_shared/html.ts";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface DuplicateInfo {
  id: string;
  name: string | null;
  status: string | null;
}

// Duplicado = lead del MISMO dueño cuya web real apunta al mismo host (sin www).
// Filtro ancho en SQL (ilike sobre website_url y raw_json->>website) + confirmación
// exacta por host en código, porque el ilike solo puede comparar subcadenas.
async function findDuplicate(
  supabase: ReturnType<typeof createClient>,
  ownerId: string,
  host: string,
): Promise<DuplicateInfo | null> {
  const { data, error } = await supabase
    .from("leads")
    .select("id,name,status,website_url,raw_json")
    .eq("owner", ownerId)
    .or(`website_url.ilike.*${host}*,raw_json->>website.ilike.*${host}*`)
    .limit(20);
  if (error) {
    console.error(`findDuplicate: ${error.message}`);
    return null; // best-effort: si el chequeo falla, no bloqueamos el alta
  }
  for (const l of data ?? []) {
    const h = siteHost(resolveWebsite(l as { website_url?: unknown; raw_json?: unknown }) ?? "");
    if (h === host) {
      return { id: String(l.id), name: (l.name as string) ?? null, status: (l.status as string) ?? null };
    }
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Método no permitido" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return jsonResponse({ error: "Faltan vars de Supabase." }, 500);
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Auth: sesión de operador. El id del usuario es el owner del lead y acota el chequeo
  // de duplicados a SU pipeline (multi-tenant, migr. 0016).
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  let operatorId: string | null = null;
  if (token) {
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data?.user) operatorId = data.user.id;
  }
  if (!operatorId) return jsonResponse({ error: "No autorizado" }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch (_e) {
    return jsonResponse({ error: "Cuerpo no válido." }, 400);
  }

  const mode = String(body.mode ?? "");
  if (mode !== "preview" && mode !== "create") {
    return jsonResponse({ error: 'Falta mode ("preview" | "create").' }, 400);
  }

  const url = normalizeUrlInput(body.url);
  if (!url) {
    return jsonResponse({ error: "Esa dirección no parece una URL válida. Revisa que sea algo como https://ejemplo.com" }, 409);
  }
  if (!isRealWebsite(url)) {
    return jsonResponse(
      { error: "Ese enlace es de una red social o de Google Maps, no una web propia. El análisis está pensado para webs de verdad." },
      409,
    );
  }
  const host = siteHost(url);
  if (!host) return jsonResponse({ error: "No se pudo leer el dominio de esa URL." }, 409);

  if (mode === "preview") {
    const duplicate = await findDuplicate(supabase, operatorId, host);
    if (duplicate) return jsonResponse({ duplicate, url });
    const page = await fetchPageForAnalysis(url);
    return jsonResponse({ proposed_name: page.title, page_ok: page.ok, url });
  }

  // mode === "create"
  const name = String(body.name ?? "").trim();
  if (!name) return jsonResponse({ error: "Falta el nombre del negocio." }, 400);
  const city = String(body.city ?? "").trim() || null;

  // Re-chequeo de duplicado (doble clic, dos pestañas…): mejor 409 que un lead repetido.
  const duplicate = await findDuplicate(supabase, operatorId, host);
  if (duplicate) {
    return jsonResponse({ error: "Este negocio ya está en tu pipeline.", duplicate }, 409);
  }

  const { data, error } = await supabase
    .from("leads")
    .insert({
      name,
      city,
      country: "ES",
      has_website: true,
      website_url: url, // web confirmada por el operador: mismo rango que la "descubierta"
      raw_json: { website: url, manual_url: true },
      source: "manual-url",
      owner: operatorId,
    })
    .select("id")
    .single();
  if (error || !data) {
    return jsonResponse({ error: `No se pudo crear el lead: ${error?.message ?? "error"}` }, 500);
  }

  return jsonResponse({ lead_id: data.id });
});
```

- [ ] **Step 2: Verificar que los tests puros siguen pasando**

Run: `node --experimental-strip-types supabase/functions/_shared/website.test.ts && node --experimental-strip-types supabase/functions/_shared/html.test.ts`
Expected: `OK` en ambos.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/add-lead-by-url/index.ts
git commit -m "feat(functions): add-lead-by-url — alta manual de lead pegando su URL (preview + create)"
```

---

### Task 4: Tarjeta "Añadir a mano" en el panel

**Files:**
- Create: `app/src/components/AddLeadByUrlCard.tsx`
- Modify: `app/src/pages/Import.tsx` (import + render de la tarjeta ANTES de la Opción C, y actualizar el subtítulo de la página)

**Interfaces:**
- Consumes: el contrato HTTP de Task 3 (`add-lead-by-url`) y el de `analyze-site` existente (`POST { lead_id }` → `{ ok, analysis: { score, summary, strengths, improvements }, url }`). Helpers del front: `supabase`, `edgeFunctionErrorMessage` de `@/lib/supabase`; componentes `Card*`, `Input`, `Button`, `buttonVariants` de `@/components/ui/*`; `Loader2`, `Link` como en `Import.tsx`.
- Produces: componente `<AddLeadByUrlCard />` sin props, autocontenido.

- [ ] **Step 1: Escribir el componente**

Crear `app/src/components/AddLeadByUrlCard.tsx`:

```tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Link as LinkIcon } from "lucide-react";
import { supabase, edgeFunctionErrorMessage } from "@/lib/supabase";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Duplicate { id: string; name: string | null; status: string | null }
interface Analysis {
  score: number;
  summary: string;
  strengths: string[];
  improvements: { area: string; issue: string; fix: string }[];
}

// Alta manual: pega la URL de la web (mala) de un negocio visto navegando → preview del nombre
// → confirmar → se crea el lead y se lanza analyze-site. Tres fases: url → confirm → done.
export default function AddLeadByUrlCard() {
  const [fase, setFase] = useState<"url" | "confirm" | "done">("url");
  const [url, setUrl] = useState("");
  const [nombre, setNombre] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [pageOk, setPageOk] = useState(true);
  const [duplicate, setDuplicate] = useState<Duplicate | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setFase("url"); setUrl(""); setNombre(""); setCiudad(""); setPageOk(true);
    setDuplicate(null); setLeadId(null); setAnalysis(null); setAnalysisError(null); setError(null);
  }

  async function handlePreview() {
    if (!url.trim()) { setError("Pega primero la URL de su web."); return; }
    setBusy(true); setError(null); setDuplicate(null);
    try {
      const { data, error } = await supabase.functions.invoke("add-lead-by-url", {
        body: { mode: "preview", url: url.trim() },
      });
      if (error) throw error;
      if (data?.duplicate) { setDuplicate(data.duplicate as Duplicate); return; }
      setNombre((data?.proposed_name as string) ?? "");
      setPageOk(Boolean(data?.page_ok));
      setFase("confirm");
    } catch (e) {
      setError(await edgeFunctionErrorMessage(e, "No se pudo comprobar esa web."));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate() {
    if (!nombre.trim()) { setError("Escribe el nombre del negocio."); return; }
    setBusy(true); setError(null);
    let newLeadId: string | null = null;
    try {
      const { data, error } = await supabase.functions.invoke("add-lead-by-url", {
        body: { mode: "create", url: url.trim(), name: nombre.trim(), city: ciudad.trim() || undefined },
      });
      if (error) throw error;
      newLeadId = (data?.lead_id as string) ?? null;
      if (!newLeadId) throw new Error("La función no devolvió el lead.");
      setLeadId(newLeadId);
      setFase("done");
    } catch (e) {
      setError(await edgeFunctionErrorMessage(e, "No se pudo crear el lead."));
      setBusy(false);
      return;
    }
    // Lead creado: lanzar el análisis. Si falla, el lead YA existe — se avisa y se
    // ofrece la ficha (allí está el botón "Analizar web" de siempre).
    try {
      const { data, error } = await supabase.functions.invoke("analyze-site", {
        body: { lead_id: newLeadId },
      });
      if (error) throw error;
      if (data?.analysis) setAnalysis(data.analysis as Analysis);
    } catch (e) {
      setAnalysisError(await edgeFunctionErrorMessage(e, "El análisis no terminó."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle className="text-lg">Añadir a mano · Pega la URL de su web</CardTitle>
        <CardDescription>
          ¿Has visto un negocio con una web mala? Pega su dirección: WebForge saca el nombre,
          lo confirmas y entra al pipeline con el análisis hecho.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {fase === "url" && (
          <>
            <div className="flex flex-wrap gap-3">
              <Input
                placeholder="https://la-web-que-has-visto.com"
                value={url}
                onChange={(e) => { setUrl(e.target.value); setError(null); setDuplicate(null); }}
                className="max-w-[380px]"
              />
              <Button onClick={handlePreview} disabled={busy}>
                {busy ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Visitando la web…</>
                ) : (
                  <><LinkIcon className="h-4 w-4" /> Buscar negocio</>
                )}
              </Button>
            </div>
            {duplicate && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400">
                ⚠️ Este negocio ya está en tu pipeline como{" "}
                <strong>{duplicate.name ?? "(sin nombre)"}</strong>
                {duplicate.status ? ` (estado: ${duplicate.status})` : ""}. No se ha duplicado.{" "}
                <Link to={`/leads/${duplicate.id}`} className="underline font-medium">Ver ficha →</Link>
              </div>
            )}
          </>
        )}

        {fase === "confirm" && (
          <>
            <p className="text-sm text-muted-foreground break-all">Web: <code>{url.trim()}</code></p>
            {!pageOk && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400">
                🔌 No pude abrir esa web (caída o bloquea la visita). Escribe el nombre a mano —
                el análisis reflejará que la web ni siquiera carga.
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <Input
                placeholder="Nombre del negocio"
                value={nombre}
                onChange={(e) => { setNombre(e.target.value); setError(null); }}
                className="max-w-[280px]"
              />
              <Input
                placeholder="Ciudad (opcional)"
                value={ciudad}
                onChange={(e) => setCiudad(e.target.value)}
                className="max-w-[180px]"
              />
            </div>
            <div className="flex gap-3">
              <Button onClick={handleCreate} disabled={busy}>
                {busy ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Guardando y analizando…</>
                ) : (
                  "Guardar y analizar"
                )}
              </Button>
              <Button variant="outline" onClick={reset} disabled={busy}>Cancelar</Button>
            </div>
          </>
        )}

        {fase === "done" && (
          <div className="space-y-3">
            <p className="rounded-md border border-emerald-200 bg-emerald-50 p-2.5 text-sm font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400">
              ✅ <strong>{nombre.trim()}</strong> añadido al pipeline.
            </p>
            {busy && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Analizando su web con Claude… (unos segundos)
              </p>
            )}
            {analysis && (
              <div className="rounded-md border p-3 space-y-1">
                <p className="text-sm">
                  Nota de su web actual: <strong>{analysis.score} / 10</strong>
                </p>
                <p className="text-sm text-muted-foreground">{analysis.summary}</p>
              </div>
            )}
            {analysisError && (
              <p className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400">
                ⚠️ El lead se creó, pero el análisis falló: {analysisError} Puedes lanzarlo desde
                su ficha con «Analizar web».
              </p>
            )}
            <div className="flex gap-3">
              {leadId && (
                <Link to={`/leads/${leadId}`} className={buttonVariants({ variant: "default" })}>
                  Ver ficha →
                </Link>
              )}
              <Button variant="outline" onClick={reset}>Añadir otro</Button>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Montar la tarjeta en `Import.tsx`**

En `app/src/pages/Import.tsx`:

2a. Añadir el import junto a los demás:

```tsx
import AddLeadByUrlCard from "@/components/AddLeadByUrlCard";
```

2b. Actualizar el subtítulo de la página y renderizar la tarjeta ANTES de la card "Opción C". Sustituir el bloque:

```tsx
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Importar leads</h1>
        <p className="text-muted-foreground">
          Pega el JSON del scraper o sube un CSV. Se normaliza, se deduplica por{" "}
          <code>google_place_id</code> y entra como <code>nuevo</code>.
        </p>
      </div>

      {/* Opción C — scraper automático */}
```

por:

```tsx
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Importar leads</h1>
        <p className="text-muted-foreground">
          Añade un negocio a mano con su URL, busca en Google Maps, o pega el JSON / sube el CSV
          del scraper. Todo entra al pipeline como <code>nuevo</code>.
        </p>
      </div>

      {/* Alta manual por URL */}
      <AddLeadByUrlCard />

      {/* Opción C — scraper automático */}
```

- [ ] **Step 3: Compilar el front**

Run: `cd app && npm run build`
Expected: build de Vite sin errores de TypeScript. (Si `npm run build` no existe, mirar `app/package.json` → scripts; el repo usa Vite.)

- [ ] **Step 4: Commit**

```bash
git add app/src/components/AddLeadByUrlCard.tsx app/src/pages/Import.tsx
git commit -m "feat(panel): tarjeta 'Añadir a mano por URL' en Importar leads"
```

---

### Task 5: Despliegue y verificación end-to-end

**Files:** ninguno nuevo (verificación).

**Interfaces:**
- Consumes: todo lo anterior desplegado.
- Produces: función `add-lead-by-url` desplegada en el Supabase de Nico y flujo verificado en el panel real.

- [ ] **Step 1: Ejecutar TODOS los tests caseros**

Run: `for f in supabase/functions/_shared/*.test.ts; do node --experimental-strip-types "$f" || exit 1; done`
Expected: `OK` en todos.

- [ ] **Step 2: Desplegar la función**

ATENCIÓN: esta máquina NO tiene git-crypt desbloqueado → `bash deploy.sh` fallará al leer secrets. Caminos válidos:
- **Camino A (preferido):** push a `main` → el CI (`.github/workflows/deploy.yml`) despliega las Edge Functions automáticamente (se dispara al tocar `supabase/functions/**`). El push a `main` requiere autorización explícita de Nico.
- **Camino B:** `supabase functions deploy add-lead-by-url --project-ref khscikqchvjxyvoaruas` si hay CLI de Supabase logueada (no necesita secrets nuevos: la función solo usa las vars que Supabase inyecta).

El front lo despliega Vercel solo con el push.

- [ ] **Step 3: Verificación manual en el panel (con Nico o con su sesión)**

En `Importar leads`:
1. Pegar una URL real de un negocio con web mala → «Buscar negocio» → debe proponer un nombre.
2. Confirmar → «Guardar y analizar» → debe salir ✅, la nota X/10 y el resumen.
3. «Ver ficha →» → la ficha debe mostrar la web, el análisis persistido y estado `nuevo`.
4. Repetir con la MISMA URL → debe avisar de duplicado con enlace a la ficha (sin crear otro).
5. Pegar `https://instagram.com/loquesea` → debe rechazarlo con el mensaje de red social.
6. Pegar un dominio inventado (`https://esto-no-existe-12345.com`) → aviso «no pude abrir esa web», permitir crear con nombre a mano.

Expected: los 6 casos se comportan como se describe. Si alguno falla → superpowers:systematic-debugging antes de tocar nada.

- [ ] **Step 4: Commit final (si hubo ajustes) y cierre**

```bash
git add -A && git commit -m "fix(panel): ajustes de la verificación e2e del alta por URL"
```

Solo si hubo cambios. Después, skill superpowers:finishing-a-development-branch.
