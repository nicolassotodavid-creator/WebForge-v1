# Puente Luvia (handoff) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir un botón "Marcar como cliente" que, sobre un lead del flujo Luvia, lo crea como cliente en la plataforma Luvia (otro Supabase) vía su Edge Function `crear-cliente`, marca el lead `won` y guarda el enlace `luvia_client_id`.

**Architecture:** Un solo sistema WebForge, dos flujos por dueño del lead (`leads.owner`). El flujo Luvia ya existe (outreach); esto añade el **cierre**: front (botón) → Edge Function `handoff-luvia` (WebForge, service_role) → `POST crear-cliente` (Supabase de Luvia, autenticado por token bearer compartido). La lógica pura (payload + guarda de flujo) se extrae a un helper `_shared/luviaHandoff.ts` testeable; el handler HTTP solo orquesta.

**Tech Stack:** Supabase Edge Functions (Deno + `jsr:@supabase/supabase-js@2`), Postgres (migración SQL), React + TypeScript (panel Vite), tests como scripts `node --experimental-strip-types`.

## Global Constraints

- **Nombre del producto = "Luvia" (con V)** en todo el código nuevo (columna, secretos, funciones). Coincide con `_shared/luvia.ts`, `LUVIA_OUTREACH_PROMPT`, `isLuviaLead`.
- **La service key de Luvia NUNCA vive en WebForge.** El puente usa `LUVIA_FUNCTIONS_URL` + `LUVIA_HANDOFF_TOKEN` (bearer). Secretos solo en servidor.
- **Enfoque = contrato:** WebForge llama a la Edge Function `crear-cliente` de Luvia; no inserta directo en las tablas de Luvia.
- **Disparador = manual** (botón). No hay checkout de Stripe para Luvia.
- **Idempotencia:** con `leads.luvia_client_id` ya poblado, el puente no vuelve a llamar a Luvia.
- **Estado de cierre = `won`** (ya existe en `LeadStatus`, etiqueta "Ganado").
- **Autorización Edge Function:** mismo patrón que `send-email`/`generate-outreach` (Bearer JWT de operador o `SERVICE_KEY`; `canAccessLead(lead.owner, operator)`).
- **Verde obligatorio antes de prod:** `cd app && npm run build` (tsc) debe pasar.

## File Structure

- **Create** `supabase/migrations/0021_lead_luvia_client.sql` — columna `leads.luvia_client_id`.
- **Create** `supabase/functions/_shared/luviaHandoff.ts` — lógica pura: `buildLuviaClientPayload(lead)` + `canHandoffToLuvia(owner, adminUserId)`.
- **Create** `supabase/functions/_shared/luviaHandoff.test.ts` — test Node de la lógica pura.
- **Create** `supabase/functions/handoff-luvia/index.ts` — Edge Function orquestadora (WebForge).
- **Modify** `app/src/lib/types.ts` — añadir `luvia_client_id` al tipo `Lead`.
- **Modify** `app/src/pages/LeadDetail.tsx` — handler `markAsLuviaClient()` + botón "Marcar como cliente".

Fuera de este repo (dependencia, contrato definido en el spec): Edge Function `crear-cliente` en el proyecto Supabase de Luvia. La aporta David o se hace en un ciclo aparte con acceso a ese proyecto.

---

### Task 1: Migración — columna `luvia_client_id`

**Files:**
- Create: `supabase/migrations/0021_lead_luvia_client.sql`

**Interfaces:**
- Produces: columna `leads.luvia_client_id text` (nullable). La consumen la Edge Function `handoff-luvia` (Task 3) y el tipo `Lead` (Task 4).

- [ ] **Step 1: Escribir la migración**

```sql
-- 0021_lead_luvia_client.sql
-- Enlace del lead con su cliente en la plataforma Luvia (otro Supabase).
-- NULL = todavía no entregado. Con valor = ya entregado → candado de idempotencia:
-- la Edge Function handoff-luvia no vuelve a llamar a Luvia.
-- Diseño: docs/superpowers/specs/2026-07-10-puente-luvia-handoff-design.md
--
-- Sin cambios de RLS: la columna hereda la visibilidad del lead (dueño + admin).
-- El service_role (Edge Functions) sigue saltándose RLS.
alter table leads
  add column if not exists luvia_client_id text;
```

- [ ] **Step 2: Verificar sintaxis (dry, sin tocar prod)**

Run: `grep -c "add column if not exists luvia_client_id" supabase/migrations/0021_lead_luvia_client.sql`
Expected: `1`

