# Canal de contenido IG/TikTok — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Nota de esta ejecución:** el usuario autorizó ejecución autónoma inline en la misma
> sesión que escribió el plan. Los entregables son markdown (sin código ejecutable ni
> tests unitarios); la "verificación" de cada tarea es un chequeo de estructura y
> contenido contra la spec, no una suite de tests.

**Goal:** Dejar operativo el sistema de lotes semanales de contenido IG/TikTok: skill `/lote-contenido`, backlog de ganchos, calendario editorial con la semana 1 en borrador, checklist de setup y candidatos de avatar.

**Architecture:** Todo vive en el repo como markdown (sin infra): un skill de proyecto orquesta la sesión semanal contra el MCP de Higgsfield; dos archivos de estado (`hooks.md`, `calendario.md`) hacen de backlog y cola; un `SETUP.md` recoge lo que solo Nico puede hacer (cuentas, elegir avatar/voz).

**Tech Stack:** Claude Code project skills (`.claude/skills/`), MCP Higgsfield (generate_image/video, create_voice, shorts_studio, virality_predictor, balance), Google Drive (carpeta de entrega), markdown.

**Spec:** `docs/superpowers/specs/2026-07-06-canal-contenido-ig-tiktok-design.md`

## Global Constraints

- Idioma de todo el contenido y los archivos: **español (España)**. Audiencia: dueños de negocios locales.
- Línea editorial única: *"estás perdiendo clientes porque nadie puede reservar fuera de horario — una web perfecta con reservas automatizadas lo arregla"*.
- Gate de aprobación humana: **ningún vídeo/imagen de contenido se genera sin visto bueno de Nico en sesión**. (Los candidatos de avatar del setup son la única generación autorizada en este plan.)
- Cadencia: 3-4 posts/semana. Formatos: mini-escena, avatar presentador, antes/después, imagen/carrusel opcional.
- Copy "texto plano, humano, sin pinta de plantilla" (mismo criterio que el outreach de WebForge).
- Solo inbound: nada de DMs ni captación en frío desde el perfil.
- No tocar orquestador, Edge Functions ni pipeline existente. Commits solo de archivos nuevos de este plan.

---

### Task 1: Backlog de ganchos — `marketing/social/hooks.md`

**Files:**
- Create: `marketing/social/hooks.md`

**Interfaces:**
- Produces: backlog que `/lote-contenido` (Task 3) lee al inicio de cada sesión. Formato: tabla con columnas `ID | Gancho | Formato sugerido | Estado (libre/usado semana X)`.

- [ ] **Step 1: Escribir el archivo** con: (a) cabecera explicando qué es y cómo se mantiene; (b) 12-15 ganchos concretos alrededor del ángulo de reservas perdidas, repartidos en 4 familias: dolor nocturno/fuera de horario ("son las 21:30 y tu negocio no coge reservas"), coste invisible cuantificado ("cada semana sin reservas online = X clientes al competidor"), fricción del cliente ("nadie llama por teléfono ya para reservar"), y prueba/transformación (antes/después de webs reales de WebForge con reservas). Cada gancho con formato sugerido (mini-escena / avatar / antes-después / carrusel); (c) sección "Cómo añadir ganchos" (se alimenta de métricas y objeciones reales de leads).
- [ ] **Step 2: Verificar** que ningún gancho suena a plantilla genérica de marketing y que todos atacan el ángulo de reservas (no el genérico "necesitas una web").
- [ ] **Step 3: Commit** — `git add marketing/social/hooks.md && git commit -m "feat(social): backlog inicial de ganchos del canal IG/TikTok"`

### Task 2: Calendario editorial — `marketing/social/calendario.md`

**Files:**
- Create: `marketing/social/calendario.md`

**Interfaces:**
- Consumes: IDs de ganchos de `hooks.md` (Task 1).
- Produces: cola de publicación que `/lote-contenido` (Task 3) actualiza. Estados por post: `borrador → aprobado → generado → publicado`. Entrada semanal: tabla `Día | Formato | Gancho (ID) | Guion/Asset | Estado`.

- [ ] **Step 1: Escribir el archivo** con: (a) leyenda de estados y convención de nombres de la carpeta Drive (`WebForge Social/<año>-W<semana>/`); (b) entrada de la **semana 1 (2026-W28)** con 4 posts en estado `borrador`, cada uno con su guion completo listo para que Nico apruebe/edite en la primera sesión: 1 mini-escena dramatizada, 1 avatar presentador con tip+CTA, 1 antes/después de web real (marcado como "elegir web aprobada del panel"), 1 carrusel con dato. Guiones de 40-70 palabras (15-30s), en el tono del copy de WebForge.
- [ ] **Step 2: Verificar** coherencia: cada post referencia un ID existente en `hooks.md` y esos ganchos quedan marcados `usado semana 2026-W28 (borrador)`.
- [ ] **Step 3: Commit** — `git add marketing/social/calendario.md marketing/social/hooks.md && git commit -m "feat(social): calendario editorial con semana 1 en borrador"`

### Task 3: Skill del lote semanal — `.claude/skills/lote-contenido/SKILL.md`

**Files:**
- Create: `.claude/skills/lote-contenido/SKILL.md`

**Interfaces:**
- Consumes: `marketing/social/hooks.md`, `marketing/social/calendario.md`, `marketing/social/SETUP.md` (Task 4: identidad avatar/voz/preset), MCP Higgsfield.
- Produces: el flujo ejecutable `/lote-contenido` (7 pasos de la spec).

