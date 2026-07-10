# Análisis de canal + pitch Luvia segmentado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Para leads Luvia, el mensaje de contacto deja de anclarse en reseñas y se segmenta según el estado del canal de mensajería detectado en la web del negocio (bot / WhatsApp / chat / nada), con badge visible en el panel.

**Architecture:** Se añade un tercer flag determinista `site_has_bot` (subconjunto de `site_has_chat`: solo bot-builders puros) a la detección de widgets que ya escanea el HTML de la web del negocio. Una función pura `luviaSiteState()` deriva un estado (`automated|hot|chat|none|unknown`) de los tres flags; la usan el generador de mensaje (payload + prompt reescrito) y el panel (badge). La función se duplica en Deno y React porque no comparten build.

**Tech Stack:** Supabase Edge Functions (Deno/TypeScript), Postgres (migraciones SQL), React + Vite + TypeScript + Tailwind/shadcn (panel).

## Global Constraints

- Tests: patrón del repo, sin framework — un fichero `*.test.ts` que se ejecuta con `node --experimental-strip-types <ruta>`, con `assertEq`/`assert` manuales y `process.exit(1)` si falla. Imports de VALOR necesitan extensión `.ts`; los `import type` se borran y no la necesitan.
- Build del panel: `cd app && npm run build` (`tsc --noEmit && vite build`). El panel usa alias `@/lib/...` sin extensión.
- Regla de espejo: la lógica pura de `_shared/website.ts` y `_shared/luvia.ts` se replica en `app/src/lib`. Si tocas las reglas en un lado, replícalas en el otro.
- Migraciones: aditivas, `add column if not exists`, numeradas correlativas (la siguiente es `0022`). Se aplican por el flujo de migración del repo (como 0019/0021), no por código.
- Salidas de Claude en JSON estricto, parsear con try/catch (ya está en `generate-outreach`; no se toca esa parte).
- Commit al final de CADA task (norma del repo: cada arreglo se committea + push).
- Modelo del Email 1 Luvia: sin cambio (`claude-haiku-4-5-20251001`).
- El pitch de "web nueva" (`OUTREACH_PROMPT`) y el handoff (`buildLuviaClientPayload`) NO se tocan.

---

### Task 1: Detección de bot en `website.ts`

Añade el flag `hasBot` a la detección determinista de widgets: subconjunto de vendors que son bot-builders puros (Landbot, ManyChat, Chatfuel), no chats con humano.

**Files:**
- Modify: `supabase/functions/_shared/website.ts` (interface `WidgetSignals` ~54-58; tabla `CHAT_VENDORS` ~62-79; `detectWidgets` ~85-93)
- Test: `supabase/functions/_shared/website.test.ts` (crear)

**Interfaces:**
- Produces: `WidgetSignals { hasChat: boolean; hasWhatsapp: boolean; hasBot: boolean; vendors: string[] }` y `detectWidgets(html: unknown): WidgetSignals` (con `hasBot`). Los labels de bot son exactamente `"Landbot"`, `"ManyChat"`, `"Chatfuel"` (los usa el backfill SQL de la Task 2).

- [ ] **Step 1: Escribir el test que falla** — `supabase/functions/_shared/website.test.ts`

```ts
// node --experimental-strip-types supabase/functions/_shared/website.test.ts
import { detectWidgets } from "./website.ts";

let failures = 0;
function assert(cond: boolean, msg: string) {
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) failures++;
}

// Bot-builder puro → hasBot true, y hasChat true (un bot ES un widget de chat).
const landbot = detectWidgets('<script src="https://static.landbot.io/landbot-3/x.js"></script>');
assert(landbot.hasBot === true, "Landbot → hasBot");
assert(landbot.hasChat === true, "Landbot → hasChat");
assert(landbot.vendors.includes("Landbot"), "Landbot en vendors");

const manychat = detectWidgets('<div class="mch_widget" data-manychat></div>');
assert(manychat.hasBot === true, "ManyChat → hasBot");

const chatfuel = detectWidgets('<script src="https://static.chatfuel.com/widget.js"></script>');
assert(chatfuel.hasBot === true, "Chatfuel → hasBot");

// Chat con humano → hasChat true pero hasBot FALSE.
const tawk = detectWidgets('<script src="https://embed.tawk.to/abc/default"></script>');
assert(tawk.hasChat === true, "Tawk → hasChat");
assert(tawk.hasBot === false, "Tawk → NO hasBot");

// WhatsApp sin chat.
const wa = detectWidgets('<a href="https://wa.me/34600111222">WhatsApp</a>');
assert(wa.hasWhatsapp === true, "wa.me → hasWhatsapp");
assert(wa.hasChat === false && wa.hasBot === false, "wa.me → sin chat ni bot");

// Web pelada → todo false.
const none = detectWidgets("<html><body>hola</body></html>");
assert(!none.hasChat && !none.hasWhatsapp && !none.hasBot, "web pelada → todo false");

console.log(failures === 0 ? "\nOK" : `\n${failures} FALLO(S)`);
if (failures) process.exit(1);
```

