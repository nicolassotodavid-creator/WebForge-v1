-- 0024 — Pausa el barrido automático de scoring de webs (cron-score-sites).
--
-- 2026-09-13: las webs de cliente quedan aparcadas. El job puntuaba con Haiku, cada 15 min, la web
-- de todo lead nuevo con web propia, incluidos los de prospección del Home Estimator, que no van a
-- tener web de WebForge. Se pausa (no se borra): el botón «Analizar web actual» de la ficha sigue
-- funcionando (analyze-site) y el job se reactiva con `active := true`.
--
-- Aplicado a prod el 2026-09-13 por Management API (este repo no aplica migraciones al desplegar).
-- cron-followups-daily NO se toca: sigue enviando los recordatorios de los leads ya contactados.

select cron.alter_job(jobid, active := false)
from cron.job
where jobname = 'cron-score-sites';

-- Para reactivarlo:
-- select cron.alter_job(jobid, active := true) from cron.job where jobname = 'cron-score-sites';
