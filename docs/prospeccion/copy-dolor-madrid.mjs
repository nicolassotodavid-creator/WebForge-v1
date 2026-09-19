// [SIMULADOR] Copy "dolor" (19-sep) para Madrid 2 y Madrid 3: reescribe asunto/cuerpo/seguimiento de
// outreach_reformas_<lote>.csv y añade el email 3 (email3_asunto/email3_cuerpo).
//
// El asunto y la primera línea atacan el dolor (leads de plataforma compartidos, presupuestos a quien no
// contesta), no describen la herramienta. Copy aprobado por Nico el 19-sep.
// A/B de asunto, conservando el reparto que ya tenía cada lote (A-fijo → A, B-medida → B):
//   A-leads    = "¿Pagas por leads que reciben 4?"
//   B-contesta = "Presupuestos que no te contestan"
// Email 2 y 3 van como "Re: <asunto 1>".
// {servicios} sale de madrid-servicios.json (extraído de la auditoría de su web y revisado).
// Verificación de buzones del 19-sep (SMTP RCPT): Reformas TVM no existe → enviar=FALSE.
//
// Uso: node docs/prospeccion/copy-dolor-madrid.mjs   (reescribe los dos CSV)
import fs from "node:fs";
import path from "node:path";

const DIR = path.dirname(new URL(import.meta.url).pathname);
const SERVICIOS = JSON.parse(fs.readFileSync(path.join(DIR, "madrid-servicios.json"), "utf8"));
const NO_ENVIAR = { "reformas-tvm": "buzón inexistente (Gmail 550 NoSuchUser, verificado 19-sep)" };

const ASUNTO = { A: "¿Pagas por leads que reciben 4?", B: "Presupuestos que no te contestan" };
const VARIANTE = { A: "A-leads", B: "B-contesta" };

const cuerpo1 = (empresa, servicios) => `Hola,

¿Cuántas visitas y presupuestos haces a clientes que luego no contestan, o que solo querían comparar precio? Y si el contacto viene de Habitissimo o Cronoshare, encima lo has pagado y lo tienen otras tres empresas.

He preparado un simulador para la web de ${empresa}: el cliente elige tipo de obra, metros y calidades, ve un precio orientativo y te escribe ya sabiendo cuánto cuesta. Ese contacto es solo tuyo.

Ya está montado con tu nombre y tus servicios (${servicios}):
{link_demo}

¿Hoy te llegan más clientes por tu web o por plataformas?

Nico Soto
nico-soto.es`;

const cuerpo2 = () => `Hola de nuevo,

Un contacto de plataforma cuesta 15 € o más y le llega a la vez a otras tres empresas: o llamas el primero o lo pierdes.

Los que entran por el simulador de tu web ya han visto un precio y no los comparte nadie:
{link_demo}

¿Pagas hoy por contactos en alguna plataforma?

Nico`;

const cuerpo3 = (empresa) => `Hola,

Último correo. Cada visita a alguien que solo quería "hacerse una idea" es una mañana perdida. Con el simulador, quien no encaja con el precio ya no te llama.

La demo de ${empresa} sigue aquí: {link_demo}

¿Lo dejo aquí o te interesa verlo 10 minutos?

Nico`;

// CSV con comillas, "" escapadas y saltos de línea dentro de campos.
function parseCsv(txt) {
  const filas = []; let fila = [], campo = "", q = false;
  txt = txt.replace(/^﻿/, "");
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) {
      if (c === '"' && txt[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') q = false;
      else campo += c;
    } else if (c === '"') q = true;
    else if (c === ",") { fila.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && txt[i + 1] === "\n") i++;
      fila.push(campo); campo = "";
      if (fila.some((x) => x !== "")) filas.push(fila);
      fila = [];
    } else campo += c;
  }
  fila.push(campo); if (fila.some((x) => x !== "")) filas.push(fila);
  const [cab, ...resto] = filas;
  return { cab, filas: resto.map((f) => Object.fromEntries(cab.map((k, j) => [k, f[j] ?? ""]))) };
}
const esc = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;

for (const lote of ["madrid2", "madrid3"]) {
  const CSV = path.join(DIR, `outreach_reformas_${lote}.csv`);
  const { cab, filas } = parseCsv(fs.readFileSync(CSV, "utf8"));
  for (const k of ["email3_asunto", "email3_cuerpo"]) if (!cab.includes(k)) cab.splice(cab.indexOf("enviar"), 0, k);
  for (const f of filas) {
    const ab = /^A/.test(f.variante) ? "A" : "B";
    const servicios = SERVICIOS[f.slug];
    if (!servicios) throw new Error(`Sin servicios para ${f.slug}`);
    f.variante = f.cluster = VARIANTE[ab];
    f.asunto = ASUNTO[ab];
    f.cuerpo = cuerpo1(f.empresa, servicios);
    f.followup_asunto = f.email3_asunto = `Re: ${ASUNTO[ab]}`;
    f.followup_cuerpo = cuerpo2();
    f.email3_cuerpo = cuerpo3(f.empresa);
    if (NO_ENVIAR[f.slug]) { f.enviar = "FALSE"; f.aviso = NO_ENVIAR[f.slug]; }
  }
  fs.writeFileSync(CSV, [cab.join(","), ...filas.map((f) => cab.map((k) => esc(f[k])).join(","))].join("\n") + "\n");
  const n = (v) => filas.filter((f) => f.enviar === "TRUE" && f.variante === v).length;
  console.log(`${lote}: ${filas.length} filas · A ${n("A-leads")} · B ${n("B-contesta")} · fuera ${filas.filter((f) => f.enviar !== "TRUE").length}`);
}