- [ ] **Step 2: Ejecutar el test para verlo fallar**

Run: `node --experimental-strip-types supabase/functions/_shared/website.test.ts`
Expected: FALLA — `hasBot` no existe (los `landbot.hasBot === true` dan `✗`) y no hay label `Chatfuel`.

- [ ] **Step 3: Añadir `Chatfuel` a la tabla de vendors** — `website.ts`, dentro de `CHAT_VENDORS` (justo tras la línea de `ManyChat`, ~78)

```ts
  { name: "ManyChat", re: /manychat\.com|mch_widget/ },
  { name: "Chatfuel", re: /chatfuel\.com|static\.chatfuel/ },
```

- [ ] **Step 4: Añadir `hasBot` al interface** — `website.ts`, `WidgetSignals` (~54-58)

```ts
export interface WidgetSignals {
  hasChat: boolean;
  hasWhatsapp: boolean;
  hasBot: boolean; // subconjunto de hasChat: bot-builder puro (Landbot/ManyChat/Chatfuel), no chat con humano
  vendors: string[]; // nombres legibles de los chats detectados (para mostrar en la ficha)
}
```

- [ ] **Step 5: Definir `BOT_VENDORS` y computar `hasBot`** — `website.ts`, justo antes de `export function detectWidgets` (~85)

```ts
// Subconjunto de vendors que son bot-builders PUROS (su único fin es montar un bot conversacional),
// no chats con operador humano. Es la señal de "ya automatizado" que usa el pitch de Luvia para no
// ofrecer "te automatizo" a quien ya lo está. Los nombres deben coincidir con los de CHAT_VENDORS.
const BOT_VENDORS = new Set(["Landbot", "ManyChat", "Chatfuel"]);

export function detectWidgets(html: unknown): WidgetSignals {
  const hay = (typeof html === "string" ? html : "").toLowerCase();
  const vendors = CHAT_VENDORS.filter((v) => v.re.test(hay)).map((v) => v.name);
  return {
    hasChat: vendors.length > 0,
    hasWhatsapp: WHATSAPP_RE.test(hay),
    hasBot: vendors.some((v) => BOT_VENDORS.has(v)),
    vendors,
  };
}
```

(Sustituye el cuerpo actual de `detectWidgets` por este; borra el `detectWidgets` viejo.)

- [ ] **Step 6: Ejecutar el test para verlo pasar**

Run: `node --experimental-strip-types supabase/functions/_shared/website.test.ts`
Expected: PASA — todas las líneas `✓`, termina en `OK`.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/_shared/website.ts supabase/functions/_shared/website.test.ts
git commit -m "feat(luvia): detectar bot-builders (hasBot) en la web del negocio

Chatfuel añadido a CHAT_VENDORS; BOT_VENDORS={Landbot,ManyChat,Chatfuel}.
hasBot = subconjunto de hasChat (bot puro, no chat con humano). Con test.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Columna `site_has_bot` (migración + backfill) y persistencia

Añade la columna, la rellena desde los vendors ya guardados (sin re-scrapear) y hace que los dos escritores del análisis la persistan.

**Files:**
- Create: `supabase/migrations/0022_lead_site_bot.sql`
- Modify: `supabase/functions/analyze-site/index.ts` (bloque `update` ~109-116)
- Modify: `supabase/functions/score-sites/index.ts` (bloque `update` ~138-144)

**Interfaces:**
- Consumes: `page.signals.hasBot` (de la Task 1).
- Produces: columna `leads.site_has_bot boolean` (null = sin comprobar), escrita por `analyze-site` y `score-sites` junto a `site_has_chat`/`site_has_whatsapp`.

- [ ] **Step 1: Crear la migración** — `supabase/migrations/0022_lead_site_bot.sql`

