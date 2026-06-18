# WebForge

Sistema de captación **outbound**: construye una web a medida (Lovable conducido por Claude vía
MCP) ANTES de contactar, te deja revisarla, y dispara el contacto para que acepten y paguen. Dos
públicos: **negocios locales** (→ email) y **clientes B2B** (→ LinkedIn semi-manual).

Lee **`ARQUITECTURA_webforge_v2.md`** (la fuente de verdad) y **`CLAUDE.md`** (reglas para Fable).

## Qué ya está hecho en este repo
- Estructura de carpetas (app · supabase · orquestador).
- `ARQUITECTURA_webforge_v2.md` — el spec completo.
- `CLAUDE.md` — instrucciones para Fable/Claude Code.
- `supabase/migrations/0001_init.sql` — schema + RLS **completos**.
- `supabase/functions/_shared/prompts.ts` — prompts de Claude (brief · build · outreach).
- Stubs con contrato de las 6 Edge Functions y del Orquestador (`orquestador/run.ts`).

## Lo que tienes que hacer tú (necesita TU ordenador y TUS cuentas)
1. **Crear cuentas y llaves:** Anthropic (plan Max + API key), Supabase, Lovable (con MCP activado),
   Resend (dominio secundario), Stripe, Apify/Outscraper, y un VPS barato (~5€). LinkedIn (B2B) es
   semi-manual, sin claves.
2. **Conectar el MCP de Lovable a Claude** en los ajustes de connectors (OAuth).
3. **Abrir esta carpeta en VS Code** y lanzar **Claude Code con Fable** seleccionado.
   IMPORTANTE: NO tengas `ANTHROPIC_API_KEY` en el entorno donde corre Claude Code, o te facturará
   por token en vez de usar tu plan.
4. **Pegar el prompt de arranque** (abajo) en el chat de Claude Code.
5. Cuando Fable lo pida: copia `.env.example` a `.env`, rellena tus llaves, y aplica la migración
   `supabase/migrations/0001_init.sql` en tu Supabase (SQL Editor o `supabase db push`).

## Prompt de arranque (pega esto en Claude Code)

```
Eres el desarrollador principal de WebForge. El repo YA está montado: están la estructura de
carpetas, ARQUITECTURA_webforge_v2.md, CLAUDE.md, la migración SQL completa
(supabase/migrations/0001_init.sql), los prompts (supabase/functions/_shared/prompts.ts) y los
stubs con contrato de las Edge Functions y del orquestador.

Antes de tocar nada, lee por completo ARQUITECTURA_webforge_v2.md y CLAUDE.md. Son la fuente de
verdad: síguelos al pie de la letra. Respeta las reglas duras (secrets solo en servidor; webs de
cliente en Lovable vía MCP desde el orquestador, no como Edge Function ni plantillas; front público
no inserta en DB directo; salidas de Claude en JSON estricto; gate de QA obligatorio; construir por
fases verificando cada una).

Tu tarea AHORA: Fase 0 y Fase 1.
- Fase 0: scaffold del frontend dentro de /app (Vite + React + Tailwind + shadcn/ui), conexión a
  Supabase, dejar listo el deploy en Vercel, y documentar en .env dónde van los secrets. La migración
  ya existe: indícame el comando exacto para aplicarla, no la reescribas.
- Fase 1: implementar la Edge Function ingest-leads contra su stub (normaliza, dedupe por
  google_place_id, upsert a status='new'), la pantalla /import (pegar JSON o subir CSV) y la tabla de
  leads en /.

Método: explica en 3-4 líneas qué vas a hacer, hazlo, y al terminar dame los comandos exactos para
verificar la Fase 1 (cómo meter un lead de prueba y verlo en el panel). Luego PARA y espera mi OK
antes de la Fase 2. Trabaja de forma autónoma dentro de estas fases; solo pregúntame si hay una
decisión que de verdad necesite mi criterio.
```
