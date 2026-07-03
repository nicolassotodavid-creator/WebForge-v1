# Spec 1 — "Build de calidad": design-system del build + fotos reales

**Fecha:** 2026-07-03
**Objetivo:** que las webs de cliente que el Orquestador construye en Lovable dejen de parecer
"plantilla de IA" y parezcan diseñadas e intencionales, sin salir todas calcadas.
**Alcance:** solo builds **nuevos**. Las webs ya enviadas no se re-generan.

Este spec junta dos palancas porque viven en el mismo código (el prompt del build y su input):

- **#2 Design-system**: convertir el `BUILD_PROMPT` (hoy dice "rápido y profesional", un deseo) en
  reglas duras y una constante fija que no deriva entre builds.
- **#1 Fotos reales**: meter las fotos reales del negocio (Google Maps) en el build, con un filtro de
  curación por visión para no colar fotos sin sentido, y fallback a web sin-fotos.

Quedan fuera, como specs propios posteriores:
- **Spec 2** — bucle de refinamiento por score (usar la nota de `analyze.ts` para reeditar en Lovable).
- **Spec 3** — pulido con infra (paletas por categoría, webs "golden" como few-shot).

---

## 1. Idea central de diseño: separar lo invariante de lo variable

Hoy el prompt que recibe Lovable lo escribe Sonnet entero, y por eso cada web sale distinta: la
gramática de diseño depende de lo que improvise el modelo en cada llamada. Para **fijar** la calidad,
partimos el prompt final a Lovable en tres piezas, dos de ellas deterministas:

```
prompt_a_lovable =
    [PARTE VARIABLE  · la escribe Sonnet]     ← secciones, copy ES, tono, a qué sección va cada foto
  + [MANIFIESTO DE FOTOS · determinista]      ← URLs ya curadas y re-hospedadas, o "sin fotos"
  + [DESIGN_SYSTEM · constante fija]           ← la gramática de diseño, verbatim en cada build
```

- La **parte variable** es lo único que puede/debe cambiar por negocio. Sonnet no toca reglas de diseño.
- El **`DESIGN_SYSTEM`** es una constante de texto que `run.ts` añade **tal cual** al final. No la
  parafrasea el modelo → no puede derivar. Es la clave de que todas las webs compartan oficio sin
  salir calcadas (la variación la ponen paleta + fotos + copy reales).
- El **manifiesto de fotos** también lo añade `run.ts` de forma determinista, tras la curación.

---

## 2. Componentes y responsabilidades

### 2.1 `extractPhotoCandidates(raw)` — nuevo, en `supabase/functions/_shared/website.ts`
Función **pura** (importable desde Deno y Node), molde de `extractReviews`. Saca las URLs candidatas
del `raw_json` del scraper: campo `imageUrl` (portada) + array `imageUrls`. Devuelve hasta ~15 URLs
únicas, sin inventar nada. Vacío si no hay.

### 2.2 `orquestador/photos.ts` — nuevo módulo de curación
Orquesta el gate de fotos. Entrada: candidatas + datos del negocio (categoría, ciudad). Salida:
`{ hero: string | null, gallery: string[] }` con URLs **ya re-hospedadas** (o `{ hero: null, gallery: [] }`).

Pasos:
1. Si no hay candidatas → devuelve vacío.
2. **Curación por visión** (Haiku 4.5, `haiku-4-5-20251001`): se le pasan las candidatas (por URL) y
   se le pide quedarse SOLO con las que son (a) buena calidad y **claramente relevantes** a
   "web profesional de {categoría} en {ciudad}", y (b) **seguras**: fuera caras identificables en
   primer plano, capturas/tiques/menús-en-texto, memes, borrosas u oscuras. Devuelve JSON estricto con
   los índices de las **4-6 mejores rankeadas**, la mejor marcada como hero. Si ninguna convence con
   confianza → vacío (sesgo conservador: "en la duda, sin foto").
3. **Re-hospedar solo las ganadoras** al bucket público (patrón de `orquestador/preview.ts`,
   `rehostScreenshot`). Se re-hospeda porque la curación **ya descargó los bytes** para mirarlos → es
   el paso natural, no un fetch extra. URLs estables, no dependemos de que Google no las bloquee.
