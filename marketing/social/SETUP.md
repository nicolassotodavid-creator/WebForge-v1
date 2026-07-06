# Setup del canal IG/TikTok — checklist

Estado del setup una-sola-vez del canal. `/lote-contenido` lee la sección
"Identidad de contenido"; mientras esté incompleta, el skill avisa antes de generar.

## Bloque 1 — Solo Nico (cuentas)

- [ ] **Instagram Business** (no personal, no creator): necesario para métricas
  (alcance, visitas al perfil) y prerequisito de cualquier publicación por API en fase 2
  (Metricool/Buffer/Postoro requieren cuenta Business vinculada a página de Facebook).
- [ ] **TikTok cuenta de empresa**: mismas razones (analytics + Content Posting API futura).
- [ ] **Handle** (mismo en ambas si está libre): sugerencia `@webforge.es` /
  `@webforge_webs`; alternativa descriptiva: `@tuwebcon.reservas`.
- [ ] **Bio** (sugerencia): "Webs con reservas automatizadas para negocios locales.
  Hecha en 24h, tú no tocas nada. ⤵ Pide la tuya" + enlace.
- [ ] **Enlace de la bio**: decidir destino (landing de WebForge / `/book` genérico).
- [ ] Localizar el toggle de **etiqueta "creado con IA"** en ambas apps (se activa
  post a post al publicar).

## Bloque 2 — Identidad de contenido (se completa en la primera sesión de /lote-contenido)

- [ ] **Avatar presentador**: elegir 1 entre los candidatos de abajo (o pedir nuevos).
  Anotar aquí la URL/ID de la imagen elegida — es la referencia de identidad para todos
  los vídeos.
- [ ] **Voz fija**: crear con `create_voice` (voz española, cercana, 30-40 años, ritmo
  conversacional) y anotar aquí el `voice_id`.
- [ ] **Preset de Shorts Studio**: crear con `shorts_studio_create_preset` (9:16,
  subtítulos grandes en español, estética consistente con el avatar) y anotar el ID.

### Candidatos de avatar

*(pendiente de generar — ver Task 5 del plan; si no hay URLs abajo, generarlos en la
primera sesión)*

### Identidad elegida

| Elemento | Valor |
|----------|-------|
| Avatar (imagen ref.) | — |
| Voz (`voice_id`) | — |
| Preset Shorts Studio | — |
