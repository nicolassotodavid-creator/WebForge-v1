# WebForge — Arquitectura v2 (build spec para Fable / Claude Code)

> Sistema de captación **outbound** que construye una **web a medida** (Lovable conducido por
> Claude vía MCP) ANTES de contactar, te deja revisarla, y dispara el contacto para que
> acepten y paguen. Dos públicos en paralelo: **negocios locales** (scraping de Google Maps →
> **email** automático vía Resend) y **clientes B2B** —agencias, clínicas, despachos…— (→
> **LinkedIn** semi-manual). El gancho es la misma web a medida en ambos.
>
> Codename: `webforge`. Esta v2 **sustituye** a la v1 (el motor de webs cambia de plantillas
> a Lovable-por-cliente vía MCP). El contacto por **WhatsApp** y por **llamada (ElevenLabs)**
> queda **descartado**: los únicos canales son email y LinkedIn.

---

## 0. Cómo usar este documento

Es la fuente de verdad para Fable (como Claude Code en VS Code). Léelo entero antes de tocar
nada. Construye **por fases** (sección 13), verificando cada una antes de seguir. Copia la
sección 14 (`CLAUDE.md`) a la raíz del repo. El arranque y el super-prompt están en 15 y 16.

---

## 1. Decisión arquitectónica clave

**Las webs de cliente se construyen en Lovable, conducido por Claude (Fable) vía el MCP de Lovable.**
Lovable expone un servidor MCP que deja a un agente crear proyectos, iterar, lanzar deploy y
recuperar una **URL en vivo**, todo programático (OAuth, sin API-key). Eso es el primitivo que
convierte "web a medida" en algo automatizable a 5/día.

Hay **dos backends distintos**, no los confundas:

- **La App** = tu panel + Supabase (DB, Auth, Edge Functions). Es lo que TÚ operas. Vive en
  Supabase, la construyes en VS Code. No usa Lovable.
- **El Orquestador** = un agente que corre por cron (Fable + MCP de Lovable). Es el que cada
  mañana scrapea → analiza → **construye las webs en Lovable** → guarda las URLs en Supabase.

Modelo de entrega: **web-first**. La web a medida se construye ANTES de contactar y es el gancho
(la enseñas en el mensaje de email o, en LinkedIn, en cuanto el contacto acepta tu conexión).
Cuando el cliente acepta y paga, esa misma web pasa a ser la suya (apuntas su dominio / la
mantienes). Implicación de coste en sección 17.

---

## 2. Las dos caras de Fable (no las mezcles)

Fable se usa en dos sitios totalmente distintos:

1. **Fable como desarrollador** (en VS Code, vía Claude Code): escribe TODO el código del
   sistema —la App y el Orquestador—. Es quien construye el proyecto siguiendo este doc.
2. **Fable como cerebro del Orquestador** (en producción): el modelo que, dentro del agente
   diario, redacta los briefs, compone los build-prompts y conduce Lovable por MCP.

Mismo modelo, dos roles. La sección 16 (super-prompt) es para el rol 1.

---

## 3. Stack (cerrado)

| Capa | Tecnología |
|---|---|
| Construir el sistema | **Fable vía Claude Code** en VS Code (suscripción Max, plano; NO pongas `ANTHROPIC_API_KEY` en ese entorno o factura por token) |
| App: frontend | React + Vite + Tailwind + shadcn/ui, desplegado en **Vercel** (free) |
| App: backend/DB | **Supabase** (Postgres + Auth + Storage + **Edge Functions** Deno + **pg_cron**) |
| Motor de webs de cliente | **Lovable** conducido por su **MCP** desde el Orquestador |
| Orquestador (agente diario) | Node/TS con **Claude Agent SDK** (o Claude Code headless) + **MCP de Lovable**, modelo `claude-fable-5`, en un **VPS** por cron |
| LLM en runtime | **Claude API**: `claude-fable-5` (briefs, build-prompts, orquestación), `claude-haiku-4-5-20251001` (extracción barata a volumen) |
| Email (locales) | **Resend** (transaccional, **dominio secundario**, texto plano) |
| Pagos | **Stripe Checkout** |
| Outreach LinkedIn (B2B) | **Semi-manual**: Claude redacta, tú copias/pegas. LinkedIn no permite envío automatizado sin baneo; NO hay API de envío ni secret. |
| Scraping / fuentes de leads | Locales: Apify "Businesses Without Websites" / Outscraper. B2B: scraper/enriquecimiento de LinkedIn o directorios sectoriales. Ambas alimentan `ingest-leads` con su `segment`. |

