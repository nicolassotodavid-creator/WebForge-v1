# WhatsApp saliente manual — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En la ficha del lead, un botón "Enviar por WhatsApp" que abre WhatsApp con un mensaje ya escrito (texto + enlace a la web + enlace a `/book`), editable, y registra el envío en `outreach_messages`.

**Architecture:** Todo en el panel (front), sin Edge Function. Dos funciones puras nuevas en `app/src/lib/contact.ts` (testeadas con el runner casero) y una acción en `app/src/pages/LeadDetail.tsx` que abre `wa.me?text=…` e inserta el registro directo (RLS `op_msgs` lo permite al owner del lead). No toca `generate-outreach`, `cron-followups` ni la segmentación.

**Tech Stack:** React + shadcn/ui + supabase-js v2 (panel en `app/`). Tests con `node --experimental-strip-types`. Build/typecheck con `npm run build` (`tsc --noEmit && vite build`).

**Spec:** `docs/superpowers/specs/2026-07-03-whatsapp-saliente-manual-design.md` (aprobada por Nico el 2026-07-03).

## Global Constraints

- Copy visible en **español**, tono humano, sin pinta de plantilla.
- Cambios en `contact.ts` **aditivos**; `waLink` extendido de forma **retrocompatible** (los llamadores actuales sin 2º argumento no cambian de comportamiento).
- **Sin migraciones.** El registro usa `email_number=0` (centinela fuera de la secuencia de emails 1/2/3) + `upsert on conflict (lead_id, email_number)` para esquivar el `UNIQUE(lead_id, email_number)` existente (migración 0006) sin tocar la DB.
- No tocar `generate-outreach`, `cron-followups`, la segmentación ni el flujo de emails.
- El WhatsApp del **lead** vive en `contact.ts`; el del **operador** en `business.ts`. Este trabajo usa el del lead.
- Tests: runner casero sin framework (patrón `app/src/lib/admin.test.ts`), ejecutado con `node --experimental-strip-types <archivo>`; termina en `process.exit(1)` si falla.
- Commits en español estilo repo, con `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Helpers puros en `contact.ts` (`whatsappOutreachText`, `waLink` con texto)

**Files:**
- Modify: `app/src/lib/contact.ts` (añadir `whatsappOutreachText`; extender `waLink` con 2º parámetro opcional; no tocar `waNumber`)
- Test: `app/src/lib/contact.test.ts` (nuevo)

**Interfaces:**
- Consumes: `waNumber(lead)` (ya existe en el fichero).
- Produces:
  - `whatsappOutreachText(negocio: string | null | undefined, liveUrl: string, bookUrl: string): string` — texto de plantilla WhatsApp. Con `negocio` vacío/null omite el nombre.
  - `waLink(lead: ContactLead, mensaje?: string): string | null` — si `mensaje`, añade `?text=${encodeURIComponent(mensaje)}`; sin `mensaje`, idéntico al actual.

- [ ] **Step 1: Escribir el test que falla**

Crear `app/src/lib/contact.test.ts`:

```ts
// Test de un solo uso (no hay framework): se ejecuta con
//   node --experimental-strip-types src/lib/contact.test.ts
import { waLink, whatsappOutreachText } from "./contact.ts";

let failures = 0;
function assert(cond: boolean, msg: string) {
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) failures++;
}
function assertEq(actual: unknown, expected: unknown, msg: string) {
  const ok = actual === expected;
  console.log(`${ok ? "✓" : "✗"} ${msg}  (got ${actual}, want ${expected})`);
  if (!ok) failures++;
}

const leadWa = { whatsapp: "600782211", phone: null }; // móvil 9 díg → 34600782211
const leadFijo = { whatsapp: null, phone: "912345678" }; // fijo → sin WhatsApp

// waLink SIN mensaje = comportamiento actual intacto
assertEq(waLink(leadWa), "https://wa.me/34600782211", "waLink pelado (sin texto)");
assertEq(waLink(leadFijo), null, "fijo sin whatsapp → null");

// waLink CON mensaje = ?text= correctamente encodeado
assertEq(
  waLink(leadWa, "Hola qué tal"),
  "https://wa.me/34600782211?text=Hola%20qu%C3%A9%20tal",
  "waLink con ?text= encodeado",
);
assertEq(waLink(leadFijo, "Hola"), null, "sin número → null aunque haya mensaje");

