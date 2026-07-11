# Luvia Demo Outreach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mandar en frío (email + WhatsApp) un link a una demo de Luvia **ya montada y revisada** para la clínica, replicando el patrón "tu web está lista" de WebForge.

**Architecture:** El operador prepara la demo desde la ficha del lead (WebForge) → una Edge de WebForge llama a un endpoint nuevo de Luvia que extrae los datos de la web de la clínica, los guarda como snapshot en el Supabase de Luvia (tabla `demos`) y devuelve un id → WebForge guarda `luvia_demo_url` en el lead → el email de Luvia (Claude) y el WhatsApp manual incluyen ese link → la ruta `/demo/:id` de la landing de Luvia renderiza el snapshot y auto-abre el chat.

**Tech Stack:** Supabase Edge Functions (Deno), React + Vite (panel WebForge), proyecto Lovable de Luvia (React + su Supabase `nqyumnkidfkkceigiktu`), Anthropic Haiku para el email. Tests de lógica pura con `node --experimental-strip-types`.

## Global Constraints

- Firma de Luvia = **Nico**, nunca "Miguel". (Copiar verbatim.)
- Luvia solo manda **Email 1** (sin secuencia de seguimientos).
- Gate = revisión humana: el operador abre `/demo/:id` antes de enviar. Los leads Luvia se saltan `status='approved'` (comportamiento actual, se mantiene).
- Sin demo (`luvia_demo_url` null) → **cae al pitch reply-first actual** (no romper nada).
- Secrets solo en servidor. El token WebForge→Luvia por env, nunca en el frontend.
- Snapshot vive en el Supabase de Luvia, tabla `demos` dedicada, aislada de clientes.
- Config (bases/URLs/tokens) por env, no hardcodeado ni commiteado.
- Cambios en Luvia van por Lovable MCP (`send_message`), no por este repo.
- El link va SOLO en su propia línea al final del body (para que la plantilla lo renderice como botón).

---

### Task 1: Migración — columnas de demo en `leads`

**Files:**
- Create: `supabase/migrations/0023_lead_luvia_demo.sql`

**Interfaces:**
- Produces: columnas `leads.luvia_demo_id text`, `leads.luvia_demo_url text` (ambas nullable).

- [ ] **Step 1: Escribir la migración**

```sql
-- 0023_lead_luvia_demo.sql — Demo de Luvia pre-extraída para el outreach.
-- luvia_demo_id  = id de la fila en la tabla `demos` del Supabase de Luvia.
-- luvia_demo_url = URL pública de la demo (LUVIA_DEMO_BASE/demo/:id) que va en el email/WhatsApp.
-- null = aún no se ha preparado demo para este lead (→ pitch reply-first).
alter table leads add column if not exists luvia_demo_id text;
alter table leads add column if not exists luvia_demo_url text;
```

- [ ] **Step 2: Verificar que aplica sin error (sintaxis)**

Run: `grep -c "add column if not exists" supabase/migrations/0023_lead_luvia_demo.sql`
Expected: `2`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0023_lead_luvia_demo.sql
git commit -m "feat(luvia): migración columnas luvia_demo_id/url en leads"
```

> Nota de despliegue: esta migración se aplica en prod por el workflow manual (patrón `apply-*.yml`, ver Task 9). NO se aplica sola.

---

### Task 2: `buildLuviaOutreachPayload` incluye `demo_url`

**Files:**
- Modify: `supabase/functions/_shared/luvia.ts:39-60`
- Test: `supabase/functions/_shared/luvia.test.ts`

**Interfaces:**
- Consumes: `lead.luvia_demo_url` (string | null).
- Produces: el payload de Claude ahora tiene `demo_url: string | null` a nivel raíz.

- [ ] **Step 1: Añadir el test que falla** (append en `luvia.test.ts`, antes de la línea `console.log(failures === 0 ...)`)

```typescript
// ── demo_url en el payload ─────────────────────────────────────────────────
const pDemo = buildLuviaOutreachPayload({
  name: "Clínica X", category: "estética", city: "València",
  site_has_whatsapp: true, site_has_chat: false, site_has_bot: false,
  website_url: "https://clinicax.es",
  site_analysis: { _widgets: { vendors: [] } },
  luvia_demo_url: "https://luvia-ia.es/demo/abc123",
});
assertEq((pDemo as Record<string, unknown>).demo_url, "https://luvia-ia.es/demo/abc123", "payload: demo_url presente");
assertEq((p as Record<string, unknown>).demo_url, null, "payload: demo_url null cuando no hay demo");
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `node --experimental-strip-types supabase/functions/_shared/luvia.test.ts`
Expected: FALLO — `demo_url` es `undefined`, se esperaba la URL / `null`.

