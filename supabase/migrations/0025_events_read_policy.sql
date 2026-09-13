-- 0025_events_read_policy.sql
-- `events` tenía RLS activado SIN ninguna política: el panel (rol authenticated) no podía leer la
-- actividad del lead (aperturas, clics de track-click, visitas a /book…). Lectura con la misma regla
-- que outreach_messages (op_msgs): admin o dueño del lead. Las escrituras siguen siendo solo del
-- service_role (track-event, track-click, send-email, cron-followups, webhooks).
drop policy if exists op_events_read on events;
create policy op_events_read on events
  for select
  using (
    is_admin()
    or exists (select 1 from leads l where l.id = events.lead_id and l.owner = auth.uid())
  );
