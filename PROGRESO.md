# WebForge — Estado del proyecto (handoff)

> Última actualización: 2026-06-21. Este archivo resume **qué está hecho y qué viene**, para
> retomar el proyecto en cualquier momento (incluido un chat nuevo). Léelo junto con
> `ARQUITECTURA_webforge_v2.md` (la fuente de verdad) y `CLAUDE.md` (reglas duras).

## Qué es WebForge
Sistema de captación **outbound** que construye una **web a medida** (Lovable conducido por Claude
vía MCP) ANTES de contactar, te deja revisarla (QA humano) y dispara el contacto para que acepten y
paguen. **Dos públicos en paralelo:** negocios **locales** (scraping Google Maps → **email**
automático) y clientes **B2B** (→ **LinkedIn** semi-manual). Dos backends: **App** (panel React +
Supabase) y **Orquestador** (agente Node por cron que construye las webs).

---

## 🔄 Cambio de planes (2026-06-11)
**Se descarta captar por WhatsApp y por llamada (ElevenLabs).** Los únicos canales son:
- **Email** — para **negocios locales** (`segment='local'`). Automático vía Resend. Ya casi construido.
- **LinkedIn** — para **clientes B2B** (`segment='b2b'`: agencias, clínicas, despachos…). **Semi-manual**:
  Claude redacta el mensaje y tú lo copias/pegas (LinkedIn no permite envío automático sin baneo).

Impacto (ya aplicado a docs y contratos):
- **Eliminada** la antigua Fase 7 (llamadas/ElevenLabs). ElevenLabs sale del stack y de los secrets.
- **Modelo de datos:** `leads` gana `segment`, `linkedin_url`, `contact_name`, `contact_role`
  → **migración `0002_segment_linkedin.sql`, PENDIENTE de aplicar** en Supabase. El canal de
  `outreach_messages` pasa de `whatsapp|email` a `email|linkedin` (sin cambio de esquema, era texto libre).
- **Contratos alineados:** `ARQUITECTURA_webforge_v2.md`, `CLAUDE.md`, `_shared/prompts.ts` (OUTREACH
  bicanal por segmento), `app/src/lib/types.ts` y los comentarios de `generate-outreach`/`send-email`.
- **Al implementar la Fase 5** (outreach): panel con acción email (Enviar) vs LinkedIn (Copiar + Abrir
  perfil + Marcar contactado). **Fase 8 nueva** = fuente/enriquecimiento de leads B2B desde LinkedIn.

> El **núcleo no cambia**: scraper → brief → web en Lovable → QA → booking/pago siguen igual. Esto es
> un recorte de canales (más simple) + un segundo público (B2B) en la capa de contacto.

---

## 🆕 Vista de pagos (2026-06-21) — módulo `/pagos`

Módulo **separado** en el panel para ver cobros, abrir la factura **borrador** de Holded y
**conciliar el pago con el banco**. **Mergeado a `master` (local), SIN desplegar todavía.**
Spec y plan completos en `docs/superpowers/`.

- **Página `/pagos`**: lista (negocio · importe · fecha de pago `paid_at` · estado Stripe · estado
  banco), 4 KPIs (cobrado mes / pendiente→banco / confirmado banco / total), botones "Abrir en
  Holded" y "Confirmar en banco". **No toca el Dashboard** ni su tabla.
- **Conciliación híbrida**: Stripe pre-rellena vía webhook `payout.paid`; el operador confirma a
  mano. Lógica de estado/KPIs en funciones puras testeadas (`app/src/lib/payments.ts`).
- **Migración `0013_payments_reconciliation.sql`** (aditiva): `bookings` gana
  `stripe_payment_intent`, `stripe_payout_id`, `payout_arrival_date`, `bank_confirmed_at`,
  `holded_invoice_id`, `paid_at`. **PENDIENTE de aplicar.**
- **Webhook `stripe-webhook`**: Fase 1 guarda `payment_intent`/`holded_invoice_id`/`paid_at` al
  cobrar; Fase 2 (`payout.paid`) pre-rellena la llegada al banco. La factura de Holded sigue
  **borrador** (`status:0`), nunca se emite.

