# Puente Luvia — el captador entrega la clínica cerrada a la plataforma Luvia

Un mismo captador de clientes sirviendo **dos productos por cuenta**: las webs (admin, vía
Lovable) y **Luvia** (agente de chat para clínicas estéticas, cuenta no-admin). Cuando una
clínica del flujo Luvia **cierra**, se crea sola como **cliente** en la plataforma Luvia
(otro proyecto Supabase). Este spec cubre solo el puente nuevo; el resto ya existe.

## Contexto y decisiones cerradas

- **Un solo sistema, no un segundo producto.** Misma Supabase, mismo panel, misma RLS. El
  flujo se deriva del dueño del lead (`leads.owner`), no de una base de datos aparte.
  - `nicolassotodavid@gmail.com` (admin) → flujo **Webs** (Lovable), como hoy.
  - La cuenta **Luvia** (no-admin) → flujo Luvia: prospección en frío del asistente, sin webs.
- **Integración = puente automático.** Al cerrar, la clínica entra sola en Luvia (no alta manual).
- **Luvia es una app Supabase** (Postgres), como este proyecto, con su propia tabla de clientes.
- **Disparador = botón manual "Marcar como cliente".** Venta B2B negociada; sin checkout de
  Stripe en WebForge. El operador pulsa el botón cuando la clínica dice que sí.
- **Enfoque del puente = contrato (opción 1).** Luvia expone una Edge Function `crear-cliente`
  que WebForge llama por HTTP. Luvia es dueña de su esquema; si cambia sus tablas, el captador
  no se rompe. Descartadas: (2) insert directo con la service key de Luvia dentro de WebForge
  —acopla los dos esquemas y mete un secreto potente de Luvia aquí—; (3) cola/webhook con
  reintentos —exagerado para un botón manual de bajo volumen (YAGNI)—.
- **Nombre:** el producto es **Luvia** (con V). El código ya lo escribe así (`luvia.ts`,
  `LUVIA_OUTREACH_PROMPT`, `isLuviaLead`). Se mantiene esa grafía en todo lo nuevo.

## Qué ya existe (no se toca) vs. qué es nuevo

**Ya construido** (solo activar/verificar, fuera del alcance de código de este spec):
- Aislamiento por dueño + RLS: `leads.owner`, `is_admin()`, owner inmutable
  (`supabase/migrations/0016_lead_ownership.sql`).
- Rama Luvia del outreach: `LUVIA_OUTREACH_PROMPT` (`_shared/prompts.ts`), `isLuviaLead(owner,
  adminUserId)` (`_shared/luvia.ts`), ramas Luvia en `generate-outreach` y `send-email`.
- Ocultado de la maquinaria de webs para no-admin: `WEB_ONLY_STAGES` / `visibleStages(isAdmin)`
  (`app/src/lib/pipeline.ts`), guardas `isAdmin` en `LeadDetail.tsx` y `Dashboard.tsx`.

**Nuevo** (este spec):
- Columna `leads.luvia_client_id` + migración.
- Botón "Marcar como cliente" en la ficha (flujo Luvia).
- Edge Function `handoff-luvia` en WebForge.
- Contrato de la Edge Function `crear-cliente` en el proyecto Luvia (dependencia externa).

## Modelo de datos

Nueva migración `supabase/migrations/0021_lead_luvia_client.sql`:

```sql
-- Enlace del lead con su cliente en la plataforma Luvia. NULL = todavía no entregado.
-- Sirve de candado de idempotencia: con valor, el puente no se vuelve a disparar.
alter table leads
  add column if not exists luvia_client_id text;
```

Sin cambios de RLS: la columna hereda la visibilidad del lead (dueño + admin). El
`service_role` (Edge Functions) sigue saltándose RLS.

## Diseño por componentes

### 1. Botón "Marcar como cliente" (front — `app/src/pages/LeadDetail.tsx`)

- **Visibilidad:** solo para leads del flujo Luvia (`isLuviaLead`, es decir `owner ≠ admin`) y
  con `luvia_client_id` nulo (aún no entregado). Se muestra tanto al operador Luvia (sus leads)
  como al admin cuando mira un lead Luvia. No aparece en leads de web.
- **Acción:** al pulsar, invoca la Edge Function `handoff-luvia` con `{ lead_id }`.
  - **Éxito:** refresca la ficha (el lead ya está en `won` con `luvia_client_id`) y muestra un
    toast "Cliente creado en Luvia". El botón desaparece (ya hay `luvia_client_id`).
  - **Error:** toast de error y el lead **no cambia de estado** → se puede reintentar. Estado
    de carga en el botón mientras responde.
- **Copia:** botón "Marcar como cliente" + subtexto breve "Crea la clínica en Luvia y cierra el
  lead." (texto exacto lo ajusta David).

### 2. Edge Function `handoff-luvia` (WebForge — `supabase/functions/handoff-luvia/index.ts`)

Contrato: `Input { lead_id }` con sesión de operador (JWT en `Authorization`). Pasos:

1. **Auth + propiedad:** cargar el lead; con `canAccessLead`/`isAdminEmail` (`_shared/leadAccess.ts`)
   exigir que el llamante es el dueño del lead o el admin. Si no → 403.
2. **Guarda de flujo:** debe ser lead Luvia (`isLuviaLead(lead.owner, ADMIN_USER_ID)`). Un lead
   de web nunca se entrega a Luvia → 400.
3. **Idempotencia:** si `lead.luvia_client_id` ya tiene valor → devolver 200 con ese id **sin**
   volver a llamar a Luvia (no duplica clientes).
4. **Llamada a Luvia:** `POST {LUVIA_FUNCTIONS_URL}/crear-cliente` con
   `Authorization: Bearer {LUVIA_HANDOFF_TOKEN}` y el payload de abajo. Timeout + try/catch;
   si Luvia responde error o no responde → 502, sin tocar el lead.
5. **Persistencia (solo en éxito):** con `service_role`, `update leads set luvia_client_id =
   <id>, status = 'won', updated_at = now()` e `insert into events (lead_id, type, payload)`
   con `type = 'luvia_handoff'` para auditoría.
6. **Respuesta:** `{ ok: true, luvia_client_id }`.

**Payload WebForge → Luvia** (campos que ya tenemos en `leads`):

```json
{
  "webforge_lead_id": "<uuid>",
  "nombre": "<name>",
  "categoria": "<category>",
  "telefono": "<phone>",
  "whatsapp": "<whatsapp>",
  "email": "<email>",
  "direccion": "<address>",
  "ciudad": "<city>",
  "pais": "<country>",
  "rating": "<rating>",
  "resenas": "<review_count>",
  "source": "webforge"
}
```

### 3. Contrato `crear-cliente` (proyecto Luvia — dependencia externa, fuera de este repo)

Edge Function en el Supabase de Luvia que:
- Valida `Authorization: Bearer <token>` contra su propio secreto (el mismo valor que
  `LUVIA_HANDOFF_TOKEN` en WebForge).
- Inserta la clínica en su tabla de clientes (nombre/columnas los aporta David).
- **Devuelve** `{ cliente_id: "<id>" }`. Idempotencia recomendada también en Luvia: si ya
  existe un cliente con ese `webforge_lead_id`, devolver el id existente en vez de duplicar.

La construye David en el proyecto Luvia, o da acceso a ese proyecto y la implementamos ahí en
un ciclo aparte (spec → plan propios). En este repo solo se fija el contrato.

## Seguridad / secretos

- WebForge (secretos de Edge Functions): `LUVIA_FUNCTIONS_URL`, `LUVIA_HANDOFF_TOKEN`,
  `ADMIN_USER_ID` (para `isLuviaLead`). **Nunca** la service key de Luvia vive en WebForge.
- Luvia (secreto de su Edge Function): el mismo token, para validar el bearer entrante.
- El token es un secreto compartido rotable; si se filtra, se rota en los dos lados sin migración.

## Lo que necesita David (fuera de código)

1. Crear la cuenta del operador Luvia en Supabase Auth (email a decidir) y fijar
   `ADMIN_USER_ID` / `VITE_ADMIN_EMAIL` con el UUID/email del admin (resolver una vez).
2. En el proyecto Luvia: la tabla de clientes (nombre + columnas obligatorias) y la Edge
   Function `crear-cliente` según el contrato.
3. Generar el `LUVIA_HANDOFF_TOKEN` y ponerlo en ambos proyectos.
4. Deploy: `supabase functions deploy handoff-luvia` + migración `0021` + build del front a prod.
5. Regla permanente (`no-enviar-a-clientes` / no crear clientes reales de prueba): probar el
   puente contra un cliente de test en Luvia antes de usarlo con clínicas reales.

## Fuera de alcance (YAGNI)

- Checkout de Stripe para Luvia (cierre elegido = manual).
- Pantalla de alta de usuarios en el panel (las cuentas se crean a mano en Supabase).
- Sincronización de vuelta Luvia → WebForge (estado del cliente, bajas, etc.).
- Disparador automático (por respuesta o por pago). Hoy es el botón manual.
- Secuencia de seguimientos propia de Luvia (queda para un sprint aparte).

## Verificación

- `cd app && npm run build` (tsc) verde antes de cualquier push a prod.
- Unit: `isLuviaLead` y la guarda de flujo de `handoff-luvia` (lead de web → rechazado).
- Idempotencia: pulsar el botón dos veces crea **un** cliente en Luvia; el segundo POST se salta
  por `luvia_client_id`.
- E2E manual: con la cuenta Luvia, un lead `contacted` de una clínica de prueba → "Marcar como
  cliente" → aparece en la tabla de clientes de Luvia, el lead pasa a `won` y el botón desaparece.
  Con la cuenta admin, el flujo de webs sigue intacto y no aparece el botón en leads de web.
- Fallo controlado: con `LUVIA_FUNCTIONS_URL` mal → toast de error y el lead sigue sin `won`.
