# Facebook + WhatsApp en el panel — diseño

**Fecha:** 2026-06-20
**Estado:** aprobado

## Objetivo
Mostrar el Facebook y el WhatsApp de cada lead en el panel, cableado de punta a punta:
capturado automáticamente en los scrapes futuros y backfilleado para los leads actuales.

## Modelo de datos
- **WhatsApp**: reutiliza la columna existente `leads.whatsapp` (solo WhatsApp *explícito*,
  p.ej. un `wa.me` hallado). En pantalla, helper `waNumber(lead)`:
  1. si `lead.whatsapp` → ese número (dígitos);
  2. si no, y `lead.phone` es **móvil español** (empieza por 6 ó 7 tras normalizar, con o sin +34) → ese teléfono;
  3. fijos (9xx) → sin WhatsApp.
  No se escriben números asumidos en la DB: la derivación móvil vive en el helper.
- **Facebook**: nueva columna `leads.facebook text` (migración `0009_lead_facebook.sql`).
  Degradación elegante: si la migración no está aplicada, `facebook` no llega en `select *`
  y la UI de Facebook se oculta (mismo patrón que `flagsSupported` de la 0008).

## Fuentes (cableado)
- **Scrapes futuros**: `run-scrape` ya envía `scrapeContacts:true`. `ingest-leads` mapeará:
  - `facebook` desde `leadsEnrichment.facebooks[]`, o desde `raw_json.website/url` si es un `facebook.com`.
  - `whatsapp` desde un `wa.me`/campo whatsapp explícito si Apify lo trae.
- **Backfill (leads actuales)**: script que visita la web guardada de cada lead y extrae enlaces
  `facebook.com` y `wa.me` (regex sobre el HTML, gratis). Para los leads sin web, búsqueda web
  manual de su página de Facebook. Lo que no tenga fuente queda vacío.

## Dónde se ve
- **Ficha (LeadDetail)**: campo Facebook (link) junto a Teléfono/WhatsApp/Email; WhatsApp y FB clicables.
- **Lista (Dashboard)**: columna compacta **"Contacto"** con iconos 💬 (WhatsApp → `wa.me`) y
  Facebook (→ su página), visibles solo cuando existen.

## Despliegue
- Migración `0009` → aplicar por CLI. Frontend degrada si no está aplicada.
- `ingest-leads` → deploy por CLI. Frontend (Dashboard/LeadDetail/types) → push a `master` (Vercel).
- Backfill → local. ⚠️ `types.ts` tiene WIP del usuario sin commitear: añadir `facebook` con stage selectivo, sin barrer ese WIP.

## Fuera de alcance
- Instagram, TikTok u otras redes (solo Facebook + WhatsApp).
- Asumir que cualquier fijo tiene WhatsApp.
- Verificar la entregabilidad/actividad de los Facebook/WhatsApp hallados.
