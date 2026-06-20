# Orquestador

Agente diario que, para cada lead, redacta el brief y el build-prompt con **Fable** y **construye la
web de cliente en Lovable vía su MCP**, guardando la `live_url` en Supabase. Ver
`ARQUITECTURA_webforge_v2.md` sec. 9. Es la **Fase 3**.

## Cómo funciona (resumen)

Por cada lead: `brief` (Fable → JSON) → `build-prompt` (Fable → texto) → **Claude Code conduce el MCP
de Lovable** (`list_workspaces → create_project → deploy_project`) → `sites.live_url` → lead
`site_built`. El resto (QA, contacto por email/LinkedIn) son fases posteriores.

### Por qué Claude Code (y no un agente Node "a pelo")

El **OAuth del MCP de Lovable solo admite clientes concretos**: ChatGPT, Claude Desktop/claude.ai,
**Claude Code**, Cursor y VS Code (verificado en docs.lovable.dev, jun 2026). Un proceso Node propio
no puede autenticarse contra Lovable. Por eso `lovable.ts` invoca **Claude Code en modo headless**
(`claude -p`), que sí sostiene la sesión OAuth. La arquitectura ya lo contemplaba ("Agent SDK **o
Claude Code en modo no-interactivo**"). El brief y el build-prompt sí van por la Anthropic API directa
(`fable.ts`), que es más barato y determinista.

---

## Qué necesitas tener listo (Nico)

1. **Lovable con plan de pago** (Pro o Business). El MCP **no** funciona en el plan Free. Necesita
   créditos: cada web construida los consume.
2. **Claude Code instalado** en la máquina donde corra el orquestador (tu Mac para la prueba; luego el
   VPS). Y el **MCP de Lovable conectado por OAuth** (login una sola vez).
3. **Claves en la raíz `../.env`**: `ANTHROPIC_API_KEY` (API de runtime, *no* el plan Max),
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `BOOKING_BASE`.

---

## Puesta en marcha (una vez)

```bash
# 1) Dependencias del orquestador
cd ~/webforge/orquestador
npm install

# 2) Conectar el MCP de Lovable a Claude Code y autenticar (abre el navegador la 1ª vez)
claude mcp add --scope user --transport http lovable "https://mcp.lovable.dev"
#   -> sigue el login OAuth en el navegador con tu cuenta de Lovable de pago.
#   Comprueba que aparece "lovable":  claude mcp list

# 3) Rellena las claves de servidor en la raíz del repo
#    ~/webforge/.env  ->  ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BOOKING_BASE
```

> **Consistencia de marca (opcional, recomendado):** una sola vez, fija el *workspace knowledge* en
> Lovable (tono, sistema de diseño, patrones) para que todas las webs salgan coherentes. Se puede
> hacer desde Claude Code con la herramienta `set_workspace_knowledge` del MCP.

---

## Probar la Fase 3

```bash
# A) Sin gastar créditos: solo brief + build-prompt (no toca Lovable ni la BD)
npm run dry-run -- --lead <ID_DE_UN_LEAD>

# B) Prueba real con UN lead: construye la web en Lovable y guarda la live_url
npm start -- --lead <ID_DE_UN_LEAD>

# C) Lote diario (hasta BATCH_SIZE leads en estado 'new')
npm start
```

El `ID_DE_UN_LEAD` lo ves en el panel (`/leads/:id`) o en la tabla de Supabase.

---

## En producción (Fase 8)

Cron en un VPS barato. Un build tarda minutos → **nada de serverless con timeout corto**. Ejemplo:

```cron
# cada día a las 8:00
0 8 * * *  cd /ruta/webforge/orquestador && /usr/bin/npm start >> /var/log/webforge.log 2>&1
```

La máquina debe tener Claude Code instalado y el MCP de Lovable ya autenticado (paso 2).

---

## Variables (todas en la raíz `../.env`)

| Variable | Obligatoria | Por defecto | Para qué |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | sí | — | Fable (brief y build-prompt) vía Anthropic API |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | sí | — | Leer leads y escribir briefs/sites |
| `BOOKING_BASE` | sí | — | Base del CTA de reserva (`/book/:leadId`) |
| `BATCH_SIZE` | no | 5 | Webs por ejecución del lote |
| `ORQUESTADOR_MODEL` | no | `claude-sonnet-4-6` | Modelo del orquestador en runtime (brief + build-prompt) |
| `LOVABLE_WORKSPACE_ID` | no | (el 1º) | Workspace de Lovable donde crear los proyectos |
| `LOVABLE_MCP_NAME` | no | `lovable` | Nombre con el que añadiste el MCP en Claude Code |
| `CLAUDE_BIN` | no | `claude` | Ruta al binario de Claude Code |
| `LOVABLE_TIMEOUT_MS` | no | 900000 | Tiempo máx. por build (15 min) |