// whatsappOutreachText — con negocio
const t = whatsappOutreachText("Bar Paco", "https://web.com/", "https://x.com/book/1");
assert(t.includes("Bar Paco"), "incluye el negocio");
assert(t.includes("https://web.com/"), "incluye liveUrl");
assert(t.includes("https://x.com/book/1"), "incluye bookUrl");

// whatsappOutreachText — sin negocio (vacío/null) omite el nombre pero mantiene los enlaces
const t2 = whatsappOutreachText("", "https://web.com/", "https://x.com/book/1");
assert(!t2.includes("web para"), "negocio vacío → sin 'web para'");
assert(
  t2.includes("https://web.com/") && t2.includes("https://x.com/book/1"),
  "vacío mantiene los dos enlaces",
);
const t3 = whatsappOutreachText(null, "https://web.com/", "https://x.com/book/1");
assert(!t3.includes("web para"), "negocio null → sin 'web para'");

console.log(failures === 0 ? "\nOK" : `\n${failures} FALLO(S)`);
if (failures) process.exit(1);
```

- [ ] **Step 2: Ejecutarlo y verificar que falla**

Run: `cd app && node --experimental-strip-types src/lib/contact.test.ts`
Expected: FALLA — `whatsappOutreachText` no existe / `waLink` con 2º arg da error de tipos o el `?text=` no aparece.

- [ ] **Step 3: Implementar los helpers**

En `app/src/lib/contact.ts`, **reemplazar** la función `waLink` actual y **añadir** `whatsappOutreachText`:

```ts
/** Enlace wa.me listo para usar; si se pasa `mensaje`, lo prerellena (?text=). Null si el lead no tiene WhatsApp. */
export function waLink(lead: ContactLead, mensaje?: string): string | null {
  const n = waNumber(lead);
  if (!n) return null;
  return mensaje
    ? `https://wa.me/${n}?text=${encodeURIComponent(mensaje)}`
    : `https://wa.me/${n}`;
}

/**
 * Texto de la plantilla de WhatsApp saliente (acción manual desde la ficha del lead):
 * saludo + enlace a la web (liveUrl) + enlace de activación (/book). `negocio` vacío/null
 * omite el nombre con gracia. Editable por el operador antes de enviar.
 */
export function whatsappOutreachText(
  negocio: string | null | undefined,
  liveUrl: string,
  bookUrl: string,
): string {
  const n = (negocio ?? "").trim();
  const saludo = n
    ? `Hola 👋 soy Nico. He preparado una web para ${n}, échale un vistazo:`
    : `Hola 👋 soy Nico. He preparado una web, échale un vistazo:`;
  return (
    `${saludo}\n${liveUrl}\n\n` +
    `Si te gusta, aquí la dejas activada en un momento:\n${bookUrl}\n\n` +
    `Un saludo.`
  );
}
```

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `cd app && node --experimental-strip-types src/lib/contact.test.ts`
Expected: PASA — última línea `OK`, sin `FALLO(S)`.

- [ ] **Step 5: No romper los tests caseros existentes**

Run (desde la raíz del repo):
```bash
node --experimental-strip-types app/src/lib/admin.test.ts
node --experimental-strip-types app/src/lib/leadFilters.test.ts
node --experimental-strip-types app/src/lib/payments.test.ts
node --experimental-strip-types app/src/lib/pipeline.test.ts
```
Expected: cada uno termina en `OK`.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/contact.ts app/src/lib/contact.test.ts
git commit -m "feat(panel): waLink con texto prerellenado y whatsappOutreachText para el WhatsApp saliente manual

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: UI + registro en `LeadDetail.tsx` (componer, abrir WhatsApp, upsert, etiqueta timeline)

**Files:**
- Modify: `app/src/pages/LeadDetail.tsx` (import de `contact`; estado nuevo; 2 handlers; bloque UI dentro de `{site && site.live_url && (...)}`; etiqueta del timeline)

**Interfaces:**
- Consumes: `whatsappOutreachText`, `waLink`, `waNumber` de `@/lib/contact` (Task 1 + existente); `supabase` de `@/lib/supabase`; `lead: Lead`, `site: Site` del estado del componente; `reloadOutreach()` (ya existe, `useCallback` en el fichero).
- Produces: nada que consuma otra tarea (es la hoja de la feature).

Notas de contexto (ya verificadas en el fichero):
- `import { waLink } from "@/lib/contact";` está en la **línea 25**.
- El bloque de la web es `{site && site.live_url && ( … )}` desde la **línea 933**; los botones Aprobar/Rechazar están en un `<div className="flex flex-wrap gap-2 pt-1">` que **cierra en la línea 1024**.
- El timeline de seguimiento pinta la etiqueta en la **línea 1089**: `<span className="font-medium">Email {m.email_number ?? 1}</span>`.
- `MessageCircle` y `Loader2` ya están importados (se usan en las líneas 488 y 1005).

- [ ] **Step 1: Ampliar el import de `contact`**

En `app/src/pages/LeadDetail.tsx` línea 25, cambiar:

```tsx
import { waLink } from "@/lib/contact";
```
por:
```tsx
import { waLink, waNumber, whatsappOutreachText } from "@/lib/contact";
```

- [ ] **Step 2: Añadir el estado del composer**

Junto al resto de estado de outreach (cerca de la línea 102, tras `const [copied, setCopied] = useState(false);`), añadir:

```tsx
// WhatsApp saliente manual: `waText` = borrador editable (null = composer cerrado).
const [waText, setWaText] = useState<string | null>(null);
const [waSaving, setWaSaving] = useState(false);
const [waError, setWaError] = useState<string | null>(null);
```

- [ ] **Step 3: Añadir los dos handlers**

Junto a los demás handlers del componente (p. ej. tras `copyToClipboard`, sobre la línea 311), añadir:

```tsx
/** Abre el composer de WhatsApp con el texto de plantilla prerellenado. */
function openWhatsappComposer() {
  if (!lead || !site?.live_url) return;
  const bookUrl = `${window.location.origin}/book/${lead.id}`;
  setWaText(whatsappOutreachText(lead.name, site.live_url, bookUrl));
  setWaError(null);
}