(La migración se aplica en prod con `supabase db push` / SQL Editor en el paso de despliegue, no en este plan.)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0021_lead_luvia_client.sql
git commit -m "feat(luvia): migración 0021 — columna leads.luvia_client_id (enlace/idempotencia)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Helper puro `luviaHandoff.ts` (TDD)

**Files:**
- Create: `supabase/functions/_shared/luviaHandoff.ts`
- Test: `supabase/functions/_shared/luviaHandoff.test.ts`

**Interfaces:**
- Consumes: `isLuviaLead(owner, adminUserId)` de `./luvia.ts`.
- Produces:
  - `buildLuviaClientPayload(lead: LeadRow): LuviaClientPayload` — mapea el lead al cuerpo del `POST` a Luvia. `source` siempre `"webforge"`; `resenas` viene de `review_count`.
  - `canHandoffToLuvia(owner: string|null|undefined, adminUserId: string|null|undefined): boolean` — true solo si es lead Luvia (owner ≠ admin, ambos no nulos).
  - Tipos `LeadRow` y `LuviaClientPayload`.

- [ ] **Step 1: Escribir el test que falla**

```ts
// node --experimental-strip-types supabase/functions/_shared/luviaHandoff.test.ts
import { buildLuviaClientPayload, canHandoffToLuvia } from "./luviaHandoff.ts";

let failures = 0;
function assertEq(actual: unknown, expected: unknown, msg: string) {
  const ok = actual === expected;
  console.log(`${ok ? "✓" : "✗"} ${msg}  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`);
  if (!ok) failures++;
}

const ADMIN = "11111111-1111-1111-1111-111111111111";
const OP = "22222222-2222-2222-2222-222222222222";

// canHandoffToLuvia: mismas reglas que isLuviaLead
assertEq(canHandoffToLuvia(OP, ADMIN), true, "lead de otro dueño = se puede entregar");
assertEq(canHandoffToLuvia(ADMIN, ADMIN), false, "lead del admin = NO se entrega");
assertEq(canHandoffToLuvia(null, ADMIN), false, "lead sin dueño = NO se entrega");
assertEq(canHandoffToLuvia(OP, undefined), false, "sin ADMIN_USER_ID = NO se entrega (compat)");

// buildLuviaClientPayload: mapeo de campos
const lead = {
  id: "lead-1", name: "Clínica Bella", category: "Clínica estética",
  phone: "+34600111222", whatsapp: "+34600111222", email: "hola@bella.es",
  address: "Calle Mayor 1", city: "Valencia", country: "ES",
  rating: 4.8, review_count: 137, owner: OP,
};
const payload = buildLuviaClientPayload(lead);
assertEq(payload.webforge_lead_id, "lead-1", "payload.webforge_lead_id = lead.id");
assertEq(payload.nombre, "Clínica Bella", "payload.nombre = lead.name");
assertEq(payload.telefono, "+34600111222", "payload.telefono = lead.phone");
assertEq(payload.ciudad, "Valencia", "payload.ciudad = lead.city");
assertEq(payload.resenas, 137, "payload.resenas = lead.review_count");
assertEq(payload.source, "webforge", "payload.source = 'webforge'");

console.log(failures === 0 ? "\nOK" : `\n${failures} FALLO(S)`);
if (failures) process.exit(1);
```

- [ ] **Step 2: Ejecutar el test para verlo fallar**

Run: `node --experimental-strip-types supabase/functions/_shared/luviaHandoff.test.ts`
Expected: FALLA con "Cannot find module './luviaHandoff.ts'" (aún no existe).

- [ ] **Step 3: Escribir la implementación mínima**

```ts
// Lógica pura del puente Luvia: qué se envía a la plataforma Luvia y cuándo se permite.
// El handler HTTP (handoff-luvia/index.ts) solo orquesta; aquí vive lo testeable.
import { isLuviaLead } from "./luvia.ts";

// Subconjunto de columnas de `leads` que necesita el payload.
export type LeadRow = {
  id: string;
  name: string;
  category: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  rating: number | null;
  review_count: number | null;
  owner: string | null;
};

// Cuerpo del POST a la Edge Function crear-cliente de Luvia. Nombres en español para
// encajar con el modelo de Luvia; `source` marca el origen; `webforge_lead_id` permite
// idempotencia también en el lado de Luvia.
export type LuviaClientPayload = {
  webforge_lead_id: string;
  nombre: string;
  categoria: string | null;
  telefono: string | null;
  whatsapp: string | null;
  email: string | null;
  direccion: string | null;
  ciudad: string | null;
  pais: string | null;
  rating: number | null;
  resenas: number | null;
  source: "webforge";
};

export function buildLuviaClientPayload(lead: LeadRow): LuviaClientPayload {
  return {
    webforge_lead_id: lead.id,
    nombre: lead.name,
    categoria: lead.category,
    telefono: lead.phone,
    whatsapp: lead.whatsapp,
    email: lead.email,
    direccion: lead.address,
    ciudad: lead.city,
    pais: lead.country,
    rating: lead.rating,
    resenas: lead.review_count,
    source: "webforge",
  };
}

// ¿Se puede entregar este lead a Luvia? Solo si es un lead Luvia (owner ≠ admin). La
// propiedad del lead (que el operador sea su dueño) la valida canAccessLead aparte.
export function canHandoffToLuvia(
  owner: string | null | undefined,
  adminUserId: string | null | undefined,
): boolean {
  return isLuviaLead(owner, adminUserId);
}
```

