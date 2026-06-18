// Puente a la API de Lovable (MCP HTTP directo, sin pasar por Claude Code).
// Requiere LOVABLE_ACCESS_TOKEN en el .env (obtenido con: npm run auth).
//
// Flujo: create_project(build-prompt) → poll get_project hasta build listo → deploy_project → live_url

const MCP_URL        = "https://mcp.lovable.dev/";
const WORKSPACE_ID   = process.env.LOVABLE_WORKSPACE_ID ?? "M6rQH3QVxqEu6GwUs0RS";
const POLL_MS        = 15_000;                                               // cada 15 s
const TIMEOUT_MS     = Number(process.env.LOVABLE_TIMEOUT_MS ?? 15 * 60 * 1000); // 15 min

export interface LovableResult {
  projectId: string;
  liveUrl: string;
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** Extrae el texto útil de un resultado MCP (content[0].text → parse JSON si posible). */
function parseContent(result: unknown): unknown {
  const r = result as { content?: { type?: string; text?: string }[] } | null;
  const text = r?.content?.[0]?.text ?? "";
  try { return JSON.parse(text); } catch { return text; }
}

/** Llama a una herramienta del MCP de Lovable y devuelve el resultado ya parseado. */
async function mcpCall(
  token: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${token}`,
      "Accept":        "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id:      Date.now(),
      method:  "tools/call",
      params:  { name: toolName, arguments: args },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Lovable MCP ${toolName} → HTTP ${res.status}: ${body.slice(0, 300)}`);
  }

  const ct = res.headers.get("content-type") ?? "";

  if (ct.includes("text/event-stream")) {
    // Respuesta SSE: buscar el primer evento con resultado
    const raw = await res.text();
    for (const block of raw.split("\n\n")) {
      const line = block.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") continue;
      try {
        const msg = JSON.parse(data) as {
          result?: unknown;
          error?: { message?: string };
        };
        if (msg.error) throw new Error(`MCP ${toolName}: ${msg.error.message ?? JSON.stringify(msg.error)}`);
        if (msg.result !== undefined) return parseContent(msg.result);
      } catch (e) {
        if (e instanceof Error && e.message.startsWith("MCP ")) throw e;
      }
    }
    throw new Error(`MCP ${toolName}: sin resultado en el stream SSE`);
  }

  // Respuesta JSON
  const data = await res.json() as { result?: unknown; error?: { message?: string } };
  if (data.error) throw new Error(`MCP ${toolName}: ${data.error.message ?? JSON.stringify(data.error)}`);
  return parseContent(data.result);
}

/** Poll get_project hasta que el build esté listo (tiene preview_url o status ready). */
async function waitForBuild(token: string, projectId: string): Promise<void> {
  const deadline = Date.now() + TIMEOUT_MS;
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt++;
    const proj = (await mcpCall(token, "get_project", { project_id: projectId })) as Record<string, unknown>;
    const status = String(proj?.status ?? proj?.build_status ?? "").toLowerCase();

    if (
      status === "ready" ||
      status === "deployed" ||
      status === "complete" ||
      proj?.preview_url ||
      proj?.live_url
    ) return;

    if (status === "failed" || status === "error") {
      throw new Error(`Build de Lovable falló (status=${status}): ${JSON.stringify(proj)}`);
    }

    if (attempt === 1) process.stdout.write("  · esperando build");
    process.stdout.write(".");
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  throw new Error(`Timeout (${TIMEOUT_MS / 60_000} min) esperando el build de Lovable`);
}

// ── export principal ──────────────────────────────────────────────────────────

export async function lovableBuild(
  buildPrompt: string,
  description: string,
  workspaceId = WORKSPACE_ID,
): Promise<LovableResult> {
  const token = process.env.LOVABLE_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "Falta LOVABLE_ACCESS_TOKEN en .env. " +
      "Ejecuta primero: cd ~/webforge/orquestador && npm run auth",
    );
  }

  // 1. Crear el proyecto en Lovable con el build-prompt como mensaje inicial
  const created = (await mcpCall(token, "create_project", {
    workspace_id: workspaceId,
    description,
    prompt:       buildPrompt,
  })) as Record<string, unknown>;

  const projectId = String(created?.project_id ?? created?.id ?? "");
  if (!projectId) {
    throw new Error("create_project no devolvió project_id: " + JSON.stringify(created));
  }

  // 2. Esperar a que el build termine
  await waitForBuild(token, projectId);
  process.stdout.write("\n");

  // 3. Publicar (deploy) y obtener la URL en vivo
  const deployed = (await mcpCall(token, "deploy_project", {
    project_id: projectId,
  })) as Record<string, unknown>;

  const liveUrl = String(
    deployed?.url ?? deployed?.live_url ?? deployed?.deploy_url ?? deployed?.preview_url ?? "",
  );
  if (!liveUrl) {
    throw new Error("deploy_project no devolvió URL: " + JSON.stringify(deployed));
  }

  return { projectId, liveUrl };
}
