# Añadir un lead a mano pegando su URL — Diseño

**Fecha:** 2026-07-03 · **Estado:** pendiente de aprobación de Nico

## Qué es (en una frase)

Un apartado nuevo arriba del todo en la página **"Importar leads"**: pegas la URL de la web
(horrible) de un negocio que has visto navegando, WebForge te propone el nombre del negocio,
tú lo confirmas, y al guardar el lead **se analiza su web automáticamente** — te enseña la
nota (score) y el análisis ahí mismo, y el negocio queda en el pipeline como uno más.

## Por qué

Hoy la única forma de meter un lead "visto en internet" es pegar un JSON técnico (Opción A)
y luego ir a su ficha y pulsar "Analizar web". Este diseño lo convierte en: pegar URL →
confirmar nombre → listo.

## Cómo se usa (flujo del usuario)

1. Entras en **Importar leads**. Arriba del todo hay una tarjeta nueva:
   **"Añadir a mano · Pega la URL de su web"**.
2. Pegas la URL y pulsas **"Buscar negocio"**.
3. WebForge visita la página y te propone el **nombre del negocio** (del título de su web).
   El nombre sale en una casilla editable: lo corriges si hace falta. Hay una casilla
   opcional de **ciudad**.
   - Si la web no responde o no tiene título, la casilla sale vacía y lo escribes tú.
   - Si ese negocio **ya está en tu pipeline**, te lo dice y te da el enlace a su ficha
     (no se duplica).
   - Si pegas un enlace de Instagram/Facebook/Google Maps, te avisa de que eso no es una
     web propia y no sigue (el análisis está pensado para webs de verdad).
4. Pulsas **"Guardar y analizar"**. Se crea el lead (estado `nuevo`, tuyo) y se lanza el
   análisis al momento. En unos segundos ves: **nota sobre 100, resumen del análisis** y un
   botón "Ver ficha →".

## Cómo funciona por dentro (técnico)

### Piezas que se REUTILIZAN (no se tocan)

- `_shared/html.ts → fetchPageForAnalysis()` — descarga y limpieza del HTML.
- `_shared/website.ts → isRealWebsite()` — decide si una URL es una web propia (rechaza
  redes sociales / mapas).
- **Edge Function `analyze-site`** — el análisis con Claude y el guardado de `site_score`,
  `site_analysis`, `site_has_chat/whatsapp` en `leads`. Se invoca tal cual con el
  `lead_id` recién creado. Cero duplicación de la lógica de análisis.
- Tabla `leads` tal cual: **no hay migración**. El lead manual usa los campos existentes.

### Pieza NUEVA: Edge Function `add-lead-by-url`

Una función pequeña con dos modos (mismo endpoint, según el cuerpo):

**Modo 1 — previsualizar** · `POST { url }`
1. Auth: sesión de operador (igual que `analyze-site`: `supabase.auth.getUser(token)`).
2. Normaliza la URL (añade `https://` si falta) y valida con `isRealWebsite()`.
   Si es red social/mapa → `409` con mensaje claro.
3. **Duplicados**: busca en `leads` del mismo dueño un lead cuya web coincida por
   **dominio** (host sin `www.`) contra `website_url` y `raw_json->>'website'`.
   Si existe → devuelve `{ duplicate: { id, name, status } }` y el panel enlaza a la ficha.
4. Descarga la página y extrae el **título**: para ello `FetchedPage` (en
   `_shared/html.ts`) gana un campo nuevo `title` (de `og:site_name` o `<title>`,
   recortando sufijos tipo `" | Inicio"` / `" - Home"`). Cambio **aditivo**: no afecta a
   `analyze-site` ni a `score-sites`.
5. Devuelve `{ proposed_name, page_ok }` (`page_ok:false` si la web no respondió — se
   permite continuar igualmente, con el nombre a mano).

**Modo 2 — crear** · `POST { url, name, city? }`
1. Misma auth y misma validación de URL + re-chequeo de duplicado (por si acaso).
2. `name` obligatorio (es la regla dura de `leads`).
3. Inserta el lead con: `name`, `city`, `country:'ES'`, `has_website: true`,
   `website_url: url` (es la web confirmada por el operador, mismo rango que la
   "descubierta"), `raw_json: { website: url, manual_url: true }`, `source: 'manual-url'`,
   `owner: <usuario de la sesión>`, `status` por defecto (`new`). Sin `google_place_id`
   (no viene de Maps; el guard geográfico de ingest no aplica aquí — el operador es la
   fuente de verdad).
4. Devuelve `{ lead_id }`.

> ¿Por qué no reutilizar `ingest-leads`? Porque no devuelve el id del lead creado (solo
> contadores), y lo necesitamos para lanzar `analyze-site` justo después. Tocar su contrato
> para esto es más arriesgado que una función nueva de ~100 líneas que reutiliza los
> mismos helpers.

### Cambios en el panel (`app/src/pages/Import.tsx`)

Tarjeta nueva **al principio** de la página (encima de la Opción C del scraper):

- Estado 1: campo URL + botón "Buscar negocio" (spinner "Visitando la web…").
- Estado 2: nombre propuesto (editable) + ciudad (opcional) + botón "Guardar y analizar".
  - Aviso ámbar si `page_ok:false` ("No pude abrir esa web — escribe el nombre a mano;
    el análisis lo reflejará").
  - Aviso con enlace si `duplicate` ("Ya está en tu pipeline → Ver ficha").
- Estado 3: tras crear, el panel invoca `analyze-site` con el `lead_id` y muestra
  **nota + resumen** (mismos datos que la ficha) + "Ver ficha →". Si el análisis falla,
  el lead ya está creado: se avisa y se ofrece el botón "Analizar web" de la ficha.

### Errores y casos raros

- Web caída / bloquea scraping → se puede añadir igual; el análisis usará
  "(no disponible)" como hace hoy `analyze-site`.
- URL sin `http(s)` → se antepone `https://` antes de validar.
- Doble clic / repetición → el re-chequeo de duplicado del modo 2 lo frena.
- `analyze-site` devuelve 409 ("no tiene web propia") — no debería pasar porque
  `website_url` queda relleno, pero si pasa se muestra el error tal cual.

### Tests

Los del repo son runners caseros sobre lógica pura. Se añade `_shared/html.test.ts` (o se
amplía el existente si lo hay) para la extracción de `title` (casos: `<title>`,
`og:site_name`, sufijos "| Inicio", sin título) y para la normalización de URL/dominio del
chequeo de duplicados (función pura exportada). La función Edge y la UI se prueban a mano.

### Despliegue

- La función nueva se despliega con el CI existente (push a `main` tocando
  `supabase/functions/**`) o con `bash deploy.sh`.
- El front lo despliega Vercel como siempre. **Sin migraciones y sin secrets nuevos.**

## Fuera de alcance

- Analizar la URL SIN crear lead ("solo curiosear"): siempre crea el lead.
- Extraer email/teléfono de la web al añadir (eso ya lo hace el backfill del Orquestador).
- Leads B2B/LinkedIn: esto entra por el mismo pipeline `local` de siempre.
