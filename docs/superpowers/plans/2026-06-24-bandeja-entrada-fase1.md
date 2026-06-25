# Bandeja de entrada — Fase 1 (ver respuestas) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que las respuestas de los clientes entren al panel enganchadas a su lead, se vean como conversación en la ficha del lead, y marquen «Respondió» automáticamente — sin tocar la entregabilidad del envío.

**Architecture:** Resend Inbound recibe en el subdominio `in.nico-soto.es`, parsea el correo y hace POST `email.received` a la Edge Function `inbound-email`. La función verifica la firma Svix, identifica el lead por la dirección destino etiquetada (`re+<lead_id>@in.nico-soto.es`), pide el cuerpo a la API de Resend, guarda en `inbound_messages`, marca el último saliente `status='replied'` y reenvía copia al buzón humano del dueño. `LeadDetail` muestra la conversación (salientes + entrantes).

**Tech Stack:** Supabase (Postgres + RLS + Edge Functions Deno), Resend (envío + inbound), React + TS (panel), tests Deno con `node --experimental-strip-types`.

## Global Constraints

- Secrets SOLO en servidor (RESEND_API_KEY, RESEND_WEBHOOK_SECRET, SERVICE_ROLE_KEY). Nunca en el frontend.
- Subdominio de inbound = `in.nico-soto.es`. Dominio de envío `nico-soto.es` NO se toca (SPF/DKIM intactos).
- Proyecto Supabase ref: `khscikqchvjxyvoaruas`. URL funciones: `https://khscikqchvjxyvoaruas.supabase.co/functions/v1/<fn>`.
- Vercel publica producción desde **main**; push a `main` que cambie `supabase/functions/**` dispara la Action de deploy de Supabase (`.github/workflows/deploy.yml`).
- ORDEN PERMANENTE: no enviar correos a clientes reales sin OK; las pruebas, al Gmail del usuario o al lead de prueba.
- Migraciones aditivas e idempotentes. Próximo número: `0018`.
- Tests de helpers Deno: `node --experimental-strip-types <archivo>.test.ts` (patrón existente: `_shared/replyTo.test.ts`).
- Frontend: no hay test runner; se valida con `cd app && npm run build` (tsc) + comprobación manual.

---

## File Structure

- **Create** `supabase/migrations/0018_inbound_messages.sql` — tabla `inbound_messages` + RLS + índice + `provider_message_id` en `outreach_messages`.
- **Create** `supabase/functions/_shared/inboundAddress.ts` — helpers puros (construir/parsear la dirección etiquetada, mapear fila inbound). Una responsabilidad: la dirección de respuesta y el modelo de fila entrante.
- **Create** `supabase/functions/_shared/inboundAddress.test.ts` — tests de los helpers puros.
- **Create** `supabase/functions/inbound-email/index.ts` — webhook receptor (orquesta: verifica firma → match → fetch cuerpo → guarda → marca replied → reenvía).
- **Modify** `supabase/functions/send-email/index.ts` — `reply_to` etiquetado + guardar `provider_message_id`.
- **Modify** `supabase/functions/cron-followups/index.ts` — `reply_to` etiquetado + guardar `provider_message_id`.
- **Modify** `supabase/config.toml` — `[functions.inbound-email] verify_jwt = false`.
- **Modify** `.github/workflows/deploy.yml` — añadir `inbound-email` a la lista de funciones desplegadas.
- **Modify** `app/src/lib/types.ts` — tipo `InboundMessage`.
- **Modify** `app/src/pages/LeadDetail.tsx` — cargar `inbound_messages` y renderizar la conversación.

---

### Task 1: Migración `inbound_messages` + `provider_message_id`

**Files:**
- Create: `supabase/migrations/0018_inbound_messages.sql`

**Interfaces:**
- Produces: tabla `inbound_messages(id, lead_id, from_email, from_name, subject, body_text, body_html, message_id, in_reply_to, outreach_message_id, received_at, raw)`; columna `outreach_messages.provider_message_id text`.

