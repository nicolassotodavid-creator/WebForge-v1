# Usuario Luvia (Miguel) — panel sin la maquinaria de webs

> Sprint actual. Objetivo: que el usuario de **Miguel (producto Luvia, agente de chat para clínicas)**
> use el mismo panel pero **sin ver nada de la construcción de webs**, y pueda **contactar clínicas
> por email** ofreciendo Luvia, sin construir ninguna web. WhatsApp saliente queda para el siguiente
> sprint (ver memoria `luvia-whatsapp-siguiente-sprint`).

## Contexto y decisiones cerradas

- **Un solo sistema, no un segundo producto.** Misma Supabase, mismo panel desplegado, misma RLS.
- **Identificación por usuario/dueño.** Admin = `nicolassotodavid@gmail.com` → ve y opera las webs.
  Cualquier **otro** usuario (el de Luvia) → no ve webs y va por el camino de contacto Luvia.
  Se apoya en el aislamiento por `owner` + RLS ya existente (migración `0015_lead_ownership.sql`).
- **Sin cambios de base de datos.** Todo es código + variables de entorno. El "es de Luvia" se deriva
  de `owner ≠ admin`, no de una columna nueva.
- **No es solo ocultar botones.** Hoy el contacto está acoplado a la web: el panel "Mensaje de
  contacto" solo aparece con lead `approved`|`contacted`, y `generate-outreach` exige brief + `live_url`
  y redacta un email que vende una web. Hay que **desacoplar** el contacto de la web para Luvia.

## Hallazgo clave (el acople)

`generate-outreach` (`supabase/functions/generate-outreach/index.ts`) bloquea a Luvia en 4 puntos:
1. Gate de estado `approved`|`contacted` (líneas ~125-130).
2. Brief obligatorio para Email 1 (líneas ~194-199).
3. `live_url` obligatoria para canal email (líneas ~211-216) — **bloqueo duro**.
4. Asunto fijo "Tu web está lista", CTA → `/book`, y `OUTREACH_PROMPT` que vende una web.

Y `send-email` (`supabase/functions/send-email/index.ts:181`) solo mueve `approved → contacted`.

La plantilla `renderEmail` (`_shared/emailTemplate.ts`) **no** exige captura de web: solo renderiza
el texto del cuerpo, opt-out y píxel. La única atadura visible es que `bodyToHtml` rotula cualquier
URL suelta como botón "Ver la web →".

## Diseño por componentes

### 1. Helper de admin en el front
- `app/src/hooks/useIsAdmin.ts` (o ampliar `useSession`): `isAdmin = session.user.email === VITE_ADMIN_EMAIL`.
- `VITE_ADMIN_EMAIL` en `app/.env*`. No es frontera de seguridad (la RLS lo es); solo decide qué se pinta.

### 2. Ocultar la maquinaria de webs a no-admin (`isAdmin === false`)
- `app/src/pages/LeadDetail.tsx`: ocultar, envueltas en `isAdmin &&`, las tarjetas/zonas:
  - **Web actual del negocio** (análisis/score de prospección-para-web).
  - **Brief (análisis)**.
  - Gate **"Brief listo — ¿Construir la web?"**.
  - **Web · QA** (preview + aprobar/rechazar).
- `app/src/pages/Dashboard.tsx`: los contadores de etapas de web (`analyzed`, `build_queued`,
  `site_built`, `approved`) se ocultan para no-admin. Quedan `new`, `contacted`, `viewed`, `booked`,
  `won`. Se hace derivando la lista de etapas visibles de `isAdmin` (no tocar `PIPELINE_ORDER`).

### 3. Frenar el cron en leads de no-admin
- `orquestador/run.ts`: en `selectLeadsByStatus` (briefs paso 1) y en el scoring (paso 0), filtrar a
  leads del admin: `owner = ADMIN_USER_ID OR owner IS NULL`. Así el orquestador no genera briefs ni
  puntúa webs de las clínicas de Luvia.
- `ADMIN_USER_ID` (UUID de auth del admin) en la `.env` raíz del orquestador.
- El paso 2 (build en Lovable) ya es manual (`build_queued`), así que no gasta créditos por sí solo;
  el filtro del paso 1 es lo que evita ensuciar.

