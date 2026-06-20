-- 0012_cron_score_sites.sql
-- Rellena el Score (calidad IA de la web que el negocio YA tiene) EN LA NUBE.
-- Hasta ahora dependía del barrido del Orquestador (launchd del Mac, score-existing-sites.ts),
-- que NO estaba corriendo → ningún lead se puntuaba y la columna Score salía siempre "—".
-- Esto lo mueve a pg_cron, igual que 0011 hizo con los seguimientos. Aditiva e idempotente.
-- Aplicar con: npx supabase db push (o pegar en el SQL Editor).
--
-- REQUISITO PREVIO (ya cumplido si aplicaste 0011): el secreto del Vault 'service_role_key'.
--   select vault.create_secret('<SUPABASE_SERVICE_ROLE_KEY>', 'service_role_key');
--
-- La función score-sites exige Authorization: Bearer <service_role_key> (ver su index.ts) y
-- puntúa en lotes pequeños (default 6) los leads con web propia aún sin analizar. Cada 15 min
-- limpia el backlog: tras un scrape, los Scores aparecen en pocos minutos sin tocar el Mac.
-- Idempotente: solo toca leads con site_analyzed_at IS NULL, así que nunca re-puntúa ni
-- pisa el análisis manual (botón «Analizar web actual», que escribe las mismas columnas).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Recrear el job de forma idempotente (re-ejecutar la migración no duplica el schedule).
do $$
begin
  if exists (select 1 from cron.job where jobname = 'cron-score-sites') then
    perform cron.unschedule('cron-score-sites');
  end if;
end $$;

-- Cada 15 minutos. Lotes de 6 → hasta 24 webs/hora puntuadas (~12 cént/hora a tope; en la
-- práctica solo gasta cuando hay leads nuevos sin analizar, luego queda inactivo).
select cron.schedule(
  'cron-score-sites',
  '*/15 * * * *',
  $$
  select net.http_post(
    url     := 'https://khscikqchvjxyvoaruas.supabase.co/functions/v1/score-sites',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' ||
        (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);