- [ ] **Step 1: Escribir la migración**

```sql
-- 0018_inbound_messages.sql
-- Bandeja de entrada: respuestas entrantes de clientes enganchadas al lead.
-- Aditiva e idempotente.

create table if not exists inbound_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,         -- null = sin asignar
  from_email text not null,
  from_name text,
  subject text,
  body_text text,
  body_html text,
  message_id text,                                             -- Message-ID del entrante
  in_reply_to text,                                            -- para hilar
  outreach_message_id uuid references outreach_messages(id) on delete set null,
  received_at timestamptz not null default now(),
  raw jsonb                                                    -- payload completo (auditoría)
);
create index if not exists idx_inbound_lead on inbound_messages (lead_id, received_at);

-- Para hilar el saliente con su respuesta (cabeceras In-Reply-To/References).
alter table outreach_messages
  add column if not exists provider_message_id text;

-- RLS: misma política que el resto (admin ve todo; operador, solo los suyos por owner del lead).
alter table inbound_messages enable row level security;

drop policy if exists inbound_select on inbound_messages;
create policy inbound_select on inbound_messages
  for select to authenticated
  using (
    is_admin()
    or exists (
      select 1 from leads l
      where l.id = inbound_messages.lead_id and l.owner = auth.uid()
    )
  );

-- Escritura solo desde el servidor (service_role). authenticated no inserta inbound.
drop policy if exists inbound_no_write on inbound_messages;
create policy inbound_no_write on inbound_messages
  for all to authenticated using (false) with check (false);
```

- [ ] **Step 2: Aplicar la migración**

Run: `cd /Users/davidnicolassoto/webforge && npx supabase db push`
Expected: aplica `0018_inbound_messages.sql` sin error. (Si el usuario debe correrlo, ver [[db-push-lo-corre-el-usuario]].)

- [ ] **Step 3: Verificar que la tabla existe (REST)**

Run:
```bash
cd /Users/davidnicolassoto/webforge
URL=$(grep -E '^SUPABASE_URL=' .env|cut -d= -f2-|xargs); K=$(grep -E '^SUPABASE_SERVICE_ROLE_KEY=' .env|cut -d= -f2-|xargs)
curl -s "$URL/rest/v1/inbound_messages?select=id&limit=1" -H "apikey: $K" -H "Authorization: Bearer $K"
```
Expected: `[]` (array vacío, sin error de "relation does not exist").

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0018_inbound_messages.sql
git commit -m "feat(db): tabla inbound_messages + provider_message_id (bandeja entrada)"
```

---

### Task 2: Helpers puros de dirección etiquetada

**Files:**
- Create: `supabase/functions/_shared/inboundAddress.ts`
- Test: `supabase/functions/_shared/inboundAddress.test.ts`

**Interfaces:**
- Produces:
  - `INBOUND_DOMAIN = "in.nico-soto.es"`
  - `buildInboundReplyTo(leadId: string, displayName: string): string` → `"<displayName> <re+<leadId>@in.nico-soto.es>"`
  - `parseLeadIdFromAddress(addr: string): string | null` — saca el `<leadId>` de una dirección (acepta `"Nombre <re+id@dom>"` o `re+id@dom`).
  - `pickLeadIdFromRecipients(to: string[]): string | null` — primer destinatario del dominio inbound del que se pueda extraer leadId.

- [ ] **Step 1: Escribir el test (falla)**

```ts
// node --experimental-strip-types supabase/functions/_shared/inboundAddress.test.ts
import { buildInboundReplyTo, parseLeadIdFromAddress, pickLeadIdFromRecipients, INBOUND_DOMAIN } from "./inboundAddress.ts";

let failures = 0;
function assertEq(actual: unknown, expected: unknown, msg: string) {
  const ok = actual === expected;
  console.log(`${ok ? "✓" : "✗"} ${msg}  (got ${actual}, want ${expected})`);
  if (!ok) failures++;
}