**Routing de modelos (coste):** Fable 5 es potente pero caro (~$10/$50 por millón de tokens),
úsalo donde su calidad manda: el build-prompt (determina la calidad de la web) y conducir Lovable.
Para extracción masiva de reseñas, Haiku 4.5. Sonnet 4.6 como alternativa más barata al build-prompt
si Fable se dispara en coste. Activa **prompt caching** en los system prompts.

---

## 4. Arquitectura de componentes

```
                 ┌─────────────────────────────────────────────┐
   (cron diario) │  ORQUESTADOR  (VPS · Agent SDK · Fable)      │
                 │  1. lee leads 'new' de Supabase             │
   Scraper ─────►│  2. Fable: brief + build-prompt             │
   (Apify)       │  3. MCP Lovable: construye web → live_url    │──► Lovable (webs de cliente)
                 │  4. escribe brief + site en Supabase        │
                 └───────────────┬─────────────────────────────┘
                                 │  (service role)
                                 ▼
        ┌───────────────────────────────────────────────┐
        │  SUPABASE  (DB · Auth · Edge Functions)        │
        │  leads · briefs · sites · outreach · bookings  │◄────── Stripe (webhook)
        └───────────────┬───────────────────────────────┘
                        │
            ┌───────────┴────────────┐
            ▼                        ▼
   APP / Panel (Vercel)      Páginas públicas (Vercel)
   - dashboard pipeline       - /book/:leadId  (acepta+paga)
   - QA: revisar/aprobar       - /gracias
   - contacto: email (Resend, auto) + LinkedIn (copiar/pegar)   (la "demo" = la URL de Lovable)
```

---

## 5. Modelo de datos (Supabase / Postgres)

DDL completo (self-contained). El cambio principal vs v1: la tabla `demos` se sustituye por `sites`
(proyecto Lovable + URL), y el pipeline añade el gate de aprobación.

```sql
-- LEADS: negocios scrapeados
create table leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text, phone text, whatsapp text, email text,
  address text, city text, country text default 'ES',
  google_place_id text unique,
  rating numeric, review_count int,
  has_website boolean default false,
  raw_json jsonb,                 -- payload bruto del scraper (incluye reviews)
  source text,                    -- 'apify' | 'outscraper' | 'linkedin' | 'manual'
  segment text not null default 'local',   -- 'local' (Google Maps→email) | 'b2b' (→LinkedIn)
  linkedin_url text,              -- perfil o empresa del contacto (sobre todo B2B)
  contact_name text, contact_role text,    -- persona concreta a la que escribir (B2B)
  status text not null default 'new',  -- máquina de estados (sección 7)
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on leads (status);
create index on leads (segment);
create index on leads (city, category);

-- BRIEFS: salida del análisis (Fable/Haiku)
create table briefs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  business_summary text, tone text,
  value_props jsonb, highlights_from_reviews jsonb,
  recommended_sections jsonb, services jsonb,
  suggested_palette jsonb, hero_copy text,
  model_used text, created_at timestamptz default now()
);
create index on briefs (lead_id);

-- SITES: la web a medida construida en Lovable
create table sites (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  lovable_project_id text,        -- id del proyecto en Lovable (vía MCP)
  live_url text,                  -- URL en vivo que devuelve Lovable
  build_prompt text,              -- prompt enviado a Lovable
  status text default 'queued',   -- queued|building|built|failed|approved|rejected|delivered
  credits_estimate numeric,       -- créditos aprox (si el MCP lo reporta)
  notes text,                     -- feedback del operador en QA
  created_at timestamptz default now(),
  built_at timestamptz, approved_at timestamptz
);
create index on sites (lead_id);
create index on sites (status);

-- OUTREACH: mensajes redactados (email/LinkedIn)
create table outreach_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  channel text not null,          -- 'email' | 'linkedin'
  subject text, body text not null,
  -- email: lo envía send-email (Resend). linkedin: NO se envía desde el sistema;
  -- el operador copia el body y lo pega a mano (sent_at lo marca el panel al "contactar").
  status text default 'draft',    -- draft|sent|replied|bounced
  generated_by_model text, sent_at timestamptz,
  created_at timestamptz default now()
);
create index on outreach_messages (lead_id);

-- BOOKINGS: aceptaciones/reservas desde /book
create table bookings (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete set null,
  site_id uuid references sites(id) on delete set null,
  name text, email text, phone text,
  plan text, deposit_amount int,          -- céntimos
  stripe_session_id text,
  stripe_payment_status text default 'pending',  -- pending|paid|failed
  scheduled_at timestamptz,
  status text default 'started',          -- started|paid|cancelled
  created_at timestamptz default now()
);

-- EVENTS: auditoría/analítica
create table events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  type text not null,             -- demo_viewed|email_sent|linkedin_copied|booking_started|payment_succeeded...
  payload jsonb, created_at timestamptz default now()
);
create index on events (lead_id, type);

-- APP_CONFIG: ajustes del operador (singleton)
create table app_config (
  id int primary key default 1,
  from_email text, sender_domain text,
  default_plan text, plan_prices jsonb,   -- {basico: 49900, pro: 99900}
  booking_base_url text,                  -- p.ej. https://app.webforge.io/book
  updated_at timestamptz default now()
);
```

