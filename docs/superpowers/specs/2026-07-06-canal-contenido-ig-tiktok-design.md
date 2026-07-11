# Canal de contenido IG/TikTok para WebForge — diseño

**Fecha:** 2026-07-06
**Estado:** aprobado en brainstorming, pendiente de plan de implementación

## Objetivo

Perfil de marca en Instagram y TikTok (mismo contenido vertical 9:16 en ambos) cuyo fin
es **captar clientes para WebForge**: dueños de negocios locales en España, en español.
Es un canal inbound complementario al pipeline existente (email/LinkedIn); no lo sustituye
ni lo toca.

**Línea editorial única:** *"estás perdiendo clientes porque nadie puede reservar en tu
negocio fuera de horario — una web perfecta con reservas automatizadas lo arregla"*.
Todo el contenido ataca ese dolor desde distintos ángulos.

## Decisiones tomadas

| Decisión | Elección |
|---|---|
| Objetivo | Captación de clientes para WebForge (no marca personal, no experimento) |
| Ángulo editorial | Pérdida de clientes por falta de reservas automatizadas + web perfecta |
| Publicación | Semi-manual con cola: el sistema genera el pack completo, Nico publica desde el móvil |
| Cadencia | 3-4 posts/semana |
| Runtime de generación | Lote semanal en sesión interactiva de Claude Code (skill `/lote-contenido`) |
| Cola/almacenamiento | Incremental: archivos (Drive + markdown) primero; panel/Supabase solo si hay señal en 3-4 semanas |

## Por qué estas decisiones

- **Publicar es el cuello de botella, no generar.** No hay hoy herramienta conectada que
  publique en IG/TikTok (Postoro está en waitlist; las APIs de Meta/TikTok requieren
  semanas de setup). El semi-manual arranca esta semana con cero fricción.
- **El MCP de Higgsfield es un conector de claude.ai autenticado interactivamente**: en
  cron headless (VPS/orquestador) probablemente no está disponible. Por eso la generación
  vive en una sesión interactiva semanal, no en el cron.
- **El gate de aprobación humana se mantiene** (misma disciplina que el gate de QA de
  WebForge), pero al aprobar Nico en vivo dentro de la sesión, no hace falta panel: la
  sesión ES el gate.
- **YAGNI:** no se monta infra (tablas, bucket, sección de panel) para un canal aún no
  validado.

## Identidad de contenido (setup una sola vez)

Creado en Higgsfield y reutilizado en todos los vídeos:

1. **Avatar presentador consistente** — un personaje fijo (misma cara en todos los clips).
2. **Voz fija** — creada con `create_voice`; misma voz en narraciones y talking-head.
3. **Preset de estilo en Shorts Studio** — estética consistente (color, ritmo, subtítulos).

Si el avatar es fotorrealista, cada post lleva la etiqueta "creado con IA" que exigen
IG/TikTok.

## Mezcla semanal (3-4 posts)

1. **Mini-escena dramatizada del dolor** (15-25s): p. ej. "Son las 21:30, María busca
   dónde reservar; tu negocio no sale; reserva en el de al lado".
2. **Avatar presentador con tip + CTA** (15-30s): "¿cuántas reservas pierdes mientras
   duermes?".
3. **Antes/después de una web real de WebForge** con el módulo de reservas en acción
   (scroll narrado). Reutiliza las webs y capturas que ya produce el pipeline
   (`live_url`, `preview_image_url`).
4. *(Opcional)* **Imagen/carrusel** con dato o mini-caso — lo más barato si hay que
   estirar créditos.

Todos rematan con CTA suave hacia el perfil/link de WebForge.

## Flujo semanal — skill `/lote-contenido`

Skill de proyecto en `.claude/skills/lote-contenido/` de este repo. Una sesión de
~20-30 min a la semana:

1. **Repaso de métricas** de la semana anterior (Nico pasa views/guardados/DMs) →
   ajustar ángulos del backlog.
2. **Propuesta de guiones**: leer `marketing/social/hooks.md` (backlog de ganchos) y
   proponer 4 guiones.
3. **Gate de aprobación**: Nico aprueba/edita en vivo. Nada se genera sin visto bueno.
4. **Generación** con Higgsfield: avatar + voz + preset fijos; `virality_predictor`
   como chequeo opcional antes de dar por bueno un vídeo.
5. **Caption + hashtags** de cada post (texto plano, humano, sin pinta de plantilla —
   mismo criterio que el mensaje en frío de WebForge).
6. **Entrega**: assets a una carpeta de Drive (`WebForge Social/<año>-<semana>/`) para
   tenerlos en el móvil; calendario actualizado en `marketing/social/calendario.md`
   (post, día asignado, estado: pendiente/publicado).
7. **Publicación**: Nico publica desde el móvil el día que toque. El estado se
   reconcilia al inicio del siguiente lote.

### Artefactos en el repo

- `.claude/skills/lote-contenido/SKILL.md` — el flujo de arriba, ejecutable.
- `marketing/social/hooks.md` — backlog de ganchos/ángulos; cada lote marca los usados
  y añade nuevos según métricas.
- `marketing/social/calendario.md` — calendario editorial con estado por post.

## Riesgos y límites

- **Créditos Higgsfield:** en el primer lote se comprueba el saldo (`balance`) y se
  dimensiona la mezcla; si el vídeo sale caro, bajar a 2 vídeos + 2 imágenes/carruseles.
- **Solo inbound:** nada de DMs automatizados ni captación en frío desde el perfil
  (coherente con las reglas duras de WebForge).
- **Cuentas:** IG **Business** y TikTok de empresa desde el día 1 — necesario para
  métricas y prerequisito del scheduler por API si llega la fase 2.
- **Etiquetado IA** obligatorio en contenido con avatar fotorrealista.

## Fuera de alcance

- Publicación automática (APIs de Meta/TikTok, Postoro cuando salga de waitlist,
  schedulers tipo Metricool). Candidato a fase 2.
- Sección en el panel + tablas Supabase (`content_posts`). Solo si en 3-4 semanas el
  canal da señal (views, visitas al perfil, DMs entrantes).
- Cualquier cambio al orquestador o al pipeline de outreach existente.

## Criterio de éxito de la fase 1

Tras 4 lotes semanales (~14 posts): decidir con datos si el canal merece la fase 2
(automatizar publicación + métricas en panel), seguir igual, o cerrarse.