const LEAD = "aa200343-de2e-4efb-ae9b-d33eff9c675f";

assertEq(buildInboundReplyTo(LEAD, "Nico"), `Nico <re+${LEAD}@${INBOUND_DOMAIN}>`, "construye reply-to etiquetado");
assertEq(parseLeadIdFromAddress(`Nico <re+${LEAD}@${INBOUND_DOMAIN}>`, ), LEAD, "parsea formato 'Nombre <...>'");
assertEq(parseLeadIdFromAddress(`re+${LEAD}@${INBOUND_DOMAIN}`), LEAD, "parsea dirección desnuda");
assertEq(parseLeadIdFromAddress("alguien@gmail.com"), null, "dirección ajena → null");
assertEq(parseLeadIdFromAddress("re+nope@otro.com"), null, "dominio que no es el inbound → null");
assertEq(pickLeadIdFromRecipients(["x@gmail.com", `re+${LEAD}@${INBOUND_DOMAIN}`]), LEAD, "elige el destinatario del dominio inbound");
assertEq(pickLeadIdFromRecipients(["x@gmail.com"]), null, "ningún destinatario inbound → null");

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAIL`);
if (failures) process.exit(1);
```

- [ ] **Step 2: Ejecutar el test (debe fallar)**

Run: `node --experimental-strip-types supabase/functions/_shared/inboundAddress.test.ts`
Expected: FAIL (module/función no existe).

- [ ] **Step 3: Implementar el helper**

```ts
// _shared/inboundAddress.ts
// Dirección de respuesta etiquetada por lead, para enrutar respuestas entrantes al lead correcto.
// El cliente ve solo el nombre ("Nico"); la parte local lleva el lead_id: re+<lead_id>@in.nico-soto.es
export const INBOUND_DOMAIN = "in.nico-soto.es";

const UUID_RE = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;

export function buildInboundReplyTo(leadId: string, displayName: string): string {
  return `${displayName} <re+${leadId}@${INBOUND_DOMAIN}>`;
}

/** Extrae el lead_id de una dirección "Nombre <re+ID@dom>" o "re+ID@dom". null si no es del dominio inbound. */
export function parseLeadIdFromAddress(addr: string): string | null {
  const m = addr.match(/<([^>]+)>/);
  const email = (m ? m[1] : addr).trim().toLowerCase();
  const at = email.indexOf("@");
  if (at < 0) return null;
  const domain = email.slice(at + 1);
  if (domain !== INBOUND_DOMAIN) return null;
  const local = email.slice(0, at); // "re+<uuid>"
  const idMatch = local.match(UUID_RE);
  return idMatch ? idMatch[0] : null;
}

export function pickLeadIdFromRecipients(to: string[]): string | null {
  for (const addr of to ?? []) {
    const id = parseLeadIdFromAddress(addr);
    if (id) return id;
  }
  return null;
}
```

- [ ] **Step 4: Ejecutar el test (debe pasar)**

Run: `node --experimental-strip-types supabase/functions/_shared/inboundAddress.test.ts`
Expected: `ALL PASS`.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/inboundAddress.ts supabase/functions/_shared/inboundAddress.test.ts
git commit -m "feat(inbound): helpers de dirección etiquetada por lead + tests"
```

---

### Task 3: Reply-to etiquetado + guardar `provider_message_id` en el envío

**Files:**
- Modify: `supabase/functions/send-email/index.ts`
- Modify: `supabase/functions/cron-followups/index.ts`

**Interfaces:**
- Consumes: `buildInboundReplyTo` (Task 2), columna `provider_message_id` (Task 1).
- Produces: salientes con `reply_to` etiquetado y `outreach_messages.provider_message_id` poblado.

- [ ] **Step 1: send-email — usar reply-to etiquetado**

En `supabase/functions/send-email/index.ts`, importar el helper y el nombre del dueño. Sustituir el cálculo de `replyTo` (líneas ~135-139) por la dirección etiquetada, manteniendo el nombre por dueño (Nico/Miguel):

```ts
import { buildInboundReplyTo } from "../_shared/inboundAddress.ts";
// ... isLuviaLead ya disponible vía _shared/luvia.ts
const ownerName = isLuviaLead(lead.owner, Deno.env.get("ADMIN_USER_ID")) ? "Miguel" : "Nico";
const replyTo = buildInboundReplyTo(msg.lead_id, ownerName);
```

Y en el cuerpo del fetch a Resend, `reply_to` pasa de opcional a siempre presente:
```ts
        reply_to: replyTo,
