# WhatsApp saliente manual — Design

**Goal:** En la ficha del lead, un botón **"Enviar por WhatsApp"** que abre WhatsApp con un
mensaje ya escrito (texto + enlace a la web + enlace a `/book`), editable antes de enviar, y
deja rastro del envío. Es una acción **manual / semi-manual**: tú revisas y das a enviar en
WhatsApp; el panel solo prepara el mensaje y registra que lo contactaste.

**Arquitectura:** Todo en el panel (front), sin Edge Function nueva ni cambios en
`generate-outreach`. Dos funciones puras nuevas en `app/src/lib/contact.ts` (testeadas con el
runner casero del repo) y una acción en `app/src/pages/LeadDetail.tsx` que abre `wa.me?text=…`
e inserta el registro directo en `outreach_messages` (permitido por RLS para el owner del lead).

**Spec aprobada por Nico el 2026-07-03** (brainstorming en la sesión).

## Decisiones tomadas (por qué es así)

- **Acción manual por lead**, NO canal de pipeline. No toca segmentación, cron ni
  `generate-outreach`. WhatsApp es un extra manual encima de email (local) / LinkedIn (b2b).
- **Texto = plantilla propia de WhatsApp**, generada al vuelo desde `lead.name` + `live_url` +
  `/book`, **editable** en un textarea antes de abrir WhatsApp.
- **Sin gate de QA** (`status='approved'` NO se exige). Basta con que haya web publicada
  (`site.live_url`). Check humano implícito: es manual y requiere web construida — el operador
  está mirando el lead cuando pulsa.
- **Se registra al pulsar** en `outreach_messages` (`channel='whatsapp'`), para el timeline de
  seguimiento y no duplicar contacto.
- **Los dos enlaces** del email: "Ver la web" (`live_url`) y "Activar mi web" (`/book/:leadId`).

## Global Constraints

- Copy visible en **español**, tono humano, sin pinta de plantilla.
- Cambios en `contact.ts` **aditivos**; `waLink` extendido de forma **retrocompatible**.
- **Sin migraciones** (ver "Registro" para cómo se esquiva el UNIQUE existente).
- No tocar `generate-outreach`, `cron-followups`, la segmentación ni el flujo de emails.
- El WhatsApp del **lead** vive en `contact.ts` (`waNumber`/`waLink`); el del **operador** vive
  en `business.ts` (`whatsappLink`, para `/book`). No confundirlos: este trabajo usa el del lead.
- Tests: runner casero sin framework (patrón `app/src/lib/leadFilters.test.ts` / `admin.test.ts`),
  ejecutado con `node --experimental-strip-types <archivo>`.
- Commits en español estilo repo (`feat(...)`, `docs(...)`), con
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## Piezas

### 1. `app/src/lib/contact.ts` (aditivo)

- **`whatsappOutreachText(negocio: string | null, liveUrl: string, bookUrl: string): string`** —
  función pura. Devuelve el texto de plantilla. Con `negocio` vacío/null omite el nombre con
  gracia. Texto canónico:

  ```
  Hola 👋 soy Nico. He preparado una web para {negocio}, échale un vistazo:
  {liveUrl}

  Si te gusta, aquí la dejas activada en un momento:
  {bookUrl}

  Un saludo.
  ```

  Sin negocio → primera línea: `Hola 👋 soy Nico. He preparado una web, échale un vistazo:`

- **`waLink(lead, mensaje?: string): string | null`** — extender la firma actual con un 2º
  parámetro **opcional**. Si viene `mensaje`, cuelga `?text=${encodeURIComponent(mensaje)}`.
  Sin `mensaje`, comportamiento idéntico al actual (los llamadores existentes no cambian).

### 2. `app/src/pages/LeadDetail.tsx`

- En el **bloque de la web** (donde ya se muestra `site.live_url`), añadir la acción
  **"Enviar por WhatsApp"**.
- **Visibilidad:** solo si `waNumber(lead) != null`. Si no hay número, el botón no se pinta
  (igual que hoy con el enlace de contacto).
- **Habilitación:** deshabilitado (con hint *"Publica la web primero"*) mientras no haya
  `site.live_url`.
