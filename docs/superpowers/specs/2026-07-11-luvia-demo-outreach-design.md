# Luvia — Outreach "Tu asistente ya está montado" (demo pre-extraída)

**Fecha:** 2026-07-11
**Estado:** Diseño aprobado (pendiente review del spec)

## Problema

El outreach de Luvia hoy es **reply-first**: `LUVIA_OUTREACH_PROMPT` escribe un email en frío
segmentado por estado de canal, **sin link**, cuya única CTA es "respóndeme y te lo enseño"
(`generate-outreach/index.ts`, prompt firma como **Miguel**). No hay artefacto tangible.

WebForge convierte porque manda **la web ya construida y live** en el propio email frío. Luvia no
tiene ese equivalente, aunque **ya existe la pieza**: la landing de Luvia (`ClinicAnalyzerSection` →
`demo-clinic-extract`) genera, a partir de la URL de una clínica, una **demo de chat cargada con sus
servicios/precios/horarios reales** que el prospecto prueba al instante (`ClinicChatPanel`).

Queremos replicar el patrón "tu web está lista" para Luvia: mandar en frío un **link a esa demo, ya
montada y revisada**, por **email y por WhatsApp**, firmado por **Nico**.

## Objetivos

- Nuevo mensaje de outreach Luvia: "Le monté un asistente a {clínica}, pruébalo → {link}".
- El link abre una demo **pre-extraída y congelada** (snapshot), no un extract en vivo al clic.
- El operador **revisa la demo real antes de enviar** (gate humano).
- Disponible por **email** (pipeline WebForge) y por **WhatsApp manual** (ficha del lead).
- Firma **Nico**, no Miguel.

## No objetivos (YAGNI)

- No tocar la lógica de chat/voz de Luvia (`ClinicChatPanel`, `ClinicVoicePanel`): se reutilizan.
- No añadir seguimientos (email 2/3) a Luvia: sigue siendo **solo email 1**.
- No automatizar el alta de cliente: el handoff (`crear-cliente`) ya existe y es posterior.
- No sustituir el formulario "Pide tu demo" de la landing.

## Arquitectura (dos bases de código)

1. **WebForge** (este repo): Supabase Edge Functions + panel React. Los leads Luvia viven aquí
   (`isLuviaLead(lead.owner, ADMIN_USER_ID)`), así que **el disparador es el panel de WebForge**.
2. **Luvia** (proyecto Lovable `4e9867a5-4523-4763-b825-f2595b0b30ab`): landing + su Supabase propio
   `nqyumnkidfkkceigiktu` (donde ya corre `demo-clinic-extract` y viven los datos de Luvia).

### Decisión de almacenamiento

El snapshot se guarda **en el Supabase de Luvia** (`nqyumnkidfkkceigiktu`), en una **tabla dedicada
`demos`**, aislada de la tabla de clientes reales. Motivo: el link es customer-facing y puede abrirse
semanas después; la página `/demo/:id` no debe depender de WebForge en tiempo de vista. El extractor
ya vive en Luvia, así que persistir ahí es lo coherente.

## Flujo

```
[Panel WebForge · ficha del lead Luvia]
 1. Operador pulsa "Preparar demo Luvia"
      → WebForge Edge `prepare-luvia-demo` llama a Luvia `create-demo { clinic_url }`
      → Luvia extrae (lógica de demo-clinic-extract) + guarda fila en `demos` → devuelve { id }
      → WebForge guarda leads.luvia_demo_id (+ leads.luvia_demo_url)
 2. Operador abre https://luvia-ia.es/demo/:id  → revisa la demo real   ←── GATE
 3. Operador pulsa "Generar email"  → generate-outreach (rama luvia)
      → LUVIA_OUTREACH_PROMPT (con link, firma Nico), link = LUVIA_DEMO_BASE/demo/:id
 4. Aprueba → send-email     ·     o    → WhatsApp manual (ficha) con el mismo link
```

Sin snapshot (o extract vacío) → cae al pitch reply-first actual (no se rompe nada).

## Cambios lado Luvia (proyecto Lovable, vía MCP `send_message`)

