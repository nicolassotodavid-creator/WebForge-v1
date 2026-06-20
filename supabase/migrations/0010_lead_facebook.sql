-- 0010_lead_facebook.sql — Página de Facebook del negocio.
-- El WhatsApp ya tiene columna (`whatsapp`, desde 0001): aquí solo falta Facebook.
-- Se rellena en ingest-leads (desde leadsEnrichment de Apify o el campo website/url si
-- es un facebook.com) y por el backfill. La UI degrada si esta migración no está aplicada.

alter table leads
  add column if not exists facebook text;   -- URL de la página de Facebook (null = sin/desconocido)
