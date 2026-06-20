// Puente a la API de Lovable (MCP HTTP directo, sin pasar por Claude Code).
// Requiere LOVABLE_ACCESS_TOKEN en el .env (obtenido con: npm run auth).
//
// Flujo: create_project(build-prompt, wait) → confirmar build (status=completed)
//        → deploy_project → live_url pública (*.lovable.app, sin prefijo preview--)
//
// IMPORTANTE (robustez): TODAS las llamadas de red llevan timeout con AbortController.
// Sin esto, una conexión SSE larga estancada cuelga el proceso indefinidamente
// (create_project bloquea en servidor hasta 600 s mientras el agente construye).

const MCP_URL        = "https://mcp.lovable.dev/";
const TOKEN_URL      = "https://lovable.dev/oauth/token";
const CLIENT_ID      = "https://claude.ai/oauth/claude-code-client-metadata";
const WORKSPACE_ID   = process.env.LOVABLE_WORKSPACE_ID ?? "M6rQH3QVxqEu6GwUs0RS";
const POLL_MS        = 15_000;                                                    // cada 15 s
const BUILD_DEADLINE_MS = Number(process.env.LOVABLE_TIMEOUT_MS ?? 15 * 60 * 1000); // 15 min total

// Timeouts por tipo de llamada de red:
const TOKEN_TIMEOUT_MS   = 30_000;       // refresh OAuth
const CREATE_TIMEOUT_MS  = 11 * 60 * 1000; // create_project: servidor bloquea hasta 600 s; damos margen
const SHORT_TIMEOUT_MS   = 60_000;       // get_project / deploy_project

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH  = path.resolve(__dirname, "../.env");

/** fetch con timeout duro vía AbortController. Lanza un error claro si se agota. */
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number, label: string): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(`Timeout (${Math.round(timeoutMs / 1000)} s) en ${label} — la conexión con Lovable se estancó`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** Refresca el access token usando el refresh token y lo guarda en .env */
async function refreshAccessToken(): Promise<string> {
  const refreshToken = process.env.LOVABLE_REFRESH_TOKEN;
  if (!refreshToken) throw new Error("Falta LOVABLE_REFRESH_TOKEN en .env. Ejecuta: npm run auth");

  const res = await fetchWithTimeout(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "refresh_token",
      client_id:     CLIENT_ID,
      refresh_token: refreshToken,
    }).toString(),
  }, TOKEN_TIMEOUT_MS, "refresh de token");

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`No se pudo refrescar el token de Lovable (${res.status}): ${body.slice(0, 200)}. Ejecuta: npm run auth`);
  }

  const data = await res.json() as { access_token: string; refresh_token?: string };
  const newAccess  = data.access_token;
  const newRefresh = data.refresh_token ?? refreshToken;

  // Persistir en .env de forma robusta: si la línea no existe se AÑADE (antes el regex
  // .replace no hacía nada y el token nuevo no se guardaba), y se escribe de forma atómica
  // (tmp + rename) para no dejar el .env a medias si otro proceso lo lee a la vez.
  let env = fs.readFileSync(ENV_PATH, "utf8");
  env = upsertEnvVar(env, "LOVABLE_ACCESS_TOKEN",  newAccess);
  env = upsertEnvVar(env, "LOVABLE_REFRESH_TOKEN", newRefresh);
  const tmp = ENV_PATH + ".tmp";
  fs.writeFileSync(tmp, env);
  fs.renameSync(tmp, ENV_PATH);
  process.env.LOVABLE_ACCESS_TOKEN  = newAccess;
  process.env.LOVABLE_REFRESH_TOKEN = newRefresh;
  console.log("  · Lovable token refrescado y guardado en .env");
  return newAccess;
}

/** Reemplaza KEY=... en el contenido del .env, o lo añade al final si no existe. */
function upsertEnvVar(env: string, key: string, value: string): string {
  const re = new RegExp(`^${key}=.*$`, "m");
  const line = `${key}=${value}`;
  if (re.test(env)) return env.replace(re, line);
  return env.length === 0 || env.endsWith("\n") ? `${env}${line}\n` : `${env}\n${line}\n`;
}

