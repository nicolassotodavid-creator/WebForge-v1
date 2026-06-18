// Carga el .env de SECRETOS DE SERVIDOR, que vive en la raíz del repo (un nivel por encima de
// /orquestador). Se importa el PRIMERO en run.ts para que las variables estén disponibles antes
// de evaluar el resto de módulos. NO subir ese .env a git (.gitignore ya lo ignora).
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, "../.env") });
