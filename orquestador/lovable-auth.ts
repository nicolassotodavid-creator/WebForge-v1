// WebForge — Autorización OAuth de Lovable. Ejecutar UNA SOLA VEZ: npm run auth
// Abre el navegador, hace el login con tu cuenta de Lovable y guarda el token en .env
// A partir de ahí el orquestador funciona de forma autónoma.

import "./env.ts";
import { createServer } from "http";
import { randomBytes, createHash } from "crypto";
import { exec } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CLIENT_ID   = "https://claude.ai/oauth/claude-code-client-metadata";
const AUTH_URL    = "https://lovable.dev/oauth/authorize";
const TOKEN_URL   = "https://lovable.dev/oauth/token";
const PORT        = 54997;
const REDIRECT    = `http://localhost:${PORT}/callback`;
const SCOPES      = "offline projects:read projects:write projects:create workspaces:read workspaces:write";
const RESOURCE    = "https://mcp.lovable.dev/";

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function setEnvVar(env: string, key: string, value: string): string {
  const re = new RegExp(`^${key}=.*`, "m");
  return re.test(env) ? env.replace(re, `${key}=${value}`) : env + `\n${key}=${value}`;
}

async function main() {
  console.log("\nWebForge — Autorizando Lovable\n");

  const verifier  = b64url(randomBytes(32));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  const state     = b64url(randomBytes(16));

  const authUrl = new URL(AUTH_URL);
  authUrl.searchParams.set("response_type",         "code");
  authUrl.searchParams.set("client_id",             CLIENT_ID);
  authUrl.searchParams.set("code_challenge",        challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("redirect_uri",          REDIRECT);
  authUrl.searchParams.set("state",                 state);
  authUrl.searchParams.set("scope",                 SCOPES);
  authUrl.searchParams.set("resource",              RESOURCE);

  // Esperar el callback de Lovable
  const code = await new Promise<string>((resolve, reject) => {
    const server = createServer((req, res) => {
      if (!req.url?.startsWith("/callback")) { res.end(); return; }
      const u = new URL(req.url, `http://localhost:${PORT}`);
      const c = u.searchParams.get("code");
      const s = u.searchParams.get("state");

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      if (s !== state) {
        res.end("<h1>Error: state mismatch.</h1>");
        reject(new Error("state mismatch")); return;
      }
      if (!c) {
        res.end("<h1>Error: no se recibió código.</h1>");
        reject(new Error("no code")); return;
      }
      res.end(
        '<h1 style="font-family:sans-serif;padding:2rem;color:#16a34a">' +
        "✅ Autorizado. Puedes cerrar esta pestaña.</h1>"
      );
      server.close(() => resolve(c));
    });

    server.on("error", reject);
    server.listen(PORT, () => {
      console.log("Abriendo el navegador para autorizar Lovable...\n");
      exec(`open "${authUrl.toString()}"`, (err) => {
        if (err) console.log("Si el navegador no se abre, abre esta URL manualmente:\n" + authUrl.toString() + "\n");
      });
      console.log("Esperando que completes el login...");
    });

    setTimeout(() => {
      server.close();
      reject(new Error("Timeout: 2 minutos sin respuesta"));
    }, 120_000);
  });

  console.log("\nIntercambiando código por token...");

  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "authorization_code",
      client_id:     CLIENT_ID,
      code,
      redirect_uri:  REDIRECT,
      code_verifier: verifier,
    }).toString(),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Token exchange falló (${tokenRes.status}): ${err}`);
  }

  const tokens = await tokenRes.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!tokens.access_token) {
    throw new Error("No se recibió access_token: " + JSON.stringify(tokens));
  }

  // Guardar en .env
  const envPath = path.resolve(__dirname, "../.env");
  let env = fs.readFileSync(envPath, "utf8");
  env = setEnvVar(env, "LOVABLE_ACCESS_TOKEN", tokens.access_token);
  if (tokens.refresh_token) env = setEnvVar(env, "LOVABLE_REFRESH_TOKEN", tokens.refresh_token);
  fs.writeFileSync(envPath, env);

  console.log("\n✅ Token guardado en .env");
  console.log("Ahora puedes lanzar el orquestador: npm start\n");
}

main().catch((e) => {
  console.error("\n❌", e instanceof Error ? e.message : e);
  process.exit(1);
});