- [ ] **Step 3: Implementar** — en `luvia.ts`, añadir el campo al tipo del parámetro y al retorno:

En la firma del objeto parámetro (tras `website_url?: string | null;`) añadir:
```typescript
  luvia_demo_url?: string | null;
```
En el objeto retornado, tras la clave `site: {...},` añadir a nivel raíz:
```typescript
    demo_url: lead.luvia_demo_url ?? null,
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `node --experimental-strip-types supabase/functions/_shared/luvia.test.ts`
Expected: `OK` (todas ✓).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/luvia.ts supabase/functions/_shared/luvia.test.ts
git commit -m "feat(luvia): demo_url en el payload de outreach"
```

---

### Task 3: Helper `buildLuviaFinalBody` (append del link)

**Files:**
- Modify: `supabase/functions/_shared/luvia.ts` (añadir función exportada al final)
- Test: `supabase/functions/_shared/luvia.test.ts`

**Interfaces:**
- Produces: `buildLuviaFinalBody(bodyText: string, demoUrl: string | null | undefined): string` — devuelve el body con el link en su propia línea al final si `demoUrl` existe; si no, el body tal cual.

- [ ] **Step 1: Test que falla** (append en `luvia.test.ts`, antes del `console.log` final; añadir el import)

En la línea 2, ampliar el import:
```typescript
import { isLuviaLead, luviaSiteState, buildLuviaOutreachPayload, buildLuviaFinalBody } from "./luvia.ts";
```
Añadir los asserts:
```typescript
// ── buildLuviaFinalBody ────────────────────────────────────────────────────
assertEq(buildLuviaFinalBody("Hola.\nNico", "https://luvia-ia.es/demo/x"), "Hola.\nNico\n\nhttps://luvia-ia.es/demo/x", "final body: link en su línea");
assertEq(buildLuviaFinalBody("Hola.\nNico", null), "Hola.\nNico", "final body: sin link si demoUrl null");
assertEq(buildLuviaFinalBody("  Hola.  ", "https://d"), "Hola.\n\nhttps://d", "final body: trim del body");
```

- [ ] **Step 2: Correr y ver fallar**

Run: `node --experimental-strip-types supabase/functions/_shared/luvia.test.ts`
Expected: FALLO — `buildLuviaFinalBody is not a function`.

- [ ] **Step 3: Implementar** — añadir al final de `luvia.ts`:

```typescript
// Body final del Email 1 de Luvia: si hay demo, el sistema añade el link EN SU PROPIA LÍNEA al
// final (para que la plantilla lo renderice como botón); la IA nunca escribe la URL.
export function buildLuviaFinalBody(bodyText: string, demoUrl: string | null | undefined): string {
  const b = bodyText.trim();
  return demoUrl ? `${b}\n\n${demoUrl}` : b;
}
```

- [ ] **Step 4: Correr y ver pasar**

