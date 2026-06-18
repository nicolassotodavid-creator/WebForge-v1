# WebForge — instrucciones para Fable / Claude Code

Dos backends: (1) APP = panel React (Vercel) + Supabase (Postgres+Auth+Edge Functions Deno+pg_cron).
(2) ORQUESTADOR = agente Node (Claude Agent SDK + MCP de Lovable + modelo claude-fable-5) en VPS por cron,
que construye las webs de cliente en Lovable y escribe en Supabase con la service key.

Reglas duras:
- Secrets (ANTHROPIC_API_KEY, Resend, Stripe, OAuth Lovable, service key) SOLO en servidor. Nunca en el frontend.
- Las webs de cliente se construyen en Lovable VÍA SU MCP desde el Orquestador. NO como Edge Function. NO plantillas estáticas.
- Dos públicos / dos canales: negocios `local` → email (Resend, automático); `b2b` → LinkedIn (semi-manual: Claude redacta, el operador copia/pega). NADA de WhatsApp ni llamadas.
- El front público no inserta en DB directo: pasa por create-checkout / track-event.
- Salidas de Claude en JSON estricto (esquemas en ARQUITECTURA_webforge_v2.md sec. 10). Parsear con try/catch.
- Modelos: Haiku 4.5 extracción a volumen; Fable 5 para build-prompt y conducir Lovable; Sonnet 4.6 alternativa barata. Prompt caching en system prompts.
- Gate de QA obligatorio: nada se contacta hasta status='approved' (visto bueno humano).
- Mensaje en frío: texto plano, humano, corto, con reseñas reales. Email incluye la live_url; LinkedIn es nota de conexión (la web va en el seguimiento). Sin pinta de plantilla.
- Construir por fases (sec. 13). Verificar cada fase antes de seguir.

Estado del repo: el scaffold de carpetas, el doc, esta guía, la migración SQL completa
(supabase/migrations/0001_init.sql) y los prompts (supabase/functions/_shared/prompts.ts) YA EXISTEN.
Las Edge Functions y el orquestador están como stubs con su contrato. Implementa contra ellos.

Fuera de alcance (no construir): contacto por WhatsApp; llamadas (ElevenLabs). Solo email y LinkedIn.