- [ ] **Step 4: Ejecutar el test para verlo pasar**

Run: `node --experimental-strip-types supabase/functions/_shared/luviaHandoff.test.ts`
Expected: todas las líneas `✓` y `OK` final, exit 0.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/luviaHandoff.ts supabase/functions/_shared/luviaHandoff.test.ts
git commit -m "feat(luvia): helper puro del puente (payload + guarda de flujo) con test

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Edge Function `handoff-luvia`

**Files:**
- Create: `supabase/functions/handoff-luvia/index.ts`

**Interfaces:**
- Consumes: `corsHeaders` (`../_shared/cors.ts`); `canAccessLead`, `type Operator` (`../_shared/leadAccess.ts`); `buildLuviaClientPayload`, `canHandoffToLuvia` (`../_shared/luviaHandoff.ts`); columna `leads.luvia_client_id` (Task 1).
- Produces: endpoint `POST /handoff-luvia` con `Input { lead_id }` → `{ ok: true, luvia_client_id, already? }`. Lo invoca el front (Task 4).
- Env (secretos): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_USER_ID`, `LUVIA_FUNCTIONS_URL`, `LUVIA_HANDOFF_TOKEN`.

- [ ] **Step 1: Escribir la Edge Function**

```ts
// handoff-luvia — entrega una clínica CERRADA del flujo Luvia a la plataforma Luvia.
// Input: { lead_id }. Sesión de operador (Bearer JWT) o service_role. Crea el cliente en el
// Supabase de Luvia vía su Edge Function crear-cliente, guarda leads.luvia_client_id, marca el
// lead 'won' e inserta event 'luvia_handoff'. Idempotente: con luvia_client_id ya no repite.
// Secrets SOLO en servidor. La service key de Luvia NUNCA vive aquí (se usa un token bearer).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { canAccessLead, type Operator } from "../_shared/leadAccess.ts";
import { buildLuviaClientPayload, canHandoffToLuvia } from "../_shared/luviaHandoff.ts";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Método no permitido" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ADMIN_USER_ID = Deno.env.get("ADMIN_USER_ID");
  const LUVIA_FUNCTIONS_URL = Deno.env.get("LUVIA_FUNCTIONS_URL");
  const LUVIA_HANDOFF_TOKEN = Deno.env.get("LUVIA_HANDOFF_TOKEN");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return jsonResponse({ error: "Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY." }, 500);
  }
  if (!LUVIA_FUNCTIONS_URL || !LUVIA_HANDOFF_TOKEN) {
    return jsonResponse(
      {
        error:
          "Faltan LUVIA_FUNCTIONS_URL / LUVIA_HANDOFF_TOKEN. Configúralos como secretos: " +
          "npx supabase secrets set LUVIA_FUNCTIONS_URL=https://<ref-luvia>.supabase.co/functions/v1 LUVIA_HANDOFF_TOKEN=...",
      },
      500,
    );
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // --- Autorización: sesión de operador (Bearer) o service_role (interno) ---
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  let authorized = false;
  let operator: Operator | null = null; // != null solo si entra un operador real
  if (token === SERVICE_KEY) {
    authorized = true;
  } else if (token) {
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data?.user) {
      authorized = true;
      operator = { id: data.user.id, email: data.user.email ?? "" };
    }
  }
  if (!authorized) return jsonResponse({ error: "No autorizado" }, 401);

  // --- Input ---
  let leadId: string | undefined;
  try {
    const body = await req.json();
    leadId = body?.lead_id;
  } catch (_e) {
    return jsonResponse({ error: "Cuerpo no válido. Usa { lead_id }." }, 400);
  }
  if (!leadId) return jsonResponse({ error: "Falta lead_id." }, 400);

  // --- Lead ---
  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .maybeSingle();
  if (leadErr) return jsonResponse({ error: leadErr.message }, 500);
  if (!lead) return jsonResponse({ error: "Lead no encontrado." }, 404);

  // Aislamiento por cuenta: un operador solo actúa sobre SUS leads (admin, cualquiera).
  if (operator && !canAccessLead(lead.owner, operator)) {
    return jsonResponse({ error: "Este lead no es de tu cuenta." }, 403);
  }

  // Guarda de flujo: solo se entregan leads Luvia (owner ≠ admin). Un lead de web nunca.
  if (!canHandoffToLuvia(lead.owner, ADMIN_USER_ID)) {
    return jsonResponse({ error: "Este lead no es del flujo Luvia; no se entrega." }, 400);
  }

  // Idempotencia: si ya tiene cliente en Luvia, no se vuelve a crear.
  if (lead.luvia_client_id) {
    return jsonResponse({ ok: true, luvia_client_id: lead.luvia_client_id, already: true });
  }

  // --- Crear el cliente en la plataforma Luvia (contrato: POST crear-cliente) ---
  const payload = buildLuviaClientPayload(lead);
  let luviaClientId: string | undefined;
  try {
    const resp = await fetch(`${LUVIA_FUNCTIONS_URL}/crear-cliente`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LUVIA_HANDOFF_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const text = await resp.text();
      return jsonResponse(
        { error: `Luvia rechazó el alta (${resp.status}): ${text.slice(0, 300)}` },
        502,
      );
    }
    const result = await resp.json();
    luviaClientId = result?.cliente_id ? String(result.cliente_id) : undefined;
  } catch (e) {
    return jsonResponse(
      { error: `No se pudo contactar con Luvia: ${e instanceof Error ? e.message : String(e)}` },
      502,
    );
  }
  if (!luviaClientId) {
    return jsonResponse({ error: "Luvia no devolvió cliente_id." }, 502);
  }

  // --- Persistir SOLO en éxito: enlazar, cerrar y auditar ---
  const { error: updErr } = await supabase
    .from("leads")
    .update({ luvia_client_id: luviaClientId, status: "won", updated_at: new Date().toISOString() })
    .eq("id", leadId);
  if (updErr) return jsonResponse({ error: updErr.message }, 500);

  await supabase.from("events").insert({
    lead_id: leadId,
    type: "luvia_handoff",
    payload: { luvia_client_id: luviaClientId },
  });

  return jsonResponse({ ok: true, luvia_client_id: luviaClientId });
});
```

- [ ] **Step 2: Verificar que no hay referencias rotas ni imports mal escritos**

Run: `grep -nE "buildLuviaClientPayload|canHandoffToLuvia|canAccessLead|luvia_client_id|crear-cliente" supabase/functions/handoff-luvia/index.ts`
Expected: aparecen los imports desde `../_shared/luviaHandoff.ts` y `../_shared/leadAccess.ts`, la llamada `POST .../crear-cliente`, y el `update` con `luvia_client_id`.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/handoff-luvia/index.ts
git commit -m "feat(luvia): Edge Function handoff-luvia — crea el cliente en Luvia y cierra el lead

POST crear-cliente al Supabase de Luvia con token bearer (nunca su service key),
guarda luvia_client_id, marca won e inserta event. Idempotente y con guarda de flujo.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Front — tipo `Lead` + botón "Marcar como cliente"

**Files:**
- Modify: `app/src/lib/types.ts` (interface `Lead`)
- Modify: `app/src/pages/LeadDetail.tsx`

**Interfaces:**
- Consumes: endpoint `handoff-luvia` (Task 3); `useIsAdmin()` (ya importado); `edgeFunctionErrorMessage` (ya importado desde `@/lib/supabase`); columna `luvia_client_id`.
- Produces: botón visible solo para operador no-admin con `lead.luvia_client_id == null`.

**Nota de diseño:** el botón se pinta con `!isAdmin` (la cuenta Luvia es no-admin) — señal barata del front. La regla real (owner ≠ admin) la impone la Edge Function con `ADMIN_USER_ID`, que es la frontera de seguridad. El admin no verá el botón (caso de borde aceptado); si en el futuro se quiere, se añade con el UUID admin en el front.

- [ ] **Step 1: Añadir el campo al tipo `Lead`**

En `app/src/lib/types.ts`, dentro de `interface Lead`, tras `seen_at: string | null;` (u otro campo cercano al final), añadir:

```ts
  // Enlace con el cliente en la plataforma Luvia (ver 0021_lead_luvia_client.sql).
  // null = no entregado; con valor = ya entregado (candado de idempotencia del puente).
  luvia_client_id: string | null;
