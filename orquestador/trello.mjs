// trello.mjs — cliente mínimo de la API REST de Trello para gestionar los pendientes de Nico.
// Credenciales en el .env de la raíz: TRELLO_KEY + TRELLO_TOKEN (app «Luvia API», lectura y escritura).
//
//   node orquestador/trello.mjs boards                     → tableros abiertos
//   node orquestador/trello.mjs board "<nombre>"           → listas y tarjetas (con id corto)
//   node orquestador/trello.mjs card <idCard>              → detalle (descripción, checklists, comentarios)
//   import { trello } from "./trello.mjs"; await trello("POST", "/cards", { idList, name, desc })
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const KEY = process.env.TRELLO_KEY ?? env.TRELLO_KEY;
const TOKEN = process.env.TRELLO_TOKEN ?? env.TRELLO_TOKEN;

export async function trello(method, path, params = {}) {
  if (!KEY || !TOKEN) throw new Error("Faltan TRELLO_KEY / TRELLO_TOKEN en .env");
  const u = new URL(`https://api.trello.com/1${path}`);
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) (method === "GET" ? u.searchParams : body).set(k, String(v));
  u.searchParams.set("key", KEY);
  u.searchParams.set("token", TOKEN);
  const res = await fetch(u, { method, body: method === "GET" ? undefined : body });
  const text = await res.text();
  if (!res.ok) throw new Error(`Trello ${method} ${path} → ${res.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

export async function boardByName(name) {
  const boards = await trello("GET", "/members/me/boards", { filter: "open", fields: "name" });
  const b = boards.find((x) => x.name.toLowerCase() === name.toLowerCase());
  if (!b) throw new Error(`No hay tablero «${name}». Abiertos: ${boards.map((x) => x.name).join(", ")}`);
  return b;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === "boards") {
    for (const b of await trello("GET", "/members/me/boards", { filter: "open", fields: "name" })) console.log(b.name);
  } else if (cmd === "board") {
    const b = await boardByName(arg);
    const lists = await trello("GET", `/boards/${b.id}/lists`, { fields: "name" });
    const cards = await trello("GET", `/boards/${b.id}/cards`, { fields: "name,idList,due,dueComplete" });
    for (const l of lists) {
      if (/contraseñas|passwords/i.test(l.name)) { console.log(`## ${l.name} (oculta)`); continue; }
      console.log(`## ${l.name}`);
      for (const c of cards.filter((c) => c.idList === l.id))
        console.log(`- ${c.id.slice(-6)} ${c.name}${c.due ? ` (vence ${c.due.slice(0, 10)}${c.dueComplete ? ", hecha" : ""})` : ""}`);
    }
  } else if (cmd === "card") {
    const c = await trello("GET", `/cards/${arg}`, { fields: "name,desc,due", checklists: "all", actions: "commentCard" });
    console.log(c.name, "\n", c.desc);
    for (const cl of c.checklists ?? []) console.log(cl.name, cl.checkItems.map((i) => `${i.state === "complete" ? "[x]" : "[ ]"} ${i.name}`));
    for (const a of c.actions ?? []) console.log("💬", a.date.slice(0, 10), a.data.text);
  } else {
    console.log("uso: boards | board <nombre> | card <id>");
  }
}