/** Abre WhatsApp con el texto (editado) y registra el envío en outreach_messages. */
async function sendWhatsapp() {
  if (!lead || waText == null) return;
  // Abrir WhatsApp SIEMPRE primero: el contacto no debe depender del registro.
  const link = waLink(lead, waText);
  if (link) window.open(link, "_blank");
  setWaSaving(true);
  setWaError(null);
  const { error } = await supabase.from("outreach_messages").upsert(
    {
      lead_id: lead.id,
      channel: "whatsapp",
      email_number: 0, // centinela: fuera de la secuencia de emails 1/2/3
      subject: null,
      body: waText,
      status: "sent",
      generated_by_model: "manual",
      sent_at: new Date().toISOString(),
    },
    { onConflict: "lead_id,email_number" },
  );
  setWaSaving(false);
  if (error) {
    setWaError("No se pudo registrar el envío (WhatsApp se abrió igual).");
  } else {
    setWaText(null);
    await reloadOutreach();
  }
}
```

- [ ] **Step 4: Añadir el bloque UI dentro del bloque de la web**

Justo **después** del `</div>` que cierra los botones Aprobar/Rechazar (línea 1024) y **antes** del `<p className="text-xs text-muted-foreground">¿No te convence?…`, insertar:

```tsx
{waNumber(lead) && (
  <div className="space-y-2 rounded-md border bg-muted/30 p-3">
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm font-medium">Enviar por WhatsApp</span>
      {waText == null && (
        <Button size="sm" variant="outline" onClick={openWhatsappComposer}>
          <MessageCircle className="h-4 w-4" /> Preparar mensaje
        </Button>
      )}
    </div>
    {waText != null && (
      <>
        <textarea
          value={waText}
          onChange={(e) => setWaText(e.target.value)}
          rows={7}
          className="w-full rounded-md border bg-background p-2 text-sm"
        />
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={sendWhatsapp} disabled={waSaving}>
            {waSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MessageCircle className="h-4 w-4" />
            )}
            Abrir WhatsApp
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setWaText(null)}>
            Cancelar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Se abrirá WhatsApp con el mensaje ya escrito. Revísalo y dale a enviar tú.
        </p>
      </>
    )}
    {waError && <p className="text-xs text-amber-700">{waError}</p>}
  </div>
)}
```

Nota: el bloque vive dentro de `{site && site.live_url && (...)}`, así que solo aparece cuando hay web publicada (satisface "exige web publicada" sin estado deshabilitado). Si el lead no tiene número, `waNumber(lead)` es falsy y no se pinta.

- [ ] **Step 5: Etiquetar las filas de WhatsApp en el timeline**

En la línea 1089, sustituir:

```tsx
<span className="font-medium">Email {m.email_number ?? 1}</span>
```
por:
```tsx
<span className="font-medium">
  {m.channel === "whatsapp"
    ? "WhatsApp"
    : m.channel === "linkedin"
      ? "LinkedIn"
      : `Email ${m.email_number ?? 1}`}