4. **Degradación elegante** en cualquier fallo (visión, descarga, re-host): se descarta esa foto; si
   caen todas, `{ hero: null, gallery: [] }`. **El build nunca se bloquea por las fotos.**

Modelo: constante propia en el módulo (`haiku-4-5-20251001`), coherente con la regla de "extracción a
volumen" de CLAUDE.md. NO toca `ORQUESTADOR_MODEL` (que es de build/brief).

### 2.3 `DESIGN_SYSTEM` — nueva constante en `supabase/functions/_shared/prompts.ts`
Texto fijo en español (ver §3). Se exporta y `run.ts` lo añade al prompt de Lovable en cada build.

### 2.4 `BUILD_PROMPT` — adelgazar (en `prompts.ts`)
Se le **quitan** las reglas de diseño (ahora en `DESIGN_SYSTEM`) y se le indica que el sistema de
diseño y las fotos se añaden aparte; Sonnet se ocupa solo del **contenido**: qué secciones, copy en
español, tono, y a qué sección va cada foto. **Se conservan intactas**: el carrusel de reseñas (6-8
reales, transcritas literales, con nota media y nº) y el CTA + badge flotante de 397€ a booking — son
contrato y funcionan.

### 2.5 `orquestador/run.ts` — PASO 2 (build), ensamblado
Tras recuperar el brief y refrescar highlights (igual que hoy):
1. `candidates = extractPhotoCandidates(lead.raw_json)`
2. `photos = await curatePhotos(candidates, { category, city })`  // photos.ts
3. Sonnet redacta la parte variable con `BUILD_PROMPT` adelgazado (sabe si hay fotos o no).
4. Ensamblar: `variable + photoManifest(photos) + DESIGN_SYSTEM`.
5. `lovableBuild(...)` igual que hoy (un solo tiro), `analyze` igual que hoy.

### 2.6 Fotos en "pasada 2" en el build (NO en la prospección)
La prospección corre con `scrapePlaceDetailPage: false` a propósito (ahorra ~½ del coste por ficha,
ver `run-scrape/index.ts`), y la galería de fotos vive en esa página de detalle. Subir `maxImages` en
la prospección no traería galería o encarecería **todos** los leads (la mayoría nunca se construyen).

Por eso las fotos se traen igual que las reseñas: en una **"pasada 2" en el build**, solo para el
lead aprobado. Nuevo `fetchPhotosForPlace(placeId, { maxImages })` (molde de `fetchReviewsForPlace`
en `orquestador/reviews.ts`) que hace una llamada dirigida al actor con `maxImages: 10`, y sus URLs se
**mergean en `lead.raw_json.imageUrls`** (idempotente: si ya hay fotos, no se re-paga). Después,
`extractPhotoCandidates` lee de ese `raw_json` ya enriquecido. Los leads con scrape básico que ya
tengan `imageUrl` (portada) se curan igual, solo con menos candidatas.

---

## 3. Contenido del `DESIGN_SYSTEM` (constante)

Reglas duras, imperativas, en español. Resumen del contenido (la redacción final va en el código):

**Tipografía** — Dos Google Fonts de una lista curada de pares display+texto (`Fraunces`+`Inter`,
`Playfair Display`+`Source Sans 3`, `Sora`+`Inter`, `Libre Franklin`+`Lora`); elegir un par acorde al
tono del brief. Escala modular (~1.25), titulares grandes con peso, cuerpo 16-18px, line-height
1.5-1.7, jerarquía clara.

**Color** — Fondo neutro (blanco/gris muy claro), texto casi-negro (#1a1a1a), UN acento (el `primary`
del brief) solo en CTAs/links/detalles. Contraste AA. Prohibido: gradientes morado→rosa / azul→violeta
"de IA", fondos saturados a pantalla completa, texto gris claro sobre blanco.

**Ritmo y layout** — Ancho máx 1100-1200px centrado, whitespace generoso, padding de sección amplio y
consistente (≈96-120px desktop / 56-64px móvil), secciones alternando blanco / gris muy claro sin
líneas divisorias duras.

**Componentes e iconos** — Iconos SVG de un set consistente (lucide); NUNCA emojis como iconos.
Botones con hover, radios de borde y sombras sutiles uniformes, tarjetas homogéneas.

