-- 0016_lead_ownership.sql
-- Aislamiento de leads por cuenta. Cada lead tiene un `owner` (auth.users).
-- Cada operador ve SOLO lo suyo; el admin (identificado por email) ve TODO.
-- Diseño: docs/superpowers/specs/2026-06-22-aislamiento-leads-por-cuenta-design.md
--
-- Modelo: `leads.owner` es la ÚNICA fuente de verdad del dueño. Las tablas hijas
-- (briefs, sites, outreach_messages, bookings) heredan la visibilidad a través de su lead.
-- El service_role (Orquestador, Edge Functions, checkout público) sigue saltándose RLS.

-- ============================================================================
-- 1) Columna owner. NULLABLE a propósito: NULL = "solo admin" (p.ej. scrapes por
--    cron sin operador). Así no hay que resolver el UUID del admin en ningún sitio.
-- ============================================================================
alter table leads
  add column if not exists owner uuid references auth.users(id) on delete set null;
create index if not exists idx_leads_owner on leads (owner);

-- ============================================================================
-- 2) Backfill: los leads que YA existen pasan a ser del admin (David). Si el
--    usuario no existe todavía, quedan NULL (mismo efecto de visibilidad: solo admin).
--    Va ANTES del trigger del paso 4 para que el UPDATE no sea bloqueado.
-- ============================================================================
update leads
   set owner = (select id from auth.users
                 where email = 'nicolassotodavid@gmail.com' limit 1)
 where owner is null;

-- ============================================================================
-- 3) Helper: ¿quién es admin? Por email del JWT, sin tabla de roles ni perfiles.
-- ============================================================================
create or replace function public.is_admin() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'nicolassotodavid@gmail.com'
$$;

-- ============================================================================
-- 4) owner inmutable: ningún UPDATE puede cambiar el dueño de un lead que YA
--    tiene dueño. Protege el upsert de ingest-leads de "robar" un lead existente:
--    el primero que lo crea, lo posee. (Un lead sin dueño —NULL— sí puede adoptarse.)
-- ============================================================================
create or replace function public.lock_lead_owner() returns trigger
language plpgsql as $$
begin
  if old.owner is not null then
    new.owner := old.owner;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_lock_lead_owner on leads;
create trigger trg_lock_lead_owner
  before update on leads
  for each row execute function public.lock_lead_owner();

-- ============================================================================
-- 5) RLS. Hoy todas las políticas son `auth.role()='authenticated'` (ven TODO).
--    Se reescriben para aislar por dueño. El admin ve todo vía is_admin().
-- ============================================================================

-- leads: cada uno ve/edita lo suyo; admin, todo. (owner NULL → solo admin.)
drop policy if exists op_leads on leads;
create policy op_leads on leads for all
  using (owner = auth.uid() or public.is_admin())
  with check (owner = auth.uid() or public.is_admin());

-- briefs / sites / outreach_messages: visibles si el lead asociado es del usuario
-- (o es admin). Pagos lee bookings y Emails lee outreach_messages: por eso hay que
-- aislar estas tablas, no solo `leads`.
drop policy if exists op_briefs on briefs;
create policy op_briefs on briefs for all
  using (
    public.is_admin()
    or exists (select 1 from leads l
                where l.id = briefs.lead_id and l.owner = auth.uid())
  );

drop policy if exists op_sites on sites;
create policy op_sites on sites for all
  using (
    public.is_admin()
    or exists (select 1 from leads l
                where l.id = sites.lead_id and l.owner = auth.uid())
  );

drop policy if exists op_msgs on outreach_messages;
create policy op_msgs on outreach_messages for all
  using (
    public.is_admin()
    or exists (select 1 from leads l
                where l.id = outreach_messages.lead_id and l.owner = auth.uid())
  );

-- bookings: lead_id puede ser NULL (reservas públicas sin lead). El admin ve todas;
-- un miembro ve solo las de SUS leads. Reservas sin lead → solo admin.
drop policy if exists op_book on bookings;
create policy op_book on bookings for all
  using (
    public.is_admin()
    or exists (select 1 from leads l
                where l.id = bookings.lead_id and l.owner = auth.uid())
  );

-- Nota: `events` ya tiene RLS activa sin política (deny-all para authenticated): el panel
-- no la lee con la sesión de operador, así que ya está aislada. `app_config` (ajustes del
-- sistema: from_email, precios) sigue compartida — no son datos de leads.