Run: `node --experimental-strip-types supabase/functions/_shared/luvia.test.ts`
Expected: `OK`.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/luvia.ts supabase/functions/_shared/luvia.test.ts
git commit -m "feat(luvia): helper buildLuviaFinalBody para append del link de demo"
```

---

### Task 4: Reescribir `LUVIA_OUTREACH_PROMPT` (variante demo + firma Nico)

**Files:**
- Modify: `supabase/functions/_shared/prompts.ts:195-236`
- Test: `supabase/functions/_shared/prompts.test.ts` (crear)

**Interfaces:**
- Consumes: payload con `demo_url` (Task 2).
- Produces: `LUVIA_OUTREACH_PROMPT` firma "Nico", ramifica según `demo_url`.

- [ ] **Step 1: Test que falla** — crear `supabase/functions/_shared/prompts.test.ts`:

```typescript
// node --experimental-strip-types supabase/functions/_shared/prompts.test.ts
import { LUVIA_OUTREACH_PROMPT } from "./prompts.ts";

let failures = 0;
function assert(cond: boolean, msg: string) {
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) failures++;
}

assert(LUVIA_OUTREACH_PROMPT.includes("Nico"), "el prompt firma como Nico");
assert(!LUVIA_OUTREACH_PROMPT.includes("Miguel"), "el prompt NO menciona a Miguel");
assert(LUVIA_OUTREACH_PROMPT.includes("demo_url"), "el prompt ramifica según demo_url");
assert(/reply-first|responder|respondan/i.test(LUVIA_OUTREACH_PROMPT), "conserva el fallback reply-first");

console.log(failures === 0 ? "\nOK" : `\n${failures} FALLO(S)`);
if (failures) process.exit(1);
```

- [ ] **Step 2: Correr y ver fallar**

Run: `node --experimental-strip-types supabase/functions/_shared/prompts.test.ts`
Expected: FALLO — el prompt actual dice "Miguel" y no menciona `demo_url`.

- [ ] **Step 3: Implementar** — sustituir el bloque `export const LUVIA_OUTREACH_PROMPT = \`...\`;` (líneas 195-236) por:

```typescript
export const LUVIA_OUTREACH_PROMPT = `
Eres Nico, de Luvia. Luvia es un agente de chat con IA para negocios: atiende a los clientes al
instante 24/7 en la web y por WhatsApp —resuelve dudas, da horarios y ayuda a pedir cita—. Escribes
en frío a un negocio para ofrecérselo.

Recibes un JSON con:
- business: { name, category, city }.
- site: el canal de mensajería que el negocio YA tiene, detectado en su web:
    state = "hot" | "chat" | "automated" | "none" | "unknown"; has_whatsapp, has_chat, has_bot, vendors, url.
- demo_url: string | null. Si NO es null, YA le has montado una demo del asistente cargada con los
  datos reales de su web, y el sistema añadirá ese enlace al FINAL del email (tú NUNCA escribas la URL).

Devuelve ÚNICAMENTE un objeto JSON válido (sin markdown): { "subject": "string", "body": "string" }

REGLAS DE ORO:
1. Texto plano, sin markdown, sin asteriscos, sin emojis de relleno. NO menciones reseñas ni valoraciones.
2. Nunca suenes a plantilla. Si parece enviado a mil negocios, has fallado.
3. HONESTIDAD: solo afirma lo que 'site' confirma (su categoría, ciudad, su botón de WhatsApp si
   has_whatsapp, su herramienta en vendors si has_bot). Nunca inventes.
4. Menciona algo concreto (su categoría o su ciudad) para que no parezca masivo.
5. Firma como "Nico". Debajo, una línea corta: "Luvia — atención al cliente con IA.".
6. UNA sola llamada a la acción.

SEGÚN demo_url:
A) demo_url NO es null → el gancho es que YA le montaste el asistente y puede probarlo:
   - Párrafo 1: viste la web de business.name y montaste un asistente con sus tratamientos y horarios.
   - Párrafo 2: invítale a hablar con él como si fuera un cliente pidiendo cita. El enlace irá justo
     debajo (lo añade el sistema; tú NO lo escribas). Cierra con que, si le encaja, lo dejas
     atendiendo su WhatsApp 24/7, y si no, sin problema.
   - "subject": directo, máx 8 palabras. Ej.: "Le monté un asistente a tu clínica".
