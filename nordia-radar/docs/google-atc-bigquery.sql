-- Google Ads Transparency Center en BigQuery (dataset público, sandbox gratis sin tarjeta).
-- Anunciantes con sede en España que han servido anuncios en ES en los últimos 90 días y cuyo
-- nombre legal suena a despacho. Pegar en console.cloud.google.com/bigquery (modo sandbox).
-- Ojo: la tabla NO trae el dominio de destino ni el texto; se cruza por razón social con el radar.
SELECT
  advertiser_id,
  advertiser_disclosed_name,
  advertiser_legal_name,
  rs.region_code,
  MIN(rs.first_shown) AS primera_vez,
  MAX(rs.last_shown) AS ultima_vez,
  COUNT(DISTINCT creative_id) AS creatividades
FROM `bigquery-public-data.google_ads_transparency_center.creative_stats`,
  UNNEST(region_stats) AS rs
WHERE advertiser_location = 'ES'
  AND rs.region_code = 'ES'
  AND rs.last_shown >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
  AND REGEXP_CONTAINS(UPPER(advertiser_legal_name), r'ABOGAD|ADVOCAT|BUFETE|LETRAD|JURIDIC|LEGAL')
GROUP BY 1, 2, 3, 4
ORDER BY ultima_vez DESC
LIMIT 1000;
