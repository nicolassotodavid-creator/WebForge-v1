-- 0018_cron_briefs.sql
-- Genera los briefs de los leads 'new' en la NUBE, sin depender del Mac. Es el PASO 1 del
-- Orquestador (brief → 'analyzed') movido a pg_cron, igual que 0011 (seguimientos) y 0012
-- (scoring). La función cron-briefs coge un lote de leads 'new', les genera el brief con Claude
-- (Sonnet 4.6) y los pasa a 'analyzed'. Aditiva e idempotente.
-- Aplicar con: npx supabase db push (o el SQL Editor, o el workflow apply-cron-briefs).
--
-- Reutiliza el secreto 'service_role_key' del Vault, creado UNA vez en 0011 (no se commitea).
-- La función cron-briefs exige Authorization: Bearer <service_role_key> (ver su index.ts).
-- Idempotencia: la función solo toca leads en 'new' y los pasa a 'analyzed'; reintentos no duplican.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Recrear el job de forma idempotente (re-ejecutar la migración no duplica el schedule).
do $$
begin
  if exists (select 1 from cron.job where jobname = 'cron-briefs') then
    perform cron.unschedule('cron-briefs');
  end if;
end $$;

-- Cada 30 minutos: brief de los leads 'new' pendientes (lote pequeño; la propia función limita
-- con BRIEF_BATCH). Así un lead nuevo tiene su brief en <30 min sin depender del Mac.
select cron.schedule(
  'cron-briefs',
  '*/30 * * * *',
  $$
  select net.http_post(
    url     := 'https://khscikqchvjxyvoaruas.supabase.co/functions/v1/cron-briefs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' ||
        (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 90000
  );
  $$
);