/** Devuelve un token válido, refrescando si es necesario. */
async function getValidToken(): Promise<string> {
  const token = process.env.LOVABLE_ACCESS_TOKEN;
  if (!token) throw new Error("Falta LOVABLE_ACCESS_TOKEN en .env. Ejecuta: npm run auth");

  // Decodificar exp del JWT (sin verificar firma)
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    const expiresIn = (payload.exp as number) - Math.floor(Date.now() / 1000);
    if (expiresIn < 300) { // refresca si queda menos de 5 min (o ya caducó)
      console.log(`  · Lovable token ${expiresIn < 0 ? "caducado" : `expira en ${expiresIn}s`} — refrescando...`);
      return await refreshAccessToken();
    }
  } catch { /* si no se puede decodificar, usamos el token tal cual */ }

  return token;
}

export interface LovableResult {
  projectId: string;
  liveUrl: string;
  /** true si liveUrl es una URL de preview (inestable), no la publicada (*.lovable.app). */
  isPreview: boolean;
  /** Captura del build que devuelve Lovable (latest_screenshot_url). El orquestador la re-hospeda. */
  screenshotUrl?: string;
}

export interface LovableBuildOptions {
  /** Sufijo para el slug de deploy (p.ej. fragmento del lead.id) — evita colisiones de slug
   *  entre dos negocios con el mismo nombre (#9). */
  slugSuffix?: string;
  /** Si se pasa, REANUDA sobre este proyecto Lovable ya existente en vez de crear uno nuevo:
   *  evita volver a gastar créditos cuando un intento previo falló DESPUÉS de create_project (#3). */
  resumeProjectId?: string;
  /** Se invoca en cuanto create_project devuelve el projectId, para persistirlo antes de las
   *  fases que pueden fallar (waitForBuild / deploy) — así un fallo posterior se puede reanudar. */
  onProjectCreated?: (projectId: string) => Promise<void> | void;
}