```

- [ ] **Step 2: Verificar que compila con el campo nuevo**

Run: `cd app && npm run build`
Expected: PASS (tsc no se queja; el campo es opcional en la práctica porque `select("*")` lo trae).

- [ ] **Step 3: Añadir estado y handler en `LeadDetail.tsx`**

Junto al resto de `useState` de acciones (cerca de `sendingEmail`), añadir:

```tsx
  const [handingOff, setHandingOff] = useState(false);
  const [handoffError, setHandoffError] = useState<string | null>(null);
```

Junto al resto de handlers (después de `sendEmail`), añadir:

```tsx
  // Cierre del flujo Luvia: crea la clínica como cliente en la plataforma Luvia y marca won.
  async function markAsLuviaClient() {
    if (!lead) return;
    if (!window.confirm(
      "¿Marcar esta clínica como cliente y crearla en Luvia? El lead pasará a 'Ganado'."
    )) return;
    setHandingOff(true);
    setHandoffError(null);
    try {
      const { error } = await supabase.functions.invoke("handoff-luvia", {
        body: { lead_id: id },
      });
      if (error) throw error;
      // Recargar el lead: ya viene con luvia_client_id y status 'won' → el botón desaparece.
      const { data: leadData } = await supabase
        .from("leads")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      setLead(leadData as Lead | null);
    } catch (e) {
      setHandoffError(await edgeFunctionErrorMessage(e, "No se pudo crear el cliente en Luvia."));
    } finally {
      setHandingOff(false);
    }
  }
