-- 0022_lead_site_bot.sql — Flag: ¿la web ACTUAL del negocio ya tiene un BOT / automatización?
-- Subconjunto de site_has_chat: solo cuenta como "automatizado" un bot-builder puro (Landbot,
-- ManyChat, Chatfuel), NO un chat con humano (Tawk, Crisp, Intercom…). Lo usa el pitch de Luvia
-- (luviaSiteState) para no ofrecer "te automatizo" a quien ya está automatizado.
-- null = no comprobado (web caída/bloqueada o sin analizar); true/false = comprobado.
-- Lo escriben analyze-site (botón) y score-sites (cron) junto a los flags de 0017.
alter table leads add column if not exists site_has_bot boolean;

-- Filtro/índice parcial (mismo criterio que 0017): solo indexa las filas en true.
create index if not exists idx_leads_site_has_bot on leads (site_has_bot) where site_has_bot;

-- Backfill SIN re-scrapear: derivar de los vendors ya guardados en site_analysis._widgets.vendors.
-- Solo tocamos filas ya analizadas con array de vendors presente; el resto se queda null.
update leads
set site_has_bot = exists (
  select 1
  from jsonb_array_elements_text(site_analysis->'_widgets'->'vendors') as v(name)
  where v.name in ('Landbot', 'ManyChat', 'Chatfuel')
)
where site_analysis ? '_widgets'
  and jsonb_typeof(site_analysis->'_widgets'->'vendors') = 'array';