/** Extrae la URL de captura del build de un payload de get_project / deploy_project. */
function pickScreenshot(obj: Record<string, unknown>): string | undefined {
  for (const k of ["latest_screenshot_url", "screenshot_url", "screenshot", "thumbnail_url"]) {
    const v = obj?.[k];
    if (typeof v === "string" && v.startsWith("http")) return v;
  }
  return undefined;
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** Extrae el texto útil de un resultado MCP (content[0].text → parse JSON si posible). */
function parseContent(result: unknown): unknown {
  const r = result as { content?: { type?: string; text?: string }[] } | null;
  const text = r?.content?.[0]?.text ?? "";
  try { return JSON.parse(text); } catch { return text; }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * ¿El error es transitorio (red/5xx/429/timeout) y por tanto reintentable?
 * Los errores de aplicación del MCP ("MCP foo: ...") y los builds fallidos NO lo son.
 */
function isTransientError(e: unknown): boolean {
  const m = e instanceof Error ? e.message : String(e);
  if (m.startsWith("MCP ") || m.includes("falló (status=")) return false;
  return (
    /→ HTTP (5\d\d|429)/.test(m) ||         // 5xx / rate-limit del MCP
    m.includes("Timeout (") ||              // timeout duro de fetchWithTimeout
    m.includes("fetch failed") ||           // error de red de undici
    (e instanceof Error && e.name === "TypeError") // fallo de red genérico
  );
}

/**
 * Llama a una herramienta del MCP de Lovable con reintentos ante errores transitorios.
 * `retries` = reintentos extra (0 = sin reintentos). NO reintentar create_project:
 * recrear gastaría créditos. Sí para get_project / deploy_project (idempotentes).
 */
async function mcpCall(
  token: string,
  toolName: string,
  args: Record<string, unknown>,
  timeoutMs: number = SHORT_TIMEOUT_MS,
  retries = 0,
): Promise<unknown> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await mcpCallOnce(token, toolName, args, timeoutMs);
    } catch (e) {
      lastErr = e;
      if (attempt < retries && isTransientError(e)) {
        const backoff = 2000 * (attempt + 1);
        console.warn(`  · ${toolName} error transitorio (intento ${attempt + 1}/${retries + 1}): ${e instanceof Error ? e.message : e}. Reintento en ${backoff / 1000}s…`);
        await sleep(backoff);
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

/** Una sola llamada al MCP (sin reintentos). */
async function mcpCallOnce(
  token: string,
  toolName: string,
  args: Record<string, unknown>,
  timeoutMs: number = SHORT_TIMEOUT_MS,
): Promise<unknown> {
  const res = await fetchWithTimeout(MCP_URL, {
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
  }, timeoutMs, `MCP ${toolName}`);

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

/**
 * Espera/confirma que el build esté listo consultando get_project.
 * Señal de completado = status "completed" | publicado (campo url) | tiene screenshot del build.
 * NO usa preview_url como señal: SIEMPRE está presente tras el primer prompt (aún sin construir).
 */
const DONE_STATUSES = ["completed", "complete", "ready", "deployed", "success", "succeeded"];
const FAIL_STATUSES = ["failed", "error", "errored"];
const IN_PROGRESS_STATUSES = ["in_progress", "building", "pending", "queued", "running", "generating", "processing"];

async function waitForBuild(token: string, projectId: string): Promise<Record<string, unknown>> {
  const deadline = Date.now() + BUILD_DEADLINE_MS;
  let attempt = 0;
  let last: Record<string, unknown> = {};
  while (Date.now() < deadline) {
    attempt++;
    const proj = (await mcpCall(token, "get_project", { project_id: projectId }, SHORT_TIMEOUT_MS, 2)) as Record<string, unknown>;
    last = proj;
    const status = String(proj?.status ?? proj?.build_status ?? "").toLowerCase();

    if (DONE_STATUSES.includes(status)) return proj;
    if (FAIL_STATUSES.includes(status)) {
      throw new Error(`Build de Lovable falló (status=${status}): ${JSON.stringify(proj).slice(0, 300)}`);
    }

    // Fallback por url/screenshot SOLO si el status NO indica build en curso. Si Lovable
    // dice 'in_progress'/'building', seguimos esperando aunque ya exista un screenshot
    // intermedio — así no publicamos una web a medio construir (#5).
    if (!IN_PROGRESS_STATUSES.includes(status) &&
        (typeof proj?.url === "string" || typeof proj?.latest_screenshot_url === "string")) {
      if (!status) console.warn(`  ⚠ get_project sin status terminal; aceptando build por url/screenshot presente`);
      return proj;
    }

    if (attempt === 1) process.stdout.write("  · confirmando build");
    process.stdout.write(".");
    await sleep(POLL_MS);
  }
  throw new Error(`Timeout (${Math.round(BUILD_DEADLINE_MS / 60_000)} min) esperando el build de Lovable. Último estado: ${JSON.stringify(last).slice(0, 300)}`);
}

// ── helpers de URL ───────────────────────────────────────────────────────────

/**
 * Una URL es la PÚBLICA PUBLICADA si es <slug>.lovable.app SIN prefijo de preview.
 * Rechaza preview--*.lovable.app / id-preview--*.lovable.app (previews del editor, no estables).
 */
function isPublishedLovableUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith(".lovable.app")) return false;
    const sub = u.hostname.slice(0, -".lovable.app".length);
    return !sub.startsWith("preview--") && !sub.startsWith("id-preview--");
  } catch {
    return false;
  }
}

/** Slug válido para la URL publicada a partir de un texto libre. */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // quitar acentos
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "webforge";
}

/**
 * Obtiene la URL pública publicada (*.lovable.app sin preview--).
 * Prioriza el campo `url` (publicado) de deploy_project / get_project.
 * Si solo hay preview, lo devuelve como fallback con aviso.
 */
async function extractPublicUrl(
  token: string,
  projectId: string,
  deployed: Record<string, unknown>,
): Promise<{ url: string; isPreview: boolean }> {
  const fields = (obj: Record<string, unknown>) =>
    [obj?.url, obj?.live_url, obj?.publish_url, obj?.public_url, obj?.preview_url, obj?.site_url]
      .filter((v): v is string => typeof v === "string" && v.startsWith("http"));

  // 1. URL publicada en la respuesta de deploy_project
  for (const c of fields(deployed)) {
    if (isPublishedLovableUrl(c)) { console.log(`  · URL pública (deploy): ${c}`); return { url: c, isPreview: false }; }
  }

  // 2. URL publicada en get_project
  const proj = (await mcpCall(token, "get_project", { project_id: projectId }, SHORT_TIMEOUT_MS, 2)) as Record<string, unknown>;
  for (const c of fields(proj)) {
    if (isPublishedLovableUrl(c)) { console.log(`  · URL pública (get_project): ${c}`); return { url: c, isPreview: false }; }
  }

  // 3. Fallback: cualquier *.lovable.app (probablemente preview, INESTABLE) con aviso. Se
  //    marca isPreview=true para que el llamador lo registre y programe un re-deploy (#6).
  const previewUrl = [...fields(deployed), ...fields(proj)].find((c) => {
    try { return new URL(c).hostname.endsWith(".lovable.app"); } catch { return false; }
  });
  if (previewUrl) {
    console.warn(`  ⚠ No se encontró URL PUBLICADA; usando preview (inestable): ${previewUrl}`);
    console.warn(`    deploy_project: ${JSON.stringify(deployed).slice(0, 200)}`);
    console.warn(`    get_project: ${JSON.stringify(proj).slice(0, 200)}`);
    return { url: previewUrl, isPreview: true };
  }

  throw new Error(
    `No se encontró URL pública para ${projectId}.\n` +
    `deploy_project: ${JSON.stringify(deployed)}\nget_project: ${JSON.stringify(proj)}`,
  );
}