### RLS

```sql
alter table leads enable row level security;
alter table briefs enable row level security;
alter table sites enable row level security;
alter table outreach_messages enable row level security;
alter table bookings enable row level security;
alter table events enable row level security;

-- Operador autenticado: acceso total al back-office
create policy op_leads on leads             for all using (auth.role()='authenticated');
create policy op_briefs on briefs           for all using (auth.role()='authenticated');
create policy op_sites on sites             for all using (auth.role()='authenticated');
create policy op_msgs on outreach_messages  for all using (auth.role()='authenticated');
create policy op_book on bookings           for all using (auth.role()='authenticated');

-- Inserts públicos (booking) van por Edge Function con service_role. El front público no escribe directo.
-- El Orquestador escribe con service_role (bypassa RLS).
```

> Regla de oro: ANTHROPIC_API_KEY, Resend, Stripe, OAuth de Lovable y la service key
> viven SOLO en el servidor (Edge Functions / Orquestador). Nada de claves en el frontend.

---

## 6. (RLS incluida arriba)

---

## 7. Máquina de estados del lead (`leads.status`)

```
new ──► analyzed ──► site_built ──►[QA]──► approved ──► contacted ──► viewed ──► booked ──► won
                                     │                      │                       │
                                  rejected               (sin respuesta) ──► nurture / lost
```

| Estado | Lo pone | Significa |
|---|---|---|
| `new` | ingest-leads | Scrapeado, sin procesar |
| `analyzed` | orquestador | Brief generado |
| `site_built` | orquestador | Web construida en Lovable, URL guardada |
| `approved` / `rejected` | **operador (QA)** | Visto bueno humano para contactar (o descartado) |
| `contacted` | operador | Email enviado, o mensaje/solicitud de LinkedIn marcada como enviada |
| `viewed` | track-event | Abrió la web |
| `booked` | create-checkout | Inició aceptación |
| `won` | stripe-webhook | Pagó |
| `nurture`/`lost` | operador/cron | Sin respuesta / descartado |

**El gate de QA (`site_built → approved`) es obligatorio**: nada se contacta sin tu visto bueno.

---

## 8. Edge Functions de la App (contratos)

El paso "construir web" NO es una Edge Function (vive en el Orquestador). La App solo tiene plumbing síncrono.