```sql
-- 0022_lead_site_bot.sql — Flag: ¿la web ACTUAL del negocio ya tiene un BOT / automatización?
-- Subconjunto de site_has_chat: solo cuenta como "automatizado" un bot-builder puro (Landbot,
-- ManyChat, Chatfuel), NO un chat con humano (Tawk, Crisp, Intercom…). Lo usa el pitch de Luvia
-- (luviaSiteState) para no ofrecer "te automatizo" a quien ya está automatizado.
-- null = no comprobado (web caída/bloqueada o sin analizar); true/false = comprobado.
-- Lo escriben analyze-site (botón) y score-sites (cron) junto a los flags de 0017.
alter table leads add column if not exists site_has_bot boolean;

-- Filtro/índice parcial (mismo criterio que 0017): solo indexa las filas en true.
create index if not exists idx_leads_site_has_bot on leads (site_has_bot) where site_has_bot;

-- Backfill SIN re-scrapear: derivar de los vendors ya guardados en site_analysis._widgets.vendors.
-- Solo tocamos filas ya analizadas con array de vendors presente; el resto se queda null.
update leads
set site_has_bot = exists (
  select 1
  from jsonb_array_elements_text(site_analysis->'_widgets'->'vendors') as v(name)
  where v.name in ('Landbot', 'ManyChat', 'Chatfuel')
)
where site_analysis ? '_widgets'
  and jsonb_typeof(site_analysis->'_widgets'->'vendors') = 'array';
```

- [ ] **Step 2: Verificar la sintaxis SQL (parseo local best-effort)**

Run: `grep -c "site_has_bot" supabase/migrations/0022_lead_site_bot.sql`
Expected: `3` (columna, índice, backfill). Revisa a ojo que el `update` cierra paréntesis y el `where` filtra por `_widgets`. La migración se APLICA por el flujo de migración del repo (como 0019/0021), no aquí.

- [ ] **Step 3: Persistir `site_has_bot` en `analyze-site`** — `supabase/functions/analyze-site/index.ts`, dentro del `.update({...})` (~114-115), añade la línea tras `site_has_whatsapp`

```ts
      // null = no se pudo bajar la web (sin comprobar); true/false = comprobado.
      site_has_chat: page.signals ? page.signals.hasChat : null,
      site_has_whatsapp: page.signals ? page.signals.hasWhatsapp : null,
      site_has_bot: page.signals ? page.signals.hasBot : null,
```

- [ ] **Step 4: Persistir `site_has_bot` en `score-sites`** — `supabase/functions/score-sites/index.ts`, dentro del `.update({...})` (~143-144), misma línea tras `site_has_whatsapp`

```ts
          // null = no se pudo bajar la web (sin comprobar); true/false = comprobado.
          site_has_chat: page.signals ? page.signals.hasChat : null,
          site_has_whatsapp: page.signals ? page.signals.hasWhatsapp : null,
          site_has_bot: page.signals ? page.signals.hasBot : null,
```

- [ ] **Step 5: Verificar que ambos escritores referencian el flag**

Run: `grep -rn "site_has_bot" supabase/functions/analyze-site/index.ts supabase/functions/score-sites/index.ts`
Expected: una coincidencia en cada fichero (dentro del `update`).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0022_lead_site_bot.sql supabase/functions/analyze-site/index.ts supabase/functions/score-sites/index.ts
git commit -m "feat(luvia): columna site_has_bot + backfill desde vendors + persistencia

Migración 0022 (aditiva, índice parcial). Backfill sin re-scrapear desde
site_analysis._widgets.vendors. analyze-site y score-sites la escriben.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Clasificador `luviaSiteState` + `buildLuviaOutreachPayload` (Deno)

La lógica pura que deriva el estado del canal y construye el payload del Email 1 de Luvia (sin reseñas). Vive junto a `isLuviaLead`.

**Files:**
- Modify: `supabase/functions/_shared/luvia.ts`
- Modify: `supabase/functions/_shared/luvia.test.ts`

**Interfaces:**
- Consumes: campos del lead `site_has_whatsapp`/`site_has_chat`/`site_has_bot` (Task 2), `site_analysis._widgets.vendors`, `website_url`.
- Produces:
  - `type LuviaSiteState = "automated" | "hot" | "chat" | "none" | "unknown"`
  - `luviaSiteState(lead): LuviaSiteState` — precedencia bot > whatsapp > chat > none; unknown si los tres flags son null.
  - `buildLuviaOutreachPayload(lead)` → `{ business: {name,category,city}, site: {state,has_whatsapp,has_chat,has_bot,vendors,url} }` (usado por `generate-outreach` en Task 5).