### ▶️ Para desplegar (ORDEN obligatorio — lo corre Nico):
1. **Migración primero**: `supabase db push` (aplica `0013`).
2. **Edge function**: `bash deploy.sh` (re-despliega `stripe-webhook`).
3. **Front al final**: `git push origin master` (Vercel publica `/pagos`).

> Si pusheas el front antes de migrar, `/pagos` referenciaría columnas inexistentes. La Fase 2
> (pre-relleno de banco) se activa al dar de alta el evento `payout.paid` en Stripe + tener
> `STRIPE_SECRET_KEY` en la función; sin eso, la confirmación de banco es manual y funciona igual.

---

## ✅ Hecho y verificado

### Fase 0 — Scaffold
- Frontend en `/app`: **Vite + React + TypeScript + Tailwind v3 + shadcn/ui** (componentes UI
  escritos a mano, sin Radix, para mantenerlo ligero).
- Cliente Supabase (`app/src/lib/supabase.ts`) con **claves públicas** (`VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY`). Login de operador con Supabase Auth + rutas protegidas.
- Envs en blanco creados: raíz `.env` (secrets de servidor) y `app/.env.local` (públicas).
- `app/vercel.json` (rewrites SPA) listo para desplegar.

### Fase 1 — Ingest + pipeline
- Edge Function **`ingest-leads`** (`supabase/functions/ingest-leads/index.ts`): CORS, autoriza por
  `INGEST_WEBHOOK_SECRET` (webhook del scraper) **o** por sesión de operador (pantalla Importar);
  normaliza campos de Apify/Outscraper, **deduplica por `google_place_id`** (upsert sin pisar el
  `status`), inserta el resto, `status='new'`.
- Pantalla **`/import`** (pegar JSON o subir CSV) y **dashboard `/`** con contadores del pipeline,
  filtros y tabla de leads. Ficha **`/leads/:id`**.
- Helper compartido `supabase/functions/_shared/cors.ts`.

### Fase 2 — Brief (análisis)
- Edge Function **`analyze-lead`** (`supabase/functions/analyze-lead/index.ts`): coge un lead +
  reseñas, llama a **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`) con `BRIEF_PROMPT`, parsea
  JSON estricto, guarda en `briefs` y pasa el lead a `analyzed`. Prompt caching en el system.
- En `/leads/:id`: botón **“Generar brief”** y render del brief (resumen, propuestas, highlights de
  reseñas, secciones, servicios, paleta, hero).

> Verificación local en cada fase: `npm run build` + `npm run lint` en verde; Edge Functions
> validadas con esbuild. (Las dependencias NO se instalan en la carpeta del usuario; se instalan
> con `npm install` en su Mac.)

---

## Estado en el Supabase de Nico
- **Project ref:** `khscikqchvjxyvoaruas` (URL: `https://khscikqchvjxyvoaruas.supabase.co`).
- Migración `0001_init.sql` **aplicada** (tablas + RLS).
- Funciones **desplegadas**: `ingest-leads` y `analyze-lead` (ambas con `verify_jwt = false` en
  `supabase/config.toml`; la autorización la hacen las propias funciones).
- Auth: **“Confirm email” desactivado**; cuenta de operador creada.
- Secret **`ANTHROPIC_API_KEY`** configurado en la función.
- Usa el **formato nuevo de claves** de Supabase (publishable/secret), no las legacy.

## Cómo arrancar en local
```bash
cd ~/webforge/app
npm install
npm run dev          # abre http://localhost:5173
```
Comprobaciones: `npm run build` y `npm run lint`.

---

## Decisiones técnicas (no deshacer sin motivo)
- `/import` llama a `ingest-leads` vía `functions.invoke` con la sesión del operador; el scraper
  usará la cabecera `x-ingest-secret`.
- `analyze-lead` es la función **de prueba** del brief; en producción el brief lo hará el
  Orquestador con el **mismo** `_shared/prompts.ts`.
- Routing de modelos: **Haiku 4.5** para extracción/brief; **Sonnet 4.6** para build-prompt y conducir
  Lovable (Fase 3).
- Reglas duras de `CLAUDE.md` siguen vigentes: secrets SOLO en servidor; webs de cliente en Lovable
  vía MCP desde el Orquestador (no Edge Function, no plantillas); front público no inserta en DB
  directo; salidas de Claude en JSON estricto; gate de QA obligatorio.