- **Interacción:** al pulsar, despliega un `<textarea>` con el texto prerellenado
  (`whatsappOutreachText(lead.name, site.live_url, bookUrl)`) + botón **"Abrir WhatsApp"**.
  - `bookUrl = ${window.location.origin}/book/${lead.id}` (el panel y `/book` comparten dominio;
    un solo Vercel). Si algún día `/book` va en un dominio aparte, se añadiría `VITE_BOOKING_BASE`.
  - "Abrir WhatsApp": `window.open(waLink(lead, textoEditado), "_blank")` **y** registra (abajo).

### 3. Registro en `outreach_messages`

Insert (upsert) directo desde el panel — RLS `op_msgs` lo permite al owner del lead:

- `lead_id`, `channel='whatsapp'`, `body=<texto editado>`, `status='sent'`,
  `generated_by_model='manual'`, `sent_at=now()`, `email_number=0`.
- **`email_number=0` (centinela) + upsert `on conflict (lead_id, email_number)`:**
  - La tabla tiene `UNIQUE(lead_id, email_number)` global (migración 0006) y
    `email_number int NOT NULL default 1` (0003). Reusar `1` **chocaría** con el email #1 del lead.
  - `0` está **fuera** de la secuencia de emails (1/2/3), así que ningún query lo mira:
    la idempotencia de `generate-outreach` y `cron-followups` solo filtran 1/2/3.
  - El upsert hace que **reenviar** a un lead **actualice** su registro de WhatsApp
    (un registro WhatsApp por lead). Sin migración, sin colisión.
- **Timeline:** LeadDetail debe etiquetar filas `channel='whatsapp'` como **"WhatsApp"**
  (no "Email #0") en el historial de seguimiento.

## Flujo de datos

`lead.name` / `site.live_url` / `lead.id`
 → `whatsappOutreachText(...)` + `bookUrl`
 → `<textarea>` editable
 → `waLink(lead, textoEditado)`
 → `window.open(...)` + upsert `outreach_messages`.

## Manejo de errores

- Sin `waNumber(lead)` → botón no se pinta.
- Sin `site.live_url` → botón deshabilitado + hint *"Publica la web primero"*.
- Falla el upsert → **abrir WhatsApp igual** (no bloquear el contacto por un fallo de registro);
  mostrar aviso inline *"No se pudo registrar el envío"*. El `window.open` no depende del insert.

## Tests — `app/src/lib/contact.test.ts` (nuevo, runner casero)

- `whatsappOutreachText`: incluye `negocio`, `liveUrl` y `bookUrl`; caso `negocio` vacío omite el
  nombre; los dos enlaces aparecen.
- `waLink(lead)` sin mensaje → enlace pelado `https://wa.me/<n>` (comportamiento actual intacto).
- `waLink(lead, msg)` → añade `?text=` correctamente `encodeURIComponent`-eado.
- `waLink(lead)` cuando el lead no tiene número → `null`.

## CLAUDE.md — matiz de reglas duras (parte del trabajo)

Ajustar dos reglas para que doc y código no se contradigan:

- **Canales:** el "NADA de WhatsApp ni llamadas" pasa a: *WhatsApp NO como captación en frío
  automática. SÍ como (a) línea de contacto entrante en el pie del email (`WHATSAPP_NUMBER`), y
  (b) envío saliente MANUAL/semi-manual desde la ficha del lead (no pipeline). Llamadas: fuera de
  alcance.*
- **Gate de QA:** añadir la excepción del envío manual por WhatsApp — no exige `status='approved'`
  (el check humano es que es manual y requiere web publicada). Los emails y LinkedIn siguen con el
  gate intacto.

## Fuera de alcance (YAGNI)

- No es canal de pipeline: segmentación, `generate-outreach` y `cron-followups` intactos.
- No adjunta la captura estática (`sites.preview_image_url`): `wa.me` no permite adjuntar
  imágenes; lo que viaja es la **tarjeta OG** que WhatsApp genera del `live_url`.
- Sin historial de múltiples envíos por lead (upsert = un registro por lead). Si se quisiera
  historial completo, sería una migración aparte (índice UNIQUE parcial).