- [ ] **Step 1: Escribir los tests que fallan** — `supabase/functions/_shared/luvia.test.ts`

Cambia la línea de import (arriba) y añade el bloque de asserts ANTES del `console.log(failures...)` final:

```ts
import { isLuviaLead, luviaSiteState, buildLuviaOutreachPayload } from "./luvia.ts";
```

```ts
// ── luviaSiteState ─────────────────────────────────────────────────────────
assertEq(luviaSiteState({}), "unknown", "sin flags → unknown");
assertEq(luviaSiteState({ site_has_whatsapp: null, site_has_chat: null, site_has_bot: null }), "unknown", "todo null → unknown");
assertEq(luviaSiteState({ site_has_bot: true, site_has_whatsapp: true, site_has_chat: false }), "automated", "bot gana a whatsapp → automated");
assertEq(luviaSiteState({ site_has_whatsapp: true, site_has_chat: true, site_has_bot: false }), "hot", "whatsapp gana a chat → hot");
assertEq(luviaSiteState({ site_has_whatsapp: false, site_has_chat: true, site_has_bot: false }), "chat", "solo chat → chat");
assertEq(luviaSiteState({ site_has_whatsapp: false, site_has_chat: false, site_has_bot: false }), "none", "todo false → none");

// ── buildLuviaOutreachPayload (sin reseñas) ────────────────────────────────
const p = buildLuviaOutreachPayload({
  name: "Clínica X", category: "estética", city: "València",
  site_has_whatsapp: true, site_has_chat: false, site_has_bot: false,
  website_url: "https://clinicax.es",
  site_analysis: { _widgets: { vendors: [] } },
});
assertEq(p.site.state, "hot", "payload: state = hot");
assertEq(p.site.has_whatsapp, true, "payload: has_whatsapp");
assertEq(p.site.url, "https://clinicax.es", "payload: url");
assertEq(p.business.name, "Clínica X", "payload: business.name");
assertEq((p as Record<string, unknown>).rating, undefined, "payload: SIN rating");
assertEq((p as Record<string, unknown>).review_count, undefined, "payload: SIN review_count");
```

- [ ] **Step 2: Ejecutar el test para verlo fallar**

Run: `node --experimental-strip-types supabase/functions/_shared/luvia.test.ts`
Expected: FALLA — `luviaSiteState`/`buildLuviaOutreachPayload` no exportados (import error o `✗`).

- [ ] **Step 3: Implementar el clasificador y el payload** — `supabase/functions/_shared/luvia.ts`, añadir al final del fichero

```ts
export type LuviaSiteState = "automated" | "hot" | "chat" | "none" | "unknown";

// Estado del canal de mensajería ACTUAL del negocio, derivado de los flags deterministas de su web
// (site_has_bot/whatsapp/chat, ver 0017 + 0022). Base del gancho del pitch de Luvia. Precedencia
// deliberada bot > whatsapp > chat > none: si ya tiene un bot, decirle "lo atiendes a mano" sería
// falso. unknown = los tres flags null (web sin analizar / no se pudo bajar).
// PURA. Se replica igual en app/src/lib/luvia.ts (no comparten build) — si cambias las reglas aquí,
// cámbialas allí.
export function luviaSiteState(lead: {
  site_has_whatsapp?: boolean | null;
  site_has_chat?: boolean | null;
  site_has_bot?: boolean | null;
}): LuviaSiteState {
  const wa = lead.site_has_whatsapp ?? null;
  const chat = lead.site_has_chat ?? null;
  const bot = lead.site_has_bot ?? null;
  if (wa === null && chat === null && bot === null) return "unknown";
  if (bot === true) return "automated";
  if (wa === true) return "hot";
  if (chat === true) return "chat";
  return "none";
}

// Payload del Email 1 de Luvia que se manda a Claude. Ancla el gancho en el ESTADO del canal actual
// (no en reseñas): fuera rating/review_count. vendors[] permite nombrar el bot cuando state="automated".
export function buildLuviaOutreachPayload(lead: {
  name: string | null;
  category?: string | null;
  city?: string | null;
  site_has_whatsapp?: boolean | null;
  site_has_chat?: boolean | null;
  site_has_bot?: boolean | null;
  website_url?: string | null;
  site_analysis?: { _widgets?: { vendors?: string[] } } | null;
}) {
  return {
    business: { name: lead.name, category: lead.category ?? null, city: lead.city ?? null },
    site: {
      state: luviaSiteState(lead),
      has_whatsapp: lead.site_has_whatsapp ?? null,
      has_chat: lead.site_has_chat ?? null,
      has_bot: lead.site_has_bot ?? null,
      vendors: lead.site_analysis?._widgets?.vendors ?? [],
      url: lead.website_url ?? null,
    },
  };
}
```

