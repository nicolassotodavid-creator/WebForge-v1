# Build consciente de vertical (salud/estética) + fotos sin huecos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que las webs de negocios de salud/estética tengan estructura y contenido propios de la vertical (solo datos reales) y que la sección de fotos nunca se vea a medias.

**Architecture:** Se añade conciencia de vertical en dos capas que ya existen, sin migración de BD: (1) contenido/estructura en `BRIEF_PROMPT` + `BUILD_PROMPT`, y (2) fotos en `photos.ts` (curación consciente de clínica + manifiesto adaptativo por nº de fotos) y `reviews.ts`/`run.ts` (más cobertura). El `DESIGN_SYSTEM` no se toca.

**Tech Stack:** TypeScript. Orquestador Node (tsx). Constantes de prompt en `supabase/functions/_shared/prompts.ts` (compartidas Deno/Node). Tests puros con `node --experimental-strip-types --test`.

**Spec:** `docs/superpowers/specs/2026-07-07-build-vertical-clinica-design.md`
**Referencia visual:** `docs/design-references/visalia-clinica-golden.html`

## Global Constraints

- **Solo builds nuevos.** No se re-generan webs ya construidas/enviadas.
- **Solo datos reales; si falta, se OMITE — NUNCA se inventa.** Prohibido inventar servicios, precios, antes/después, credenciales, titulaciones o certificaciones.
- **Contrato intacto:** carrusel de reseñas reales (6-8, transcritas literales), CTA + badge flotante 397€ → `{{BOOKING_URL}}`, español, mobile-first, un solo tiro de build.
- **`DESIGN_SYSTEM` no se toca.**
- **Sin migración de BD** — sin campos nuevos en el JSON del brief.
- **Instagram fuera de alcance** (spec posterior).
- **Validación limitada en este Mac:** los secretos están cifrados con git-crypt, así que el build real y `npm run dry-run` NO corren aquí (necesitan la API key de Anthropic y Supabase). La verificación por tarea es `npm run typecheck` + los tests puros de `photos.ts`. La validación E2E (dry-run + build + score) queda pendiente de desbloquear git-crypt.
- Todos los comandos se ejecutan desde `orquestador/` dentro del worktree salvo que se indique otra ruta.

---

## Setup: commitear los artefactos de planificación

- [ ] **Paso 1: Commit del spec + maqueta + este plan** (están sin trackear en el worktree)

```bash
cd /Users/nico/WebForge-v1/.claude/worktrees/build-vertical-clinica
git add docs/superpowers/specs/2026-07-07-build-vertical-clinica-design.md \
        docs/design-references/visalia-clinica-golden.html \
        docs/superpowers/plans/2026-07-07-build-vertical-clinica.md
git commit -m "docs(build-calidad): spec, maqueta golden y plan de build vertical de clínica"
```

---

## Task 1: Manifiesto de fotos adaptativo por nº de fotos

Mata las "cajas vacías": el nº de celdas = nº de fotos reales. Es la única lógica pura nueva → TDD.

**Files:**
- Modify: `orquestador/photos.ts` (función `photoManifest`, ~líneas 79-92)
- Test: `orquestador/photos.test.ts` (añadir casos)

**Interfaces:**
- Consumes: `CuratedPhotos { hero: string | null; gallery: string[] }` (ya existe en `photos.ts`).
- Produces: `photoManifest(photos: CuratedPhotos): string` — misma firma; cambia el texto emitido según `total = (hero?1:0) + gallery.length`.

- [ ] **Step 1: Escribir los tests que fallan** — añadir al final de `orquestador/photos.test.ts`, ANTES de la línea que imprime el resumen/`process.exit` (busca `failures`):

```ts
// --- Task 1: manifiesto adaptativo por nº de fotos ---
{
  const m = photoManifest({ hero: "http://x/h.jpg", gallery: [] });
  assertEq(m.includes("imagen destacada"), true, "1 foto → imagen destacada");
}
{
  const m = photoManifest({ hero: "http://x/h.jpg", gallery: ["http://x/g.jpg"] });
  assertEq(m.includes("dúo"), true, "2 fotos → dúo");
}
{
  const m = photoManifest({ hero: "http://x/h.jpg", gallery: ["http://x/g1.jpg", "http://x/g2.jpg"] });
  assertEq(m.includes("rejilla de instalaciones"), true, "3 fotos → rejilla");
}
{
  const m = photoManifest({ hero: null, gallery: [] });
  assertEq(m.includes("NO incluyas"), true, "0 fotos → omite la sección");
}
```