| Función | Trigger | Input | Hace |
|---|---|---|---|
| `ingest-leads` | Webhook scraper / import | `{leads:[...]}` o CSV | Normaliza, dedupe por `google_place_id`, upsert → `status=new` |
| `generate-outreach` | Operador (tras aprobar) | `{lead_id}` (canal = según `segment`: `local`→email, `b2b`→linkedin) | Brief + `live_url` → Claude redacta mensaje plano → `outreach_messages` draft |
| `send-email` | Operador | `{message_id}` | **Solo canal email.** Envía vía Resend (dominio secundario) → event `email_sent`. LinkedIn NO tiene función de envío: se copia/pega desde el panel. |
| `create-checkout` | Página `/book` | `{lead_id, plan, contact}` | Crea Stripe Checkout, inserta `bookings` started → `status=booked` |
| `stripe-webhook` | Stripe | evento firmado | `checkout.session.completed` → `booking.paid`, lead `won` |
| `track-event` | Front público | `{lead_id, type, payload}` | Inserta en `events` (p.ej. `demo_viewed`) → `status=viewed` si aplica |

> `analyze-lead` es opcional como Edge Function para poder probar el brief aislado. En producción
> el brief lo hace el Orquestador con el mismo prompt de `_shared/prompts.ts`.

---

## 9. El Orquestador (el agente diario) — pieza nueva

Es lo que hace que todo sea automático. **No** es un cron de `curl`: es un agente con estado que
sostiene la sesión OAuth del MCP de Lovable.

**Cómo corre:** script Node/TS usando el **Claude Agent SDK** (o Claude Code en modo no-interactivo),
con el **MCP de Lovable** configurado (OAuth), modelo `claude-fable-5` y la **service key de Supabase**.
Agendado por **cron en un VPS** (un build de Lovable tarda minutos, así que NADA de funciones
serverless con timeout corto: VPS o job largo). Alternativa: GitHub Actions con workflow programado.

**Pseudo-flujo (`orquestador/run.ts`):**
```ts
const BATCH = 5; // webs/día
const leads = await db.from('leads').select('*').eq('status','new').limit(BATCH);

for (const lead of leads) {
  // 1) Brief
  const brief = await fable(BRIEF_PROMPT, leadConReviews);   // JSON estricto
  await db.from('briefs').insert({ lead_id: lead.id, ...brief, model_used:'claude-fable-5' });
  await db.from('leads').update({ status:'analyzed' }).eq('id', lead.id);

  // 2) Build-prompt (Fable escribe el prompt para Lovable a partir del brief)
  const buildPrompt = await fable(BUILD_PROMPT, { brief, lead,
      booking_url: `${BOOKING_BASE}?lead=${lead.id}` });

  // 3) Construir en Lovable VÍA MCP → URL en vivo
  const site = await db.from('sites').insert({ lead_id:lead.id, build_prompt:buildPrompt, status:'building' }).select().single();
  const { projectId, liveUrl } = await lovableMcp.createProject({ prompt: buildPrompt }); // herramienta MCP
  await db.from('sites').update({ lovable_project_id:projectId, live_url:liveUrl, status:'built', built_at:'now()' }).eq('id', site.id);

  // 4) Marcar lead listo para QA
  await db.from('leads').update({ status:'site_built' }).eq('id', lead.id);
}
// Las aprobaciones y el outreach (email / LinkedIn) son pasos POSTERIORES (tras el QA humano).
```

**Consistencia de marca:** fija una sola vez el *workspace/project knowledge* en Lovable (vía MCP)
con tu sistema de diseño, tono y patrones, para que cada build salga consistente sin supervisión pesada.

**El build-prompt** (lo genera Fable) debe instruir a Lovable: one-page a medida para `[negocio]`,
secciones del brief, paleta, **reseñas reales**, horario/contacto, mobile-first y rápida, y un CTA
prominente **"Reservar / Aceptar"** que enlace a `{booking_url}` (lleva el `lead_id`). Opcional:
inyectar un snippet `fetch` a `track-event` en el `onLoad` para registrar `demo_viewed`.

---

## 10. Esquemas de salida de Claude (JSON estricto)

**Brief:**
```json
{ "business_summary":"string","tone":"string","value_props":["string"],
  "highlights_from_reviews":["string"],
  "recommended_sections":["hero","servicios","resenas","galeria","reserva","contacto"],
  "services":[{"name":"string","desc":"string"}],
  "suggested_palette":{"primary":"#hex","accent":"#hex","bg":"#hex"},
  "hero_copy":"string" }
```

