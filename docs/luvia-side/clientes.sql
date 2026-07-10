-- clientes — tabla del proyecto LUVIA (NO de WebForge) que recibe las clínicas cerradas.
-- Aplícala en el SQL Editor de tu proyecto Luvia.
--
-- ¿Ya tienes una tabla de clientes? Entonces NO crees esta: solo añádele la columna de enlace
--   alter table <tu_tabla> add column if not exists webforge_lead_id text unique;
-- y ajusta CLIENTES_TABLE + los nombres de columnas en crear-cliente/index.ts.
create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  webforge_lead_id text unique,   -- enlace con el lead de WebForge → idempotencia del puente
  nombre text not null,
  categoria text,
  telefono text,
  whatsapp text,
  email text,
  direccion text,
  ciudad text,
  pais text,
  rating numeric,
  resenas int,
  source text default 'webforge',
  created_at timestamptz default now()
);