/**
 * Consulta get_project y devuelve la captura del build (latest_screenshot_url), si existe.
 * Útil para el backfill de webs ya construidas (que no tienen preview_image_url todavía).
 */
export async function fetchProjectScreenshot(projectId: string): Promise<string | undefined> {
  const token = await getValidToken();
  const proj = (await mcpCall(token, "get_project", { project_id: projectId })) as Record<string, unknown>;
  return pickScreenshot(proj);
}

// ── export principal ──────────────────────────────────────────────────────────

export async function lovableBuild(
  buildPrompt: string,
  description: string,
  opts: LovableBuildOptions = {},
  workspaceId = WORKSPACE_ID,
): Promise<LovableResult> {
  const token = await getValidToken();
  const t0 = Date.now();
  const elapsed = () => `${Math.round((Date.now() - t0) / 1000)}s`;

  // 1. Crear el proyecto con el build-prompt, o REANUDAR sobre uno existente (#3).
  //    wait=true: Lovable bloquea hasta que el agente termina (o hasta timeout_seconds=600 en
  //    servidor; el cliente da margen con CREATE_TIMEOUT_MS). create_project NO se reintenta:
  //    recrear gastaría créditos.
  let projectId: string;
  if (opts.resumeProjectId) {
    projectId = opts.resumeProjectId;
    console.log(`  · reanudando sobre proyecto Lovable existente (${projectId}) — no se crea otro`);
  } else {
    const created = (await mcpCall(token, "create_project", {
      workspace_id:    workspaceId,
      prompt:          buildPrompt,
      wait:            true,
      timeout_seconds: 600,
    }, CREATE_TIMEOUT_MS)) as Record<string, unknown>;

    projectId = String(created?.project_id ?? created?.id ?? "");
    if (!projectId) {
      throw new Error("create_project no devolvió project_id/id: " + JSON.stringify(created).slice(0, 300));
    }
    console.log(`  · proyecto creado (${projectId}) en ${elapsed()}`);
    // Persistir el projectId YA: si una fase posterior falla, el llamador puede reanudar.
    if (opts.onProjectCreated) await opts.onProjectCreated(projectId);
  }

  // 2. Confirmar que el build está listo. Robusto aunque create_project devuelva antes de
  //    terminar (build > 600 s → status 'in_progress').
  const built = await waitForBuild(token, projectId);
  process.stdout.write(`\n  · build listo en ${elapsed()}\n`);

  // 3. Publicar (deploy) con slug estable y único (descripción + sufijo) y reintentos.
  const deploySlug = slugify(description) + (opts.slugSuffix ? `-${slugify(opts.slugSuffix)}` : "");
  const deployed = (await mcpCall(token, "deploy_project", {
    project_id: projectId,
    name:       deploySlug,
  }, SHORT_TIMEOUT_MS, 2)) as Record<string, unknown>;

  // 4. Extraer la URL pública PUBLICADA (*.lovable.app sin preview--)
  const { url: liveUrl, isPreview } = await extractPublicUrl(token, projectId, deployed);
  console.log(`  · publicado en ${elapsed()}: ${liveUrl}${isPreview ? " (preview, no publicada)" : ""}`);

  // 5. Captura del build (la re-hospeda el orquestador para la preview de /book)
  const screenshotUrl = pickScreenshot(built) ?? pickScreenshot(deployed);

  return { projectId, liveUrl, isPreview, screenshotUrl };
}
