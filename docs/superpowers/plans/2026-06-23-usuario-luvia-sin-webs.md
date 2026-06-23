# Usuario Luvia (Miguel) — panel sin maquinaria de webs · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el usuario no-admin (Miguel, producto Luvia) use el mismo panel sin ver nada de la construcción de webs, y pueda contactar clínicas por email con copy de Luvia sin construir ninguna web.

**Architecture:** Un solo sistema. El rol se deriva del email/dueño: admin = `nicolassotodavid@gmail.com`. El front oculta la maquinaria de webs a no-admin; el orquestador no procesa leads de no-admin; `generate-outreach` toma una rama Luvia (sin gates de web, copy propio) cuando el dueño del lead no es el admin. Sin cambios de base de datos.

**Tech Stack:** React + Vite + TypeScript (panel), Supabase Edge Functions (Deno/TS), orquestador Node/TS. Tests de helpers puros = scripts de aserción a mano corridos con `node --experimental-strip-types` (no hay framework). El resto se verifica con `npm run build` (tsc) y prueba manual.

## Global Constraints

- Secrets SOLO en servidor; nunca en el frontend (CLAUDE.md).
- Identificación admin: email `nicolassotodavid@gmail.com`. Front via `VITE_ADMIN_EMAIL`; orquestador/edge via `ADMIN_USER_ID` (UUID de `auth.users`).
- Salidas de Claude en JSON estricto; parsear con try/catch (CLAUDE.md).
- Modelo de outreach: `claude-haiku-4-5-20251001` (ya en uso en `generate-outreach`).
- ORDEN PERMANENTE: nunca enviar a clínicas reales sin OK explícito de David; probar solo contra su Gmail (memoria `no-enviar-a-clientes`).
- Vercel publica desde `master`; `npm run build` (tsc --noEmit) DEBE pasar antes de cualquier push, o prod se queda en el bundle viejo sin aviso (memoria `vercel-build-falla-silencioso`).
- Este sprint NO añade migraciones. WhatsApp saliente y seguimientos de Luvia quedan fuera (memoria `luvia-whatsapp-siguiente-sprint`).
- Rama de trabajo: `feat/usuario-luvia-sin-webs` (ya creada, con el spec commiteado).

---

## File Structure

**Front (`app/`):**
- Crear `app/src/lib/admin.ts` — helper puro `isAdminEmail`.
- Crear `app/src/lib/admin.test.ts` — test del helper.
- Crear `app/src/hooks/useIsAdmin.ts` — hook que usa la sesión + `VITE_ADMIN_EMAIL`.
- Crear `app/src/lib/pipeline.ts` — `visibleStages(isAdmin)` + `WEB_ONLY_STAGES`.
- Crear `app/src/lib/pipeline.test.ts` — test de `visibleStages`.
- Modificar `app/src/pages/Dashboard.tsx` — contadores según `visibleStages`.
- Modificar `app/src/pages/LeadDetail.tsx` — ocultar tarjetas de web; desbloquear contacto a no-admin.
- Modificar `app/.env.example` — documentar `VITE_ADMIN_EMAIL`.

**Edge (`supabase/functions/`):**
- Crear `supabase/functions/_shared/luvia.ts` — helper puro `isLuviaLead`.
- Crear `supabase/functions/_shared/luvia.test.ts` — test del helper.
- Modificar `supabase/functions/_shared/prompts.ts` — añadir `LUVIA_OUTREACH_PROMPT`.
- Modificar `supabase/functions/generate-outreach/index.ts` — rama Luvia.
- Modificar `supabase/functions/send-email/index.ts` — transición `new → contacted`.

**Orquestador (`orquestador/`):**
- Modificar `orquestador/run.ts` — filtro de leads del admin.
- Modificar `orquestador/score-existing-sites.ts` — parámetro `adminUserId` + filtro.
- Modificar `.env.example` (raíz) — documentar `ADMIN_USER_ID`.

---

## Task 1: Helper de admin + hook `useIsAdmin` (front)

**Files:**
- Create: `app/src/lib/admin.ts`
- Test: `app/src/lib/admin.test.ts`
- Create: `app/src/hooks/useIsAdmin.ts`
- Modify: `app/.env.example`

**Interfaces:**
- Produces: `isAdminEmail(email: string | null | undefined, adminEmail: string | null | undefined): boolean` y `useIsAdmin(): boolean`.

