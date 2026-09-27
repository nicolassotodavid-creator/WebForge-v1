# [FINCAS] Asistente de recepción para administradores de fincas

Demo con una administración ficticia: **Administraciones Turia** (Valencia). Producto aparte de las webs, el simulador y Luvia. Usa la cuenta de ElevenLabs de Luvia y el proyecto Supabase de WebForge solo por comodidad.

| Pieza | Dónde |
|---|---|
| Agente ElevenLabs | `agent_1401m3gm297hf5pasr0yt5jgxwkk` (ids en `agente.json`) |
| Guion | `prompt.md` |
| Crear / actualizar | `node docs/fincas/agente-fincas/crear-agente.mjs <email-copia> [dominio-landing]` |
| Backend | función `fincas-voz` (`/urgencia`, `/incidencia`, `/post-call`) |
| Datos | tabla `incidencias_fincas` (migración 0026), referencia `INC-1001…` |

## Widget en la landing

```html
<elevenlabs-convai agent-id="agent_1401m3gm297hf5pasr0yt5jgxwkk"
  dynamic-variables='{"gestor_email":"EMAIL_DEL_QUE_PRUEBA","guardia_movil":"MOVIL_DEL_QUE_PRUEBA"}'></elevenlabs-convai>
<script src="https://unpkg.com/@elevenlabs/convai-widget-embed" async type="text/javascript"></script>
```

La landing pide el email y el móvil a la administración que prueba la demo y los pasa como variables. A ese email llegan el aviso urgente y el resumen de cada llamada, y a ese móvil el SMS de guardia. Nico recibe copia de todo (`FINCAS_COPIA_EMAIL`). Sin variables, el agente funciona igual y solo llega la copia a Nico.

## Pendiente

- **SMS de guardia:** el código ya está. Se activa al poner `FINCAS_TWILIO_SID` y `FINCAS_TWILIO_TOKEN` en los secretos de Supabase (cuenta Twilio con saldo; remitente alfanumérico `TURIA`). Mientras no estén, el aviso urgente sale solo por email.
- **Número de teléfono:** un número español de Twilio exige documentación. Cuando esté, se importa en ElevenLabs y se asigna al agente. En las llamadas por teléfono, pasar el número del llamante en `telefono_entrante` para que el agente solo lo confirme.
- **Allowlist:** ahora el widget funciona desde cualquier web (con tope de 60 conversaciones al día). Cuando exista el dominio de la landing: `crear-agente.mjs <email> dominio.com`.

## Topes contra abusos

30 SMS al día, 60 resúmenes por email al día y un solo aviso de guardia por conversación. Las herramientas exigen la cabecera `x-fincas-token` y el post-call exige la firma HMAC de ElevenLabs.
