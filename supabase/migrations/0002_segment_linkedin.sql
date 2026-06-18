-- 0002_segment_linkedin.sql
-- Cambio de planes (2026-06-11): captación outbound SOLO por EMAIL (negocios locales) y
-- LINKEDIN (clientes B2B). Se descartan WhatsApp y llamadas (ElevenLabs).
--
-- ⚠️ 0001_init.sql YA está aplicada en el Supabase de Nico. Esta migración es ADITIVA e
--    idempotente (no toca datos ni rompe nada). PENDIENTE DE APLICAR.
--    Aplicar con:  cd ~/webforge && npx supabase db push
--    (o pega este archivo en el SQL Editor del proyecto en supabase.com).

-- LEADS: distinguir el público (local vs b2b) y guardar el contacto B2B para LinkedIn.
alter table leads add column if not exists segment      text not null default 'local';  -- 'local' | 'b2b'
alter table leads add column if not exists linkedin_url text;   -- perfil o empresa del contacto (B2B)
alter table leads add column if not exists contact_name text;   -- persona concreta a la que escribir (B2B)
alter table leads add column if not exists contact_role text;   -- su cargo (B2B)

create index if not exists leads_segment_idx on leads (segment);

-- CANALES (no requiere cambio de esquema):
--   outreach_messages.channel era texto libre, comentado como 'whatsapp' | 'email'.
--   A partir de ahora los valores válidos son 'email' | 'linkedin'. La app y los prompts ya lo
--   reflejan; no hay constraint que migrar. No debería haber filas antiguas (el outreach aún no
--   estaba implementado); si las hubiera con 'whatsapp', normalízalas a mano.
