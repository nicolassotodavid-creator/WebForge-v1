-- 0011_cron_followups.sql
-- Dispara la secuencia de seguimientos (Email 2 día 4, Email 3 día 7 sin abrir) en la NUBE.
-- Hasta ahora dependía del launchd del Mac (PASO 3 del orquestador). Esto lo mueve a pg_cron,
-- así los emails salen aunque el Mac esté apagado. Aditiva e idempotente.
-- Aplicar con: npx supabase db push (o pegar en el SQL Editor).
--
-- REQUISITO PREVIO (una sola vez, NO se commitea — la service key es secreta):
--   select vault.create_secret('<SUPABASE_SERVICE_ROLE_KEY>', 'service_role_key');
-- Si ya existe el secreto y quieres rotarlo:
--   select vault.update_secret(
--     (select id from vault.secrets where name = 'service_role_key'),
--     '<NUEVA_KEY>');
--
-- La función cron-followups exige Authorization: Bearer <service_role_key> (ver su index.ts).
-- Idempotencia de envíos garantizada por UNIQUE(lead_id, email_number) (migración 0006):
-- aunque el launchd siguiera activo en paralelo, ningún email se manda dos veces.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Recrear el job de forma idempotente (re-ejecutar la migración no duplica el schedule).
do $$
begin
  if exists (select 1 from cron.job where jobname = 'cron-followups-daily') then
    perform cron.unschedule('cron-followups-daily');
  end if;
end $$;

-- 08:00 UTC todos los días (~09:00–10:00 hora peninsular). Mismo horario que tenía el launchd.
select cron.schedule(
  'cron-followups-daily',
  '0 8 * * *',
  $$
  select net.http_post(
    url     := 'https://khscikqchvjxyvoaruas.supabase.co/functions/v1/cron-followups',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' ||
        (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
