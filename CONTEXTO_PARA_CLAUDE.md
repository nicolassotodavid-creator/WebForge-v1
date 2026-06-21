# WebForge — Contexto completo para Claude

> Documento de handoff: todo lo que necesitas saber para retomar el proyecto desde cero.
> Léelo antes de tocar cualquier archivo. Luego lee también `ARQUITECTURA_webforge_v2.md` y `CLAUDE.md`.

---

## 1. Qué es WebForge (concepto de negocio)

Sistema de **captación outbound web-first**: en lugar de vender primero y entregar después, WebForge
**construye la web del cliente antes de contactarle**, la usa como gancho en el mensaje de contacto, y
cuando el cliente paga, esa misma web ya está lista y es suya.

**Flujo de valor:**
1. Scrapear negocios que no tienen web (o la tienen mal).
2. Construir automáticamente una web a medida con IA (Lovable conducido por Claude vía MCP).
3. QA humano: el operador (Nico) revisa la web antes de enviarla.
4. Contactar con el gancho: "te hice una web, mírala aquí".
5. El cliente entra en la URL, le gusta, reserva y paga.

**Dos públicos en paralelo:**

| Segmento | Fuente | Canal de contacto | Automatización |
|---|---|---|---|
| `local` — negocios locales sin web | Scraping Google Maps (Apify) | **Email** automático (Resend) | Alta (email se envía solo) |
| `b2b` — agencias, clínicas, despachos | LinkedIn / directorios | **LinkedIn** semi-manual | Baja (Claude redacta, Nico pega) |

**Por qué LinkedIn es semi-manual:** LinkedIn banea la automatización de mensajes y no expone API de
envío. Claude redacta el mensaje perfecto, el operador lo copia y pega a mano.

**El gancho es siempre la misma web:** en el email (locales) se incluye la URL directamente; en LinkedIn
la URL se envía en el mensaje de seguimiento una vez que el contacto acepta la conexión.

---

## 2. Arquitectura — visión de pájaro

```
 SCRAPER (Apify)
      │
      ▼
 SUPABASE (DB · Auth · Edge Functions Deno)
      │  leads · briefs · sites · outreach · bookings
      │
      ├──► ORQUESTADOR (VPS · Node/TS · Agent SDK · Claude Sonnet 4.6)
      │         Lee leads 'new' → genera brief → genera build-prompt
      │         → construye web EN LOVABLE vía MCP → guarda live_url
      │
      ├──► APP / Panel (React · Vercel)
      │         Dashboard pipeline, QA (Aprobar/Rechazar), contacto
      │         Email → botón Enviar; LinkedIn → Copiar + Abrir perfil
      │
      └──► Páginas públicas (Vercel)
                /book/:leadId → Stripe Checkout → /gracias
```

**Dos backends distintos, no los confundas:**

- **App**: el panel que opera Nico. React + Vite + Tailwind + shadcn/ui en Vercel. Backend = Supabase
  (Postgres + Auth + Edge Functions Deno + pg_cron).
- **Orquestador**: el agente diario que construye las webs. Node/TS con Claude Agent SDK + MCP de
  Lovable + modelo `claude-sonnet-4-6`, en un VPS por cron. No es serverless (los builds tardan minutos).

---

## 3. Stack (cerrado — no cambiar sin motivo)

| Capa | Tecnología |
|---|---|
| Frontend (panel) | React + Vite + TypeScript + Tailwind v3 + shadcn/ui |
| Deploy frontend | **Vercel** (free) |
| Base de datos | **Supabase** — Postgres + Auth + Edge Functions (Deno) + pg_cron |
| Motor de webs de cliente | **Lovable** conducido por su **MCP oficial** |
| Orquestador (agente diario) | Node/TS · **Claude Agent SDK** · MCP de Lovable · VPS con cron |
| LLM principal (orquestador) | `claude-sonnet-4-6` (Sonnet 4.6) — briefs, build-prompts, conducir Lovable |
| LLM económico (volumen) | `claude-haiku-4-5-20251001` — extracción de reseñas a volumen |
| Email | **Resend** — dominio secundario — texto plano — solo `segment='local'` |
| Pagos | **Stripe** Checkout |
| Scraping (locales) | Apify actor `compass/crawler-google-places` (o Outscraper) |
| LinkedIn (B2B) | Semi-manual — sin API ni secrets — Claude redacta, operador pega |