- [ ] **Step 2: Correr los tests y verlos fallar**

Run: `node --experimental-strip-types --test photos.test.ts`
Expected: FAIL — las nuevas aserciones dan `✗` (got false, want true) y el proceso sale con código ≠ 0.

- [ ] **Step 3: Implementar** — reemplazar la función `photoManifest` en `orquestador/photos.ts` por:

```ts
export function photoManifest(photos: CuratedPhotos): string {
  const total = (photos.hero ? 1 : 0) + photos.gallery.length;
  if (total === 0) {
    return [
      "FOTOS: No hay fotos disponibles de este negocio.",
      "NO uses fotos de stock ni imágenes de relleno. Construye un diseño tipográfico limpio:",
      "hero de texto, iconos para los servicios, y apóyate en el carrusel de reseñas como prueba social.",
      "NO incluyas una sección de galería/instalaciones vacía.",
    ].join(" ");
  }
  const lines = ["FOTOS: usa EXCLUSIVAMENTE estas fotos reales del negocio (no añadas stock)."];
  if (photos.hero) lines.push(`Hero (foto principal): ${photos.hero}`);
  if (photos.gallery.length) lines.push(`Galería: ${photos.gallery.join(", ")}`);
  // Layout adaptativo: el nº de celdas = nº de fotos reales. NUNCA una cuadrícula con huecos.
  if (total === 1) {
    lines.push("Solo hay UNA foto: úsala como imagen destacada (hero grande o banda ancha). No montes galería en cuadrícula ni dejes huecos.");
  } else if (total === 2) {
    lines.push("Hay DOS fotos: preséntalas en dúo (dos columnas equilibradas). No dejes celdas vacías.");
  } else {
    lines.push(`Hay ${total} fotos: rejilla de instalaciones usando EXACTAMENTE esas fotos, sin celdas vacías.`);
  }
  lines.push("Son fotos reales; respétalas, no las deformes ni recortes las caras.");
  return lines.join(" ");
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `node --experimental-strip-types --test photos.test.ts`
Expected: PASS — todas las aserciones `✓`, incluidas las 4 nuevas; `# fail 0`.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: sin salida de error (exit 0).

- [ ] **Step 6: Commit**

```bash
git add orquestador/photos.ts orquestador/photos.test.ts
git commit -m "feat(fotos): manifiesto adaptativo por nº de fotos (0/1/2/3+) — sin cajas vacías"
```

---

## Task 2: Ampliar la cobertura de fotos desde Maps

Más candidatas reales → más probabilidad de 4-6 buenas tras curar. Cambio de constante; se verifica con typecheck.

**Files:**
- Modify: `orquestador/reviews.ts` (`fetchPhotosForPlace`, línea del default `?? 10`)
- Modify: `orquestador/run.ts` (llamada `fetchPhotosForPlace(photoPlaceId, { maxImages: 10 })`, ~línea 221)

**Interfaces:**
- Consumes: `fetchPhotosForPlace(placeId: string, opts?: { maxImages?: number })` (ya existe).
- Produces: mismo contrato; solo cambia el nº por defecto (10 → 15). Nota: `MAX_CANDIDATES = 15` en `photos.ts` es el techo efectivo tras dedup, así que 15 alinea sin desperdiciar coste de visión.

- [ ] **Step 1: Subir el default en `reviews.ts`** — reemplazar:

```ts
  const maxImages = opts.maxImages ?? 10;
```

por:

```ts
  const maxImages = opts.maxImages ?? 15;
```

- [ ] **Step 2: Subir el valor explícito en `run.ts`** — reemplazar:

```ts
        const fetchedPhotos = await fetchPhotosForPlace(photoPlaceId, { maxImages: 10 });
```

por:

```ts
        const fetchedPhotos = await fetchPhotosForPlace(photoPlaceId, { maxImages: 15 });
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: exit 0, sin errores.

- [ ] **Step 4: Commit**

```bash
git add orquestador/reviews.ts orquestador/run.ts
git commit -m "feat(fotos): más candidatas de Maps (maxImages 10→15) para la curación"
```

---

## Task 3: Curación consciente de clínica

La curación por visión debe seguir vetando caras de pacientes (privacidad; descarta antes/después de paso) pero NO descartar instalaciones, aparatología ni equipo. Cambio en el system prompt.

**Files:**
- Modify: `orquestador/photos.ts` (constante `CURATION_SYSTEM`, ~líneas 94-100)

**Interfaces:** ninguna nueva — solo cambia el texto del system prompt; `curatePhotos` y `parseCurationResponse` no cambian de firma.

- [ ] **Step 1: Reemplazar `CURATION_SYSTEM`** en `orquestador/photos.ts` por:

```ts
const CURATION_SYSTEM = `Eres director de arte seleccionando fotos para la web profesional de un negocio.
Recibes varias imágenes numeradas desde 0 y los datos del negocio. Devuelve ÚNICAMENTE un objeto JSON
válido (sin markdown): { "order": [índices] }, con los índices de las 4-6 MEJORES fotos, la primera = la
mejor para el hero. Incluye SOLO fotos que sean: (a) de buena calidad y CLARAMENTE relevantes a este
negocio —para clínicas de salud/estética son muy relevantes las INSTALACIONES, la APARATOLOGÍA/tecnología
y el EQUIPO en contexto—, y (b) seguras para publicar: NADA de caras identificables en primer plano
(fuera fotos de pacientes y antes/después), capturas de pantalla, tiques, menús como texto, memes, ni
fotos borrosas u oscuras. Si ninguna cumple con confianza, devuelve { "order": [] }. Ante la duda,
EXCLUYE (mejor sin foto que una foto mala).`;
```

- [ ] **Step 2: Correr los tests puros** (no deben romperse: `parseCurationResponse`/`photoManifest` no cambian)

Run: `node --experimental-strip-types --test photos.test.ts`
Expected: PASS, `# fail 0`.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add orquestador/photos.ts
git commit -m "feat(fotos): curación consciente de clínica (instalaciones/equipo sí; caras de pacientes no)"
```

---

## Task 4: `BRIEF_PROMPT` consciente de vertical

El brief infiere la vertical desde `category` y, para salud/estética, emite el plano de secciones de clínica y `services` como categorías de tratamiento. Prompt text → se verifica con typecheck + inspección; la validación de comportamiento es por dry-run cuando se desbloquee git-crypt.

**Files:**
- Modify: `supabase/functions/_shared/prompts.ts` (`BRIEF_PROMPT`, ~líneas 5-22)

**Interfaces:** el esquema JSON del brief NO cambia (sin campos nuevos → sin migración). Solo se enriquece la guía de cómo rellenar `recommended_sections` y `services`.

- [ ] **Step 1: Insertar la guía de vertical** en `BRIEF_PROMPT`, justo ANTES de la línea `Reglas: todo en español...`, añadir este bloque:

```
Antes de rellenar el JSON, INFIERE la vertical del negocio desde `category` y ajusta la estructura al
recorrido de compra de esa vertical (no uses una lista de secciones genérica por defecto):
- `recommended_sections` va EN EL ORDEN adecuado a la vertical e incluye SOLO las secciones con material
  real (omite las que no puedas sostener con datos).