```

- [ ] **Step 2: send-email — guardar provider_message_id**

En el update que marca 'sent' (líneas ~182-185), añadir el id de Resend:
```ts
  const { error: updErr } = await supabase
    .from("outreach_messages")
    .update({ status: "sent", sent_at: nowIso, provider_message_id: resendId })
    .eq("id", messageId);
```

- [ ] **Step 3: cron-followups — mismos dos cambios**

En `supabase/functions/cron-followups/index.ts`: importar `buildInboundReplyTo`, fijar `reply_to` etiquetado por lead en el envío a Resend, y añadir `provider_message_id: resendId` al update que marca 'sent'. (Misma forma que en send-email; reutiliza el `lead.owner` que la función ya carga.)

- [ ] **Step 4: Verificar build de funciones (type-check Deno)**

Run: `cd /Users/davidnicolassoto/webforge && deno check supabase/functions/send-email/index.ts supabase/functions/cron-followups/index.ts`
Expected: sin errores de tipos. (Si `deno` no está, el chequeo real es el deploy de la Action; en ese caso saltar al commit y validar en Task 6.)

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/send-email/index.ts supabase/functions/cron-followups/index.ts
git commit -m "feat(inbound): reply-to etiquetado por lead + guardar provider_message_id"
```

---

### Task 4: Edge Function `inbound-email`

**Files:**
- Create: `supabase/functions/inbound-email/index.ts`
- Modify: `supabase/config.toml`
- Modify: `supabase/functions/_shared/inboundAddress.ts` (añadir `buildInboundRow`)
- Test: `supabase/functions/_shared/inboundAddress.test.ts` (añadir test de `buildInboundRow`)

**Interfaces:**
- Consumes: `pickLeadIdFromRecipients` (Task 2); tabla `inbound_messages` (Task 1); `replyToFor` (`_shared/replyTo.ts`) para el reenvío.
- Produces: endpoint público `POST /functions/v1/inbound-email`; `buildInboundRow(leadId, fetched)` → objeto fila para insertar.

- [ ] **Step 1: Test de `buildInboundRow` (falla)**

Añadir a `inboundAddress.test.ts`:
```ts
import { buildInboundRow } from "./inboundAddress.ts";
const fetched = {
  id: "em_123", from: "Cliente <cliente@correo.com>", to: [`re+${LEAD}@${INBOUND_DOMAIN}`],
  subject: "Re: tu web", text: "Sí, me interesa", html: "<p>Sí, me interesa</p>",
  message_id: "<abc@correo.com>", headers: { "in-reply-to": "<out@nico-soto.es>" },
};
const row = buildInboundRow(LEAD, fetched as any);
assertEq(row.lead_id, LEAD, "row.lead_id");
assertEq(row.from_email, "cliente@correo.com", "row.from_email (extrae el email del display)");
assertEq(row.from_name, "Cliente", "row.from_name");
assertEq(row.body_text, "Sí, me interesa", "row.body_text");
assertEq(row.message_id, "<abc@correo.com>", "row.message_id");
assertEq(row.in_reply_to, "<out@nico-soto.es>", "row.in_reply_to de headers");
```

- [ ] **Step 2: Ejecutar (falla)**

Run: `node --experimental-strip-types supabase/functions/_shared/inboundAddress.test.ts`
Expected: FAIL (`buildInboundRow` no existe).

