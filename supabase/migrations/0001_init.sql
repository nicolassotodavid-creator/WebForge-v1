-- WebForge — migración inicial (schema + RLS). Ver ARQUITECTURA_webforge_v2.md secciones 5 y 7.
-- Aplicar en el SQL Editor de tu proyecto Supabase, o con la CLI: supabase db push.

-- LEADS: negocios scrapeados
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text, phone text, whatsapp text, email text,
  address text, city text, country text default 'ES',
  google_place_id text unique,
  rating numeric, review_count int,
  has_website boolean default false,
  raw_json jsonb,
  source text,
  status text not null default 'new',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_leads_status on leads (status);
create index if not exists idx_leads_city_cat on leads (city, category);

-- BRIEFS: salida del análisis (Sonnet 4.6/Haiku)
create table if not exists briefs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  business_summary text, tone text,
  value_props jsonb, highlights_from_reviews jsonb,
  recommended_sections jsonb, services jsonb,
  suggested_palette jsonb, hero_copy text,
  model_used text, created_at timestamptz default now()
);
create index if not exists idx_briefs_lead on briefs (lead_id);

-- SITES: la web a medida construida en Lovable
create table if not exists sites (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  lovable_project_id text,
  live_url text,
  build_prompt text,
  status text default 'queued',   -- queued|building|built|failed|approved|rejected|delivered
  credits_estimate numeric,
  notes text,
  created_at timestamptz default now(),
  built_at timestamptz, approved_at timestamptz
);
create index if not exists idx_sites_lead on sites (lead_id);
create index if not exists idx_sites_status on sites (status);

-- OUTREACH: mensajes redactados
create table if not exists outreach_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  channel text not null,          -- 'whatsapp' | 'email'
  subject text, body text not null,
  status text default 'draft',    -- draft|sent|replied|bounced
  generated_by_model text, sent_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists idx_outreach_lead on outreach_messages (lead_id);

-- BOOKINGS: aceptaciones/reservas
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete set null,
  site_id uuid references sites(id) on delete set null,
  name text, email text, phone text,
  plan text, deposit_amount int,
  stripe_session_id text,
  stripe_payment_status text default 'pending',
  scheduled_at timestamptz,
  status text default 'started',
  created_at timestamptz default now()
);

-- EVENTS: auditoría/analítica
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  type text not null,
  payload jsonb, created_at timestamptz default now()
);
create index if not exists idx_events_lead_type on events (lead_id, type);

-- APP_CONFIG: ajustes del operador (singleton)
create table if not exists app_config (
  id int primary key default 1,
  from_email text, sender_domain text,
  default_plan text, plan_prices jsonb,
  booking_base_url text,
  updated_at timestamptz default now()
);

-- ===== RLS =====
alter table leads enable row level security;
alter table briefs enable row level security;
alter table sites enable row level security;
alter table outreach_messages enable row level security;
alter table bookings enable row level security;
alter table events enable row level security;

drop policy if exists op_leads on leads;
drop policy if exists op_briefs on briefs;
drop policy if exists op_sites on sites;
drop policy if exists op_msgs on outreach_messages;
drop policy if exists op_book on bookings;

create policy op_leads on leads             for all using (auth.role()='authenticated');
create policy op_briefs on briefs           for all using (auth.role()='authenticated');
create policy op_sites on sites             for all using (auth.role()='authenticated');
create policy op_msgs on outreach_messages  for all using (auth.role()='authenticated');
create policy op_book on bookings           for all using (auth.role()='authenticated');

-- Nota: inserts públicos (booking) y el Orquestador escriben con service_role (bypassa RLS).
-- El frontend público NO escribe directo: pasa por create-checkout / track-event.
