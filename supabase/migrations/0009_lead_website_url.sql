-- 0009_lead_website_url.sql — Web real del negocio, resuelta por descubrimiento.
--
-- Problema: algunos negocios NO enlazan su web en Google Maps (ponen su Instagram, o nada),
-- aunque sí tienen web propia (caso TALLERES PRO CARS → talleresprocars.es). El scrape solo ve
-- la ficha de Maps, así que esos negocios quedaban como `has_website=false` y sin URL.
--
-- `website_url` guarda la web real DESCUBIERTA (por el Orquestador: backfill-emails.ts), separada
-- de `raw_json.website` (lo que el negocio puso en Maps, que puede ser su Instagram). El panel y
-- el scoring prefieren `website_url` cuando existe. Ver supabase/functions/_shared/website.ts.

alter table leads
  add column if not exists website_url text;

comment on column leads.website_url is
  'Web real del negocio resuelta por descubrimiento (cuando Google Maps solo enlaza RRSS o no trae web). Distinta de raw_json.website (lo que el negocio puso en su ficha de Maps).';