**Build-prompt:** salida = **texto** (el prompt para Lovable), no JSON. Reglas de calidad en sección 9.

**Outreach:**
```json
{ "channel":"email|linkedin","subject":"string|null",
  "body":"string (texto plano, humano, corto, menciona reseñas reales)" }
```

> Mensaje en frío: texto plano, 1ª persona, sin pinta de plantilla. Lo bonito es la web, no el mensaje.
> - **email** (locales): incluye la `live_url` directa; `subject` concreto, sin clickbait.
> - **linkedin** (B2B): `subject` = null. El `body` es la **nota de conexión** (corta, ~300 car. máx,
>   sin enlace), pensada para que acepten; la `live_url` se enseña en el mensaje de seguimiento una vez
>   conectados. Tono profesional, menciona algo real del negocio/sector.

---

## 11. Frontend (la App)

### Back-office (auth)
- **`/` Dashboard** — pipeline por estado, contadores, filtros por ciudad/categoría/estado.
- **`/leads/:id` Detalle + QA** — info + reseñas + brief + **iframe/preview de la `live_url` de Lovable**;
  botones **Aprobar** / **Rechazar** / **Regenerar** (re-encola el build). Tras aprobar: bloque de
  contacto con el mensaje redactado **según el `segment` del lead** — si **email** (locales): botón
  **Enviar** (→ `send-email`); si **LinkedIn** (B2B): **Copiar mensaje** + **Abrir perfil**
  (`linkedin_url`) para pegarlo a mano. **Marcar contactado** en ambos. Estado de booking.
- **`/import`** — pegar JSON del scraper / CSV / config del webhook de ingest.
- **`/settings`** — dominio remitente, planes/precios, `booking_base_url`.

### Público (sin auth)
- La **"demo"** que ve el prospecto **es la URL de Lovable** (no la renderiza tu app).
- **`/book/:leadId`** — formulario de aceptación → `create-checkout` → Stripe.
- **`/gracias`** — confirmación tras pago.

---

## 12. Secrets / variables de entorno (solo servidor)

```
# Claude (runtime, en Orquestador y Edge Functions)
ANTHROPIC_API_KEY=
# Lovable MCP: OAuth (se conecta vía connector/SDK, no es key plana) — sesión en el Orquestador
# Supabase: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (en Orquestador y funciones)
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
# Email
RESEND_API_KEY=
FROM_EMAIL=hola@trywebforge-mail.com     # DOMINIO SECUNDARIO
# Pagos
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
# Scraper
APIFY_TOKEN=                              # o OUTSCRAPER_API_KEY
INGEST_WEBHOOK_SECRET=
# LinkedIn (B2B): sin secrets — el outreach es semi-manual (copiar/pegar desde el panel).
# Orquestador
BATCH_SIZE=5
BOOKING_BASE=https://app.webforge.io/book
```

---

## 13. Orden de construcción (para Fable)

Fase a fase, verificando cada una.

- **Fase 0 — Scaffold.** Repo + Vite/React/Tailwind/shadcn + Supabase. Aplicar migración (sección 5, schema+RLS). Auth (solo tú). Deploy en Vercel. Cargar secrets.
- **Fase 1 — Ingest + datos.** `ingest-leads` (acepta `segment`: `local`|`b2b`) + `/import` + tabla de leads en `/`. Meter leads reales.
- **Fase 2 — Brief.** Prompt en `_shared/prompts.ts` + `analyze-lead` (Edge Fn de prueba) + render del brief en `/leads/:id`.
- **Fase 3 — Orquestador MVP (núcleo nuevo).** Script Node + Agent SDK + **MCP de Lovable** + Fable que, para UN lead, genere brief → build-prompt → **construya la web en Lovable** → guarde `live_url` en `sites`. Verificar que devuelve una URL viva.
- **Fase 4 — Dashboard QA.** Preview de la `live_url` en `/leads/:id` + Aprobar/Rechazar/Regenerar.
- **Fase 5 — Outreach bicanal.** `generate-outreach` (canal según `segment`) + `send-email` (Resend, **solo email**) + acciones de panel: email → **Enviar**; LinkedIn → **Copiar mensaje** + **Abrir perfil** + **Marcar contactado**.
- **Fase 6 — Booking + pagos.** `/book/:leadId` + `create-checkout` + `stripe-webhook` + `/gracias`.
- **Fase 7 — Automatización diaria.** Cron del Orquestador en lote + `track-event` + métricas en el dashboard.
- **Fase 8 — Fuente B2B (LinkedIn).** Ingesta de leads `segment='b2b'` (empresa/persona + `linkedin_url`), enriquecimiento del contacto y variante de brief/mensaje B2B. *(Sustituye a la antigua "Fase 7 — Llamadas/ElevenLabs", eliminada.)*