B) demo_url ES null → NO hay demo. Pitch reply-first (invitar a que respondan para enseñárselo):
   - Párrafo 1 = gancho según site.state:
     - "hot": atienden WhatsApp a mano; ¿quién responde fuera de horario? Luvia contesta al momento.
     - "chat": tienen chat con persona; Luvia responde solo, 24/7, sin depender de que haya alguien.
     - "automated": ya usan una herramienta; Luvia conversa de forma natural y ayuda a agendar.
     - "none": hoy quien les escribe no recibe respuesta al instante; Luvia les da ese canal.
     - "unknown": no afirmes nada sobre su web; habla del valor de atender cada mensaje 24/7.
   - Párrafo 2 = qué es Luvia + UNA CTA suave: que respondan para enseñárselo. NO incluyas links.
   - "subject": directo, máx 8 palabras. Ej.: "Que ningún cliente se quede sin respuesta".
`;
```

- [ ] **Step 4: Correr y ver pasar**

Run: `node --experimental-strip-types supabase/functions/_shared/prompts.test.ts`
Expected: `OK`.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/prompts.ts supabase/functions/_shared/prompts.test.ts
git commit -m "feat(luvia): prompt de outreach con variante demo + firma Nico"
```

---

### Task 5: `generate-outreach` — inyectar el link de demo en el body de Luvia

**Files:**
- Modify: `supabase/functions/generate-outreach/index.ts:352-354` (y el import de `buildLuviaFinalBody`)

**Interfaces:**
- Consumes: `buildLuviaFinalBody` (Task 3), `lead.luvia_demo_url` (Task 1, ya viene en `select("*")`), payload con `demo_url` (Task 2, ya lo construye `buildLuviaOutreachPayload(lead)`).

- [ ] **Step 1: Ampliar el import** (línea 9)

```typescript
import { isLuviaLead, buildLuviaOutreachPayload, buildLuviaFinalBody } from "../_shared/luvia.ts";
```

- [ ] **Step 2: Cambiar el cálculo de `finalBody`** — sustituir (líneas ~352-354):

```typescript
  const finalBody = luvia
    ? bodyText
    : (channel === "email" ? `${bodyText}\n\n${emailLink}` : bodyText);
```
por:
```typescript
  const finalBody = luvia
    ? buildLuviaFinalBody(bodyText, lead.luvia_demo_url)
    : (channel === "email" ? `${bodyText}\n\n${emailLink}` : bodyText);
```

- [ ] **Step 3: Verificar el type-check de la función** (Deno)

Run: `deno check supabase/functions/generate-outreach/index.ts`
Expected: sin errores. (Si `deno` no está instalado, verificar a ojo que `lead.luvia_demo_url` existe en el tipo del lead; `select("*")` lo trae en runtime.)

- [ ] **Step 4: Correr los tests de lógica pura para no regresar**

Run: `node --experimental-strip-types supabase/functions/_shared/luvia.test.ts`
Expected: `OK`.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/generate-outreach/index.ts
git commit -m "feat(luvia): generate-outreach añade el link de demo al Email 1"
```

---

### Task 6: Edge `prepare-luvia-demo` (WebForge → Luvia create-demo)

**Files:**
- Create: `supabase/functions/prepare-luvia-demo/index.ts`
- Create: `supabase/functions/_shared/luviaDemo.ts` (helper puro)
- Test: `supabase/functions/_shared/luviaDemo.test.ts`

**Interfaces:**
- Consumes: env `LUVIA_DEMO_BASE`, `LUVIA_CREATE_DEMO_URL`, `LUVIA_API_TOKEN`.
- Produces: helper `buildDemoUrl(base: string, id: string): string`. Edge que recibe `{ lead_id }` y persiste `luvia_demo_id`/`luvia_demo_url` en el lead. Respuesta `{ ok: true, demo_url, empty }` o `{ error }`.

- [ ] **Step 1: Test del helper puro** — crear `supabase/functions/_shared/luviaDemo.test.ts`:

```typescript
// node --experimental-strip-types supabase/functions/_shared/luviaDemo.test.ts
import { buildDemoUrl } from "./luviaDemo.ts";

let failures = 0;
function assertEq(a: unknown, b: unknown, m: string) {
  console.log(`${a === b ? "✓" : "✗"} ${m}  (got ${a})`); if (a !== b) failures++;
}

assertEq(buildDemoUrl("https://luvia-ia.es", "abc"), "https://luvia-ia.es/demo/abc", "url normal");
assertEq(buildDemoUrl("https://luvia-ia.es/", "abc"), "https://luvia-ia.es/demo/abc", "quita slash final");

console.log(failures === 0 ? "\nOK" : `\n${failures} FALLO(S)`);
if (failures) process.exit(1);
```

- [ ] **Step 2: Correr y ver fallar**

Run: `node --experimental-strip-types supabase/functions/_shared/luviaDemo.test.ts`
Expected: FALLO — módulo no existe.

- [ ] **Step 3: Implementar el helper** — crear `supabase/functions/_shared/luviaDemo.ts`:

```typescript
// URL pública de la demo de Luvia: {base}/demo/{id}. base sin slash final.
export function buildDemoUrl(base: string, id: string): string {
  return `${base.replace(/\/+$/, "")}/demo/${id}`;
}
```

- [ ] **Step 4: Correr y ver pasar**

Run: `node --experimental-strip-types supabase/functions/_shared/luviaDemo.test.ts`
Expected: `OK`.

- [ ] **Step 5: Implementar la Edge** — crear `supabase/functions/prepare-luvia-demo/index.ts`:

```typescript
// prepare-luvia-demo: el operador prepara la demo de Luvia para un lead.
// 1) lee la URL de la web de la clínica del lead
// 2) llama al endpoint create-demo del Supabase de Luvia (extrae + guarda snapshot, devuelve id)
// 3) persiste luvia_demo_id / luvia_demo_url en el lead
// Gate: la revisión de la demo la hace el operador abriendo la URL; aquí solo se prepara.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildDemoUrl } from "../_shared/luviaDemo.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { lead_id } = await req.json();
    if (!lead_id) return json({ error: "Falta lead_id." }, 400);

    const base = Deno.env.get("LUVIA_DEMO_BASE");
    const createUrl = Deno.env.get("LUVIA_CREATE_DEMO_URL");
    const token = Deno.env.get("LUVIA_API_TOKEN");
    if (!base || !createUrl || !token)
      return json({ error: "Config de Luvia incompleta (LUVIA_DEMO_BASE/LUVIA_CREATE_DEMO_URL/LUVIA_API_TOKEN)." }, 500);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: lead, error: leadErr } = await supabase
      .from("leads").select("id, website_url").eq("id", lead_id).maybeSingle();
    if (leadErr) return json({ error: leadErr.message }, 500);
    if (!lead) return json({ error: "Lead no encontrado." }, 404);
    if (!lead.website_url) return json({ error: "El lead no tiene website_url; no se puede montar la demo." }, 409);

    const res = await fetch(createUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ clinic_url: lead.website_url }),
    });
    const out = await res.json().catch(() => null);
    if (!res.ok || !out?.id)
      return json({ error: `Luvia create-demo falló (${res.status}): ${out?.error ?? "sin id"}` }, 502);

    const demoUrl = buildDemoUrl(base, out.id);
    const { error: updErr } = await supabase
      .from("leads").update({ luvia_demo_id: out.id, luvia_demo_url: demoUrl }).eq("id", lead_id);
    if (updErr) return json({ error: `Guardando la demo: ${updErr.message}` }, 500);

    return json({ ok: true, demo_url: demoUrl, empty: out.empty === true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "error" }, 500);
  }
});
```

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/prepare-luvia-demo/index.ts supabase/functions/_shared/luviaDemo.ts supabase/functions/_shared/luviaDemo.test.ts
git commit -m "feat(luvia): edge prepare-luvia-demo (crea snapshot y guarda link)"
```

---

### Task 7: `contact.ts` — texto de WhatsApp para Luvia

**Files:**
- Modify: `app/src/lib/contact.ts` (añadir función tras `whatsappOutreachText`)
- Test: `app/src/lib/contact.test.ts` (crear)

**Interfaces:**
- Produces: `whatsappLuviaText(negocio: string | null | undefined, demoUrl: string): string`.

- [ ] **Step 1: Test que falla** — crear `app/src/lib/contact.test.ts`:

```typescript
// node --experimental-strip-types app/src/lib/contact.test.ts
import { whatsappLuviaText } from "./contact.ts";