## Pendientes menores (no bloquean)
- **Rotar la `ANTHROPIC_API_KEY`** (la clave anterior se vio en un chat). Hacerlo en
  console.anthropic.com y re-`npx supabase secrets set ANTHROPIC_API_KEY=...`.
- `app_config` no tiene RLS (viene así de la migración). Al construir `/settings`, añadir su
  política en una migración nueva.
- Confirmar la Fase 2 con una prueba real: abrir un lead → “Generar brief”. Si da error de
  autorización, re-poner el secret de la API key.

---

## 🟡 Fase 3 — Orquestador (CÓDIGO IMPLEMENTADO; pendiente de prueba real con Lovable)

Implementado y verificado por compilación en `orquestador/`:
- `run.ts` — flujo por lead: brief → `briefs` → `analyzed`; build-prompt; construir en Lovable →
  `sites` (`live_url`) → `site_built`. Idempotente (no regresa estados), maneja errores por lead (un
  fallo no rompe el lote), y tiene **modo prueba** (`--lead <id>`) y **dry-run** (sin gastar créditos).
- `llm.ts` — Sonnet 4.6 (`claude-sonnet-4-6`) vía Anthropic API con prompt caching: `llmJson` (brief) y
  `llmText` (build-prompt). Reutiliza `extractReviews`/`extractJson` de la Fase 2.
- `lovable.ts` — puente al MCP de Lovable.
- `package.json` + `tsconfig.json` + `env.ts` (carga la raíz `.env`). `npm install` y `tsc` en verde.

**Hallazgo importante (verificado en docs.lovable.dev, jun 2026):** el **OAuth del MCP de Lovable solo
admite clientes concretos** (ChatGPT, Claude Desktop/claude.ai, **Claude Code**, Cursor, VS Code). Un
agente Node "a pelo" NO puede autenticarse. Por eso el puente usa **Claude Code en modo headless**
(`claude -p`), que la arquitectura ya contemplaba. Sigue cumpliendo la regla dura (webs en Lovable vía
su MCP desde el Orquestador). Además: el MCP **requiere plan de pago** de Lovable (no Free), y el flujo
real es `list_workspaces → create_project(initial_message = build-prompt) → deploy_project → live_url`.
- También corregido: el CTA de reserva apunta a `/book/:leadId` (routing real de la app), no a `?lead=`.

### ▶️ Para terminar la Fase 3, necesito de Nico (en su Mac):
1. **Lovable**: cuenta con **plan de pago** (Pro/Business) y créditos.
2. **Claude Code** instalado + conectar el MCP de Lovable una vez (login OAuth en el navegador):
   `claude mcp add --scope user --transport http lovable "https://mcp.lovable.dev"`
3. **Claves en la raíz `.env`**: `ANTHROPIC_API_KEY` (runtime, no el plan Max), `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`. (`BOOKING_BASE` ya está.)
4. Probar: `cd orquestador && npm install && npm start -- --lead <ID_DE_UN_LEAD>`.

Detalle completo y comandos en `orquestador/README.md`.

**Más adelante (Fase 8):** VPS barato (~5€) para el cron diario, con Claude Code instalado y el MCP ya
autenticado.

---

## Cómo retomar en un chat NUEVO
1. Conecta la carpeta `webforge` (así Claude lee `CLAUDE.md` y estos docs automáticamente).
2. Pega este mensaje de arranque:

```
Soy Nico (no técnico). Retomamos el proyecto WebForge; la carpeta está conectada.
Antes de tocar nada, lee enteros ARQUITECTURA_webforge_v2.md, CLAUDE.md y PROGRESO.md (en la raíz):
son la fuente de verdad y el estado actual. Respeta las reglas duras.
Las Fases 0, 1 y 2 ya están hechas y desplegadas. Vamos a por la Fase 3 (el Orquestador, en
orquestador/run.ts). Explícamelo todo en lenguaje sencillo, ve por fases, verifica cada una, y
cuando necesites algo mío (cuentas, llaves, OAuth de Lovable) párate y dime exactamente qué hacer.
```