- [ ] **Step 3: Implementar `buildInboundRow` en `inboundAddress.ts`**

```ts
export interface FetchedInbound {
  id: string; from: string; to: string[]; subject: string | null;
  text: string | null; html: string | null; message_id: string | null;
  headers?: Record<string, string>;
}
export interface InboundRow {
  lead_id: string | null; from_email: string; from_name: string | null;
  subject: string | null; body_text: string | null; body_html: string | null;
  message_id: string | null; in_reply_to: string | null; raw: unknown;
}
/** Separa "Nombre <email>" → {name, email}. */
function splitAddress(addr: string): { name: string | null; email: string } {
  const m = addr.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1] || null, email: m[2].trim().toLowerCase() };
  return { name: null, email: addr.trim().toLowerCase() };
}
export function buildInboundRow(leadId: string | null, f: FetchedInbound): InboundRow {
  const { name, email } = splitAddress(f.from);
  return {
    lead_id: leadId,
    from_email: email,
    from_name: name,
    subject: f.subject ?? null,
    body_text: f.text ?? null,
    body_html: f.html ?? null,
    message_id: f.message_id ?? null,
    in_reply_to: f.headers?.["in-reply-to"] ?? null,
    raw: f,
  };
}
```

- [ ] **Step 4: Ejecutar (pasa)**

Run: `node --experimental-strip-types supabase/functions/_shared/inboundAddress.test.ts`
Expected: `ALL PASS`.

- [ ] **Step 5: Implementar la función `inbound-email`**

```ts
// inbound-email — recibe el webhook email.received de Resend Inbound.
// Verifica firma Svix, identifica el lead por la dirección etiquetada, pide el cuerpo a Resend,
// guarda en inbound_messages, marca el último saliente 'replied' y reenvía copia al buzón del dueño.
// Público (verify_jwt=false): la seguridad es la firma Svix. Secrets solo en servidor.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { Webhook } from "https://esm.sh/svix@1";
import { corsHeaders } from "../_shared/cors.ts";
import { pickLeadIdFromRecipients, buildInboundRow, type FetchedInbound } from "../_shared/inboundAddress.ts";
import { replyToFor, DEFAULT_REPLY_TO_WEBFORGE, DEFAULT_REPLY_TO_LUVIA } from "../_shared/replyTo.ts";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
  const WEBHOOK_SECRET = Deno.env.get("RESEND_WEBHOOK_SECRET")!;
  const FROM_EMAIL = Deno.env.get("FROM_EMAIL")!;

  // 1) Verificar firma Svix sobre el cuerpo crudo.
  const raw = await req.text();
  let evt: { type: string; data: { email_id: string; to: string[]; from: string; subject: string } };
  try {
    const wh = new Webhook(WEBHOOK_SECRET);
    evt = wh.verify(raw, {
      "svix-id": req.headers.get("svix-id") ?? "",
      "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
      "svix-signature": req.headers.get("svix-signature") ?? "",
    }) as typeof evt;
  } catch (_e) {
    return json({ error: "Firma inválida" }, 401);
  }
  if (evt.type !== "email.received") return json({ ok: true, ignored: evt.type });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // 2) Identificar el lead por la dirección etiquetada.
  const leadId = pickLeadIdFromRecipients(evt.data.to);

  // 3) Pedir el cuerpo completo a Resend.
  const r = await fetch(`https://api.resend.com/emails/receiving/${evt.data.email_id}`, {
    headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
  });
  const fetched = (await r.json()) as FetchedInbound;

  // 4) Guardar el entrante.
  const row = buildInboundRow(leadId, fetched);
  await supabase.from("inbound_messages").insert(row);

  if (leadId) {
    // 5) Marcar el último saliente del lead como 'replied' (alimenta pestaña Emails / Dashboard / timeline).
    const { data: last } = await supabase
      .from("outreach_messages")
      .select("id").eq("lead_id", leadId).eq("channel", "email").eq("status", "sent")
      .order("sent_at", { ascending: false }).limit(1).maybeSingle();
    if (last) await supabase.from("outreach_messages").update({ status: "replied" }).eq("id", last.id);

    // 6) Reenviar copia al buzón humano del dueño (no perder visibilidad en Gmail).
    const { data: lead } = await supabase.from("leads").select("owner").eq("id", leadId).maybeSingle();
    const fwd = replyToFor(lead?.owner, Deno.env.get("ADMIN_USER_ID"), {
      webforge: Deno.env.get("REPLY_TO_WEBFORGE") ?? DEFAULT_REPLY_TO_WEBFORGE,
      luvia: Deno.env.get("REPLY_TO_LUVIA") ?? DEFAULT_REPLY_TO_LUVIA,
    });
    if (fwd) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `Bandeja WebForge <${FROM_EMAIL}>`,
          to: [fwd],
          subject: `↩︎ Respuesta de ${row.from_email}: ${row.subject ?? "(sin asunto)"}`,
          text: `De: ${fetched.from}\n\n${row.body_text ?? "(sin texto)"}`,
          html: fetched.html ?? undefined,
        }),
      });
    }
  }

  return json({ ok: true, lead_id: leadId, email_id: evt.data.email_id });
});
```

- [ ] **Step 6: Marcar la función como pública en config**

En `supabase/config.toml` añadir (igual que stripe-webhook/track-event):
```toml
[functions.inbound-email]
verify_jwt = false
```

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/inbound-email/index.ts supabase/functions/_shared/inboundAddress.ts supabase/functions/_shared/inboundAddress.test.ts supabase/config.toml
git commit -m "feat(inbound): edge function inbound-email (recibe, guarda, marca replied, reenvía)"
```