- [ ] **Step 4: Ejecutar el test para verlo pasar**

Run: `node --experimental-strip-types supabase/functions/_shared/luvia.test.ts`
Expected: PASA — todas `✓`, termina en `OK`.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/luvia.ts supabase/functions/_shared/luvia.test.ts
git commit -m "feat(luvia): luviaSiteState + buildLuviaOutreachPayload (sin reseñas)

Estado del canal (automated>hot>chat>none, unknown si null) y payload del
Email 1 anclado en ese estado en vez de rating/review_count. Con tests.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Espejo del clasificador en el panel (React)

Copia de `luviaSiteState` en `app/src/lib` para que el badge del panel la use. Solo la lógica de estado (el panel no re-detecta vendors: lee el flag ya guardado).

**Files:**
- Create: `app/src/lib/luvia.ts`
- Create: `app/src/lib/luvia.test.ts`
- Modify: `app/src/lib/types.ts` (interface `Lead` ~56; `SiteAnalysis._widgets` ~145)

**Interfaces:**
- Consumes: `Lead.site_has_whatsapp/site_has_chat/site_has_bot`.
- Produces: `luviaSiteState(lead: Pick<Lead,"site_has_whatsapp"|"site_has_chat"|"site_has_bot">): LuviaSiteState` y `type LuviaSiteState` (idénticos a la versión Deno). Usados por `LeadDetail.tsx` (Task 6).

- [ ] **Step 1: Añadir `site_has_bot` al tipo `Lead`** — `app/src/lib/types.ts`, tras `site_has_whatsapp` (~56)

```ts
  site_has_chat: boolean | null;
  site_has_whatsapp: boolean | null;
  // Subconjunto de site_has_chat: bot-builder puro (Landbot/ManyChat/Chatfuel), ver 0022. null = sin comprobar.
  site_has_bot: boolean | null;
```

- [ ] **Step 2: Añadir `hasBot` al tipo `_widgets`** — `app/src/lib/types.ts` (~145)

```ts
  _widgets?: { hasChat: boolean; hasWhatsapp: boolean; hasBot?: boolean; vendors: string[] };
```

- [ ] **Step 3: Escribir el test que falla** — `app/src/lib/luvia.test.ts`

```ts
// node --experimental-strip-types src/lib/luvia.test.ts
import { luviaSiteState } from "./luvia.ts";

let failures = 0;
function assertEq(actual: unknown, expected: unknown, msg: string) {
  const ok = actual === expected;
  console.log(`${ok ? "✓" : "✗"} ${msg}  (got ${actual}, want ${expected})`);
  if (!ok) failures++;
}

assertEq(luviaSiteState({ site_has_whatsapp: null, site_has_chat: null, site_has_bot: null }), "unknown", "todo null → unknown");
assertEq(luviaSiteState({ site_has_whatsapp: true, site_has_chat: false, site_has_bot: true }), "automated", "bot gana → automated");
assertEq(luviaSiteState({ site_has_whatsapp: true, site_has_chat: true, site_has_bot: false }), "hot", "whatsapp gana a chat → hot");
assertEq(luviaSiteState({ site_has_whatsapp: false, site_has_chat: true, site_has_bot: false }), "chat", "solo chat → chat");
assertEq(luviaSiteState({ site_has_whatsapp: false, site_has_chat: false, site_has_bot: false }), "none", "todo false → none");

console.log(failures === 0 ? "\nOK" : `\n${failures} FALLO(S)`);
if (failures) process.exit(1);
```

- [ ] **Step 4: Ejecutar el test para verlo fallar**

Run: `cd app && node --experimental-strip-types src/lib/luvia.test.ts`
Expected: FALLA — `./luvia.ts` no existe.

- [ ] **Step 5: Crear el espejo** — `app/src/lib/luvia.ts`