**Routing de modelos:** Sonnet 4.6 para briefs y build-prompt (conducir Lovable). Haiku 4.5
para extracción a volumen (barato a volumen). Prompt caching activo en system prompts.

**Coste variable crítico:** cada build de Lovable gasta créditos, aunque el cliente no convierta.
Con ~5 webs/día y ~110/mes, asegurarte de que `conversión × ticket` cubre el coste de TODAS.

---

## 4. Modelo de datos (tablas clave)

| Tabla | Para qué |
|---|---|
| `leads` | Negocios scrapeados. Tiene `segment` ('local'/'b2b'), `status` (máquina de estados), `linkedin_url`, `contact_name`, `contact_role` |
| `briefs` | Análisis del negocio por Claude (propuestas de valor, reseñas destacadas, paleta, hero copy) |
| `sites` | La web construida en Lovable: `lovable_project_id`, `live_url`, `build_prompt`, `status` (queued→building→built→approved→delivered) |
| `outreach_messages` | Mensajes redactados por Claude. `channel` = 'email' o 'linkedin'. El email lo envía el sistema; LinkedIn lo copia el operador |
| `bookings` | Reservas/pagos desde `/book/:leadId` → Stripe |
| `events` | Auditoría: demo_viewed, email_sent, linkedin_copied, booking_started, payment_succeeded… |
| `app_config` | Configuración del operador: from_email, planes/precios, booking_base_url |

---

## 5. Máquina de estados del lead

```
new → analyzed → site_built → [QA humano] → approved → contacted → viewed → booked → won
                                    │                        │
                                 rejected             nurture / lost
```

| Estado | Lo pone | Significa |
|---|---|---|
| `new` | `ingest-leads` | Scrapeado, sin procesar |
| `analyzed` | Orquestador | Brief generado por Claude |
| `site_built` | Orquestador | Web viva en Lovable, `live_url` guardada |
| `approved` / `rejected` | **Nico (QA)** | Visto bueno humano — gate obligatorio |
| `contacted` | Nico (panel) | Email enviado o LinkedIn marcado como enviado |
| `viewed` | `track-event` | El prospecto abrió la web |
| `booked` | `create-checkout` | Inició reserva |
| `won` | `stripe-webhook` | Pagó |

**Regla de oro: nada se contacta hasta `status='approved'`.** El QA es obligatorio.

---

## 6. Edge Functions (contratos)

El paso de construir la web NO es una Edge Function (vive en el Orquestador).
Las Edge Functions solo son plumbing de la App.

| Función | Hace |
|---|---|
| `ingest-leads` | Normaliza, deduplica por `google_place_id`, upsert → `status='new'` |
| `analyze-lead` | Llama a Claude Haiku con `BRIEF_PROMPT` → JSON → guarda en `briefs` (función de prueba; en producción lo hace el Orquestador) |
| `generate-outreach` | Claude redacta mensaje según `segment` (email con `live_url` / LinkedIn nota de conexión corta) → `outreach_messages` draft |
| `send-email` | **Solo canal email.** Envía vía Resend. LinkedIn NO tiene función de envío |
| `run-scrape` | Trigger al actor de Apify → resultado a `ingest-leads` (pendiente de construir) |
| `create-checkout` | Crea Stripe Checkout, inserta `bookings` → `status='booked'` |
| `stripe-webhook` | `checkout.session.completed` → `booking.paid`, lead `won` |
| `track-event` | Inserta en `events` (p.ej. `demo_viewed`) → actualiza `status` si aplica |

---

## 7. El Orquestador (pieza central)

Script Node/TS con Claude Agent SDK. Corre por cron en VPS (no serverless — los builds tardan minutos).
Usa `claude -p` (Claude Code headless) porque el MCP de Lovable solo acepta clientes OAuth concretos
(Claude Desktop, Claude Code, Cursor, VS Code) — un agente Node puro NO puede autenticarse.