---

### Task 5: Conversación en `LeadDetail`

**Files:**
- Modify: `app/src/lib/types.ts`
- Modify: `app/src/pages/LeadDetail.tsx`

**Interfaces:**
- Consumes: tabla `inbound_messages` (Task 1); `outreachHistory` ya existente.
- Produces: sección "Conversación" que mezcla salientes + entrantes por fecha.

- [ ] **Step 1: Tipo `InboundMessage` en types.ts**

```ts
export interface InboundMessage {
  id: string;
  lead_id: string | null;
  from_email: string;
  from_name: string | null;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  received_at: string;
}
```

- [ ] **Step 2: Cargar los entrantes en LeadDetail**

En `loadAll` (junto a la query de `outreach_messages`), añadir en el `Promise.all`:
```ts
      supabase
        .from("inbound_messages")
        .select("id,lead_id,from_email,from_name,subject,body_text,body_html,received_at")
        .eq("lead_id", id)
        .order("received_at", { ascending: true }),
```
y guardar en un estado nuevo `const [inbound, setInbound] = useState<InboundMessage[]>([])` → `setInbound((inboundData as InboundMessage[]) ?? [])`.

- [ ] **Step 3: Renderizar la conversación**

Debajo del bloque "SEGUIMIENTO DE EMAILS", añadir una lista cronológica que mezcle salientes (`outreachHistory` con `sent_at`) y entrantes (`inbound`), ordenados por fecha. Los entrantes se alinean a la izquierda con fondo distinto; muestran `from_name ?? from_email`, la fecha (`fmtWhen`) y `body_text` (texto plano; nunca inyectar `body_html` sin sanear). Ejemplo de item entrante:
```tsx
<div className="rounded-md border bg-muted/40 p-3">
  <div className="text-xs text-muted-foreground">
    {m.from_name ?? m.from_email} · {fmtWhen(m.received_at)}
  </div>
  <pre className="mt-1 whitespace-pre-wrap text-sm font-sans">{m.body_text ?? "(sin texto)"}</pre>
</div>
```
(Reutilizar el helper de fecha; si `fmtWhen` no está en LeadDetail, añadir uno local idéntico al de la pestaña Emails.)

- [ ] **Step 4: Verificar build**