let failures = 0;
function assert(cond: boolean, msg: string) {
  console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) failures++;
}

const t = whatsappLuviaText("Clínica X", "https://luvia-ia.es/demo/abc");
assert(t.includes("Nico"), "firma Nico");
assert(t.includes("Clínica X"), "nombre del negocio");
assert(t.includes("https://luvia-ia.es/demo/abc"), "incluye el link de demo");
assert(whatsappLuviaText(null, "https://d").length > 0, "aguanta negocio null");

console.log(failures === 0 ? "\nOK" : `\n${failures} FALLO(S)`);
if (failures) process.exit(1);
```

- [ ] **Step 2: Correr y ver fallar**

Run: `node --experimental-strip-types app/src/lib/contact.test.ts`
Expected: FALLO — `whatsappLuviaText` no exportada.

- [ ] **Step 3: Implementar** — añadir al final de `app/src/lib/contact.ts`:

```typescript
// Texto de WhatsApp saliente manual para leads de Luvia: enlaza la demo ya montada, firma Nico.
export function whatsappLuviaText(
  negocio: string | null | undefined,
  demoUrl: string,
): string {
  const n = (negocio ?? "").trim();
  const saludo = n
    ? `Hola 👋 soy Nico, de Luvia. Le monté un asistente a ${n} con vuestros datos, pruébalo:`
    : `Hola 👋 soy Nico, de Luvia. Monté un asistente con vuestros datos, pruébalo:`;
  return (
    `${saludo}\n${demoUrl}\n\n` +
    `Háblale como si fueras un cliente pidiendo cita. Si te encaja, lo dejamos atendiendo tu WhatsApp 24/7.\n\n` +
    `Un saludo.`
  );
}
```

- [ ] **Step 4: Correr y ver pasar**

Run: `node --experimental-strip-types app/src/lib/contact.test.ts`
Expected: `OK`.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/contact.ts app/src/lib/contact.test.ts
git commit -m "feat(luvia): whatsappLuviaText para el envío manual con link de demo"
```

---

### Task 8: Ficha del lead — botón "Preparar demo Luvia" + WhatsApp Luvia

**Files:**
- Modify: `app/src/pages/LeadDetail.tsx`

**Interfaces:**
- Consumes: Edge `prepare-luvia-demo` (Task 6), `whatsappLuviaText` (Task 7), `isLuviaLead`/estado Luvia ya presentes, `lead.luvia_demo_url`.

- [ ] **Step 1: Determinar si el lead es Luvia en el cliente**

Ya se importa `luviaSiteState` y hay `LUVIA_STATE_META` (línea 27, 87). Localizar cómo el panel sabe que es un lead Luvia (owner ≠ admin). Si existe un helper/flag `isLuvia` en `app/src/lib/luvia.ts` o admin.ts, reutilizarlo; si no, derivarlo del owner del lead y el admin id disponible en el cliente (mismo criterio que el badge de estado de canal que ya se pinta). Guardar en una const `const isLuvia = ...;` cerca del render.

- [ ] **Step 2: Añadir el handler de preparar demo** (junto a los otros `supabase.functions.invoke`, p.ej. tras el de `generate-outreach` ~línea 291)

```typescript
const [preparingDemo, setPreparingDemo] = useState(false);
const [demoError, setDemoError] = useState<string | null>(null);

async function prepareLuviaDemo() {
  setPreparingDemo(true);
  setDemoError(null);
  try {
    const { data, error } = await supabase.functions.invoke("prepare-luvia-demo", {
      body: { lead_id: lead.id },
    });
    if (error) throw error;
    if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
    await loadAll(); // refresca lead.luvia_demo_url
  } catch (e) {
    setDemoError(e instanceof Error ? e.message : "No se pudo preparar la demo.");
  } finally {
    setPreparingDemo(false);
  }
}
```