**Flujo por lead (pseudocódigo):**
```
1. Lee hasta BATCH_SIZE leads con status='new' de Supabase
2. El modelo (Sonnet 4.6) genera el brief (JSON estricto) → guarda en briefs → lead='analyzed'
3. El modelo (Sonnet 4.6) genera el build-prompt (texto) para Lovable
4. MCP de Lovable: list_workspaces → create_project(build_prompt) → deploy_project → live_url
5. Guarda en sites (lovable_project_id, live_url, status='built')
6. Lead → status='site_built'
```

**Modo de prueba:** `npm start -- --lead <ID>` (un solo lead). Dry-run disponible (sin gastar créditos).

**Consistencia de marca:** configurar una vez el workspace knowledge en Lovable vía MCP para que
todos los builds salgan con el mismo sistema de diseño, tono y patrones.

---

## 8. Esquemas JSON de Claude (obligatorios)

**Brief (Haiku/Sonnet 4.6):**
```json
{
  "business_summary": "string",
  "tone": "string",
  "value_props": ["string"],
  "highlights_from_reviews": ["string"],
  "recommended_sections": ["hero","servicios","resenas","galeria","reserva","contacto"],
  "services": [{"name": "string", "desc": "string"}],
  "suggested_palette": {"primary": "#hex", "accent": "#hex", "bg": "#hex"},
  "hero_copy": "string"
}
```

**Outreach (Sonnet 4.6):**
```json
{
  "channel": "email|linkedin",
  "subject": "string|null",
  "body": "string (texto plano, humano, corto, con reseñas reales)"
}
```

Reglas del mensaje:
- **Email (locales):** incluye la `live_url` directa; `subject` concreto, sin clickbait.
- **LinkedIn (B2B):** `subject` = null. El `body` es la nota de conexión (~300 car. máx, sin enlace).
  La `live_url` va en el seguimiento una vez conectados.
- Siempre: texto plano, 1ª persona, sin pinta de plantilla. Lo bonito es la web.

---

## 9. Frontend — pantallas

**Back-office (requiere auth):**
- `/` — Dashboard: pipeline por estado, contadores, filtros por ciudad/categoría/estado
- `/leads/:id` — Detalle + QA: info del negocio + reseñas + brief + iframe preview de la `live_url`
  + botones Aprobar/Rechazar/Regenerar. Tras aprobar: bloque de contacto diferenciado por `segment`
  (email → Enviar; LinkedIn → Copiar mensaje + Abrir perfil + Marcar contactado)
- `/import` — Pegar JSON del scraper / subir CSV
- `/settings` — Dominio remitente, planes/precios, `booking_base_url`

**Público (sin auth):**
- La "demo" que ve el prospecto **es directamente la URL de Lovable** (no la renderiza la app)
- `/book/:leadId` — Formulario de aceptación → create-checkout → Stripe
- `/gracias` — Confirmación tras pago

---

## 10. Secretos y variables de entorno

**Regla de oro: TODOS los secrets solo en servidor. Nunca en el frontend.**

```bash
# Servidor (Orquestador + Edge Functions)
ANTHROPIC_API_KEY=          # API key de runtime (distinta al plan Max de Claude Code)
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=  # Bypasa RLS — solo en servidor
RESEND_API_KEY=
FROM_EMAIL=hola@trywebforge-mail.com   # dominio secundario
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
APIFY_TOKEN=                # o OUTSCRAPER_API_KEY
INGEST_WEBHOOK_SECRET=
BATCH_SIZE=5
BOOKING_BASE=https://app.webforge.io/book

# Frontend (solo públicas)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# Lovable: OAuth (no es API key plana)
# Se conecta vía: claude mcp add --scope user --transport http lovable "https://mcp.lovable.dev"
# LinkedIn: sin secrets (semi-manual)
```

---

## 11. Estado actual del proyecto (junio 2026)

**Hecho y desplegado en Supabase (ref: `khscikqchvjxyvoaruas`):**
- ✅ Fase 0: scaffold React + Vite + Tailwind + shadcn/ui, Auth, deploy Vercel
- ✅ Fase 1: `ingest-leads` (normaliza, deduplica por `google_place_id`), `/import`, dashboard `/`
- ✅ Fase 2: `analyze-lead` (Claude Haiku → brief JSON), render del brief en `/leads/:id`
- ✅ Fase 4: QA panel — preview iframe de `live_url`, botones Aprobar/Rechazar/Regenerar
- ✅ Fase 5: `generate-outreach` (bicanal por `segment`) + `send-email` (Resend)
- ✅ Migración `0001_init.sql` aplicada