Run: `cd /Users/davidnicolassoto/webforge/app && npm run build`
Expected: `BUILD_EXIT=0`, sin errores TS.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/types.ts app/src/pages/LeadDetail.tsx
git commit -m "feat(panel): conversación entrante en la ficha del lead (bandeja entrada)"
```

---

### Task 6: Configurar Resend Inbound + DNS + desplegar + prueba end-to-end

**Files:**
- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: Añadir la función al workflow de deploy**

En `.github/workflows/deploy.yml`, en la lista de `supabase functions deploy`, añadir la línea:
```
            inbound-email \
```

- [ ] **Step 2: Configurar el dominio receptor en Resend** (manual, lo hace el usuario o Nico)

En el dashboard de Resend → Receiving → añadir dominio receptor `in.nico-soto.es`. Resend dará uno o más registros **MX** (y posiblemente TXT). Añadirlos en **GoDaddy** bajo el subdominio `in` (NO tocar los MX del apex `nico-soto.es`, que siguen en ImprovMX). Esperar verificación/propagación.

- [ ] **Step 3: Crear el webhook + secreto**

En Resend → Webhooks → crear endpoint `https://khscikqchvjxyvoaruas.supabase.co/functions/v1/inbound-email`, evento `email.received`. Copiar el **signing secret** (Svix) y guardarlo como secret de Supabase y en `.env`:
```bash
npx supabase secrets set RESEND_WEBHOOK_SECRET=whsec_xxx --project-ref khscikqchvjxyvoaruas
```

- [ ] **Step 4: Desplegar**

Merge de la rama a `main` (dispara la Action que despliega las funciones, incluida `inbound-email`). Confirmar en la pestaña Actions de GitHub que el deploy salió verde. (Reglas de rama: ver [[deploy-ramas-vercel-master]].)

- [ ] **Step 5: Prueba end-to-end (al Gmail del usuario)**

1. Crear/usar un lead de prueba con email = el Gmail del usuario y enviarle el Email 1 (como en `scratchpad/test-tracking.sh`). Ahora el `reply_to` será `re+<lead_id>@in.nico-soto.es`.
2. Desde el Gmail, **responder** a ese correo.
3. Verificar (REST) que aparece la fila entrante y el saliente quedó 'replied':
```bash
URL=$(grep -E '^SUPABASE_URL=' .env|cut -d= -f2-|xargs); K=$(grep -E '^SUPABASE_SERVICE_ROLE_KEY=' .env|cut -d= -f2-|xargs)
curl -s "$URL/rest/v1/inbound_messages?lead_id=eq.<LEAD_ID>&select=from_email,subject,body_text,received_at" -H "apikey: $K" -H "Authorization: Bearer $K"
```
4. En el panel → ficha del lead → la respuesta aparece en "Conversación", y el lead figura como "Respondió" en la pestaña Emails.
5. Confirmar que llegó también la copia al buzón humano (reenvío).

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "chore(deploy): desplegar inbound-email en la Action de Supabase"
```

---

## Self-Review (cobertura del spec)

- Capturar entrantes → Task 4 (`inbound-email`). ✅
- Engancharlos al lead → Tasks 2+4 (dirección etiquetada + match). ✅
- Mostrar conversación → Task 5. ✅
- Marcar «Respondió» auto → Task 4 (step 5). ✅
- No perder copia en Gmail → Task 4 (step 6, reenvío). ✅
- Sin impacto en envío → reply-to en subdominio aparte; SPF/DKIM intactos (Global Constraints). ✅
- Seguridad (firma Svix, RLS, no HTML sin sanear) → Tasks 1 (RLS), 4 (Svix), 5 (texto plano). ✅
- Sin asignar si no hay match → Task 4 (leadId null → fila con lead_id null, no rompe). ✅

**Fuera de esta fase (irá en el plan de Fase 2):** responder desde el panel (`send-reply` + caja de respuesta, hilado con In-Reply-To/References usando `provider_message_id`).