- [ ] **Step 1: Escribir el test que falla** — `app/src/lib/admin.test.ts`

```ts
// Test de un solo uso (no hay framework): se ejecuta con
//   node --experimental-strip-types src/lib/admin.test.ts
import { isAdminEmail } from "./admin.ts";

let failures = 0;
function assertEq(actual: unknown, expected: unknown, msg: string) {
  const ok = actual === expected;
  console.log(`${ok ? "✓" : "✗"} ${msg}  (got ${actual}, want ${expected})`);
  if (!ok) failures++;
}

const ADMIN = "nicolassotodavid@gmail.com";
assertEq(isAdminEmail(ADMIN, ADMIN), true, "mismo email = admin");
assertEq(isAdminEmail("miguel@x.com", ADMIN), false, "otro email = no admin");
assertEq(isAdminEmail("Nicolassotodavid@Gmail.com", ADMIN), true, "case-insensitive + trim");
assertEq(isAdminEmail(null, ADMIN), false, "sin sesión = no admin");
assertEq(isAdminEmail("x@y.com", undefined), false, "sin VITE_ADMIN_EMAIL = no admin");

console.log(failures === 0 ? "\nOK" : `\n${failures} FALLO(S)`);
if (failures) process.exit(1);
```

- [ ] **Step 2: Ejecutar el test y ver que falla**

Run: `cd app && node --experimental-strip-types src/lib/admin.test.ts`
Expected: FALLA — `Cannot find module './admin.ts'` (aún no existe).

- [ ] **Step 3: Implementar el helper** — `app/src/lib/admin.ts`

```ts
// Helper puro: ¿el email de la sesión es el del admin (David)?
// NO es una frontera de seguridad — la RLS de Supabase lo es. Solo decide qué se PINTA
// en el panel: el admin ve la maquinaria de webs; cualquier otro usuario (Luvia) no.
export function isAdminEmail(
  email: string | null | undefined,
  adminEmail: string | null | undefined,
): boolean {
  if (!email || !adminEmail) return false;
  return email.trim().toLowerCase() === adminEmail.trim().toLowerCase();
}
```

- [ ] **Step 4: Ejecutar el test y ver que pasa**

Run: `cd app && node --experimental-strip-types src/lib/admin.test.ts`
Expected: todas ✓ y `OK`.

- [ ] **Step 5: Crear el hook** — `app/src/hooks/useIsAdmin.ts`

```ts
import { useSession } from "./useSession";
import { isAdminEmail } from "@/lib/admin";

// ¿La sesión actual es la del admin (David)? Mira el email de la sesión contra
// VITE_ADMIN_EMAIL. Solo decide qué se muestra en el panel; la RLS es la frontera real.
export function useIsAdmin(): boolean {
  const { session } = useSession();
  return isAdminEmail(session?.user?.email, import.meta.env.VITE_ADMIN_EMAIL);
}
```

- [ ] **Step 6: Documentar la variable** — añadir a `app/.env.example`

```
# Email del admin (David). Decide qué ve en el panel: solo el admin ve la
# construcción de webs (brief, construir, QA). Cualquier otro usuario = Luvia.
VITE_ADMIN_EMAIL=nicolassotodavid@gmail.com
```

- [ ] **Step 7: Verificar tipos** — `cd app && npm run build`
Expected: build OK (sin errores tsc).

- [ ] **Step 8: Commit**

```bash
git add app/src/lib/admin.ts app/src/lib/admin.test.ts app/src/hooks/useIsAdmin.ts app/.env.example
git commit -m "feat(panel): helper isAdminEmail + hook useIsAdmin (VITE_ADMIN_EMAIL)"
```

---

## Task 2: `visibleStages` + contadores del Dashboard por rol

**Files:**
- Create: `app/src/lib/pipeline.ts`
- Test: `app/src/lib/pipeline.test.ts`
- Modify: `app/src/pages/Dashboard.tsx` (import + uso de `visibleStages`)

**Interfaces:**
- Consumes: `PIPELINE_ORDER`, `LeadStatus` de `app/src/lib/types.ts`; `useIsAdmin` (Task 1).
- Produces: `WEB_ONLY_STAGES: LeadStatus[]`, `visibleStages(isAdmin: boolean): LeadStatus[]`.

- [ ] **Step 1: Escribir el test que falla** — `app/src/lib/pipeline.test.ts`