- **Tabla `demos`** en `nqyumnkidfkkceigiktu`: `id uuid pk`, `clinic_url text`, `clinic_name text`,
  `snapshot jsonb` (el `ExtractData` + `pages_scanned`), `created_at timestamptz default now()`.
  RLS: lectura pública por `id` (la demo es un link para prospectos); escritura solo service role.
- **Edge `create-demo`**: recibe `{ clinic_url }`, ejecuta la extracción (reutiliza la lógica de
  `demo-clinic-extract`), inserta en `demos`, devuelve `{ id, empty: boolean }`. Auth: token bearer
  compartido con WebForge (mismo patrón que `handoff-luvia`).
- **Edge/RPC de lectura pública `get-demo?id=`** (o RLS select directa desde el cliente) que devuelve
  el snapshot para la ruta.
- **Ruta `/demo/:id`**: hace fetch del snapshot, renderiza el `ResultCard` existente y **auto-abre
  `ClinicChatPanel`** con `clinicData`/`clinicName`/`clinicUrl` del snapshot. Estado de carga y
  fallback si el id no existe.

## Cambios lado WebForge (este repo)

- **`_shared/prompts.ts` — `LUVIA_OUTREACH_PROMPT`**: pasa de "reply-first, sin link" a "ya te lo
  monté, pruébalo → {link}". Recibe `demo_url` en el payload. Regla de firma: **Nico** (no Miguel).
  Copy base validado:
  > Asunto: *Le monté un asistente a {clínica}*
  > Vi la web de {clínica} y me puse a probar una cosa: cogí vuestros tratamientos y horarios y monté
  > un asistente que responde a los pacientes por vosotros, al instante. Háblale tú mismo, como si
  > fueras alguien pidiendo cita: {demo_url}. Si te encaja, lo dejamos atendiendo vuestro WhatsApp
  > 24/7. Si no, nada — fue un rato mío. — Nico · Luvia
- **`_shared/luvia.ts` — `buildLuviaOutreachPayload`**: añade `demo_url` (desde `leads.luvia_demo_url`)
  al payload que consume el prompt.
- **`generate-outreach/index.ts`**: rama luvia — si hay `luvia_demo_url`, inyecta el link (igual que
  hoy inyecta `live_url` en la rama WebForge); si no, mantiene el pitch reply-first actual.
- **Edge `prepare-luvia-demo`** (nueva): llama a Luvia `create-demo`, guarda `luvia_demo_id` /
  `luvia_demo_url` en el lead. Config del endpoint y token por env.
- **Migración**: `leads.luvia_demo_id text`, `leads.luvia_demo_url text`.
- **`LeadDetail.tsx`**: botón "Preparar demo Luvia" (solo leads Luvia), link para revisarla, y el
  WhatsApp manual existente pre-rellena el texto con `luvia_demo_url` para leads Luvia.
- **Config (env, no código)**: `LUVIA_DEMO_BASE=https://luvia-ia.es`,
  `LUVIA_CREATE_DEMO_URL` (endpoint de Luvia), token bearer compartido (reutilizar el de handoff).

## Gate y manejo de errores

- **Gate = revisión humana.** Los leads Luvia ya se saltan `status='approved'` en generate-outreach;
  el gate real pasa a ser: el operador abre `/demo/:id`, la ve, y solo entonces genera/envía.
- **Extract vacío** (`EmptyCard`): `create-demo` devuelve `empty:true`; el operador lo ve al revisar y
  no manda la versión demo (cae a reply-first).
- **Extract falla**: no hay `luvia_demo_id`; el botón avisa y generate-outreach no genera link roto.
- **id inexistente en `/demo/:id`**: la ruta muestra estado de error con CTA "Pide tu demo".

## Tests

- WebForge (patrón `luvia.test.ts`): `generate-outreach` rama luvia **con** `luvia_demo_url` → link
  presente + firma Nico; **sin** él → reply-first; `buildLuviaOutreachPayload` incluye `demo_url`.
- `prepare-luvia-demo`: mock de `create-demo` → persiste id/url; error del extract → no persiste.

## Riesgos / notas

- Cruce de sistemas WebForge→Luvia: mismo patrón probado que `handoff-luvia` (token bearer, nunca la
  service key de Luvia).
- Cambios en Luvia van por Lovable MCP (`send_message`), no por este repo.
- Norma de despliegue: llevar el trabajo hasta que esté **live y visible** (no dejar a medias).
```