### 4. Camino de contacto Luvia (el grueso)
Cómo sabe la Edge Function que un lead es de Luvia: compara `lead.owner` con `ADMIN_USER_ID` (secreto
de la función). `owner !== ADMIN_USER_ID` (y no nulo) ⇒ Luvia.

- `generate-outreach/index.ts`, rama Luvia:
  - Saltar el gate de estado, el brief obligatorio y el requisito de `live_url`.
  - Asunto y cuerpo desde un prompt nuevo `LUVIA_OUTREACH_PROMPT` (en `_shared/prompts.ts`) que
    **ofrece el agente de chat Luvia**, no una web. Email 1 personalizado con IA (Haiku), igual patrón.
  - CTA de Luvia (ver "Copy" abajo) en vez del enlace a `/book`.
- `send-email/index.ts`: además de `approved → contacted`, mover `new → contacted` para que los leads
  de Luvia avancen al enviar. Cambiar el guard a `.in("status", ["approved", "new"])` (no regresa
  leads ya `contacted`/`booked`/`won`).
- **Seguimientos:** los Email 2/3 automáticos (orquestador `processFollowups` + pg_cron 0011) se
  saltan solos si no hay `live_url`, así que los leads de Luvia **no recibirán followups de web por
  error**. No tendrán secuencia propia este sprint (queda para el sprint de WhatsApp).

## Copy de Luvia (BORRADOR para editar)

Estructura definida; el texto exacto lo ajusta David. Mismas reglas de oro del frío
(`OUTREACH_PROMPT`): texto plano, humano, corto, un halago concreto, una sola CTA suave, firma.

- **Asunto (≤8 palabras, sin clickbait):** ej. "Una recepción que no duerme para [Clínica]".
- **Cuerpo (2 párrafos):** (1) por qué me fijé en la clínica (reseñas/reputación concreta);
  (2) qué es Luvia — un agente de chat que responde a los pacientes 24/7 (dudas, horarios, pedir cita)
  para que no se pierdan mensajes ni llamadas — e invitación suave.
- **CTA (por defecto, no bloquea):** sin enlace — cierre tipo "respóndeme y te lo enseño en 2 min".
  Es lo más seguro para arrancar. Si David quiere un enlace (demo/landing/calendario de Luvia), se
  añade después y `bodyToHtml` necesitará un rótulo distinto a "Ver la web →" para ese caso.

> Nota: el copy real depende del pitch que dé David (qué hace Luvia exactamente, integración, precio,
> destino del CTA). El borrador permite implementar y probar end-to-end contra su Gmail.

## Lo que necesita David (fuera de código)

1. Crear el usuario de Miguel en Supabase Auth (su email).
2. El pitch de Luvia (3-4 frases) y el destino del CTA del email.
3. Variables: `VITE_ADMIN_EMAIL` (front), `ADMIN_USER_ID` (orquestador) y como secreto de las Edge
   Functions (`generate-outreach`, y donde haga falta). Resolver el UUID admin una vez.
4. Deploy (lo corre David): `supabase functions deploy` + push a `master` (Vercel). Sin migración.
5. Regla permanente (`no-enviar-a-clientes`): nada de enviar a clínicas reales sin OK; probar primero
   al Gmail de David.

## Fuera de alcance (este sprint)

- WhatsApp saliente (siguiente sprint).
- Secuencia de seguimientos propia de Luvia.
- Endurecer las Edge Functions de web (analyze-lead/build) para rechazar a no-admin: la UI ya las
  oculta; el blindaje server-side es mejora futura, no necesaria para el intent.
- Columna `product` / multi-producto generalizado: hoy bastan 2 usuarios.

## Verificación

- `cd app && npm run build` (tsc) verde antes de cualquier push a `master` (prod se rompe en silencio
  si falla — memoria `vercel-build-falla-silencioso`).
- Manual: con el usuario de Miguel no aparece ninguna zona de web; puede generar y enviar (a Gmail de
  prueba) un email Luvia desde un lead `new`; el lead pasa a `contacted`. Con el usuario admin, el
  flujo de webs sigue intacto. El cron con `--dry-run` no toca leads de Miguel.