**Pendiente de aplicar:**
- ⚠️ Migración `0002_segment_linkedin.sql` (añade columnas `segment`, `linkedin_url`, `contact_name`,
  `contact_role` a `leads`) — ejecutar: `npx supabase db push`

**En progreso:**
- 🟡 Fase 3 — Orquestador: código listo en `orquestador/` (`run.ts`, `llm.ts`, `lovable.ts`),
  compilado en verde con `tsc`. **Pendiente de probar con Lovable real** (necesita cuenta de pago
  de Lovable y MCP autenticado con `claude mcp add`)

**Pendiente (no empezado):**
- ⬜ `run-scrape` (Edge Function para trigger automático de Apify — prompt en `PROMPT_SCRAPER.md`)
- ⬜ Fase 6: booking + pagos (`create-checkout`, `stripe-webhook`, `/book/:leadId`, `/gracias`)
- ⬜ Fase 7: cron diario en VPS, `track-event`, métricas en dashboard
- ⬜ Fase 8: fuente de leads B2B desde LinkedIn (ingesta + enriquecimiento)

**Pendiente menor:**
- Rotar la `ANTHROPIC_API_KEY` (la anterior se expuso en un chat)
- RLS en `app_config` (hoy sin política)

---

## 12. Fases de construcción (para retomar)

```
Fase 0 ✅  Scaffold (React/Supabase/Vercel)
Fase 1 ✅  Ingest + pipeline de leads
Fase 2 ✅  Brief (analyze-lead + render)
Fase 3 🟡  Orquestador: brief → build-prompt → Lovable → live_url  ← SIGUIENTE
Fase 4 ✅  Dashboard QA (Aprobar/Rechazar/Regenerar + preview)
Fase 5 ✅  Outreach bicanal (email Resend + LinkedIn copiar/pegar)
Fase 6 ⬜  Booking + pagos (Stripe)
Fase 7 ⬜  Cron diario + track-event + métricas
Fase 8 ⬜  Fuente leads B2B (LinkedIn) + enriquecimiento
```

---

## 13. Reglas duras (no negociables)

1. **Secrets solo en servidor.** Nunca en el frontend ni en el repo.
2. **Las webs se construyen en Lovable vía su MCP desde el Orquestador.** No como Edge Function. No con plantillas estáticas.
3. **Dos canales únicos:** email (locales, automático) y LinkedIn (B2B, semi-manual). Sin WhatsApp ni llamadas (ElevenLabs fuera del stack).
4. **El front público no inserta en DB directo:** pasa por `create-checkout` o `track-event`.
5. **Salidas de Claude en JSON estricto** según los esquemas de la sección 8. Parsear siempre con try/catch.
6. **Gate de QA obligatorio:** `status='approved'` antes de cualquier contacto.
7. **Construir por fases.** No avanzar de fase sin verificar la anterior.
8. **Routing de modelos:** Haiku 4.5 para extracción a volumen; Sonnet 4.6 para briefs y build-prompt.

---

## 14. Para retomar en un chat nuevo

1. Conecta la carpeta `webforge` en Cowork (o ábrela en Claude Code).
2. Di a Claude que lea `ARQUITECTURA_webforge_v2.md`, `CLAUDE.md`, `PROGRESO.md` y este documento.
3. Indica en qué fase quieres continuar (la próxima es la Fase 3 — Orquestador con Lovable real).
4. Cuando Claude necesite algo tuyo (cuenta de Lovable con plan de pago, MCP autenticado, `.env` con claves), te lo pedirá con exactamente qué hacer.

**Para la Fase 3 necesitarás tener:**
- Cuenta Lovable con plan de pago (Pro/Business) y créditos
- Claude Code instalado + MCP de Lovable conectado: `claude mcp add --scope user --transport http lovable "https://mcp.lovable.dev"`
- `ANTHROPIC_API_KEY` (runtime, no el plan Max), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` en el `.env` raíz
- Probar: `cd orquestador && npm install && npm start -- --lead <ID_DE_UN_LEAD_REAL>`