- [ ] **Step 3: Renderizar el botón + link de revisión** (solo si `isLuvia`, en la zona de acciones del lead)

```tsx
{isLuvia && (
  <div className="flex flex-col gap-1">
    <Button onClick={prepareLuviaDemo} disabled={preparingDemo} variant="outline" size="sm">
      {preparingDemo ? "Preparando demo…" : lead.luvia_demo_url ? "Regenerar demo Luvia" : "Preparar demo Luvia"}
    </Button>
    {lead.luvia_demo_url && (
      <a href={lead.luvia_demo_url} target="_blank" rel="noopener noreferrer"
         className="text-xs text-sage-800 underline underline-offset-2">
        Revisar la demo →
      </a>
    )}
    {demoError && <span className="text-xs text-coral">{demoError}</span>}
  </div>
)}
```

- [ ] **Step 4: Usar `whatsappLuviaText` para leads Luvia** — ampliar el import (línea 26) y cambiar `openWhatsappComposer` (línea ~351-355):

Import:
```typescript
import { waLink, waNumber, whatsappOutreachText, whatsappLuviaText } from "@/lib/contact";
```
En `openWhatsappComposer`, sustituir el `setWaText(...)`:
```typescript
setWaText(
  isLuvia && lead.luvia_demo_url
    ? whatsappLuviaText(lead.name, lead.luvia_demo_url)
    : whatsappOutreachText(lead.name, site.live_url, bookUrl),
);
```

- [ ] **Step 5: Verificar build del panel**

Run: `cd app && npm run build`
Expected: build OK, sin errores de TypeScript.

- [ ] **Step 6: Commit**

```bash
git add app/src/pages/LeadDetail.tsx
git commit -m "feat(luvia): ficha con botón Preparar demo Luvia y WhatsApp con link de demo"
```

---

### Task 9: Config de entorno (env) + workflow de migración

**Files:**
- Modify: `.env` (raíz, NO commitear), secretos Supabase (prod)
- Create: `.github/workflows/apply-luvia-demo.yml` (patrón de `apply-lead-site-bot.yml`)

**Interfaces:**
- Produces: `LUVIA_DEMO_BASE`, `LUVIA_CREATE_DEMO_URL`, `LUVIA_API_TOKEN` disponibles para `prepare-luvia-demo`; migración 0023 aplicable en prod.

- [ ] **Step 1: Fijar las env (local + secretos Edge)**

```
LUVIA_DEMO_BASE=https://luvia-ia.es
LUVIA_CREATE_DEMO_URL=https://nqyumnkidfkkceigiktu.supabase.co/functions/v1/create-demo
LUVIA_API_TOKEN=<token que da Luvia; el MISMO que valida create-demo en el lado Luvia>
```
Añadir a `.env` raíz y a los secretos de las Edge Functions en prod (dashboard Supabase / CLI). NO commitear valores.

- [ ] **Step 2: Crear el workflow de migración** — `.github/workflows/apply-luvia-demo.yml`, copiando `apply-lead-site-bot.yml` y cambiando el fichero a `0023_lead_luvia_demo.sql` y el nombre del job.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/apply-luvia-demo.yml
git commit -m "ci(luvia): workflow manual para aplicar la migración 0023 (luvia_demo)"
```

---

### Task 10: Lado Luvia — tabla `demos`, `create-demo`, `get-demo`, ruta `/demo/:id`

**Files:** proyecto Lovable `4e9867a5-4523-4763-b825-f2595b0b30ab` (vía Lovable MCP `send_message`, NO este repo).

**Interfaces:**
- Consumes: llamada de `prepare-luvia-demo` a `POST /create-demo { clinic_url }` con `Authorization: Bearer <LUVIA_API_TOKEN>`.
- Produces: `create-demo` devuelve `{ id, empty }`; ruta pública `https://luvia-ia.es/demo/:id` que renderiza el snapshot y auto-abre el chat.

