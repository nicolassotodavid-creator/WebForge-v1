-- 0023_lead_luvia_demo.sql — Demo de Luvia pre-extraída para el outreach.
-- luvia_demo_id  = id de la fila en la tabla `demos` del Supabase de Luvia.
-- luvia_demo_url = URL pública de la demo (LUVIA_DEMO_BASE/demo/:id) que va en el email/WhatsApp.
-- null = aún no se ha preparado demo para este lead (→ pitch reply-first).
alter table leads add column if not exists luvia_demo_id text;
alter table leads add column if not exists luvia_demo_url text;
