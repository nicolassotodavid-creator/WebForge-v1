# WebForge — instrucciones para Claude Code

Dos backends: (1) APP = panel React (Vercel) + Supabase (Postgres+Auth+Edge Functions Deno+pg_cron).
(2) ORQUESTADOR = agente Node (Anthropic API + MCP de Lovable + modelo claude-sonnet-4-6) en VPS por cron,
que construye las webs de cliente en Lovable y escribe en Supabase con la service key.

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