```ts
// node --experimental-strip-types src/lib/pipeline.test.ts
import { visibleStages, WEB_ONLY_STAGES } from "./pipeline.ts";
import { PIPELINE_ORDER } from "./types.ts";

let failures = 0;
function assert(cond: boolean, msg: string) {
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) failures++;
}

const admin = visibleStages(true);
assert(admin.length === PIPELINE_ORDER.length, "admin ve TODAS las etapas");

const luvia = visibleStages(false);
assert(
  luvia.length === PIPELINE_ORDER.length - WEB_ONLY_STAGES.length,
  "no-admin ve menos etapas (sin las de web)",
);
assert(!luvia.some((s) => WEB_ONLY_STAGES.includes(s)), "no-admin NO ve etapas de web");
assert(
  luvia.includes("new") && luvia.includes("contacted") && luvia.includes("won"),
  "no-admin conserva new/contacted/won",
);

console.log(failures === 0 ? "\nOK" : `\n${failures} FALLO(S)`);
if (failures) process.exit(1);
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `cd app && node --experimental-strip-types src/lib/pipeline.test.ts`
Expected: FALLA — no existe `./pipeline.ts`.

- [ ] **Step 3: Implementar** — `app/src/lib/pipeline.ts`

```ts
import { PIPELINE_ORDER, type LeadStatus } from "./types";

// Etapas del pipeline que pertenecen a la construcción de webs. Solo el admin las ve;
// el usuario de Luvia no construye webs, así que sus contadores se ocultan.
export const WEB_ONLY_STAGES: LeadStatus[] = [
  "analyzed",
  "build_queued",
  "site_built",
  "approved",
];

// Etapas visibles en el Dashboard según el rol. Admin = todas; no-admin (Luvia) = sin las de web.
export function visibleStages(isAdmin: boolean): LeadStatus[] {
  if (isAdmin) return PIPELINE_ORDER;
  return PIPELINE_ORDER.filter((s) => !WEB_ONLY_STAGES.includes(s));
}
```

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `cd app && node --experimental-strip-types src/lib/pipeline.test.ts`
Expected: todas ✓ y `OK`.

- [ ] **Step 5: Usar en el Dashboard** — `app/src/pages/Dashboard.tsx`

5a. Añadir imports (junto a los demás, arriba):

```ts
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { visibleStages } from "@/lib/pipeline";
```

5b. Dentro del componente `Dashboard`, al principio (junto a los `useState`):

```ts
  const isAdmin = useIsAdmin();
