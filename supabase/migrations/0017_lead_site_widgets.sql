-- 0017_lead_site_widgets.sql — Flags de la web ACTUAL del negocio: ¿tiene chat web o WhatsApp?
-- Señal de prospección DETERMINISTA (sin Claude): analyze-site y score-sites escanean el HTML
-- CRUDO de la web (firmas de Tawk/Crisp/Intercom… para chat; wa.me/api.whatsapp para WhatsApp)
-- y escriben estos flags junto al site_score. Solo aplica a leads con web propia (has_website).
-- null = no comprobado (web caída/bloqueada o aún sin analizar); true/false = comprobado.
alter table leads add column if not exists site_has_chat boolean;     -- chat web embebido (Tawk, Crisp, Intercom…)
alter table leads add column if not exists site_has_whatsapp boolean; -- enlace/botón a un chat de WhatsApp

-- Filtros del Dashboard ("Con chat web" / "Con WhatsApp"). Índices parciales: solo indexan las
-- filas en true (las que el filtro busca), sin pesar sobre la mayoría null/false.
create index if not exists idx_leads_site_has_chat on leads (site_has_chat) where site_has_chat;
create index if not exists idx_leads_site_has_whatsapp on leads (site_has_whatsapp) where site_has_whatsapp;
