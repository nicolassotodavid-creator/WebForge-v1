# WebForge — instrucciones para Claude Code

Dos backends: (1) APP = panel React (Vercel) + Supabase (Postgres+Auth+Edge Functions Deno+pg_cron).
(2) ORQUESTADOR = agente Node (Anthropic API + MCP de Lovable + modelo claude-sonnet-4-6) en VPS por cron,
que construye las webs de cliente en Lovable y escribe en Supabase con la service key.

## Etiquetas de proyecto (LEER PRIMERO)

En este repo conviven varios productos. Nico empieza el mensaje con una etiqueta para decir de cuál habla.
Con etiqueta, trabaja SOLO en ese producto: su código, su proyecto Lovable, su dominio y sus memorias.

| Etiqueta | Producto | Dónde vive | Canal |
|---|---|---|---|
| `[WEBS]` | Webs automáticas para negocios (397 €) | `orquestador/`, `app/` (panel y `/book`), `supabase/functions/`, `*.lovable.app`, `nico-soto.es/book` | Email automático (Resend) + WhatsApp manual desde la ficha |
| `[SIMULADOR]` | Home Estimator para empresas de reformas (59 €/mes) | Lovable `reform-wizard` (`4e13bf62…`) en `presupuestos.nico-soto.es`, `docs/prospeccion/` | MANUAL: Nico busca la empresa, pega el texto en su formulario y manda el enlace de la demo |
| `[LUVIA]` | Clínicas de Luvia (handoff al CRM) | `handoff-luvia`, proyecto Supabase LUVIA CRM | Otro flujo, propio de Luvia |

- **Sin etiqueta:** se hereda la última etiqueta usada en la conversación.
- **"Reformas" NO sirve para distinguir:** hay empresas de reformas que son leads de `[WEBS]` y también prospectos de `[SIMULADOR]`. Si no hay etiqueta y el mensaje puede ser de los dos, pregunta "¿[WEBS] o [SIMULADOR]?" en una línea ANTES de investigar.
- Las reglas duras de abajo son de `[WEBS]`. No se aplican al simulador.

Reglas duras:
- Secrets (ANTHROPIC_API_KEY, Resend, Stripe, OAuth Lovable, service key) SOLO en servidor. Nunca en el frontend.
- Las webs de cliente se construyen en Lovable VÍA SU MCP desde el Orquestador. NO como Edge Function. NO plantillas estáticas.
- Dos públicos / dos canales: negocios `local` → email (Resend, automático); `b2b` → LinkedIn (semi-manual: Claude redacta, el operador copia/pega). WhatsApp NO como captación en frío automática; SÍ como (a) línea de contacto entrante en el pie del email (WHATSAPP_NUMBER, solo email, apagado si vacío) y (b) envío saliente MANUAL/semi-manual desde la ficha del lead (no pipeline, solo con la web ya aprobada). Llamadas: fuera de alcance.
- El front público no inserta en DB directo: pasa por create-checkout / track-event.
- Salidas de Claude en JSON estricto (esquemas en ARQUITECTURA_webforge_v2.md sec. 10). Parsear con try/catch.
- Modelos: Sonnet 4.6 (claude-sonnet-4-6) para build-prompt y briefs; Haiku 4.5 (haiku-4-5-20251001) para extracción a volumen. Configurable con ORQUESTADOR_MODEL en .env. Prompt caching en system prompts.
- Gate de QA obligatorio: nada se contacta hasta status='approved' (visto bueno humano). Aplica a TODOS los canales, incluido el envío manual por WhatsApp desde la ficha.
- Mensaje en frío: texto plano, humano, corto, con reseñas reales. Email incluye la live_url; LinkedIn es nota de conexión (la web va en el seguimiento). Sin pinta de plantilla.
- Emails (los 3, OBLIGATORIO): cuando el lead tiene captura (`sites.preview_image_url`), TODOS los emails (1, 2 y 3) llevan el bloque "showcase" = captura de la web enmarcada (mini-navegador, clicable → la web) + DOS CTAs: "Ver la web entera" → `live_url` y "Activar mi web" → `/book/:leadId`. Sin captura → texto plano. Layout canónico: `docs/email-design/EMAIL1-DISENO-DEFINITIVO.html`. El copy/asuntos del 2 y 3 son los cortos de `generate-outreach/templates.md` (NO se cambian); solo se les añade el bloque visual. NUNCA quitar la preview ni el 2º enlace de los recordatorios. Preview = captura estática del bucket `site-previews`, NUNCA iframe.
- Construir por fases (sec. 13). Verificar cada fase antes de seguir.

Estado del repo: el scaffold de carpetas, el doc, esta guía, la migración SQL completa
(supabase/migrations/0001_init.sql) y los prompts (supabase/functions/_shared/prompts.ts) YA EXISTEN.
Las Edge Functions y el orquestador están como stubs con su contrato. Implementa contra ellos.

Fuera de alcance (no construir): WhatsApp como canal de captación AUTOMÁTICO/de pipeline; llamadas (ElevenLabs). El WhatsApp saliente permitido es solo el envío manual desde la ficha del lead.
