// [LUVIA] Email 2: junta las partes, pasa el QA del método editorial y genera la vista previa. NO envía nada.
// Uso: node --experimental-strip-types docs/luvia/prospeccion/email2-recordatorio-2026-10-29/qa.mjs
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { renderEmail } from "../../../../supabase/functions/_shared/emailTemplate.ts";

const dir = new URL("./", import.meta.url);
const FIRMA = "Nico · Luvia IA";
const CTA = "¿Te interesa que te enseñe cómo funcionaría en vuestra clínica?";
const PROHIBIDOS = [/24\s*\/\s*7/i, /al momento/i, /en segundos/i, /recordatorio/i, /agenda autom/i, /€|\beuros?\b/i,
  /clienta/i, /no os lo cre/i, /probadla|pru[eé]bala/i, /gratis/i, /reseña/i, /https?:|wa\.me|www\./i, /instagram/i];

const partes = readdirSync(dir).filter((f) => /^parte-\d+-\d+\.json$/.test(f)).sort((a, b) => parseInt(a.slice(6)) - parseInt(b.slice(6)));
const todos = partes.flatMap((f) => JSON.parse(readFileSync(new URL(f, dir))));
todos.sort((a, b) => a.n - b.n);

const fallos = [];
const vistos = { email: new Set(), lead: new Set() };
for (const m of todos) {
  const err = [];
  const palabras = m.body.trim().split(/\s+/).length;
  if (palabras < 110 || palabras > 140) err.push(`${palabras} palabras`);
  if ((m.body.match(/\?/g) ?? []).length !== 1) err.push("no tiene exactamente una «?»");
  if (!m.body.trim().endsWith(CTA)) err.push("no acaba en la CTA");
  if (!/^Hola, .+:/.test(m.body)) err.push("saludo");
  if (!m.subject?.startsWith("Re: ")) err.push("asunto sin Re:");
  for (const p of PROHIBIDOS) if (p.test(m.body)) err.push(`prohibido ${p}`);
  if (/whatsapp/i.test(m.body) && !/Con WhatsApp todavía estamos en piloto/.test(m.body) && m.variante !== "B") err.push("habla de WhatsApp fuera de la variante B");
  if (vistos.email.has(m.email.toLowerCase())) err.push("email repetido");
  if (vistos.lead.has(m.lead_id)) err.push("lead repetido");
  vistos.email.add(m.email.toLowerCase()); vistos.lead.add(m.lead_id);
  m.palabras = palabras;
  if (err.length) fallos.push({ n: m.n, name: m.name, err });
}
const faltan = Array.from({ length: 168 }, (_, i) => i + 1).filter((n) => !todos.some((m) => m.n === n));

const conHtml = todos.map((m) => ({
  ...m,
  firma: FIRMA,
  html: renderEmail({ bodyText: `${m.body}\n\n${FIRMA}`, subject: m.subject, brand: "luvia" }),
}));
writeFileSync(new URL("borradores.src.json", dir), JSON.stringify(todos, null, 2));
writeFileSync(new URL("borradores-168.json", dir), JSON.stringify(conHtml, null, 2));

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
writeFileSync(new URL("preview-168.html", dir), `<!doctype html><meta charset="utf-8"><title>Email 2 Luvia: vista previa</title>
<body style="margin:0;background:#eee;font-family:system-ui">` + conHtml.map((m) => `
<section style="max-width:680px;margin:24px auto;background:#fff;border-radius:8px;overflow:hidden">
<div style="padding:10px 16px;background:#f6f6f6;font-size:13px;color:#444">#${m.n} · ${esc(m.name)} · ${esc(m.email)} · variante ${m.variante} · ${m.palabras} palabras<br><b>${esc(m.subject)}</b></div>
<iframe srcdoc="${m.html.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}" style="width:100%;height:560px;border:0"></iframe></section>`).join("") + "</body>");

const porVar = todos.reduce((a, m) => ((a[m.variante] = (a[m.variante] ?? 0) + 1), a), {});
console.log(JSON.stringify({ total: todos.length, faltan, porVariante: porVar, fallos }, null, 2));