```

5c. En la grid de contadores, sustituir `PIPELINE_ORDER.map((s) => {` por:

```ts
        {visibleStages(isAdmin).map((s) => {
```

(El resto del `.map` y el cierre quedan igual. `PIPELINE_ORDER` puede seguir importado: lo usa `viewCounts`/otros; si tras el cambio el linter marca `PIPELINE_ORDER` sin usar, quítalo del import.)

- [ ] **Step 6: Verificar tipos** — `cd app && npm run build`
Expected: build OK.

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/pipeline.ts app/src/lib/pipeline.test.ts app/src/pages/Dashboard.tsx
git commit -m "feat(panel): contadores del Dashboard ocultan etapas de web a no-admin"
```

---

## Task 3: Ocultar tarjetas de web en LeadDetail + desbloquear contacto a no-admin

**Files:**
- Modify: `app/src/pages/LeadDetail.tsx`

**Interfaces:**
- Consumes: `useIsAdmin` (Task 1).

- [ ] **Step 1: Añadir el hook** — en `app/src/pages/LeadDetail.tsx`

1a. Import (junto a los demás):

```ts
import { useIsAdmin } from "@/hooks/useIsAdmin";
```

1b. Dentro de `LeadDetail`, junto a los `useState` del principio:

```ts
  const isAdmin = useIsAdmin();
```

- [ ] **Step 2: Ocultar la tarjeta "Web actual del negocio"**

Envolver toda la `<Card>` de "Web actual del negocio" (la que empieza con el comentario `{/* Web actual del negocio — análisis IA de prospección ... */}`) en `{isAdmin && ( ... )}`:

```tsx
      {isAdmin && (
      <Card>
        {/* ...contenido de "Web actual del negocio" sin cambios... */}
      </Card>
      )}
```

- [ ] **Step 3: Ocultar la tarjeta "Brief (análisis)"**

Envolver la `<Card>` de "Brief" (`{/* Brief */}`) igual:

```tsx
      {isAdmin && (
      <Card>
        {/* ...tarjeta Brief sin cambios... */}
      </Card>
      )}
```

- [ ] **Step 4: Ocultar el gate "Brief listo — ¿Construir la web?"**

Cambiar la condición de apertura del bloque:

De:
```tsx
      {brief && lead.status === "analyzed" && (
```
A:
```tsx
      {isAdmin && brief && lead.status === "analyzed" && (
```

- [ ] **Step 5: Ocultar la tarjeta "Web · QA"**

Envolver la `<Card>` de "Web · QA" (la que tiene `<CardTitle className="text-lg">Web · QA</CardTitle>`) en `{isAdmin && ( ... )}`:

```tsx
      {isAdmin && (
      <Card>
        {/* ...tarjeta Web · QA sin cambios... */}
      </Card>
      )}
```

- [ ] **Step 6: Desbloquear el panel de contacto para no-admin**

6a. Cambiar la condición del panel de contacto.

De:
```tsx
      {(lead.status === "approved" || lead.status === "contacted") && (
```
A:
```tsx
      {(lead.status === "approved" || lead.status === "contacted" || !isAdmin) && (
```

6b. Arreglar el copy de la cabecera (hoy asume "La web está aprobada"). Sustituir el `<CardDescription>` de esa tarjeta por:

```tsx
              <CardDescription>
                {lead.status === "contacted"
                  ? "Email enviado. El lead está en estado «Contactado»."
                  : isAdmin
                    ? "La web está aprobada. Genera el mensaje y envíalo."
                    : "Genera el mensaje de contacto y envíalo."}
              </CardDescription>
```

- [ ] **Step 7: Verificar tipos** — `cd app && npm run build`
Expected: build OK.

- [ ] **Step 8: Verificación manual (rol)**

Run: `cd app && npm run dev` y abre un lead.
- Con `VITE_ADMIN_EMAIL` = tu email (sesión admin): se ven Web actual, Brief, gate y Web · QA.
- Cambia temporalmente `VITE_ADMIN_EMAIL` a otro valor y recarga: NO aparece ninguna tarjeta de web, pero SÍ aparece el panel "Mensaje de contacto" aunque el lead esté en `new`.
- Vuelve a poner tu email.

- [ ] **Step 9: Commit**

```bash
git add app/src/pages/LeadDetail.tsx
git commit -m "feat(panel): LeadDetail oculta webs a no-admin y desbloquea contacto"
```

---

## Task 4: Helper `isLuviaLead` (compartido edge)

**Files:**
- Create: `supabase/functions/_shared/luvia.ts`
- Test: `supabase/functions/_shared/luvia.test.ts`

**Interfaces:**
- Produces: `isLuviaLead(owner: string | null | undefined, adminUserId: string | null | undefined): boolean`.

- [ ] **Step 1: Escribir el test que falla** — `supabase/functions/_shared/luvia.test.ts`

```ts
// node --experimental-strip-types supabase/functions/_shared/luvia.test.ts
import { isLuviaLead } from "./luvia.ts";

let failures = 0;
function assertEq(actual: unknown, expected: unknown, msg: string) {
  const ok = actual === expected;
  console.log(`${ok ? "✓" : "✗"} ${msg}  (got ${actual}, want ${expected})`);
  if (!ok) failures++;
}

const ADMIN = "11111111-1111-1111-1111-111111111111";
const MIGUEL = "22222222-2222-2222-2222-222222222222";
assertEq(isLuviaLead(MIGUEL, ADMIN), true, "lead de otro usuario = Luvia");
assertEq(isLuviaLead(ADMIN, ADMIN), false, "lead del admin = no Luvia");
assertEq(isLuviaLead(null, ADMIN), false, "lead sin dueño (cron) = no Luvia");
assertEq(isLuviaLead(MIGUEL, undefined), false, "sin ADMIN_USER_ID = no Luvia (compat)");

console.log(failures === 0 ? "\nOK" : `\n${failures} FALLO(S)`);
if (failures) process.exit(1);
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `node --experimental-strip-types supabase/functions/_shared/luvia.test.ts`
Expected: FALLA — no existe `./luvia.ts`.

- [ ] **Step 3: Implementar** — `supabase/functions/_shared/luvia.ts`

```ts
// ¿Este lead pertenece al producto Luvia (usuario de Miguel) y NO al admin (David)?
// Se deriva del dueño del lead:
//  - adminUserId vacío  -> nunca Luvia (comportamiento previo: todo es del admin).
//  - owner null         -> lead del cron/admin, no Luvia.
//  - owner != admin     -> Luvia.
export function isLuviaLead(
  owner: string | null | undefined,
  adminUserId: string | null | undefined,
): boolean {
  if (!adminUserId || !owner) return false;
  return owner !== adminUserId;
}
```

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `node --experimental-strip-types supabase/functions/_shared/luvia.test.ts`
Expected: todas ✓ y `OK`.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/luvia.ts supabase/functions/_shared/luvia.test.ts
git commit -m "feat(edge): helper isLuviaLead (dueño != admin)"
```

---

## Task 5: `generate-outreach` — rama Luvia (sin gates de web, copy propio)

**Files:**
- Modify: `supabase/functions/_shared/prompts.ts` (añadir `LUVIA_OUTREACH_PROMPT`)
- Modify: `supabase/functions/generate-outreach/index.ts`

**Interfaces:**
- Consumes: `isLuviaLead` (Task 4); `LUVIA_OUTREACH_PROMPT` (este task).
- Produces: para leads de Luvia, inserta un `outreach_messages` (channel `email`, `email_number=1`) sin requerir brief ni `live_url`.

- [ ] **Step 1: Añadir el prompt** — al final de `supabase/functions/_shared/prompts.ts`

```ts
// LUVIA_OUTREACH_PROMPT: Email 1 en frío del producto Luvia (agente de chat para clínicas).
// NO vende una web. Una sola CTA suave = que respondan. Sin links (el sistema no añade ninguno).
// Borrador: David puede afinar el copy. Devuelve JSON estricto { subject, body }.
export const LUVIA_OUTREACH_PROMPT = `
Eres Miguel, fundador de Luvia. Luvia es un agente de chat con IA para clínicas: atiende a los
pacientes 24/7 en la web y por mensajería —resuelve dudas, da horarios y ayuda a pedir cita— para que
la clínica no pierda mensajes ni llamadas fuera de horario. Escribes en frío a una clínica que
encontraste para ofrecérselo. El objetivo es que RESPONDAN para enseñárselo, no vender en el email.

Recibes datos reales de la clínica (nombre, categoría, ciudad, valoración y nº de reseñas).
Devuelve ÚNICAMENTE un objeto JSON válido (sin markdown) con este esquema:
{ "subject": "string", "body": "string" }

REGLAS DE ORO:
1. Texto plano, sin markdown, sin asteriscos, sin emojis de relleno.
2. Nunca suenes a plantilla. Si parece enviado a mil clínicas, has fallado.
3. Un halago sincero y CONCRETO basado en su reputación real (su valoración, su nº de reseñas, su
   prestigio en la ciudad). Nada genérico.
4. Menciona algo concreto (que es una clínica, su ciudad) para que quede claro que no es masivo.
5. "subject": directo, sin clickbait, máx 8 palabras. Ej.: "Una recepción que no duerme para tu clínica".
6. "body": 5-7 frases en dos párrafos cortos:
   Párrafo 1 — por qué te fijaste en la clínica (su reputación concreta).
   Párrafo 2 — qué es Luvia (agente de chat que atiende a pacientes 24/7 y no deja escapar citas) y
   una invitación SUAVE a que respondan para enseñárselo en un par de minutos.
7. UNA sola llamada a la acción, suave: que respondan al email. NO incluyas links ni URLs.
8. Firma como "Miguel". Debajo, una línea corta: "Luvia — atención al paciente con IA.".
`;
```

- [ ] **Step 2: Importar el helper y el prompt** — en `supabase/functions/generate-outreach/index.ts`

Cambiar la línea de import de prompts y añadir el helper:

```ts
import { OUTREACH_PROMPT, LUVIA_OUTREACH_PROMPT } from "../_shared/prompts.ts";
import { isLuviaLead } from "../_shared/luvia.ts";
```

- [ ] **Step 3: Añadir el subject de respaldo de Luvia** — junto a `getSubject`

```ts
// Asunto de respaldo de Luvia si la IA no devuelve uno (en Luvia el subject lo propone el modelo).
function getLuviaSubject(): string {
  return "Una recepción que no duerme para tu clínica";
}
```

- [ ] **Step 4: Detectar Luvia tras cargar el lead**

Justo después del bloque que carga `lead` (tras `if (!lead) return jsonResponse({ error: "Lead no encontrado." }, 404);`), añadir:

```ts
  const ADMIN_USER_ID = Deno.env.get("ADMIN_USER_ID");
  const luvia = isLuviaLead(lead.owner, ADMIN_USER_ID);
```

- [ ] **Step 5: Relajar los gates de web para Luvia**

5a. Gate de estado — sustituir el bloque actual `if (lead.status !== "approved" && lead.status !== "contacted") { ... }` por:

```ts
  if (!luvia && lead.status !== "approved" && lead.status !== "contacted") {
    return jsonResponse(
      { error: `El lead debe estar 'approved' o 'contacted' (está '${lead.status}').` },
      409,
    );
  }
  // Luvia este sprint solo Email 1 (sin secuencia de seguimientos propia).
  if (luvia && emailNumber !== 1) {
    return jsonResponse(
      { error: "Los seguimientos de Luvia aún no están disponibles (solo Email 1)." },
      409,
    );
  }
```

5b. Canal — sustituir la línea `const channel = segment === "b2b" ? "linkedin" : "email";` por:

```ts
  const channel = luvia ? "email" : (segment === "b2b" ? "linkedin" : "email");
```

5c. Brief obligatorio — sustituir `if (!brief && emailNumber === 1) {` por:

```ts
  if (!luvia && !brief && emailNumber === 1) {
```

5d. `live_url` obligatoria — sustituir `if (channel === "email" && !liveUrl) {` por:

```ts
  if (!luvia && channel === "email" && !liveUrl) {
```

- [ ] **Step 6: Ramificar el bloque Email 1 (prompt + payload + subject/body)**

Sustituir TODO el bloque "EMAIL 1: IA personalizada" (desde el comentario `// EMAIL 1: ...` hasta el `return jsonResponse({ ok: true, channel, email_number: 1, message: inserted });` final) por:

```ts
  // ─────────────────────────────────────────────────────────────────────────────
  // EMAIL 1: IA personalizada (Claude Haiku)
  //  - Web (OUTREACH_PROMPT): vende la web de muestra; el sistema añade CTA → /book.
  //  - Luvia (LUVIA_OUTREACH_PROMPT): ofrece el agente de chat; SIN link (CTA = responder).
  // ─────────────────────────────────────────────────────────────────────────────
  const systemPrompt = luvia ? LUVIA_OUTREACH_PROMPT : OUTREACH_PROMPT;
  const payload = luvia
    ? {
        business: {
          name: lead.name,
          category: lead.category,
          city: lead.city,
          rating: lead.rating,
          review_count: lead.review_count,
        },
      }
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

  let anthropicData: { content?: { text?: string }[]; error?: { message?: string } };
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1200,
        system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: JSON.stringify(payload) }],
      }),
    });
    anthropicData = await res.json();
    if (!res.ok) {
      return jsonResponse(
        { error: `Claude devolvió ${res.status}: ${anthropicData?.error?.message ?? "error"}` },
        502,
      );
    }
  } catch (e) {
    return jsonResponse(
      { error: `No se pudo contactar con Claude: ${e instanceof Error ? e.message : "error"}` },
      502,
    );
  }

  const text = anthropicData.content?.[0]?.text ?? "";
  let draft: Record<string, unknown>;
  try {
    draft = extractJson(text);
  } catch (_e) {
    return jsonResponse({ error: "Claude no devolvió un JSON válido.", raw: text.slice(0, 500) }, 422);
  }

  const bodyText = typeof draft.body === "string" ? draft.body.trim() : "";
  if (!bodyText) {
    return jsonResponse({ error: "El mensaje redactado vino vacío.", raw: text.slice(0, 500) }, 422);
  }

  // Web: asunto fijo del sistema + CTA → /book añadida por el sistema.
  // Luvia: asunto lo propone la IA (con respaldo fijo) y NO se añade ningún link.
  const finalSubject = luvia
    ? (typeof draft.subject === "string" && draft.subject.trim() ? draft.subject.trim() : getLuviaSubject())
    : subject;
  const finalBody = luvia
    ? bodyText
    : (channel === "email" ? `${bodyText}\n\n${emailLink}` : bodyText);

  const { data: inserted, error: insErr } = await supabase
    .from("outreach_messages")
    .insert({
      lead_id: leadId,
      channel,
      subject: channel === "email" ? finalSubject : null,
      body: withWhatsappFooter(finalBody, channel),
      status: "draft",
      generated_by_model: ANTHROPIC_MODEL,
      email_number: 1,
    })
    .select()
    .single();
  if (insErr) return jsonResponse({ error: `Guardando el mensaje: ${insErr.message}` }, 500);

  return jsonResponse({ ok: true, channel, email_number: 1, message: inserted });
```

- [ ] **Step 7: Verificar tipos del edge function**

Run: `deno check supabase/functions/generate-outreach/index.ts`
Expected: sin errores. (Si no tienes `deno` local, el type-check ocurre en `supabase functions deploy`; déjalo para el deploy del Task 8.)

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/_shared/prompts.ts supabase/functions/generate-outreach/index.ts
git commit -m "feat(edge): generate-outreach rama Luvia (sin gates de web, copy propio)"
```

---

## Task 6: `send-email` — transición `new → contacted` para Luvia

**Files:**
- Modify: `supabase/functions/send-email/index.ts`

**Interfaces:**
- Consumes: nada nuevo. Solo amplía la transición de estado al enviar.

- [ ] **Step 1: Ampliar la transición de estado**

Sustituir el bloque final que mueve el lead (hoy):

```ts
  await supabase
    .from("leads")
    .update({ status: "contacted", updated_at: nowIso })
    .eq("id", msg.lead_id)
    .eq("status", "approved");
```

por:

```ts
  // Mover a 'contacted' al enviar. Web: desde 'approved'. Luvia: desde 'new' (sus leads no
  // pasan por el gate de web). El `.in` evita regresar leads ya más avanzados (contacted/booked/won).
  await supabase
    .from("leads")
    .update({ status: "contacted", updated_at: nowIso })
    .eq("id", msg.lead_id)
    .in("status", ["approved", "new"]);
```

- [ ] **Step 2: Verificar tipos**

Run: `deno check supabase/functions/send-email/index.ts`
Expected: sin errores. (Si no hay `deno` local, se valida en el deploy del Task 8.)

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/send-email/index.ts
git commit -m "feat(edge): send-email mueve new -> contacted para leads de Luvia"
```

---

## Task 7: Orquestador — procesar solo leads del admin

**Files:**
- Modify: `orquestador/score-existing-sites.ts`
- Modify: `orquestador/run.ts`
- Modify: `.env.example` (raíz)

**Interfaces:**
- Consumes: `process.env.ADMIN_USER_ID`.
- Produces: `scoreExistingSites(supabase, adminUserId?)` con filtro por dueño; `selectLeadsByStatus` con filtro por dueño.

- [ ] **Step 1: Filtrar el scoring por dueño** — `orquestador/score-existing-sites.ts`

1a. Cambiar la firma de la función:

```ts
export async function scoreExistingSites(
  supabase: SupabaseClient,
  adminUserId?: string,
): Promise<SweepResult> {
```

1b. Sustituir la query de selección (el `const { data, error } = await supabase.from("leads")....limit(SWEEP_BATCH);`) por:

```ts
  // Leads con web propia y sin analizar, los más antiguos primero. Tope por corrida.
  // Si hay admin definido, solo sus leads (o sin dueño): no puntuamos las webs de Luvia.
  let q = supabase
    .from("leads")
    .select("id,name,category,city,rating,review_count,raw_json,website_url")
    .eq("has_website", true)
    .is("site_analyzed_at", null)
    .order("created_at", { ascending: true })
    .limit(SWEEP_BATCH);
  if (adminUserId) q = q.or(`owner.eq.${adminUserId},owner.is.null`);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
```

- [ ] **Step 2: Filtrar la selección de briefs por dueño** — `orquestador/run.ts`

2a. Añadir la constante (junto a `const BATCH = ...` arriba):

```ts
// Solo el admin construye webs. Si está definido, el cron procesa SOLO sus leads (o sin dueño):
// los leads de otros usuarios (Luvia) no se analizan ni se les genera brief.
const ADMIN_USER_ID = process.env.ADMIN_USER_ID;
```

2b. Sustituir `selectLeadsByStatus` por:

```ts
async function selectLeadsByStatus(status: string): Promise<Lead[]> {
  let q = supabase.from("leads").select("*").eq("status", status).limit(BATCH);
  if (ADMIN_USER_ID) q = q.or(`owner.eq.${ADMIN_USER_ID},owner.is.null`);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Lead[];
}
```

2c. Pasar el admin al scoring — cambiar la llamada `await scoreExistingSites(supabase)` por:

```ts
        const { scored, skipped, failed } = await scoreExistingSites(supabase, ADMIN_USER_ID);
```

- [ ] **Step 3: Documentar la variable** — añadir a `.env.example` (raíz)

```
# UUID (auth.users.id) del admin (David). El orquestador y las Edge Functions procesan/
# tratan como propios SOLO los leads de este usuario (o sin dueño). Los de otros usuarios
# (Luvia) no se analizan ni construyen. Resolver con:
#   select id from auth.users where email = 'nicolassotodavid@gmail.com';
ADMIN_USER_ID=
```

- [ ] **Step 4: Verificar tipos del orquestador**

Run: `cd orquestador && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Verificación manual (dry-run, sin gastar)**

Run (desde la raíz, con `ADMIN_USER_ID` puesto en `.env`): `cd orquestador && npm run dry-run`
Expected: en PASO 1 no aparecen leads cuyo dueño sea Miguel; los `new` de David sí. (Si aún no hay leads de Miguel, basta con que la corrida no falle.)

- [ ] **Step 6: Commit**

```bash
git add orquestador/run.ts orquestador/score-existing-sites.ts .env.example
git commit -m "feat(orquestador): procesar solo leads del admin (ADMIN_USER_ID)"
```

---

## Task 8: Despliegue + verificación end-to-end (lo corre David)

**Files:** ninguno (configuración + deploy + prueba manual).

- [ ] **Step 1: Crear el usuario de Miguel** en Supabase Auth (Authentication → Users → Add user) con su email.

- [ ] **Step 2: Resolver el UUID del admin** — en el SQL Editor de Supabase:

```sql
select id from auth.users where email = 'nicolassotodavid@gmail.com';
```

- [ ] **Step 3: Configurar variables/secretos**
  - Front: `VITE_ADMIN_EMAIL=nicolassotodavid@gmail.com` en `app/.env.local` (y en las env vars del proyecto de Vercel).
  - Orquestador: `ADMIN_USER_ID=<uuid del paso 2>` en la `.env` de la raíz.
  - Edge: `npx supabase secrets set ADMIN_USER_ID=<uuid del paso 2>`

- [ ] **Step 4: Build del panel (gate anti-bundle-viejo)**

Run: `cd app && npm run build`
Expected: build OK. Si falla tsc, NO continúes (prod se quedaría en el bundle viejo en silencio).

- [ ] **Step 5: Desplegar Edge Functions**

Run: `npx supabase functions deploy generate-outreach send-email`
Expected: deploy OK (esto type-checkea el Deno).

- [ ] **Step 6: Publicar el panel** — push a `master` (Vercel publica desde ahí).

- [ ] **Step 7: Verificación E2E (contra el Gmail de David, NUNCA a clínicas reales)**
  - Login como **Miguel**: el Dashboard no muestra contadores de etapas de web; al abrir un lead no aparece ninguna tarjeta de web; sí aparece "Mensaje de contacto" en un lead `new`.
  - Crea un lead de prueba con el email de David, genera el mensaje (debe salir copy de Luvia, sin link) y envíalo: el lead pasa a `contacted` y llega el email al Gmail de David.
  - Login como **David** (admin): el flujo de webs (brief → construir → QA) sigue intacto.
  - Cron: con `ADMIN_USER_ID` puesto, una corrida no toca los leads de Miguel.

- [ ] **Step 8: Merge de la rama** — cuando todo verifique, integrar `feat/usuario-luvia-sin-webs` (PR o merge a `main`/`master` según tu flujo).

---

## Self-Review (hecha al escribir el plan)

- **Cobertura del spec:** helper admin (T1), ocultar Dashboard (T2) y LeadDetail + desbloqueo de contacto (T3), helper Luvia (T4), rama Luvia en generate-outreach con copy (T5), transición de estado en send-email (T6), filtro del cron (T7), config/deploy/E2E + creación de usuario (T8). Sin migración (correcto: el spec lo excluye).
- **Sin placeholders:** el copy de Luvia es un borrador completo y funcional (no un TBD); CTA por defecto = sin link (responder).
- **Consistencia de tipos:** `isAdminEmail`/`useIsAdmin` (T1) usados en T2/T3; `visibleStages`/`WEB_ONLY_STAGES` (T2); `isLuviaLead(owner, adminUserId)` (T4) usado en T5; `scoreExistingSites(supabase, adminUserId?)` (T7) coincide con su llamada en run.ts.