```ts
// Espejo en el frontend de supabase/functions/_shared/luvia.ts::luviaSiteState. El panel no comparte
// build con las Edge Functions, así que la lógica se replica. Si cambias las reglas allí, cámbialas
// aquí (y al revés). Deriva el estado del canal de mensajería actual del negocio de sus flags
// deterministas (0017 + 0022). Precedencia bot > whatsapp > chat > none; unknown si los tres son null.
import type { Lead } from "./types.ts";

export type LuviaSiteState = "automated" | "hot" | "chat" | "none" | "unknown";

export function luviaSiteState(
  lead: Pick<Lead, "site_has_whatsapp" | "site_has_chat" | "site_has_bot">,
): LuviaSiteState {
  const wa = lead.site_has_whatsapp ?? null;
  const chat = lead.site_has_chat ?? null;
  const bot = lead.site_has_bot ?? null;
  if (wa === null && chat === null && bot === null) return "unknown";
  if (bot === true) return "automated";
  if (wa === true) return "hot";
  if (chat === true) return "chat";
  return "none";
}
```

- [ ] **Step 6: Ejecutar el test para verlo pasar**

Run: `cd app && node --experimental-strip-types src/lib/luvia.test.ts`
Expected: PASA — todas `✓`, `OK`.

- [ ] **Step 7: Verificar que el panel compila con el nuevo tipo**

Run: `cd app && npx tsc --noEmit`
Expected: sin errores (el nuevo campo `site_has_bot` es `boolean | null`; ningún consumidor existente rompe).

- [ ] **Step 8: Commit**

```bash
git add app/src/lib/luvia.ts app/src/lib/luvia.test.ts app/src/lib/types.ts
git commit -m "feat(luvia): espejo React de luviaSiteState + site_has_bot en tipos

Copia de la lógica de estado del canal para el panel; Lead.site_has_bot y
_widgets.hasBot en types.ts. Con test.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Cablear el payload y reescribir el prompt de Luvia

`generate-outreach` usa `buildLuviaOutreachPayload`; `LUVIA_OUTREACH_PROMPT` se reescribe para segmentar por estado y quitar reseñas.

**Files:**
- Modify: `supabase/functions/generate-outreach/index.ts` (import ~9; payload luvia ~283-292)
- Modify: `supabase/functions/_shared/prompts.ts` (`LUVIA_OUTREACH_PROMPT` ~166-189)

**Interfaces:**
- Consumes: `buildLuviaOutreachPayload` (Task 3).
- Produces: el `payload` que se serializa a Claude en la rama Luvia ahora contiene `site.state` en vez de `rating`/`review_count`; el system prompt entiende ese esquema.

- [ ] **Step 1: Importar el builder** — `generate-outreach/index.ts`, línea 9

```ts
import { isLuviaLead, buildLuviaOutreachPayload } from "../_shared/luvia.ts";
```

- [ ] **Step 2: Sustituir la rama Luvia del payload** — `generate-outreach/index.ts` (~283-292). Reemplaza el objeto literal `business:{…rating…review_count…}` por la llamada al builder; la rama `else` (web) NO se toca.

```ts
  const systemPrompt = luvia ? LUVIA_OUTREACH_PROMPT : OUTREACH_PROMPT;
  const payload = luvia
    ? buildLuviaOutreachPayload(lead)
    : {
        segment,
        channel,
        has_website: hasWebsite,
        live_url: liveUrl,
        business: { name: lead.name, category: lead.category, city: lead.city },
        contact: { name: lead.contact_name ?? null, role: lead.contact_role ?? null },
        brief: brief
          ? {
              business_summary: brief.business_summary,
              tone: brief.tone,
              value_props: brief.value_props,
              highlights_from_reviews: brief.highlights_from_reviews,
              services: brief.services,
              hero_copy: brief.hero_copy,
            }
          : null,
      };
