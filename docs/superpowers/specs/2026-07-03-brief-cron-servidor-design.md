# Brief automático sin depender del Mac (cron en servidor)

**Fecha:** 2026-07-03
**Estado:** aprobado (opción B)

## Problema

Hoy el brief automático (PASO 1 del Orquestador: leads `new` → brief → `analyzed`) solo
corre si el Mac de producción está encendido, porque lo dispara **launchd** local
(`com.webforge.orquestador.plist` → `run-daily.sh` a las 08:00). Si el Mac está apagado,
no se generan briefs. Los seguimientos (0011) y el scoring (0012) ya se movieron a `pg_cron`
precisamente por esto; el brief todavía no.

El operador no quiere depender de local ni tocar terminal: quiere que viva "en Git".

## Alcance

- **Sí:** sacar el PASO 1 (brief) a un cron de servidor, sin Mac.
- **No (fase 2 aparte):** el PASO 2 (build en Lovable) sigue en el Mac. El MCP de Lovable
  necesita una máquina persistente con su OAuth; no es serverless. Eso es un VPS y va aparte.

El brief es **ligero**: solo Anthropic + Supabase. Las reseñas se piden después, en el build
(`processBuild`), no en el brief. Por eso el brief se puede mover entero.

## Diseño (opción B — GitHub Actions)

Dos piezas:

### 1. Edge Function `cron-briefs`

Clon batch de `cron-followups` + la lógica de brief de `analyze-lead`.

- **Auth:** exige `Authorization: Bearer <service_role_key>` (idéntico a `cron-followups` /
  `score-sites`). `verify_jwt = false` en `config.toml`.
- **Selección:** leads en `status = 'new'`, solo del cron/admin
  (`owner = ADMIN_USER_ID` o `owner is null`) — **nunca** leads de usuarios Luvia. Mismo
  filtro que `run.ts` (`owner.eq.<admin>,owner.is.null`).
- **Por lead:** Claude con `BRIEF_PROMPT` (modelo `claude-sonnet-4-6`, lo que manda el
  CLAUDE.md para briefs; override con `ORQUESTADOR_MODEL`) → parsea JSON estricto (try/catch)
  → inserta en `briefs` → mueve el lead a `analyzed` (solo si sigue en `new`, idempotente).
- **Robustez:** try/catch por lead (un fallo no tumba el lote). Procesa hasta `BRIEF_BATCH`
  (por defecto 15) por invocación y devuelve `{ processed, failed }`. **No** hace el scraping
  de emails de `analyze-lead` (6 fetch/lead con timeout) para no arriesgar el timeout de la
  función en lote; eso se queda en el flujo per-lead.

### 2. Workflow `.github/workflows/daily-brief.yml`

- Disparadores: `schedule` (cada 30 min, `*/30 * * * *`) + `workflow_dispatch` (manual).
- Un `curl` a la función con el header `Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}`.
- **Drena el backlog:** llama en bucle hasta que `processed == 0` (tope de seguridad de
  iteraciones) para vaciar cualquier acumulación en una sola ejecución sin arriesgar el
  timeout de la función.

### Despliegue

- La función se despliega **sola** al hacer push a `main` (el workflow `deploy.yml` ya
  existente; se añade `cron-briefs` a su lista y a `deploy.sh`).
- Secret runtime de la función (`ANTHROPIC_API_KEY`) ya está puesto en Supabase (lo usa
  `analyze-lead`). No hace falta nada nuevo ahí.
- **Único paso manual del operador (web, sin terminal):** dar de alta el secreto
  `SUPABASE_SERVICE_ROLE_KEY` en *GitHub → Settings → Secrets and variables → Actions*, para
  que el workflow pueda autenticarse contra la función.

## Trade-offs asumidos

- Patrón nuevo (GitHub Actions) frente a los otros dos crons (`pg_cron`). Aceptado: a cambio
  todo vive en Git, se despliega con push y no requiere aplicar migraciones a mano ni la
  contraseña de la BD.
- Scheduler best-effort de GitHub Actions (retrasos de ±15 min posibles). Irrelevante para
  briefs.
- Modelo Sonnet 4.6 (calidad, según regla dura) en vez de Haiku. Override por env si se
  quiere abaratar.

## Verificación

1. `workflow_dispatch` manual → la respuesta trae `{ processed, failed }`.
2. En el panel: leads que estaban en `new` pasan a `analyzed` con su brief.
3. Logs de la función en el dashboard de Supabase.
