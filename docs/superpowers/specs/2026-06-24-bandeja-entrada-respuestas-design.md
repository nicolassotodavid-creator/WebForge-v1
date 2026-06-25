# Bandeja de entrada de respuestas — diseño

**Fecha:** 2026-06-24
**Estado:** propuesta, pendiente de aprobación del usuario.

---

## Resumen en cristiano (para Nico)

Hoy el panel **solo manda** correos. Cuando un cliente **responde**, su respuesta NO vuelve al panel: se va a tu Gmail (vía el reenvío de `hello@nico-soto.es`). Por eso ahora las respuestas las ves en Gmail, no aquí.

Esto convierte el panel en una **bandeja de entrada**: cuando un cliente conteste, su respuesta **aparecerá dentro de la ficha del lead** como una conversación, el panel marcará **«Respondió»** solo, y (en la fase 2) podrás **escribirle y contestar desde ahí mismo**, sin abrir Gmail.

- **No afecta a la calidad de tus envíos.** Mandar y recibir van por caminos distintos del DNS; solo toco el de recibir, y lo monto en un subdominio aparte. Tus correos siguen saliendo por el mismo Resend.
- **No pierdes nada en Gmail.** Durante la transición, cada respuesta se reenvía igualmente a tu buzón de siempre, además de entrar al panel.
- Se hace en **2 pasos**: primero VER las respuestas (~1 día), luego RESPONDER desde el panel (~1 día).

---

## Estado actual (cómo viaja el correo hoy)

- **Envío:** `send-email` y `cron-followups` mandan vía Resend desde `From: Nico <hola@nico-soto.es>`. Autenticación (SPF/DKIM) en `nico-soto.es` + `send.nico-soto.es`.
- **Reply-to:** lo decide `_shared/replyTo.ts` por dueño del lead. Como `ADMIN_USER_ID` no está configurado, **todo** reply-to = `hello@nico-soto.es` (WebForge/Nico). El de Luvia (`marketing@luvia-ia.es`) se activaría poniendo `ADMIN_USER_ID`.
- **Recepción hoy:** `hello@nico-soto.es` → **ImprovMX** (MX en GoDaddy) → reenvío al Gmail de Nico. `marketing@luvia-ia.es` → **Google Workspace** → Miguel. El panel no lee ninguno de los dos.
- **Apertura:** ya se trackea con píxel (`track-event` escribe `outreach_messages.opened_at`).
- **«Respondió»:** existe en el esquema (`status='replied'`) pero **nada lo escribe** y no hay UI para marcarlo.

## Objetivo y alcance

Que las respuestas entrantes lleguen al panel, queden enganchadas al lead, y se puedan leer y (fase 2) contestar desde la ficha del lead.

**Fase 1 — VER respuestas (objetivo ~1-1,5 días de trabajo):**
- Capturar correos entrantes y guardarlos enganchados al lead correcto.
- Mostrar la conversación (salientes + entrantes) en `LeadDetail`.
- Marcar `outreach_messages.status='replied'` automáticamente → se refleja en la pestaña Emails, la columna del Dashboard y el timeline del lead.
- Reenviar copia de cada respuesta al buzón humano de siempre (no perder nada).

**Fase 2 — RESPONDER desde el panel (objetivo ~1 día de trabajo):**
- Caja de respuesta de texto libre en la conversación.
- Envío vía Resend en el **mismo hilo** del correo (cabeceras `In-Reply-To`/`References`).
- La respuesta se guarda como mensaje saliente en la conversación.

## Arquitectura

```
Cliente responde
   │  (a la dirección reply-to con etiqueta de lead)
   ▼
Subdominio de entrada  in.nico-soto.es   (MX nuevo, NO toca el apex)
   │  proveedor parse→webhook
   ▼
Edge Function  inbound-email  (pública, verifica firma del proveedor)
   ├─ identifica el lead (etiqueta en la dirección; fallback: email del remitente / cabeceras)
   ├─ inserta fila en  inbound_messages
   ├─ marca el último outreach del lead  status='replied'
   └─ reenvía copia al buzón humano del dueño (ImprovMX/Workspace)
   ▼
Panel (LeadDetail)  ── lee outreach_messages + inbound_messages → muestra la conversación
   └─ (Fase 2) caja de respuesta → Edge Function  send-reply  → Resend (hilo) → guarda saliente
```

**Decisión de proveedor de entrada (interfaz-primero, intercambiable):** la función `inbound-email` define un contrato estable; el proveedor externo es enchufable. Recomendado por orden: (1) **Resend Inbound** si está disponible en el momento de construir (mismo proveedor que el envío), (2) **Cloudflare Email Routing** (gratis), (3) **Postmark/Mailgun inbound**. Se fija el concreto al inicio de la implementación con una verificación rápida; no cambia ni la arquitectura ni la estimación.

## Identificar a qué lead pertenece una respuesta (matching)

Mecanismo principal — **dirección de respuesta etiquetada por lead**: cada email saliente fija
`reply_to: "Nico <re+<lead_id>@in.nico-soto.es>"` (catch-all del subdominio → webhook). La función lee `<lead_id>` de la dirección de destino → match exacto, sin ambigüedad. El cliente sigue viendo "Nico" como nombre.