```

- [ ] **Step 4: Añadir el botón en el JSX**

En la zona de acciones de contacto (junto al bloque `!isAdmin`, cerca de la línea ~1077 donde ya se muestra el panel de contacto Luvia), añadir el bloque:

```tsx
      {!isAdmin && lead && !lead.luvia_client_id && (
        <div className="mt-4">
          <Button onClick={markAsLuviaClient} disabled={handingOff} size="sm">
            {handingOff ? "Creando cliente en Luvia…" : "Marcar como cliente"}
          </Button>
          <p className="text-xs text-muted-foreground mt-1">
            Crea la clínica en Luvia y cierra el lead como ganado.
          </p>
          {handoffError && (
            <p className="text-xs text-red-600 mt-1">{handoffError}</p>
          )}
        </div>
      )}
```

- [ ] **Step 5: Verificar build verde**

Run: `cd app && npm run build`
Expected: PASS (tsc + vite build sin errores).

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/types.ts app/src/pages/LeadDetail.tsx
git commit -m "feat(luvia): botón 'Marcar como cliente' — dispara el handoff a Luvia y cierra el lead

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Verificación final (tras las 4 tareas)

- [ ] `node --experimental-strip-types supabase/functions/_shared/luviaHandoff.test.ts` → `OK`.
- [ ] `cd app && npm run build` → verde.
- [ ] Revisión manual del flujo (en despliegue, con datos de prueba): con la cuenta Luvia, un lead de clínica de prueba → "Marcar como cliente" → aparece en la tabla de clientes de Luvia, el lead pasa a `won` y el botón desaparece. Segundo clic (si se recarga) no duplica. Con la cuenta admin, no aparece el botón y el flujo de webs sigue intacto.

## Despliegue (lo corre David, fuera del plan de código)

1. Secretos WebForge: `npx supabase secrets set ADMIN_USER_ID=<uuid> LUVIA_FUNCTIONS_URL=https://<ref-luvia>.supabase.co/functions/v1 LUVIA_HANDOFF_TOKEN=<token>`.
2. Migración: `supabase db push` (o pegar `0021` en el SQL Editor).
3. Deploy función: `supabase functions deploy handoff-luvia`.
4. Front a prod: push a la rama de deploy (Vercel).
5. Lado Luvia (otro proyecto): tabla de clientes + Edge Function `crear-cliente` según el contrato del spec, validando el mismo `LUVIA_HANDOFF_TOKEN` y devolviendo `{ cliente_id }`.

## Dependencia externa (bloqueante para el E2E real)

La verificación E2E real necesita la Edge Function `crear-cliente` viva en el Supabase de Luvia. El lado WebForge (Tasks 1-4) es completable y verificable por sí solo (build + test del helper); el puente no cerrará de punta a punta hasta que exista `crear-cliente`.