**Hero** — Sobre el pliegue: titular (`hero_copy`), subtítulo corto, UN CTA primario a booking, y
señal de confianza (⭐ nota media + nº reseñas reales). Con foto hero curada → úsala con buen contraste
de texto; sin foto → hero tipográfico limpio (nada de stock).

**Micro-interacciones** — Transiciones sutiles (fade/slide suave al entrar en viewport). Nada de
rebotes ni animaciones llamativas.

**Pulido (SEO/marca)** — Header con wordmark (nombre en la fuente display, no "Arial"). Favicon
(inicial o logo si viene). `<title>` + meta description reales; OG title/description/image (imagen =
portada curada o screenshot). Horario en tabla legible y NAP consistentes en footer, **solo si vienen
en el brief**.

**Lista negra de "AI tells" (prohibido explícito)** — Sin lorem ipsum. Sin stats inventadas
("+500 clientes", "Nº1"). Sin sellos/badges falsos. Sin todo centrado por defecto. Sin secciones
vacías de relleno. Sin stock genérico (solo las fotos curadas). Sin iconos-emoji.

---

## 4. El manifiesto de fotos (bloque determinista de `run.ts`)

- **Con fotos**: `Usa EXCLUSIVAMENTE estas fotos reales del negocio (no añadas stock): hero → {url}.
  Galería → {url}, {url}… Son fotos reales; respétalas, no las deformes ni recortes las caras.`
- **Sin fotos**: `No hay fotos disponibles. NO uses fotos de stock ni de relleno. Diseño tipográfico
  limpio: hero de texto, iconos para servicios, apóyate en el carrusel de reseñas como prueba social.`

---

## 5. Manejo de errores / degradación

| Fallo | Comportamiento |
|---|---|
| `raw_json` sin fotos | Curación devuelve vacío → web sin-fotos. Build sigue. |
| Visión falla / timeout | Tratar como "sin fotos" → web sin-fotos. Build sigue. |
| Descarga o re-host de una ganadora falla | Descartar esa foto; usar el resto. Si caen todas → sin-fotos. |
| URL de Google 404 al descargar | Descartar esa candidata. |

**Principio:** las fotos son un *nice-to-have*; **nunca** bloquean ni rompen el build. Peor una web
con foto rota o sin sentido que una web tipográfica limpia sin fotos.

---

## 6. Criterio de éxito

- **Métrica cuantitativa:** la nota 1-10 que ya calcula `analyze.ts` tras cada build. Comparar la
  mediana de las webs nuevas (post-Spec 1) contra las previas. Objetivo: subida clara y sostenida.
- **Cualitativo:** revisar a ojo 5-10 webs nuevas — ¿pasan el test de "parece hecha por un estudio,
  no por una IA"? Sin fotos sin sentido, sin gradiente morado, tipografía y ritmo intencionales.
- **Cero regresiones** en lo que ya funciona: carrusel de reseñas reales, CTA/badge a booking, ES,
  mobile-first, un solo tiro de build.

---

## 7. Archivos que se tocan

| Archivo | Cambio |
|---|---|
| `supabase/functions/_shared/website.ts` | + `extractPhotoCandidates(raw)` (puro) |
| `supabase/functions/_shared/prompts.ts` | + `DESIGN_SYSTEM`; adelgazar `BUILD_PROMPT` |
| `orquestador/photos.ts` | **nuevo** — curación por visión + re-host |
| `orquestador/run.ts` | PASO 2: curar fotos, ensamblar `variable + fotos + DESIGN_SYSTEM` |
| `orquestador/llm.ts` | + helper de visión (`llmVisionJson`) |
| `orquestador/reviews.ts` | + `fetchPhotosForPlace(placeId, { maxImages })` (molde de `fetchReviewsForPlace`) |
| `orquestador/preview.ts` | refactor: extraer `rehostToBucket(...)` genérico (lo usan captura y fotos) |

---

## 8. Fuera de alcance (explícito)

- Re-generar webs ya construidas/enviadas.
- Tocar el carrusel de reseñas o el badge de 397€ (son contrato, funcionan).
- El bucle de refinamiento por score (Spec 2) y el pulido con infra (Spec 3).
- WhatsApp/llamadas (fuera del proyecto).