Fallbacks si faltara la etiqueta: (a) email del remitente = `leads.email`; (b) cabeceras `In-Reply-To`/`References` contra el `Message-ID` del saliente (que guardaremos al enviar).

## Modelo de datos

Nueva tabla `inbound_messages` (migración aditiva):

| columna | tipo | nota |
|---|---|---|
| id | uuid pk | |
| lead_id | uuid fk → leads(id) on delete cascade | nullable si no hay match (cae a "sin asignar") |
| from_email | text | remitente |
| from_name | text null | |
| subject | text null | |
| body_text | text null | cuerpo en texto |
| body_html | text null | cuerpo HTML (sanitizado al renderizar) |
| message_id | text null | Message-ID del correo entrante |
| in_reply_to | text null | para hilar |
| outreach_message_id | uuid null fk | el saliente al que responde, si se sabe |
| received_at | timestamptz default now() | |
| raw | jsonb | payload completo del proveedor (auditoría/depuración) |

Índice por `(lead_id, received_at)`. RLS: misma política que `leads` (admin ve todo; operador, solo los suyos vía el `owner` del lead).

Para el envío saliente seguimos usando `outreach_messages`. En Fase 2, las respuestas escritas desde el panel se guardan como `outreach_messages` (`channel='email'`, `status='sent'`, sin `email_number` de secuencia o uno marcado como respuesta libre).

## Cambios en el código

**Fase 1**
- Migración SQL: tabla `inbound_messages` + RLS + índice.
- `_shared/replyTo.ts` (o el llamador): el reply-to pasa a ser `re+<lead_id>@in.nico-soto.es` con nombre "Nico"/"Miguel" según dueño. Se mantiene el reenvío al buzón humano vía la función inbound.
- `send-email` y `cron-followups`: guardar el `Message-ID` del saliente (de la respuesta de Resend) en `outreach_messages` (columna nueva `provider_message_id`) para hilar.
- Nueva Edge Function `inbound-email` (pública, verifica firma): parsea, hace match, inserta `inbound_messages`, marca `status='replied'`, reenvía copia al buzón del dueño.
- `LeadDetail.tsx`: sección "Conversación" que mezcla salientes (`outreach_messages`) + entrantes (`inbound_messages`) por fecha. El cuerpo HTML entrante se sanea antes de mostrar.
- La pestaña Emails / Dashboard / timeline ya leen `status='replied'` → muestran "Respondió" sin cambios adicionales (o ajuste mínimo).

**Fase 2**
- Nueva Edge Function `send-reply` (auth de operador o service): envía texto libre vía Resend con `In-Reply-To`/`References` al hilo; guarda el saliente.
- `LeadDetail.tsx`: caja de respuesta dentro de la conversación.

## Entregabilidad (la preocupación del usuario)

Sin impacto en el envío. Recibir usa registros **MX** en un **subdominio nuevo** (`in.nico-soto.es`); enviar usa **SPF/DKIM/DMARC** en `nico-soto.es`/`send.nico-soto.es`, que **no se tocan**. El reply-to es solo "a dónde vuelven las respuestas" y no interviene en la autenticación del saliente. Las respuestas que se manden desde el panel salen por el **mismo Resend** ya autenticado → misma entregabilidad. El apex `hello@nico-soto.es` (ImprovMX→Gmail) sigue intacto.

## Seguridad

- `inbound-email` es pública (el proveedor la llama sin JWT) pero **verifica la firma HMAC** del proveedor; descarta lo no firmado.
- Saneado del HTML entrante antes de renderizar (evitar XSS en el panel).
- RLS en `inbound_messages` por dueño del lead (igual que el resto).
- Secrets (clave de firma del proveedor, Resend) solo en servidor.

## Fuera de alcance (YAGNI)

- Adjuntos en las respuestas (fase posterior si hace falta).
- Bandeja unificada multi-cuenta / asignación entre operadores.
- Detección de "respuesta automática"/fuera de oficina (se puede filtrar luego).
- Sincronizar el histórico viejo de Gmail; solo se capturan respuestas nuevas desde el despliegue.

## Riesgos y mitigaciones

- **Cambiar el reply-to** rompería el flujo actual a Gmail → se mitiga reenviando copia al buzón humano desde la función inbound.
- **Propagación DNS / verificación del proveedor**: tiempo de reloj, no de trabajo; se hace al principio.
- **Falsos «Respondió»** por autorrespuestas: aceptable en fase 1; filtro de auto-reply como mejora.
- **Match fallido** (sin etiqueta) → cae a "sin asignar" y se reenvía a Gmail igualmente; nunca se pierde.

## Criterios de aceptación (Fase 1)

1. Respondiendo a un email de prueba, la respuesta aparece en la ficha del lead correcto en el panel.
2. El lead/mensaje pasa a "Respondió" en la pestaña Emails, el Dashboard y el timeline.
3. La respuesta llega igualmente al Gmail de siempre.
4. Una respuesta sin poder identificar el lead no rompe nada (queda "sin asignar").
5. El envío de correos sigue funcionando idéntico (sin regresión de entregabilidad).