---

## 14. CLAUDE.md (copiar a la raíz del repo)

```md
# WebForge — instrucciones para Fable / Claude Code

Dos backends: (1) APP = panel React (Vercel) + Supabase (Postgres+Auth+Edge Functions Deno+pg_cron).
(2) ORQUESTADOR = agente Node (Claude Agent SDK + MCP de Lovable + modelo claude-fable-5) en VPS por cron,
que construye las webs de cliente en Lovable y escribe en Supabase con la service key.

Reglas duras:
- Secrets (ANTHROPIC_API_KEY, Resend, Stripe, OAuth Lovable, service key) SOLO en servidor. Nunca en el frontend.
- Las webs de cliente se construyen en Lovable VÍA SU MCP desde el Orquestador. NO como Edge Function. NO plantillas estáticas.
- Dos públicos / dos canales: negocios `local` → **email** (Resend, automático); `b2b` → **LinkedIn** (semi-manual: Claude redacta, el operador copia/pega). NADA de WhatsApp ni llamadas.
- El front público no inserta en DB directo: pasa por create-checkout / track-event.
- Salidas de Claude en JSON estricto (esquemas en ARQUITECTURA_webforge_v2.md sec. 10). Parsear con try/catch.
- Modelos: Haiku 4.5 extracción a volumen; Fable 5 para build-prompt y conducir Lovable; Sonnet 4.6 alternativa barata. Prompt caching en system prompts.
- Gate de QA obligatorio: nada se contacta hasta status='approved' (visto bueno humano).
- Mensaje en frío: texto plano, humano, corto, con reseñas reales. Email incluye la live_url; LinkedIn es nota de conexión (la web va en el seguimiento). Sin pinta de plantilla.
- Construir por fases (sec. 13). Verificar cada fase antes de seguir.

Fuera de alcance (no construir): contacto por WhatsApp; llamadas (ElevenLabs). Solo email y LinkedIn.
```

---

## 15. Cómo empezar (paso a paso)

**A. Cuentas y llaves (una tarde):**
1. **Anthropic** — plan **Max** (para construir con Claude Code en plano) + una **API key** aparte para el runtime (Orquestador/Edge Functions).
2. **Supabase** — proyecto nuevo (tier free vale para el MVP).
3. **Lovable** — cuenta con créditos (plan acorde a tu volumen, ver sec. 17) y **activa el MCP**.
4. **Resend** — alta + verifica un **dominio secundario** para email.
5. **Stripe** — cuenta + claves test.
6. **Scraper** — Apify (actor "Businesses Without Websites") u Outscraper.
7. **LinkedIn** — una cuenta (idealmente Sales Navigator para volumen B2B). Outreach semi-manual: sin API ni claves.
8. **VPS** barato (Hetzner/DigitalOcean ~5€) para el cron del Orquestador.

**B. Conectar el MCP de Lovable a Claude:** en los ajustes de connectors de Claude, añade Lovable
(OAuth). Así Fable puede conducir Lovable. (El Orquestador en producción usa esa misma conexión vía SDK.)

**C. Arrancar el repo:**
1. Crea el repo y mete este doc (`ARQUITECTURA_webforge_v2.md`) + el `CLAUDE.md` (sec. 14) en la raíz.
2. Ábrelo en VS Code, lanza **Claude Code** con **Fable** seleccionado. (Asegúrate de NO tener
   `ANTHROPIC_API_KEY` en ese entorno, o Code factura por token en vez de tu plan.)
3. Pega el **super-prompt** (sección 16). Fable construye Fase 0 + 1 y para para que verifiques.
4. Avanza fase a fase dándole el OK.

