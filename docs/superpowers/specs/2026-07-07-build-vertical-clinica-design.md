# Spec — Build consciente de vertical (salud / estética) + fotos sin huecos

**Fecha:** 2026-07-07
**Objetivo:** que las webs de negocios de **salud/estética** (clínicas de medicina y cirugía
estética, dermatología, dental, fisioterapia…) tengan una **estructura y un contenido propios de la
vertical** — no las secciones genéricas de "un negocio local cualquiera" — usando **solo datos
reales**, y que la sección de fotos **nunca** se vea a medias (cajas vacías).
**Caso de prueba:** *Clínica Visalia — Medicina y Cirugía Estética*.
**Referencia visual (golden):** `docs/design-references/visalia-clinica-golden.html`.

**Alcance:** solo builds **nuevos** (no se re-generan webs ya construidas). Se tocan el **brief** y el
**BUILD_PROMPT** (contenido/estructura) + la **curación de fotos** (cobertura y layout). El
`DESIGN_SYSTEM` (gramática visual) **no se toca** — el pulido "de lujo" es otra palanca, fuera de este
spec.

---

## 1. Idea central

Hoy el pipeline es **agnóstico de vertical**: `BRIEF_PROMPT` propone una lista de secciones genérica
(`hero, servicios, resenas, galeria, reserva, contacto`) igual para un taller que para una clínica, y
las fotos salen de un único sitio (Google Maps) sin adaptar el layout a cuántas hay.

Este spec introduce **conciencia de vertical** en dos capas que ya existen, sin migración de BD:

1. **Contenido/estructura** (brief + build): el brief **infiere la vertical** desde `category` y, para
   salud/estética, emite el **plano de secciones de clínica** (orden del recorrido del paciente) y
   `services` como **categorías de tratamiento**. El BUILD_PROMPT aprende a renderizar esas secciones y
   repite los **guardarraíles médicos**.
2. **Fotos** (curación + manifiesto): se **amplía la cobertura** desde Maps y el **layout se adapta al
   número de fotos** (0/1/2/3+), de modo que la sección nunca muestra huecos.

**Regla de oro (se mantiene intacta):** *solo datos reales; si falta información, se omite — nunca se
inventa* ([BRIEF_PROMPT líneas 20-21], DESIGN_SYSTEM "nada de secciones vacías de relleno").

**Contexto que manda el diseño:** WebForge capta negocios **sin web** (`run-scrape` filtra
`onlyWithoutWebsite`). Por eso "traer fotos de su web propia" **no es una fuente**. La fuente honesta
hoy es Google Maps; la fuente rica para clínicas (su Instagram) queda para un spec posterior (§8).

---

## 2. El plano de secciones de clínica

Orden = recorrido del paciente. Cada sección se **omite** si no hay material real.

| # | Sección (slug) | Se puebla de | Si no hay dato |
|---|---|---|---|
| 1 | `hero` | `hero_copy` + señal de confianza (⭐ `rating` + `review_count` reales) + foto hero curada | hero tipográfico limpio (sin foto) |
| 2 | `tratamientos` | `services` = **categorías** de tratamiento (de `category` + lo que citen las reseñas). Sin procedimientos concretos inventados | omitir tarjetas sin base |
| 3 | `confianza` | `rating`/`review_count` + **profesional citado en `business.reviews`** (si aparece) + `value_props` reales. Credenciales/certificaciones **solo si constan** | omitir equipo/credenciales |
| 4 | `resenas` | carrusel de reseñas **reales** de Google (contrato existente, 6-8 transcritas literales) | — (siempre que haya reseñas) |
| 5 | `instalaciones` | fotos reales curadas del local (layout adaptativo, §4) | **omitir la sección entera** |
| 6 | `reserva` | CTA a `{{BOOKING_URL}}` + badge flotante 397€ (contrato) | — |
| 7 | `contacto` | NAP (dirección/teléfono) + horario, **solo lo que conste** | omitir lo que falte |

**Excluido a propósito** (no hay datos reales → se omite, no se rellena): **antes/después** (no hay
pares de imágenes reales y es médico), **financiación**, **sellos/certificaciones**.

---

## 3. Componentes y responsabilidades

### 3.1 `BRIEF_PROMPT` — consciente de vertical (`supabase/functions/_shared/prompts.ts`)
Se añade guía para que el modelo:
1. **Infiera la vertical** desde `category` (razonamiento general, no una tabla hardcodeada de todos los
   rubros) y elija un conjunto/orden de secciones acorde al recorrido de compra de esa vertical.
2. Para **salud/estética** siga el plano de §2 como ejemplo explícito: `recommended_sections` en ese
   **orden** e incluyendo **solo** las secciones con material real.
