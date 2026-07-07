-- 0019_cron_auth_cron_secret.sql
-- Reprograma los jobs pg_cron de seguimientos (0011) y scoring (0012) para autenticar con el
-- secreto DEDICADO 'cron_secret' del Vault, en lugar de 'service_role_key'. Motivo: la variable
-- SUPABASE_SERVICE_ROLE_KEY está DEPRECATED y su valor en runtime dejó de ser reproducible tras
-- la migración de keys del proyecto → las funciones daban 401 y ni los Email 2/3 ni el scoring
-- se ejecutaban (silenciosamente). Las funciones cron-followups/score-sites ya comparan el Bearer
-- contra CRON_SECRET (mismo valor que este 'cron_secret' del Vault).
--
-- El secreto 'cron_secret' del Vault debe existir con el MISMO valor que el secreto CRON_SECRET de
-- las funciones. Lo setea el workflow apply-cron-auth.yml desde el secreto CRON_SECRET de GitHub.
-- Aditiva e idempotente.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ── Seguimientos (Email 2 día 4, Email 3 día 7). Mismo horario que 0011 (08:00 UTC). ──
do $$ begin
  if exists (select 1 from cron.job where jobname = 'cron-followups-daily') then
    perform cron.unschedule('cron-followups-daily');
  end if;
end $$;
select cron.schedule('cron-followups-daily', '0 8 * * *', $$
  select net.http_post(
    url     := 'https://khscikqchvjxyvoaruas.supabase.co/functions/v1/cron-followups',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization', 'Bearer ' ||
        (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 30000);
$$);

-- ── Scoring de webs (cada 15 min). Mismo horario que 0012. ──
do $$ begin
  if exists (select 1 from cron.job where jobname = 'cron-score-sites') then
    perform cron.unschedule('cron-score-sites');
  end if;
end $$;
select cron.schedule('cron-score-sites', '*/15 * * * *', $$
  select net.http_post(
    url     := 'https://khscikqchvjxyvoaruas.supabase.co/functions/v1/score-sites',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization', 'Bearer ' ||
        (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 150000);
$$);
