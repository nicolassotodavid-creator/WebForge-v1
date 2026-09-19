# Home Estimator — Madrid 4: 30 empresas del norte y oeste

**Fecha:** 2026-09-19 · El pool del sur-este (auditoría del 13-sep) se acabó con Madrid 3, así que hubo scrape y
auditoría nuevos.

## De dónde salen

- **Scrape:** `orquestador/scrape-batch.ts`, "reformas integrales", con web y ≥10 reseñas, en 12 municipios:
  Majadahonda, Las Rozas, Pozuelo, Boadilla, Villaviciosa de Odón, Collado Villalba, Torrelodones, Galapagar,
  Tres Cantos, Colmenar Viejo, Algete y Navalcarnero. 198 fichas → **94 empresas nuevas** (status `new`).
- **Auditoría:** `auditar-reformas.mjs --lote madrid-4` (el mismo método que la del 20-ago, ahora en un script):
  home + hasta 3 páginas de contacto, formulario, WhatsApp, calculadoras y email publicado en su web. Sonnet
  asigna clase, score y servicios. **A 47 · B 27 · C 20.** Pool en `madrid-4-pool.json` y en `events`.
  Ojo: el ingest del scrape deja la web en `raw_json.website`, no en `website_url`.
- **Selección:** las 30 mejores A con email que no se hubieran contactado antes. Descartadas: Designio Interior
  (ya tiene un botón «Calcular») y Reformas Monbas (buzón inexistente).
- **Buzones (SMTP RCPT del 19-sep):** 25 confirmados, 4 dominios que lo aceptan todo y 1 sin verificar
  (Caoba Majadahonda).

## Marcas

22 logos sacados de su web con Playwright; el de Alejo y el de Área se recortaron de la cabecera. Las 8 sin logo
utilizable (Infoconstrureform, Exclusivas Joma, Reformas Ideas, Kozma, Reformas Lenzo, Antter, A198, CGR) van
con wordmark en tinta. Color = el tono dominante del logo, oscurecido hasta contraste 4,5 con texto blanco. Emona
va a tinta (el color de la «O» es una foto). Renovatotal y Unitec se ajustaron a mano. 30 filas en `organizations`
de reform-wizard → `/demo/<slug>`.

## Copy

El de dolor aprobado el 19-sep (`copy-dolor-madrid.mjs`), con el mismo A/B de asunto que Madrid 2 y 3 (15/15).
Numeración 136-165. Envío: `node docs/prospeccion/enviar-email-lote.mjs --lote madrid4 [--seguimiento|--email3] --enviar`.
