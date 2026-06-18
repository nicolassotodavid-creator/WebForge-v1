-- 0003_followup_tracking.sql
-- Soporte para la secuencia de 3 emails y tracking de aperturas.
-- Aditiva e idempotente. Aplicar con: npx supabase db push
-- (o pegar en el SQL Editor de supabase.com).

-- email_number: qué email de la secuencia es (1 = gancho, 2 = recordatorio día 4, 3 = cierre día 7)
alter table outreach_messages
  add column if not exists email_number int not null default 1;

-- opened_at: cuándo abrió el lead el email (via pixel de seguimiento). null = no abierto.
alter table outreach_messages
  add column if not exists opened_at timestamptz;

-- Índice para las queries de seguimientos automáticos (busca por lead + número de email)
create index if not exists idx_outreach_lead_num
  on outreach_messages (lead_id, email_number);

-- Índice para el PASO 3 del orquestador: busca email_number=2 enviados sin abrir
create index if not exists idx_outreach_followup
  on outreach_messages (email_number, status, sent_at)
  where opened_at is null;
