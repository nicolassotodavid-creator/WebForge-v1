# WebForge · Probar el scraper de Google (paso a paso, sin código)

El objetivo de esta prueba: traer **negocios reales de Google Maps** (con teléfono, valoración
y reseñas) y verlos entrar en tu panel, en estado **Nuevo**. Así validamos la **fuente de leads**
antes de automatizar nada.

Usamos **Apify · Google Maps Scraper**. Es la herramienta que tu sistema ya está preparado para
leer (la pantalla *Importar* entiende su formato). La capa **gratuita son 5 $/mes sin tarjeta**,
de sobra para esta prueba (gastarás unos céntimos).

> Regla del proyecto: primero **validamos** que la fuente sirve (esto, a mano). Si los datos entran
> bien, en el siguiente paso te monto un **botón "Buscar en Google"** dentro del panel para no
> repetir esto a mano nunca más.

---

## PARTE A · Crear la cuenta de Apify (5 min, gratis)

1. Entra en **https://apify.com** y pulsa **Sign up**.
2. Regístrate con Google o con tu email. **No pide tarjeta.**
3. Cuando entres, estarás en el **Apify Console** (tu panel de Apify).

---

## PARTE B · Abrir el scraper y configurar la búsqueda

1. Arriba, en el buscador del Console, escribe **Google Maps Scraper** (el oficial, del autor
   **Compass**) y ábrelo. Atajo directo: **https://apify.com/compass/crawler-google-places**.
2. Pulsa **Try for free**. Verás un formulario de configuración (la pestaña **Input**).
3. Arriba a la derecha de ese formulario, cambia de **Form** a **JSON** y **pega esto tal cual**:

```json
{
  "searchStringsArray": ["peluquería Salamanca"],
  "maxCrawledPlacesPerSearch": 20,
  "language": "es",
  "maxReviews": 5,
  "reviewsSort": "newest",
  "scrapeReviewsPersonalData": false,
  "skipClosedPlaces": true,
  "includeWebResults": false
}
```

4. **Cambia solo la primera línea** `"peluquería Salamanca"` por **tu nicho + tu ciudad**.
   Ejemplos: `"barbería Valladolid"`, `"taller mecánico Murcia"`, `"clínica estética Vigo"`.

Qué hace cada cosa (por si lo prefieres en el formulario visual *Form*):

| Campo | Valor | Para qué |
|---|---|---|
| **Search** (`searchStringsArray`) | tu nicho + ciudad | lo mismo que escribirías en Google Maps |
| **Max places** (`maxCrawledPlacesPerSearch`) | `20` | tope bajo para gastar poco en la prueba |
| **Language** | `es` | resultados en español |
| **Number of reviews** (`maxReviews`) | `5` | trae 5 reseñas por negocio (prueba social) |
| **skipClosedPlaces** | `true` | ignora negocios cerrados permanentemente |
| **includeWebResults** | `false` | más barato; no visita webs buscando emails |

---

## PARTE C · Ejecutar y exportar

1. Pulsa el botón verde **Start**. Para 20 fichas tarda **1–3 minutos** (verás un contador en vivo).
2. Cuando termine, ve a la pestaña **Output / Storage** y pulsa **Export**.
3. Elige formato **JSON** y pulsa **Download** (o **Copy** para copiar al portapapeles).
   - Si te resulta más fácil, **CSV** también vale: tu panel acepta los dos.

---

## PARTE D · Meterlos en tu panel (lo que ya funciona)

1. Abre tu panel (`npm run dev` → http://localhost:5173) y entra con tu cuenta.
2. Arriba, pulsa **Importar**.
3. **Opción A (JSON):** pega el JSON que descargaste en el recuadro grande.
   **Opción B (CSV):** usa *Subir CSV* y elige el archivo.
4. Pulsa **Importar**. Verás algo como *"Importación completada · Nuevos: 20"*.
5. Pulsa **Ir al pipeline**: ahí están tus negocios reales en estado **Nuevo**. ✅

---

## PARTE E · Mirar cuáles NO tienen web

Apify trae **todos** los negocios de la búsqueda (con y sin web). Tu sistema marca cada uno:
abre cualquier ficha (**/leads/:id**) y mira el campo **"Tiene web"**. Los que ponen **No** son
tu objetivo (a esos les construirás la web).

> En el paso del **botón "Buscar en Google"** dejaremos que el sistema **filtre y se quede solo
> con los que no tienen web** automáticamente, y añadiremos un filtro "solo sin web" en el panel.

---

## Ojo (cosas a tener en cuenta)

- **Coste de la prueba:** ~0,08 $ (dentro de los 5 $ gratis). Si subes `maxCrawledPlacesPerSearch`,
  sube el gasto: ~4 $ por cada 1.000 fichas. No te dispares en las pruebas.
- **Emails:** Google Maps casi nunca muestra email, y los negocios **sin web** rara vez lo tienen.
  Como el canal de los locales ahora es **email**, prioriza en el scraping las fichas que SÍ traen
  email (o enriquécelo aparte): sin email, ese lead local no es accionable.
- **Legalidad:** scrapear datos públicos (nombre, dirección, teléfono, valoración) es práctica
  común para prospección. No lo uses para spam. Para volumen alto, lo hablamos.

---

## Qué hago yo después (cuando me confirmes que han entrado)

Te construyo el **botón "Buscar en Google" en la pantalla Importar**: escribes nicho + ciudad,
pulsas, y el sistema llama a Apify solo, **se queda con los que no tienen web** y los mete en el
pipeline. Para eso necesitaré tu **APIFY_TOKEN** (te diré dónde sacarlo: *Apify Console → Settings
→ API & Integrations*), que va en el servidor, nunca en el navegador.
