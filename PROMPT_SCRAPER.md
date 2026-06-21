# Prompt para Claude Code — Construir la captación de leads (scraper Google Maps vía Apify)

> Copia TODO el bloque de abajo y pégalo en un chat nuevo de Claude Code, con la carpeta
> `webforge` abierta. Construye solo esta pieza, de punta a punta.

---

Eres el desarrollador principal de WebForge. Antes de escribir nada, lee enteros `CLAUDE.md`,
`PROGRESO.md` y `app/src/lib/types.ts`. Respeta las reglas duras de `CLAUDE.md`.

**Aviso de scope (IMPORTANTE):** el modelo de captación es **email (negocios locales) + LinkedIn
(B2B). NO existe WhatsApp ni llamadas/ElevenLabs.** El archivo `ARQUITECTURA_webforge_v2.md` está
DESACTUALIZADO y todavía menciona ElevenLabs/WhatsApp: ignóralo en todo lo relativo a canales de
contacto y guíate por `CLAUDE.md`. No reintroduzcas WhatsApp ni llamadas en ningún sitio.

**Estado actual (NO lo rehagas):** Fases 0-2 (scaffold, `ingest-leads`, brief con `analyze-lead`)
hechas y desplegadas. Panel **QA** en `LeadDetail.tsx` hecho (preview + Aprobar/Rechazar/Regenerar).
Funciones de outreach `generate-outreach` y `send-email` ya implementadas. El orquestador
(`orquestador/`) está listo pero sin probar. La migración `0002_segment_linkedin.sql` está pendiente
de aplicar (no la apliques tú; la aplica Nico).

**NO toques:** `LeadDetail.tsx`, `generate-outreach`, `send-email`, ni nada de `orquestador/` (lo
lleva otro hilo). Tu trabajo es una pieza nueva y aislada.

## Tu tarea: la captación de leads desde el panel

Hoy los leads solo entran pegando JSON a mano en `/import`. Construye el **lanzador de scraping**
para que el operador escriba un nicho + ciudad, pulse un botón, y el sistema traiga los negocios de
Google Maps (vía Apify), se quede con los **que no tienen web** y los meta en el pipeline.

### 1) Edge Function nueva: `supabase/functions/run-scrape/index.ts`

- **Input** (JSON): `{ query: string, city: string, max?: number (default 20, tope duro 60),
  language?: string (default "es"), maxReviews?: number (default 5), onlyWithoutWebsite?: boolean
  (default true) }`.
- **Auth:** igual que las demás funciones — sesión de operador por `Authorization: Bearer <jwt>`
  (mira cómo lo hace `analyze-lead`/`ingest-leads`). CORS con el helper `_shared/cors.ts`.
- **Secret de servidor:** `APIFY_TOKEN` (`Deno.env.get`). Si falta, responde 500 con mensaje claro.
  NUNCA expongas el token al frontend.
- **Llama a Apify** al actor oficial **`compass/crawler-google-places`** usando el endpoint síncrono
  `run-sync-get-dataset-items`:
  `POST https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items?token=APIFY_TOKEN`
  con body:
  ```json
  {
    "searchStringsArray": ["<query> <city>"],
    "maxCrawledPlacesPerSearch": <max>,
    "language": "<language>",
    "maxReviews": <maxReviews>,
    "reviewsSort": "newest",
    "scrapeReviewsPersonalData": false,
    "skipClosedPlaces": true,
    "includeWebResults": false
  }
  ```
  Pon un timeout defensivo y maneja el caso de que Apify tarde más que el límite de la Edge Function:
  si no puedes garantizar la ejecución síncrona dentro del límite, implementa el modo asíncrono
  (lanzar el run, hacer polling corto del estado, y leer el dataset) — pero para `max<=20` el síncrono
  debería bastar. Documenta lo que elijas.
- **Filtro "sin web":** si `onlyWithoutWebsite` es true, descarta los items que tengan web propia.
  Usa la MISMA regla que `deriveHasWebsite` de `ingest-leads` (sin `website`, o `website` que apunte a
  google/maps/facebook/instagram = se considera SIN web propia). Para no duplicar lógica, **extrae
  `normalizeLead` + `deriveHasWebsite` de `ingest-leads/index.ts` a un módulo `_shared/leads.ts` y
  úsalo en ambas funciones** (refactor seguro; verifica que `ingest-leads` sigue compilando igual).
- **Inserción:** reutiliza el camino existente. Lo más limpio: reenvía los items ya filtrados a la
  función `ingest-leads` mediante una llamada server-to-server con la cabecera `x-ingest-secret:
  INGEST_WEBHOOK_SECRET` y body `{ "leads": [...], "source": "apify" }`. Así heredas la normalización
  y el dedupe por `google_place_id` sin reescribirlos. (Los leads nuevos quedan `segment='local'` por
  el default de la columna, que es lo correcto para negocios locales.)
- **Respuesta** (JSON): `{ found, without_website, inserted, upserted, with_email, errors }` para que
  el panel muestre un resumen útil.

### 2) UI en `app/src/pages/Import.tsx`: tarjeta "Opción C · Buscar en Google"

- Campos: **Nicho** (texto, p.ej. "peluquería"), **Ciudad** (texto, p.ej. "Salamanca"),
  **Máx. negocios** (número, default 20), checkbox **"Solo los que no tienen web"** (marcado).
- Botón **"Buscar en Google"** que invoca `run-scrape` con `supabase.functions.invoke`. Muestra
  estado de carga (avisa de que puede tardar 1-3 min), y al terminar enseña el resumen
  (`found / without_website / inserted`) con enlace **"Ver pipeline"**.
- Mantén intactas las opciones A (pegar JSON) y B (subir CSV).

### 3) Filtro "sin web" en el Dashboard (`app/src/pages/Dashboard.tsx`)

- Añade un filtro/toggle **"Solo sin web"** (`has_website = false`) junto a los filtros existentes,
  para localizar rápido los leads objetivo. (Este archivo no lo lleva nadie más.)

## Reglas duras (innegociables)
- `APIFY_TOKEN` e `INGEST_WEBHOOK_SECRET` SOLO en el servidor. El frontend nunca ve el token ni
  inserta en la base directo: pasa por `run-scrape` → `ingest-leads`.
- Salidas JSON estrictas, parseo con try/catch, errores claros con código HTTP correcto.
- Tope duro de `max` (60) para evitar gastos accidentales de créditos.
- No toques los archivos listados arriba en "NO toques".

## Verificación (hazla y enséñame el resultado)
- `cd app && npm run build && npm run lint` en verde.
- Valida las Edge Functions con esbuild (como en el resto del repo). Confirma que `ingest-leads`
  sigue compilando tras el refactor a `_shared/leads.ts`.
- Dame los pasos EXACTOS para probarlo (incluido qué secrets faltan).

## Lo que necesitará Nico para que funcione (documéntalo, no lo hagas tú)
1. Cuenta en Apify (gratis) y su **API token**: *Apify Console → Settings → API & Integrations*.
2. Secrets en Supabase:
   `npx supabase secrets set APIFY_TOKEN=apify_api_xxx INGEST_WEBHOOK_SECRET=<una-cadena-larga>`
   (el `INGEST_WEBHOOK_SECRET` debe ser el mismo valor que ya use `ingest-leads`; si no había, créalo).
3. Desplegar: `npx supabase functions deploy run-scrape ingest-leads`.

Método de trabajo: explica en 3-4 líneas qué vas a hacer, hazlo, verifica, y para. Trabaja autónomo
dentro de esta pieza; solo pregúntame si hay una decisión que de verdad necesite mi criterio.