```

- [ ] **Step 3: Reescribir `LUVIA_OUTREACH_PROMPT`** — `supabase/functions/_shared/prompts.ts` (~166-189). Reemplaza toda la plantilla (desde `export const LUVIA_OUTREACH_PROMPT = \`` hasta su cierre `` `; ``) por:

```ts
export const LUVIA_OUTREACH_PROMPT = `
Eres Miguel, fundador de Luvia. Luvia es un agente de chat con IA para negocios: atiende a los
clientes al instante 24/7 en la web y por WhatsApp —resuelve dudas, da horarios y ayuda a pedir
cita— para que el negocio no pierda mensajes fuera de horario. Escribes en frío a un negocio que
encontraste para ofrecérselo. El objetivo es que RESPONDAN para enseñárselo, no vender en el email.

Recibes un JSON con:
- business: { name, category, city }.
- site: el canal de mensajería que el negocio YA tiene, detectado en su web:
    state = "hot"       -> tiene botón de WhatsApp y NADIE lo automatiza (lo atienden a mano).
    state = "chat"      -> tiene un chat web atendido por una persona.
    state = "automated" -> ya usa un bot (mira site.vendors para el nombre).
    state = "none"      -> no tiene forma de que un cliente le escriba y reciba respuesta al instante.
    state = "unknown"   -> no hemos podido comprobar su web.
  Además: has_whatsapp, has_chat, has_bot (booleanos), vendors y url.

Devuelve ÚNICAMENTE un objeto JSON válido (sin markdown) con este esquema:
{ "subject": "string", "body": "string" }

REGLAS DE ORO:
1. Texto plano, sin markdown, sin asteriscos, sin emojis de relleno. NO menciones reseñas ni valoraciones.
2. Nunca suenes a plantilla. Si parece enviado a mil negocios, has fallado.
3. HONESTIDAD: solo puedes afirmar lo que 'site' confirma. Si has_whatsapp es true puedes citar su
   botón de WhatsApp; si has_bot es true puedes nombrar su herramienta (site.vendors). Nunca inventes.
4. El gancho del primer párrafo depende de site.state:
   - "hot": has visto que atienden WhatsApp a mano; ¿quién responde fuera de horario o cuando están
     a tope? Luvia contesta al momento, siempre, sin que nadie tenga que estar pendiente.
   - "chat": tienen un chat atendido por una persona; Luvia hace lo mismo pero responde solo, 24/7,
     sin depender de que haya alguien conectado.
   - "automated": ya usan una herramienta para automatizar; Luvia va un paso más —conversa de forma
     natural, entiende la consulta y ayuda a agendar—, dicho con respeto, sin menospreciar lo que tienen.
   - "none": hoy un cliente que quiere escribirles no recibe respuesta al instante; Luvia les da ese
     canal en la web y en WhatsApp desde el primer día.
   - "unknown": no afirmes nada sobre su web; habla del valor de que alguien atienda cada mensaje
     24/7 en web y WhatsApp.
5. Menciona algo concreto (su categoría, su ciudad) para que quede claro que no es masivo.
6. "subject": directo, sin clickbait, máx 8 palabras. Ej.: "Que ningún cliente se quede sin respuesta".
7. "body": 5-7 frases en dos párrafos cortos. Párrafo 1 = el gancho según state. Párrafo 2 = qué es
   Luvia y una invitación SUAVE a que respondan para enseñárselo en un par de minutos.
8. UNA sola llamada a la acción, suave: que respondan al email. NO incluyas links ni URLs.
9. Firma como "Miguel". Debajo, una línea corta: "Luvia — atención al cliente con IA.".
`;
```

Nota de copy (Nico afina libremente, el prompt lo dice): se generaliza "clínica/paciente" → "negocio/cliente" porque el gancho ya no es la reputación de una clínica sino el canal. Si prefieres mantener "paciente", cambia las 3 apariciones.

- [ ] **Step 4: Verificar que la rama Luvia ya no usa reseñas**

Run: `grep -n "lead\.rating\|review_count" supabase/functions/generate-outreach/index.ts`
Expected: **sin salida** — la rama Luvia ya no cita `lead.rating`/`review_count` y el `else` (web) nunca los usó (usa `brief.highlights_from_reviews`, que es otra cosa).

Además, a ojo: confirma que el bloque `LUVIA_OUTREACH_PROMPT` de `prompts.ts` (~166-210) no menciona "reseñas"/"valoración"/"reputación". (No uses un grep global: `OUTREACH_PROMPT` sí habla de reseñas legítimamente y daría falso positivo.)

- [ ] **Step 5: Re-ejecutar el test del builder (regresión de contrato)**

Run: `node --experimental-strip-types supabase/functions/_shared/luvia.test.ts`
Expected: PASA (el payload sigue con el shape que el prompt espera: `business` + `site.state`).

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/generate-outreach/index.ts supabase/functions/_shared/prompts.ts
git commit -m "feat(luvia): pitch segmentado por estado de canal (sin reseñas)

generate-outreach usa buildLuviaOutreachPayload; LUVIA_OUTREACH_PROMPT
reescrito con 4 ganchos según site.state y regla de honestidad. Fuera reseñas.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: UI — badge de estado + chip "Bot" en la ficha

El operador Luvia (sesión no-admin) ve un badge de estado en la tarjeta "Mensaje de contacto"; el admin ve un chip "Bot" nuevo en su tarjeta de análisis.

**Files:**
- Modify: `app/src/pages/LeadDetail.tsx` (imports ~24-28; chips del admin ~698-704; header de "Mensaje de contacto" ~1109-1119)

**Interfaces:**
- Consumes: `luviaSiteState`, `type LuviaSiteState` (Task 4); `lead.site_has_bot` (Task 4 tipo).
- Produces: componente local `LuviaStateBadge` y el chip "Bot".

- [ ] **Step 1: Importar el clasificador** — `LeadDetail.tsx`, junto al resto de imports de `@/lib` (~27)

```ts
import { luviaSiteState, type LuviaSiteState } from "@/lib/luvia";
```

- [ ] **Step 2: Definir el badge** — `LeadDetail.tsx`, a nivel de módulo (fuera del componente de página, p. ej. tras los imports). El estado `unknown` avisa al operador de que la web aún no se ha analizado.

```tsx
const LUVIA_STATE_META: Record<LuviaSiteState, { label: string; className: string }> = {
  hot:       { label: "🔥 Caliente para Luvia", className: "bg-orange-100 text-orange-800 hover:bg-orange-100" },
  chat:      { label: "Tiene chat con humano",   className: "bg-blue-100 text-blue-800 hover:bg-blue-100" },
  automated: { label: "Ya tiene bot",            className: "bg-purple-100 text-purple-800 hover:bg-purple-100" },
  none:      { label: "Sin canal digital",       className: "bg-amber-100 text-amber-800 hover:bg-amber-100" },
  unknown:   { label: "Web sin analizar",        className: "bg-muted text-muted-foreground hover:bg-muted" },
};