3. Emita `services` como **categorías de tratamiento** (p.ej. "Medicina estética facial", "Estética
   corporal", "Cirugía estética", "Láser y aparatología"), fundadas en `category` + reseñas. **Nunca**
   procedimientos concretos que no consten.
4. Mantenga intacta la regla de no inventar / omitir si falta.

Sin campos nuevos en el JSON del brief → **sin migración de BD**. El nombre del profesional NO se añade
como campo: lo surtirá el BUILD desde `business.reviews` (§3.2), que ya recibe.

### 3.2 `BUILD_PROMPT` — render de clínica + guardarraíles (`prompts.ts`)
Se añade:
- Cómo renderizar las secciones de clínica cuando aparecen en `recommended_sections`: `tratamientos`
  como **rejilla de tarjetas** limpia (icono + categoría + descripción breve); `confianza` como bloque
  con nota media + nº reseñas + (si `business.reviews` **nombra** a un/a profesional) un elemento de
  equipo con ese nombre y una cita real; si no lo nombran, **se omite** el elemento de equipo.
- **Guardarraíles médicos explícitos**: prohibido inventar antes/después, precios, credenciales,
  titulaciones o certificaciones. Si no consta, no se pone.
- **Layout de fotos adaptativo** (§4): la instrucción determinista la añade `run.ts` vía el manifiesto,
  pero el BUILD_PROMPT debe **no** forzar una rejilla de N huecos.
- **Se conservan intactos** (contrato): carrusel de reseñas reales, CTA + badge 397€, español,
  mobile-first, un solo tiro.

### 3.3 Cobertura de fotos desde Maps (`orquestador/reviews.ts`, `orquestador/run.ts`)
- Subir `maxImages` de la pasada 2 de fotos de **10 → 15-20** (más candidatas → más probabilidad de
  4-6 buenas tras curar). Coste marginal: es una sola llamada dirigida por lead aprobado.

### 3.4 Curación consciente de clínica (`orquestador/photos.ts`, `CURATION_SYSTEM`)
- **Mantener** el veto a **caras identificables en primer plano** (privacidad de pacientes; también
  descarta antes/después por la puerta de atrás).
- **Permitir explícitamente** para salud/estética: interior/instalaciones, aparatología/tecnología,
  equipo en contexto (sin primer plano de cara identificable), detalle profesional.
- Sesgo conservador intacto: en la duda, excluir.

### 3.5 Manifiesto de fotos adaptativo (`orquestador/photos.ts`, `photoManifest`)
`run.ts` conoce el nº real de fotos tras curar (`hero` + `gallery.length`). El manifiesto emite la
instrucción de layout **según ese conteo** (§4). Es determinista (no lo parafrasea el modelo).

### 3.6 `DESIGN_SYSTEM`
**Sin cambios.** La gramática visual actual vale; este spec es estructura/contenido y fotos.

---

## 4. Fotos: layout adaptativo por número (mata las cajas vacías)

`total = (hero ? 1 : 0) + gallery.length`, calculado en `run.ts`:

| `total` | Instrucción en el manifiesto |
|---|---|
| **0** | Sin fotos: diseño tipográfico limpio, iconos para tratamientos, apóyate en reseñas. **No** pintes sección de instalaciones. (comportamiento actual) |
| **1** | Una sola foto real: úsala como **imagen destacada** (hero grande o banda ancha). **No** hagas rejilla ni dejes huecos. |
| **2** | Dos fotos: layout en **dúo** (dos columnas equilibradas). Sin huecos. |
| **3+** | **Rejilla** de instalaciones con las fotos disponibles (sin celdas vacías). |

Principio: el nº de celdas = nº de fotos reales. **Nunca** se maqueta una rejilla fija con placeholders.

---

## 5. Manejo de errores / degradación

Se hereda el principio del build-calidad: **las fotos son un nice-to-have; nunca bloquean el build.**

| Fallo | Comportamiento |
|---|---|
| Maps no devuelve fotos | Curación vacía → `total=0` → web foto-ligera. Build sigue. |
| Curación descarta todo (caras/calidad) | `total=0` → web foto-ligera. |
| Reseñas no nombran profesional | Se omite el elemento de equipo en `confianza`. |
| Sin `category` reconocible como vertical | El brief cae al comportamiento genérico actual (no rompe). |

---

## 6. Criterio de éxito

- **Cuantitativo:** la nota 1-10 de `analyze.ts` tras el build. Comparar la mediana de clínicas nuevas
  contra el histórico. Objetivo: subida clara.
- **Cualitativo:** revisar a ojo builds de clínica — ¿estructura de clínica creíble, sin secciones de
  relleno, sin cajas de foto vacías, sin claims inventados?
- **Cero regresiones:** carrusel de reseñas reales, CTA/badge 397€, español, un solo tiro, no-inventar.

---

## 7. Archivos que se tocan

| Archivo | Cambio |
|---|---|
| `supabase/functions/_shared/prompts.ts` | `BRIEF_PROMPT` consciente de vertical; `BUILD_PROMPT` render de clínica + guardarraíles + no forzar rejilla |
| `orquestador/reviews.ts` | `fetchPhotosForPlace`: `maxImages` por defecto 10 → 15-20 |
| `orquestador/run.ts` | pasar el `maxImages` ampliado; (el manifiesto adaptativo ya se ensambla aquí) |
| `orquestador/photos.ts` | `CURATION_SYSTEM` consciente de clínica; `photoManifest` adaptativo por conteo |
| `docs/design-references/visalia-clinica-golden.html` | referencia (ya creado); anotar los estados 0/1/2 de fotos |

---

## 8. Fuera de alcance (explícito)

- **Instagram como fuente de fotos** — el salto de calidad real para clínicas (su IG suele estar en
  `raw_json.website`). **Spec posterior**: nuevo scraper de IG → misma curación → mismos guardarraíles.
- **Re-generar webs ya construidas/enviadas.**
- **Pulido visual "de lujo"** (paletas por categoría, tipografía premium por vertical).
- **Otras verticales** más allá del plano de clínica (el brief generaliza, pero solo escribimos el
  ejemplo de salud/estética ahora).
- Antes/después, financiación, WhatsApp/llamadas.

---

## 9. Nota de validación (entorno)

En este Mac los secretos están cifrados con git-crypt (`.env` bloqueado), así que **no corre ni el
build real ni `npm run dry-run`** (ambos necesitan la API key de Anthropic y Supabase). Hasta
desbloquear git-crypt, la validación es **visual sobre la maqueta golden** + revisión del texto de los
prompts. Con secretos desbloqueados: `npm run dry-run` (ver el prompt ensamblado), build real de un
lead de clínica, y comparación de score (§6).