- [ ] **Step 1: Tabla + endpoints** — `send_message` a Luvia (plan_mode=false):

> "Crea una tabla `demos` en el Supabase del proyecto: columnas `id uuid primary key default gen_random_uuid()`, `clinic_url text not null`, `clinic_name text`, `snapshot jsonb not null`, `created_at timestamptz not null default now()`. RLS: SELECT público por id (anon puede leer una fila por su id); INSERT solo service role.
>
> Crea una Edge Function `create-demo` (POST): valida `Authorization: Bearer <LUVIA_API_TOKEN>` contra un secreto del proyecto; recibe `{ clinic_url }`; ejecuta la MISMA extracción que `demo-clinic-extract` (reutiliza su lógica) sobre esa URL; inserta una fila en `demos` con `clinic_url`, `clinic_name` (nombre_clinica del extract) y `snapshot` = { data: ExtractData, pages_scanned }; responde `{ id, empty }` donde `empty` es true si el extract no encontró servicios ni datos clave.
>
> Crea una Edge Function pública `get-demo` (GET `?id=`) que devuelve `{ clinic_url, clinic_name, snapshot }` de esa fila, o 404 si no existe."

- [ ] **Step 2: Ruta `/demo/:id`** — `send_message` a Luvia:

> "Añade una ruta `/demo/:id`. Al cargar, hace fetch a `get-demo?id=:id`. Con el resultado, renderiza el mismo `ResultCard` que ya usa `ClinicAnalyzerSection` (servicios, horario, ubicación, pago) y **auto-abre el `ClinicChatPanel`** pasándole `clinicData`, `clinicName` y `clinicUrl` del snapshot, para que el visitante pueda hablar con el asistente de inmediato. Si el id no existe (404), muestra un estado amable con CTA a `#pide-demo`. No cambies la lógica interna de `ClinicChatPanel`."

- [ ] **Step 3: Verificar en el preview de Luvia**

Comprobar con `mcp__claude_ai_Lovable__query_database` que la tabla `demos` existe, y abrir `preview_url + /demo/<id de prueba>` para ver que renderiza y el chat abre. Insertar una fila de prueba vía `create-demo` con una URL real de clínica.

- [ ] **Step 4: (sin commit en este repo)** — los cambios viven en Luvia. Anotar el `commit_sha` que devuelve `send_message` en el PR de WebForge para trazabilidad.

---

## Verificación E2E (tras todas las tasks)

1. Aplicar migración 0023 (workflow) + desplegar Edges (`prepare-luvia-demo`) + panel.
2. En un lead Luvia real con `website_url`: pulsar "Preparar demo Luvia" → aparece "Revisar la demo →".
3. Abrir el link → la demo carga con los datos de la clínica y el chat abre.
4. "Generar email" → el Email 1 (borrador) trae el copy "ya te lo monté", firma Nico, y el link de demo en su línea.
5. Enviar (send-email) a una dirección de prueba → llega con el botón a la demo.
6. WhatsApp manual → el composer trae el texto de `whatsappLuviaText` con el link.
7. Lead Luvia SIN demo preparada → "Generar email" produce el pitch reply-first (sin link). No roto.

## Self-Review (cobertura del spec)

- Snapshot en Luvia, tabla `demos` → Task 10. ✔
- `/demo/:id` reutiliza ResultCard + ClinicChatPanel → Task 10. ✔
- Prompt demo + firma Nico → Task 4. ✔
- generate-outreach inyecta link con fallback reply-first → Tasks 2,3,5. ✔
- prepare-luvia-demo + storage columns → Tasks 1,6. ✔
- get-demo público → Task 10. ✔
- Ficha: botón + review + WhatsApp Luvia → Tasks 7,8. ✔
- Config env + token bearer → Task 9. ✔
- Gate humano (revisar /demo/:id) → E2E paso 2-3. ✔
- Tests → Tasks 2,3,4,6,7. ✔
```
