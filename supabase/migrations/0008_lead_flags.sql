-- 0008_lead_flags.sql — Bandeja del operador en el Dashboard.
-- Flags GLOBALES sobre el lead (no por-operador): favorito y "visto".
-- El status `viewed` del pipeline es otra cosa (el cliente vio su web); esto es del operador.

alter table leads
  add column if not exists is_favorite boolean not null default false,
  add column if not exists seen_at timestamptz;          -- null = no visto

-- Índice parcial: filtrar/contar favoritos es barato aunque crezca la tabla.
create index if not exists idx_leads_favorite on leads (is_favorite) where is_favorite;
