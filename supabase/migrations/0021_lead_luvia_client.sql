-- 0021_lead_luvia_client.sql
-- Enlace del lead con su cliente en la plataforma Luvia (otro Supabase).
-- NULL = todavía no entregado. Con valor = ya entregado → candado de idempotencia:
-- la Edge Function handoff-luvia no vuelve a llamar a Luvia.
-- Diseño: docs/superpowers/specs/2026-07-10-puente-luvia-handoff-design.md
--
-- Sin cambios de RLS: la columna hereda la visibilidad del lead (dueño + admin).
-- El service_role (Edge Functions) sigue saltándose RLS.
alter table leads
  add column if not exists luvia_client_id text;
