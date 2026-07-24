# Deliverability del email en frío — qué hay montado y qué falta activar

Objetivo: que los emails caigan en **bandeja de entrada**, no en spam. Este runbook
resume lo que ya está vivo y el único paso manual pendiente.

## Lo que ya está LIVE

- **Autenticación del dominio de envío `nico-soto.es`** (verificado en DNS):
  DKIM alineado (`resend._domainkey.nico-soto.es`), DMARC `p=quarantine`, Return-Path
  propio `send.nico-soto.es` (SPF de Resend + feedback SES). Esto es el 80 % del asunto.
- **Baja con UN click (RFC 8058 `List-Unsubscribe`)** — función `unsubscribe`:
  - Los 3 emails (send-email + cron-followups) llevan la cabecera `List-Unsubscribe`
    (URL firmada + `mailto:…?subject=BAJA`) y `List-Unsubscribe-Post: List-Unsubscribe=One-Click`
    → Gmail/Yahoo pintan el botón nativo "Cancelar suscripción".
  - Pie del email: enlace "Darte de baja con un clic" (junto al "responde BAJA" de siempre).
  - Al pincharlo (o al one-click de Gmail): `leads.do_not_contact=true` + `unsubscribed_at`
    + evento `unsubscribed`. Los envíos ya respetan `do_not_contact` → no vuelve a escribir.
  - Firma: HMAC-SHA256 con `SUPABASE_SERVICE_ROLE_KEY` (etiqueta `unsub:v1:`). Sin secreto nuevo.
  - Verificado E2E en prod (GET→página, POST one-click→200, firma mala→400).
- **Verificación desde la bandeja del destinatario** (2026-07-24): envío de prueba real
  `hola@nico-soto.es` → Gmail de Nico → cayó en **INBOX + IMPORTANT** (no spam, no
  promociones), HTML y pie de baja renderizados. Confirma que el remitente real es
  `hola@nico-soto.es` (no `trywebforge-mail.com`).

## Supresión de rebotes/quejas — ✅ ACTIVO (2026-07-24)

Función `resend-webhook` (suprime rebotes duros y quejas de spam → `do_not_contact=true`,
reutiliza la misma columna). **Alta hecha en Resend + `RESEND_WEBHOOK_SECRET` puesto en
Supabase.** Verificado E2E: firma Svix válida → 200, firma falsa → 401. A partir de ahora,
cualquier `email.bounced` / `email.complained` auto-suprime al lead.

Pasos de referencia (por si hay que rehacer el alta o rotar el secreto):

1. **Resend → Webhooks → Add Endpoint.**
   - URL: `https://khscikqchvjxyvoaruas.supabase.co/functions/v1/resend-webhook`
   - Eventos: marca al menos `email.bounced` y `email.complained` (el resto se ignora solo).
2. Copia el **Signing Secret** que te da Resend (empieza por `whsec_`).
3. Ponlo como secreto de la función (una de las dos vías):
   - Rápida (necesita `SUPABASE_ACCESS_TOKEN`):
     `supabase secrets set RESEND_WEBHOOK_SECRET=whsec_xxx --project-ref khscikqchvjxyvoaruas`
   - O como secreto de GitHub `RESEND_WEBHOOK_SECRET` y añadir un paso en `deploy.yml`
     (igual que `CRON_SECRET`) para fijarlo en cada deploy.
4. En Resend, botón "Send test" (o espera un rebote real) → el endpoint debe responder 200.
   Verás el evento `email_bounced`/`email_complained` en la tabla `events`.

## Pendiente (mejoras futuras, NO bloqueantes)

- **Warm-up / throttling**: hoy los envíos no tienen tope diario ni jitter. A volumen,
  quema reputación (el dominio es también el correo real de Zoho). Cap diario creciente.
- **Verificación de dirección** (MX/sintaxis) antes de enviar → menos rebotes de raspados.
- **Pixel de apertura en frío**: imagen remota 1×1 es leve señal de spam; valorar apagarlo
  en frío o servirlo desde el propio dominio.
- **Doc stale**: `ARQUITECTURA_webforge_v2.md` / `CONTEXTO_PARA_CLAUDE.md` aún citan
  `trywebforge-mail.com` como dominio de envío; el real es `nico-soto.es` (aquel está vacío en DNS).