</span>
```

- [ ] **Step 6: Typecheck + build del front**

Run: `cd app && npm run build`
Expected: `tsc --noEmit` sin errores y `vite build` OK (termina sin error).

- [ ] **Step 7: Commit**

```bash
git add app/src/pages/LeadDetail.tsx
git commit -m "feat(panel): botón Enviar por WhatsApp en la ficha del lead (mensaje prerellenado + registro)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Matiz de las reglas duras en `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md` (dos reglas de la sección "Reglas duras")

**Interfaces:** ninguna (documentación). Deja doc y código coherentes: el código ya tiene WhatsApp (footer entrante ya existente + este envío saliente manual), pero las reglas duras aún dicen "NADA de WhatsApp".

- [ ] **Step 1: Matizar la regla de canales**

En `CLAUDE.md`, en la línea que empieza `- Dos públicos / dos canales:`, sustituir el fragmento `NADA de WhatsApp ni llamadas.` por:

```
WhatsApp NO como captación en frío automática; SÍ como (a) línea de contacto entrante en el pie del email (WHATSAPP_NUMBER, solo email, apagado si vacío) y (b) envío saliente MANUAL/semi-manual desde la ficha del lead (no pipeline, exige web publicada). Llamadas: fuera de alcance.
```

- [ ] **Step 2: Matizar el gate de QA**

En la línea `- Gate de QA obligatorio: nada se contacta hasta status='approved' (visto bueno humano).`, añadir al final:

```
 Excepción: el envío MANUAL por WhatsApp desde la ficha no exige status='approved' (el check humano es que es manual y requiere web publicada); email y LinkedIn siguen con el gate intacto.
```

- [ ] **Step 3: Ajustar el "Fuera de alcance" del final**

En la línea `Fuera de alcance (no construir): contacto por WhatsApp; llamadas (ElevenLabs). Solo email y LinkedIn.`, sustituirla por:

```
Fuera de alcance (no construir): WhatsApp como canal de captación AUTOMÁTICO/de pipeline; llamadas (ElevenLabs). El WhatsApp saliente permitido es solo el envío manual desde la ficha del lead.
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: matizar reglas de WhatsApp (entrante + saliente manual) y del gate de QA

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Verificación end-to-end

**Files:** ninguno (solo verificación).

- [ ] **Step 1: Todos los tests caseros del front**

Run (desde la raíz):
```bash
for f in app/src/lib/*.test.ts; do echo "== $f =="; node --experimental-strip-types "$f" || break; done
```
Expected: cada fichero termina en `OK`; ninguno hace `exit(1)`.

- [ ] **Step 2: Build del front**

Run: `cd app && npm run build`
Expected: sin errores de TypeScript ni de build.

- [ ] **Step 3: Verificación manual en el panel (con Nico o su sesión)**

Comprobar en la ficha de un lead que **tenga WhatsApp y web publicada** (`site.live_url`):
1. Aparece el bloque "Enviar por WhatsApp" con el botón "Preparar mensaje".
2. Al pulsar, el textarea muestra el texto con el nombre del negocio, el `live_url` y el `.../book/<leadId>`.
3. Editar el texto, pulsar "Abrir WhatsApp" → se abre `wa.me` con el texto editado; WhatsApp muestra la tarjeta-preview del `live_url` si la web tiene OG.
4. En "Seguimiento de emails" aparece una fila **"WhatsApp"** (no "Email 0") con "Enviado".
5. Reenviar al mismo lead: no da error de duplicado (upsert) y actualiza la fila.
6. Un lead **sin** WhatsApp: no aparece el bloque. Un lead con WhatsApp pero **sin** web: no aparece (el bloque vive dentro de `site.live_url`).

- [ ] **Step 4: Commit final (si hubo ajustes) y cierre**

Si el paso 3 obligó a retocar algo, commitéalo. Si no, la feature queda cerrada en los commits de las Tasks 1-3.

---

## Notas de higiene (no bloquean el plan)

- Este trabajo está sobre `feat/lead-manual-por-url`, que es **otra** feature a medias. Recomendado: al ejecutar, sacar esto a su propia rama (p. ej. `feat/whatsapp-saliente-manual`) para no mezclar.
- Los cambios sueltos de `.env.example`/`deploy.sh` (footer entrante de WhatsApp) son de otra tarea y siguen sin commitear; no forman parte de este plan.
