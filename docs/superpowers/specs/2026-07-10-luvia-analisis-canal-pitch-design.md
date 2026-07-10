# Análisis de canal + pitch Luvia segmentado

Fecha: 2026-07-10
Rama base: `feat/email-coste-cero-whatsapp`
Estado: diseño aprobado, pendiente de plan de implementación.

## Problema

El mensaje de contacto para leads **Luvia** (el servicio de agente de chat con IA para
WhatsApp/web) se ancla hoy en **reseñas + valoración** del negocio (ej. "662 reseñas y
una valoración de 4.8"). Para vender Luvia eso es irrelevante: lo que importa es **qué
canal de mensajería tiene el negocio hoy y quién lo atiende**. Un negocio con botón de
WhatsApp que responde a mano es el candidato perfecto; uno que ya tiene un bot es otra
conversación.

La detección necesaria **ya existe parcialmente**: al analizar la web del negocio,
WebForge ya guarda `leads.site_has_whatsapp`, `leads.site_has_chat` y la lista de vendors
en `leads.site_analysis._widgets.vendors[]`. El mensaje simplemente los ignora. Falta:
(a) separar "bot/automático" de "chat con humano", (b) clasificar el lead en un estado,
(c) mostrarlo en el panel, y (d) reescribir el pitch para usar el estado en vez de reseñas.

## Objetivo

Para leads Luvia, clasificar cada negocio en un **estado de canal** derivado del análisis
de su web, mostrarlo en la ficha, y generar un mensaje de contacto cuyo gancho se adapte a
ese estado. **Cero reseñas en el mensaje.** El pitch de "web nueva" (`OUTREACH_PROMPT`) no
se toca; las reseñas siguen visibles en el panel (informativas).

## Estados

`luviaSiteState(lead)` → uno de: `automated | hot | chat | none | unknown`.

| Estado | Regla | Gancho del mensaje |
|---|---|---|
| **automated** (C) | `site_has_bot === true` | Ya automatizado → Luvia como mejora/reemplazo |
| **hot** (A) | `site_has_whatsapp === true` y sin bot | 🔥 Tiene botón de WhatsApp, lo atienden a mano |
| **chat** (B) | `site_has_chat === true`, sin WhatsApp ni bot | Chat con persona → Luvia responde solo 24/7 |
| **none** (D) | los tres flags `=== false` | Sin canal → Luvia se lo da (web + WhatsApp) |
| **unknown** | los tres flags `null` (web sin analizar / fetch falló) | Gancho neutro, sin afirmar nada |

**Precedencia deliberada: C > A > B > D.** Si el negocio tiene un bot (ManyChat), decirle
"lo atiendes a mano" (A) sería falso y quema el mensaje → bot gana siempre. WhatsApp (A)
gana a chat humano (B) porque un botón de WhatsApp es la señal más fuerte de que reciben
mensajes entrantes reales.

## Componentes

### 1. Detección refinada — `supabase/functions/_shared/website.ts`

- Añadir constante `BOT_VENDORS` = **Landbot, ManyChat, Chatfuel** (estricto: bot-builders
  puros; solo estos cuentan como "automatizado", para minimizar falsos positivos de C).
  Asegurar que Chatfuel está en la tabla `CHAT_VENDORS`/regex (Landbot y ManyChat ya están).
- Añadir `hasBot: boolean` a `WidgetSignals`.
- En `detectWidgets(html)`: `hasBot = vendors.some(v => BOT_VENDORS.has(v))`. `hasChat`
  sigue siendo "hay algún widget" (`vendors.length > 0`); `hasBot` es el subconjunto bot.
- Los labels de vendor en `BOT_VENDORS` deben coincidir **exactamente** con los que la tabla
  emite en `vendors[]` (usados también por el backfill SQL).

### 2. Persistencia — migración `supabase/migrations/0022_lead_site_bot.sql`

- `alter table leads add column site_has_bot boolean;` (null = sin comprobar), mismo patrón
  que `0017_lead_site_widgets.sql`. Índice parcial sobre `where site_has_bot = true`.
- **Backfill sin re-scrapear:** derivar de lo ya guardado en `site_analysis._widgets.vendors[]`:
  marcar `site_has_bot = true` donde algún vendor ∈ lista bot, `false` donde hay `_widgets`
  con `vendors` pero ninguno es bot, y dejar `null` donde no hay `_widgets`.
- Persistir `site_has_bot` en los dos escritores del análisis:
  - `supabase/functions/analyze-site/index.ts` (botón manual "Analizar").
  - `supabase/functions/score-sites/index.ts` (cron automático).
  - Los equivalentes del orquestador (`orquestador/analyze.ts`, `orquestador/score-existing-sites.ts`)
    se alinean si comparten el mismo `detectWidgets`; verificar en el plan.

### 3. Clasificador puro — `supabase/functions/_shared/luvia.ts` (+ espejo `app/src/lib/luvia.ts`)

- Función `luviaSiteState(lead)` con la tabla de estados y precedencia de arriba. `unknown`
  cuando los tres flags son `null`.
- Función pura, minúscula, sin dependencias → se **duplica** en Deno (edge functions) y React
  (panel) porque no comparten runtime. Mantenerla trivial para que el espejo sea seguro.
- Junto a `isLuviaLead`, que ya vive en `_shared/luvia.ts`.

### 4. UI — `app/src/pages/LeadDetail.tsx`

- Chip nuevo "Bot" junto a los chips de "Chat web" / "WhatsApp" (zona ~línea 700), pintando
  `lead.site_has_bot`.
- **Badge de estado Luvia**, visible solo para leads Luvia (misma condición que el resto de
  UI Luvia — no admin): texto por estado ("🔥 Caliente para Luvia", "Ya automatizado",
  "Chat con humano", "Sin canal", "Sin analizar").
- Reseñas (líneas ~608-609) **se quedan** visibles; solo salen del mensaje.
- Reflejar `site_has_bot` en `app/src/lib/types.ts` (`Lead`).

### 5. Mensaje — `supabase/functions/generate-outreach/index.ts` + `_shared/prompts.ts`

- Payload Luvia (`index.ts` ~283-291): quitar `rating`/`review_count`; añadir
  `site: { state, has_whatsapp, has_chat, has_bot, vendors, url }` donde `state = luviaSiteState(lead)`
  y `url = website_url` (para que el copy pueda ser concreto: "vi vuestro botón de WhatsApp").
- Reescribir `LUVIA_OUTREACH_PROMPT` (`prompts.ts` ~166-189):
  - Quitar toda mención a reputación/valoración/reseñas (líneas 172, 179-180, 184).
  - Explicar que recibe el estado del canal + señales detectadas.
  - 4 variantes de gancho según `state` (ver tabla). `unknown` → gancho genérico tipo `none`
    pero **sin afirmar** ausencia de canal.
  - **Regla de honestidad:** solo afirmar lo que detectamos (si `has_whatsapp`, puede citar
    el botón de WhatsApp; para `automated` puede nombrar el vendor de `vendors[]`).
  - Mantener el formato: texto plano, humano, corto, un CTA ("responde y te lo enseño en 5 min").
    Luvia sigue siendo Email-1-only (sin enlace añadido), como hoy.

### 6. Tests

- Unit test de `luviaSiteState`: los 5 estados + precedencia (bot+whatsapp → automated;
  whatsapp+chat → hot) + nulls → unknown.
- Unit test de `detectWidgets`: HTML con Landbot/ManyChat → `hasBot true`; HTML con Tawk/Crisp
  → `hasBot false`, `hasChat true`.
- Seguir el harness de test ya presente en el repo (el del helper puro del puente Luvia,
  commit `d7867f1`). Confirmar runner exacto en el plan.

## Fuera de alcance

- `buildLuviaClientPayload` (`_shared/luviaHandoff.ts`) sigue enviando
  `rating`/`resenas` a la Edge Function `crear-cliente` de Luvia. Es transferencia de datos al
  proyecto Luvia, no el mensaje de outreach. No se toca.
- El pitch de "web nueva" (`OUTREACH_PROMPT`) no cambia.
- Badge de estado en la LISTA de leads (triage): posible follow-up, no en este spec.

## Riesgos / notas

- **Espejo del clasificador** (Deno + React): dos copias de `luviaSiteState`. Mitigación:
  función trivial + test en al menos un lado; documentar que deben ir sincronizadas.
- **Backfill depende de labels exactos** de vendor guardados en `_widgets.vendors[]`. Verificar
  los strings reales antes de escribir el SQL.
- Falsos positivos de `automated`: al ser estricto (solo 3 bot-builders), un negocio con
  Intercom/Drift (que traen bot) caería en `chat`/`hot`, no en `automated`. Aceptado.
