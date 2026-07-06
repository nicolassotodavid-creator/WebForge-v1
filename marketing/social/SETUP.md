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

Generados el 2026-07-06 (modelo `soul_2`, 9:16, ~1 crédito c/u). **Elegir 1 en la
primera sesión** (o pedir nuevos si ninguno convence). El `job_id` es lo que se pasa
como referencia de identidad (`medias[].value`) al generar los vídeos.

| # | Perfil | job_id | Imagen |
|---|--------|--------|--------|
| 1 | Mujer ~35, cercana, fondo peluquería | `4575c606-f265-43b0-9db3-af50b3f6d156` | [ver](https://d8j0ntlcm91z4.cloudfront.net/user_3Aa57yxxelh2aMt3JIB518b7VGi/hf_20260706_181729_4575c606-f265-43b0-9db3-af50b3f6d156.png) |
| 2 | Hombre ~40, cercano, fondo cafetería | `b0e4ada8-f694-4c7a-a55e-8a45daba1d41` | [ver](https://d8j0ntlcm91z4.cloudfront.net/user_3Aa57yxxelh2aMt3JIB518b7VGi/hf_20260706_181732_b0e4ada8-f694-4c7a-a55e-8a45daba1d41.png) |
| 3 | Mujer ~48, dueña de negocio, fondo restaurante | `5d6847b9-a73a-4589-8b31-4701b077ce03` | [ver](https://d8j0ntlcm91z4.cloudfront.net/user_3Aa57yxxelh2aMt3JIB518b7VGi/hf_20260706_181737_5d6847b9-a73a-4589-8b31-4701b077ce03.png) |

Nota de saldo (2026-07-06): 526 créditos, plan Pro.

### Identidad elegida

| Elemento | Valor |
|----------|-------|
| Avatar (imagen ref.) | — |
| Voz (`voice_id`) | — |
| Preset Shorts Studio | — |
