---
name: lote-contenido
description: Sesión semanal del canal IG/TikTok de WebForge — genera el lote de 3-4 posts (vídeos con Higgsfield + captions) con gate de aprobación humana. Usar cuando Nico pida "lote de contenido", "posts de la semana", "contenido para Instagram/TikTok" o toque preparar la semana del canal social.
---

# /lote-contenido — lote semanal del canal IG/TikTok

Sesión de ~20-30 min que deja la semana lista para publicar. Estado del canal:
`marketing/social/hooks.md` (backlog), `marketing/social/calendario.md` (cola),
`marketing/social/SETUP.md` (identidad: avatar, voz, preset).

**Reglas duras (heredan de CLAUDE.md y de la spec):**
- NADA se genera sin aprobación explícita de Nico en esta sesión (gate de QA).
- Este skill NO publica en ninguna red y NO envía mensajes a nadie. Solo genera y encola.
- Copy en español, texto humano, sin pinta de plantilla. Un dato/cifra solo si es verificable.
- Posts con avatar fotorrealista → recordar la etiqueta "creado con IA" al publicar.

**Prerequisito:** si la sección "Identidad de contenido" de `SETUP.md` está incompleta
(sin avatar elegido, sin voz), avisar a Nico y resolverla ANTES del paso 4 (el paso 1-3
puede hacerse igualmente).

## Flujo (7 pasos, en orden)

### 1. Reconciliar la semana anterior
- Leer `calendario.md`. Preguntar a Nico: ¿qué se publicó de la semana pasada y qué métricas tuvo? (views, guardados, visitas al perfil, DMs).
- Actualizar estados (`generado` → `publicado`), mover la semana cerrada a "Histórico" con sus métricas.
- Si algún ángulo funcionó/fracasó claramente, anotarlo en `hooks.md` (nuevo gancho o nota en la familia).

### 2. Comprobar presupuesto
- `mcp: balance` de Higgsfield.
- Mezcla estándar: 3 vídeos + 1 carrusel. Si el saldo no da holgadamente para el lote (estimar con el coste del lote anterior; primera vez: generar el vídeo más corto primero y extrapolar), proponer a Nico la mezcla degradada: 2 vídeos + 2 imágenes/carruseles.

### 3. Proponer 4 guiones — GATE DE APROBACIÓN
- Tomar los posts en `borrador` del calendario si los hay; completar hasta 4 con ganchos `libres` de `hooks.md` (variar familias y formatos).
- Para el antes/después: elegir una web real con `status='approved'` del panel (necesita `live_url` y `preview_image_url`) y adaptar el guion al negocio.
- Presentar los 4 guiones con AskUserQuestion (aprobar / editar / descartar cada uno).
- **Sin visto bueno de Nico no se genera NADA.** Los aprobados pasan a `aprobado` en el calendario.

### 4. Generar assets
- Identidad fija desde `SETUP.md`: avatar (imagen/character de referencia), voz (`speak.voice_id`) y preset de Shorts Studio si existe.
- Vídeos: `mcp: generate_video` (o `shorts_studio_create` para el flujo de shorts con subtítulos), formato vertical 9:16, 15-30s. Imágenes/carrusel: `mcp: generate_image`.
- Opcional: pasar los vídeos por `mcp: virality_predictor` y comentar el resultado.
- Si un asset sale mal: regenerar máximo 1 vez sin consultar; si sigue mal, enseñárselo a Nico y decidir juntos.

### 5. Caption + hashtags
- Por post: caption de 1-2 frases (mismo tono que el guion, sin repetirlo), 3-5 hashtags de nicho/local (no genéricos tipo #marketing), CTA suave al enlace de la bio cuando toque.
- Escribirlos en el calendario, dentro de la entrada del post.

### 6. Entregar
- Subir los assets a la carpeta Drive `WebForge Social/<año>-W<semana>/` (crear la carpeta si no existe; nombres `<día>-<formato>.mp4|png`). Si Drive falla, dejar las URLs de Higgsfield en el calendario y avisar.
- Actualizar `calendario.md`: estado `generado`, día asignado, enlace al asset.

### 7. Cierre
- Marcar en `hooks.md` los ganchos usados (`usado <semana>`).
- Commit de `hooks.md` + `calendario.md`: `chore(social): lote <año>-W<semana>`.
- Resumen final a Nico: tabla día → formato → asset → caption listo para copiar/pegar, y recordatorio de la etiqueta IA.