- [ ] **Step 1: Escribir el SKILL.md** con frontmatter (`name: lote-contenido`, `description` con triggers "lote de contenido", "posts de la semana", "contenido IG/TikTok") y el flujo en 7 pasos numerados, cada uno con las herramientas MCP exactas:
  1. **Reconciliar semana anterior**: preguntar a Nico qué se publicó y métricas (views/guardados/DMs); actualizar estados en `calendario.md`; anotar aprendizajes como candidatos a gancho en `hooks.md`.
  2. **Comprobar presupuesto**: `balance` de Higgsfield; si el saldo no da para la mezcla estándar, proponer mezcla degradada (2 vídeos + 2 imágenes).
  3. **Proponer 4 guiones** desde ganchos `libres` de `hooks.md` (o los `borrador` ya escritos); presentarlos con AskUserQuestion para aprobar/editar. **GATE: sin aprobación no se genera nada.**
  4. **Generar assets** con la identidad fija de `SETUP.md` (avatar, voz, preset de Shorts Studio): `generate_video`/`shorts_studio_create` para vídeos, `generate_image` para carruseles; `virality_predictor` opcional sobre los vídeos; regenerar como máximo 1 vez por asset sin re-consultar.
  5. **Caption + hashtags** por post: caption corto y humano, 3-5 hashtags locales/nicho, recordatorio de etiqueta "creado con IA" si el avatar es fotorrealista.
  6. **Entregar**: subir/mover assets a la carpeta Drive de la semana; actualizar `calendario.md` (estado `generado`, día asignado, URL del asset).
  7. **Cierre**: resumen a Nico (qué publicar qué día, con caption listo para copiar) y marcar ganchos usados en `hooks.md`.
- [ ] **Step 2: Verificar** contra la spec §"Flujo semanal": los 7 pasos presentes, el gate explícito, la mezcla degradada por créditos, y que el skill NO publica ni envía nada.
- [ ] **Step 3: Commit** — `git add .claude/skills/lote-contenido/SKILL.md && git commit -m "feat(social): skill /lote-contenido (lote semanal con gate de aprobación)"`

### Task 4: Checklist de setup — `marketing/social/SETUP.md`

**Files:**
- Create: `marketing/social/SETUP.md`

**Interfaces:**
- Consumes: URLs de candidatos de avatar (Task 5).
- Produces: sección "Identidad" que `/lote-contenido` lee (avatar elegido, voz, preset). Hasta que Nico la complete, el skill debe avisar de que falta setup.

- [ ] **Step 1: Escribir el archivo** con dos bloques: (a) **Solo Nico** — crear cuenta IG Business y TikTok de empresa (con notas de por qué Business: métricas + API futura), handle sugerido, bio sugerida con CTA a WebForge, activar etiqueta IA; (b) **Identidad de contenido** — elegir avatar entre los candidatos (URLs de Task 5), crear voz (`create_voice`) y preset de Shorts Studio en la primera sesión de `/lote-contenido`, y anotar aquí los IDs/nombres elegidos.
- [ ] **Step 2: Commit** — `git add marketing/social/SETUP.md && git commit -m "feat(social): checklist de setup del canal (cuentas + identidad)"`

### Task 5: Candidatos de avatar (Higgsfield)

**Files:**
- Modify: `marketing/social/SETUP.md` (añadir URLs de candidatos)

**Interfaces:**
- Consumes: `balance` (solo si el saldo lo permite holgadamente).
- Produces: 3 imágenes candidatas de presentador/a (retrato fotorrealista, luz natural, fondo neutro de negocio local, 30-40 años, cercano/profesional) con sus URLs en `SETUP.md`.

- [ ] **Step 1: Comprobar `balance`**. Si el saldo es bajo (< ~10× el coste estimado de un lote), SALTAR la generación y anotarlo en `SETUP.md`.
- [ ] **Step 2: Generar 3 candidatos** con `generate_image` (una llamada por candidato, variando género/estilo entre ellos). Sin upscale ni variaciones extra.
- [ ] **Step 3: Añadir las URLs a `SETUP.md`** con nota "elegir 1 en la primera sesión".
- [ ] **Step 4: Commit** — `git add marketing/social/SETUP.md && git commit -m "feat(social): candidatos de avatar para la identidad del canal"`

### Task 6: Memoria de proyecto

**Files:**
- Create: `~/.claude/projects/-Users-nico-WebForge-v1/memory/canal-contenido-ig-tiktok.md`
- Modify: `~/.claude/projects/-Users-nico-WebForge-v1/memory/MEMORY.md` (añadir 1 línea)

- [ ] **Step 1: Escribir la memoria** (type: project): qué es el canal, dónde viven spec/plan/skill/estado, que el gate de aprobación aplica también aquí, y que Higgsfield MCP no funciona headless (por eso lote semanal interactivo).
- [ ] **Step 2: Añadir el puntero en MEMORY.md.**

### Task 7: Verificación final

- [ ] **Step 1:** Releer spec y comprobar: cada sección tiene su artefacto; `hooks.md` ↔ `calendario.md` consistentes; el skill referencia rutas que existen.
- [ ] **Step 2:** `git log --oneline` — commits limpios, solo archivos del plan.
- [ ] **Step 3:** Resumen final para Nico: qué queda hecho, qué le toca a él (SETUP.md), y cómo lanzar la primera sesión (`/lote-contenido`).
