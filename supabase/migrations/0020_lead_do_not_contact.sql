-- 0020_lead_do_not_contact.sql
-- OPT-OUT / BAJA (LSSI Art. 21 + RGPD): honrar la baja del outreach.
-- Un lead con do_not_contact=true NO recibe ningún email (1/2/3): lo respetan
-- generate-outreach, send-email y cron-followups. Se marca a mano desde el panel
-- cuando el lead responde "BAJA" al correo (que promete baja inmediata).

alter table leads add column if not exists do_not_contact boolean not null default false;
alter table leads add column if not exists unsubscribed_at timestamptz;

comment on column leads.do_not_contact is 'Opt-out de outreach (BAJA). Si true, no se le envía ningún email.';
comment on column leads.unsubscribed_at is 'Momento en que se marcó la BAJA (do_not_contact=true).';