---

## 16. Super-prompt para Fable (copia y pega en Claude Code)

```
Eres el desarrollador principal de WebForge, un sistema que cada día scrapea negocios locales,
les construye una web a medida y dispara el contacto para que reserven/acepten y paguen.

Antes de escribir nada, lee por completo ARQUITECTURA_webforge_v2.md y CLAUDE.md en la raíz del repo.
Son la fuente de verdad: síguelos al pie de la letra.

Stack cerrado:
- Dos backends: (1) APP = React+Vite+Tailwind+shadcn en Vercel + Supabase (Postgres + Auth +
  Edge Functions en Deno + pg_cron). (2) ORQUESTADOR = agente Node/TS con el Claude Agent SDK +
  el MCP de Lovable + modelo claude-fable-5, que corre por cron en un VPS y construye las webs de
  cliente EN LOVABLE vía su MCP, escribiendo en Supabase con la service key.
- Runtime LLM: Claude API. Haiku 4.5 para extracción a volumen; Fable 5 para build-prompt y conducir
  Lovable. Contacto: email (Resend, dominio secundario, texto plano) para negocios locales + LinkedIn
  semi-manual (Claude redacta, el operador pega) para B2B. Pagos: Stripe. SIN WhatsApp ni llamadas.

Reglas duras (innegociables):
- Todas las secrets SOLO en servidor (Edge Functions / Orquestador). Nunca en el frontend.
- Las webs de cliente se construyen en Lovable VÍA SU MCP desde el Orquestador, NO como Edge Function
  y NO con plantillas estáticas.
- El frontend público nunca inserta en DB directo: pasa por create-checkout / track-event.
- Todas las salidas de Claude en JSON estricto según los esquemas del doc (sección 10). Parsear con try/catch.
- Gate de QA obligatorio: ningún lead se contacta hasta status='approved'.
- Construye POR FASES (sección 13). No avances de fase sin que yo lo apruebe.

Tu tarea AHORA: construye solo la Fase 0 y la Fase 1.
- Fase 0: scaffold del repo (Vite/React/Tailwind/shadcn), proyecto Supabase, aplica la migración
  completa (schema + RLS de la sección 5), configura Auth (solo un operador), deja el deploy en Vercel
  listo y documenta dónde van los secrets.
- Fase 1: Edge Function ingest-leads (normaliza, dedupe por google_place_id, upsert a status='new'),
  la pantalla /import (pegar JSON o subir CSV), y la tabla de leads en /.

Método de trabajo: explica en 3-4 líneas qué vas a hacer, hazlo, y al terminar dame la lista exacta
de comandos/pasos para verificar la Fase 1 (cómo meter un lead de prueba y verlo en el panel). Luego
PARA y espera mi OK antes de la Fase 2. Trabaja de forma autónoma dentro de estas fases; solo
pregúntame si hay una decisión que de verdad necesite mi criterio.
```

---

## 17. Fuera de alcance / avisos honestos

- **Créditos de Lovable = tu mayor coste variable, y se gastan en CADA build, no solo en los que
  cierran.** Web-first significa construir ~110 webs/mes; muchas no convertirán. Asegúrate de que
  `conversión × ticket` cubre el coste de créditos de **todas**. Por eso vendes *mayor ticket*.
  *Optimización opcional:* construir una versión ligera (menos iteración = menos créditos) como gancho,
  y solo pulir a fondo tras mostrar interés. Reduce el desperdicio a la mitad.
- **LinkedIn es semi-manual a propósito:** no hay envío automático (LinkedIn banea la automatización y
  no expone API de mensajería). El sistema redacta; tú envías a mano, respetando los límites de
  conexiones/mensajes de tu cuenta. Para volumen B2B, plantéate Sales Navigator.
- **Email en frío (locales):** cumple RGPD/LSSI — remite desde dominio secundario, identifícate, incluye
  baja y no compres listas. El sistema envía, no calienta el dominio (eso es externo).
- **El Orquestador no es serverless corto:** un build tarda minutos. Corre en VPS/job largo.
- **Scraping y warmup de dominio de email:** externos. El sistema ingiere y envía, no scrapea ni calienta.
```