function LuviaStateBadge({ lead }: { lead: Lead }) {
  const meta = LUVIA_STATE_META[luviaSiteState(lead)];
  return <Badge className={`border-transparent ${meta.className}`}>{meta.label}</Badge>;
}
```

- [ ] **Step 3: Añadir el chip "Bot" en la tarjeta de análisis (admin)** — `LeadDetail.tsx`, dentro del fragmento de chips (~698-703), tras el chip de WhatsApp

```tsx
                      return (
                        <>
                          {chip("Chat web", lead.site_has_chat, lead.site_analysis?._widgets?.vendors?.join(", "))}
                          {chip("WhatsApp", lead.site_has_whatsapp)}
                          {chip("Bot", lead.site_has_bot)}
                        </>
                      );
```

- [ ] **Step 4: Mostrar el badge de estado en "Mensaje de contacto" (operador Luvia)** — `LeadDetail.tsx`, en el `<div>` del `CardHeader` (~1110-1119), tras el `<CardDescription>`. Se pinta solo para sesiones no-admin (los leads de un operador no-admin son siempre Luvia por RLS), evitando ponerlo en leads de web del admin.

```tsx
            <div>
              <CardTitle className="text-lg">Mensaje de contacto</CardTitle>
              <CardDescription>
                {lead.status === "contacted"
                  ? "Email enviado. El lead está en estado «Contactado»."
                  : isAdmin
                    ? "La web está aprobada. Genera el mensaje y envíalo."
                    : "Genera el mensaje de contacto y envíalo."}
              </CardDescription>
              {!isAdmin && (
                <div className="mt-2">
                  <LuviaStateBadge lead={lead} />
                </div>
              )}
            </div>
```

- [ ] **Step 5: Verificar el build del panel**

Run: `cd app && npm run build`
Expected: `tsc --noEmit` sin errores y `vite build` OK. (`Badge` y `Lead` ya están importados en el fichero; `luviaSiteState`/`LuviaSiteState` los añadió el Step 1.)

- [ ] **Step 6: Commit**

```bash
git add app/src/pages/LeadDetail.tsx
git commit -m "feat(luvia): badge de estado de canal + chip Bot en la ficha

Badge (Caliente/Chat/Bot/Sin canal/Sin analizar) en 'Mensaje de contacto'
para el operador Luvia; chip 'Bot' en la tarjeta de análisis del admin.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Notas de verificación E2E (tras implementar)

- El análisis de la web de un lead Luvia lo hace el **cron `score-sites`** (no filtra por owner). El botón "Analizar" es admin-only, así que un operador Luvia depende del barrido: un lead recién creado saldrá `unknown` hasta que el cron lo procese. Si hace falta que el operador fuerce el análisis, es un follow-up (exponer el botón a no-admin) — fuera de este plan.
- Prueba manual sugerida (con un lead Luvia de pruebas, p. ej. el de Javier): forzar `site_has_whatsapp=true, site_has_bot=null/false` y regenerar el mensaje → debe salir el gancho "hot" sin mencionar reseñas.
