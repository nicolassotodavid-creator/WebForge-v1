# Reply-To por dueño — que las respuestas a los emails en frío vuelvan a un buzón real

**Fecha:** 2026-06-23
**Rama:** feat/usuario-luvia-sin-webs
**Estado:** diseño aprobado (opción A: leer en buzón/Gmail; la integración en panel = opción C queda para otro sprint)

## Problema

Los emails en frío salen vía Resend con `From: Nico <FROM_EMAIL>` y **sin `reply_to`**. Cuando un
lead responde, el correo vuelve a `FROM_EMAIL` (dominio secundario de envío), que puede no tener
buzón. Resultado: **no nos enteramos de quién contesta.**

Además `send-email` es compartido entre dos productos:
- **WebForge** (leads del admin / sin dueño) → las respuestas las quiere Nico.
- **Luvia** (leads de Miguel, `owner != admin`) → las respuestas las quiere Miguel.

Un único reply-to mezclaría los dos.

## Decisión

Añadir `reply_to` **por dueño del lead**, reutilizando el helper `isLuviaLead` ya existente:

| Producto | Reply-To (default) | ¿Recibe hoy? |
|----------|--------------------|--------------|
| Luvia (`owner != admin`) | `marketing@luvia-ia.es` | **Sí** — luvia-ia.es tiene MX de Google |
| WebForge (admin / sin dueño) | `hola@nico-soto.es` (= FROM_EMAIL) | **Sí** (desde 2026-06-24) — reenvío ImprovMX en GoDaddy a Gmail |

Las direcciones son **configurables por env** (`REPLY_TO_LUVIA`, `REPLY_TO_WEBFORGE`) con esos
valores como default. Si la env está vacía, no se añade `reply_to` (degradación segura, no rompe el
envío). Así cambiar el buzón de WebForge (p. ej. a un Gmail mientras se monta el dominio) es un
secret, sin tocar código.

## Componentes

### 1. `supabase/functions/_shared/replyTo.ts` (nuevo)
Función pura `replyToFor(owner, adminUserId, { webforge, luvia })`:
- Llama a `isLuviaLead(owner, adminUserId)`.
- Devuelve `luvia` si es Luvia, si no `webforge`.
- Si la dirección elegida está vacía/undefined, devuelve `undefined` (el llamador omite `reply_to`).

Qué hace: elegir el buzón de respuesta. Depende de: `isLuviaLead`. Se prueba sola.

### 2. `supabase/functions/_shared/replyTo.test.ts` (nuevo)
Mismo estilo que `luvia.test.ts` (`node --experimental-strip-types`). Casos:
- lead Luvia → dirección luvia
- lead WebForge (admin) → dirección webforge
- lead sin dueño (cron) → dirección webforge
- dirección vacía → `undefined`

### 3. `supabase/functions/send-email/index.ts` (Email 1)
Ya carga `lead.owner`. Leer `ADMIN_USER_ID`, `REPLY_TO_LUVIA`, `REPLY_TO_WEBFORGE` del entorno
(con defaults), calcular el reply-to y añadir `reply_to` al body de Resend cuando exista.

### 4. `supabase/functions/cron-followups/index.ts` (Email 2/3)
Hoy **no** selecciona `owner`. Añadirlo a los dos `select` de leads, pasarlo a `sendFollowup`, y
aplicar el mismo helper para poner `reply_to`.

## Fuera de alcance / heads-up

- **Opción C** (parsear respuestas a Supabase, marcar lead "respondió", parar seguimientos) → otro sprint.
- **DNS de nico-soto.es** (HECHO 2026-06-24): reenvío con ImprovMX → MX `mx1/mx2.improvmx.com` +
  TXT `v=spf1 include:spf.improvmx.com ~all` en GoDaddy, catch-all `*` → Gmail. No toca el registro
  A de la web ni el envío de Resend (`send` SES). `hola@nico-soto.es` (y cualquier @nico-soto.es) recibe.
- **cron-followups firma "Nico" y habla de "tu web"** — copy que no encaja con leads Luvia (clínicas
  sin web). Es un problema distinto del reply-to; queda anotado para revisar aparte.

## Verificación

- `node --experimental-strip-types supabase/functions/_shared/replyTo.test.ts` pasa.
- Revisión visual de los dos bodies de Resend con `reply_to`.
- (Manual, tras deploy) responder a un email de prueba y ver que llega al buzón correcto.