- SALUD/ESTÉTICA (clínica de medicina/cirugía estética, dermatología, dental, fisioterapia, etc.): usa
  el orden ["hero","tratamientos","confianza","resenas","instalaciones","reserva","contacto"], incluyendo
  solo las que apliquen. Para esta vertical, `services` son CATEGORÍAS de tratamiento (p.ej. "Medicina
  estética facial", "Estética corporal", "Cirugía estética", "Láser y aparatología"), fundadas en
  `category` y en lo que citen las reseñas. NUNCA inventes procedimientos concretos, precios,
  antes/después, credenciales ni certificaciones: si no consta, se omite.
```

- [ ] **Step 2: Verificar que el texto quedó en la constante**

Run: `grep -c "SALUD/ESTÉTICA" supabase/functions/_shared/prompts.ts`
Expected: `1`

- [ ] **Step 3: Typecheck** (la constante es un template string; confirma que no se rompió la sintaxis)

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/_shared/prompts.ts
git commit -m "feat(brief): BRIEF_PROMPT consciente de vertical (plano de clínica salud/estética)"
```

---

## Task 5: `BUILD_PROMPT` render de clínica + guardarraíles médicos

El BUILD_PROMPT aprende a renderizar bien las secciones de clínica y repite los guardarraíles médicos. Prompt text.

**Files:**
- Modify: `supabase/functions/_shared/prompts.ts` (`BUILD_PROMPT`, ~líneas 36-66)

**Interfaces:** el BUILD ya recibe `business.reviews` (de dónde saca el profesional citado). El manifiesto de fotos (Task 1) ya le dice el layout adaptativo; aquí solo se le prohíbe forzar una rejilla.

- [ ] **Step 1: Añadir las reglas de clínica** en `BUILD_PROMPT`, dentro de la lista "El prompt que generes debe pedir…", justo ANTES de la línea `- Sin texto de relleno tipo lorem ipsum…`, insertar:

```
- Si recommended_sections incluye secciones de clínica (salud/estética), constrúyelas con datos REALES:
  · "tratamientos": rejilla de tarjetas limpias (icono + categoría + descripción breve) a partir de
    services. Son CATEGORÍAS; no listes procedimientos concretos que no consten.
  · "confianza": bloque con la nota media y nº de reseñas reales + las value_props. Si business.reviews
    NOMBRA a un/a profesional, destácalo con su nombre y UNA cita real; si no lo nombran, OMITE el
    elemento de equipo. No inventes titulaciones, colegiación ni certificaciones.
  · "instalaciones": galería de las fotos reales curadas respetando el bloque FOTOS (no fuerces una
    cuadrícula con huecos; si no hay fotos, no incluyas la sección).
- GUARDARRAÍLES (obligatorio): nunca incluyas antes/después, precios, financiación, credenciales,
  titulaciones ni certificaciones que no vengan en los datos. Si no consta, se omite.
```

- [ ] **Step 2: Verificar que el texto quedó en la constante**

Run: `grep -c "GUARDARRAÍLES" supabase/functions/_shared/prompts.ts`
Expected: `1`

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/_shared/prompts.ts
git commit -m "feat(build): BUILD_PROMPT renderiza secciones de clínica + guardarraíles médicos"
```

---

## Task 6: Anotar los estados de foto en la maqueta golden

La maqueta muestra el estado "3+ fotos". Dejar documentados los estados 0/1/2 para que sea referencia completa (spec §7). Doc-only, sin nuevas maquetas.

**Files:**
- Modify: `docs/design-references/visalia-clinica-golden.html` (comentario de cabecera)

- [ ] **Step 1: Añadir al comentario `<!-- MAQUETA "GOLDEN" … -->`** de cabecera, antes del cierre `-->`, estas líneas:

```
  · La sección "Instalaciones" es ADAPTATIVA por nº de fotos reales curadas:
      0 → se omite (web foto-ligera: tipografía + iconos + reseñas)
      1 → una imagen destacada (sin cuadrícula)
      2 → dúo (dos columnas)
      3+ → rejilla (este es el estado que muestra la maqueta)
    El nº de celdas = nº de fotos reales. NUNCA una rejilla con huecos.
```

- [ ] **Step 2: Verificar**

Run: `grep -c "ADAPTATIVA por nº de fotos" docs/design-references/visalia-clinica-golden.html`
Expected: `1`

- [ ] **Step 3: Commit**

```bash
git add docs/design-references/visalia-clinica-golden.html
git commit -m "docs(maqueta): anotar los estados 0/1/2/3+ de la sección de fotos"
```

---

## Cierre

- [ ] **Verificación final del worktree**

```bash
cd orquestador
npm run typecheck                                   # exit 0
node --experimental-strip-types --test photos.test.ts   # # fail 0
```

- [ ] **Pendiente (fuera de este plan, requiere desbloquear git-crypt):** `npm run dry-run` para inspeccionar el prompt ensamblado de un lead de clínica, build real de un lead, y comparación del score de `analyze` contra el histórico (spec §6). Después: decidir el merge a `main` y, si aplica, la regeneración controlada de clínicas ya construidas (con el ojo puesto en no romper `live_url` ya enviadas).
