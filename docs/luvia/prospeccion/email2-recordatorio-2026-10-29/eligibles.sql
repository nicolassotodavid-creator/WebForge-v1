-- [LUVIA] Email 2: las 168 clínicas que reciben el recordatorio (proyecto Supabase webforge, khscikqchvjxyvoaruas).
-- Solo emails 1 de Luvia (el lead Clindent tiene un email 1 de [WEBS] de julio con el mismo owner).
-- Las partes se redactaron con la versión sin ese filtro: su n va de 2 a 168 (Clindent era el n=1).
-- Fuera: respondieron (salvo Noelia Duarte, que fue la automática de Booksy), rebote o baja, do_not_contact, y las 4 que se llaman.
with e1 as (
  select distinct on (m.lead_id) m.id, m.lead_id, m.subject, m.body, m.sent_at
  from outreach_messages m join leads l on l.id = m.lead_id
  where l.owner = 'e9536f1a-006b-497f-83a5-b3ffe6fb786d' and m.channel = 'email'
    and m.sent_at is not null and m.email_number = 1
    and m.body ilike '%luvia%'
  order by m.lead_id, m.sent_at),
ex as (
  select lead_id from events
  where type in ('replied', 'email_bounced', 'unsubscribed')
    and lead_id not in (select id from leads where name ilike 'Noelia Duarte%')
  group by 1)
select row_number() over (order by e1.sent_at, e1.id) as n,
       e1.id as email1_id, l.id as lead_id, l.name, l.city, l.email, e1.subject, e1.body
from e1 join leads l on l.id = e1.lead_id
where e1.lead_id not in (select lead_id from ex)
  and not coalesce(l.do_not_contact, false)
  and l.name not ilike 'Clínica Dental Parada Solano%'
  and l.name not ilike '%Clínica Belice%'
  and l.name not ilike '%Benaes%'
  and l.name not ilike 'Clínica Fortuny%'
order by n;
