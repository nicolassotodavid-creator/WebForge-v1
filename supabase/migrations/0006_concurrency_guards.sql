-- 0006_concurrency_guards.sql
-- Blindajes de concurrencia para el Orquestador (cron en VPS, ticks que pueden solaparse).
-- Aditiva e idempotente. Aplicar con: npx supabase db push (o pegar en el SQL Editor).
--
-- (1) leads.build_lock_at — lock de construcción. processBuild reclama el lead con un UPDATE
--     condicional antes de gastar créditos en Lovable; dos ticks solapados ya NO construyen
--     el mismo lead dos veces. Ver orquestador/run.ts (PASO 2).
-- (2) UNIQUE(lead_id, email_number) en outreach_messages — garantía a nivel DB de la
--     idempotencia de la secuencia de emails. El check-then-insert de PASO 3 tenía una
--     carrera (TOCTOU); con el índice único, el perdedor de la carrera falla el INSERT
--     ANTES de enviar, así que el email nunca se manda dos veces.

alter table leads
  add column if not exists build_lock_at timestamptz;

-- Dedupe defensivo antes del índice único: conservar la fila MÁS RECIENTE por
-- (lead_id, email_number). Sin esto, datos preexistentes con duplicados harían fallar
-- la creación del índice. (created_at desc, desempate por id.)
delete from outreach_messages om
using outreach_messages om2
where om.lead_id = om2.lead_id
  and om.email_number = om2.email_number
  and (om.created_at < om2.created_at
       or (om.created_at = om2.created_at and om.id < om2.id));

create unique index if not exists uq_outreach_lead_email_number
  on outreach_messages (lead_id, email_number);
