// [SIMULADOR] Envía el mensaje por el formulario de contacto de la web de cada empresa (lo mismo que el encargo de Cowork,
// cowork-formularios/ENCARGO.md, pero con Playwright desde este Mac).
// Uso: node docs/prospeccion/enviar-formularios.mjs [--seco] [--n 167,170] [--desde 0] [--limite 10] [--paralelo 6]
//   --seco  → rellena y hace captura, pero NO envía (para revisar el mapeo de campos).
// Reglas del encargo: CAPTCHA visible (reCAPTCHA v2, hCaptcha, Turnstile, sumas) → no se toca, queda para Nico.
// Newsletter/comerciales sin marcar; privacidad marcada; teléfono solo si es obligatorio. Nunca dos veces a la misma.
// Solo se apuntan en resultados.csv los `enviado` y `captcha`: lo dudoso queda libre para Cowork o a mano.
// Detalle de cada intento (campos, notas, capturas) en formularios-log.json.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";

const require = createRequire(path.join(os.homedir(), ".npm/_npx/e41f203b7505f1fb/node_modules/"));
const { chromium } = require("playwright");

const DIR = path.join(path.dirname(new URL(import.meta.url).pathname), "cowork-formularios");
const SECO = process.argv.includes("--seco");
const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d);
const SOLO = arg("--n", "") ? new Set(arg("--n").split(",")) : null;
const DESDE = Number(arg("--desde", 0));
const LIMITE = Number(arg("--limite", 999));
const PARALELO = Number(arg("--paralelo", 6));
const CAPT = path.join(DIR, "capturas");
fs.mkdirSync(CAPT, { recursive: true });

function parseCsv(txt) {
  const F = []; let f = [], c = "", q = false;
  txt = txt.replace(/^﻿/, "");
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i];
    if (q) { if (ch === '"' && txt[i + 1] === '"') { c += '"'; i++; } else if (ch === '"') q = false; else c += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { f.push(c); c = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && txt[i + 1] === "\n") i++; f.push(c); c = ""; if (f.some((x) => x)) F.push(f); f = []; }
    else c += ch;
  }
  f.push(c); if (f.some((x) => x)) F.push(f);
  const [h, ...r] = F;
  return r.map((x) => Object.fromEntries(h.map((k, j) => [k, x[j] ?? ""])));
}
const csvCampo = (v) => (/[",\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

const LISTA = parseCsv(fs.readFileSync(path.join(DIR, "formularios-todos.csv"), "utf8"));
const RES_F = path.join(DIR, "resultados.csv");
const hechos = new Set(parseCsv(fs.readFileSync(RES_F, "utf8")).map((r) => r.n));
const LOG_F = path.join(DIR, "formularios-log.json");
const log = fs.existsSync(LOG_F) ? JSON.parse(fs.readFileSync(LOG_F, "utf8")) : [];

const DATOS = { nombre: "Nico Soto", email: "hola@nico-soto.es", tel: "600782211", empresa: "nico-soto.es", web: "https://nico-soto.es" };
const RX_CONTACTO = /contact|presupuest|escr[ií]benos|habl(a|emos)|pide|solicita/i;
const RX_EXITO = /gracias|enviad[oa] (correctamente|con [ée]xito)|mensaje (ha sido )?enviado|se ha enviado|hemos recibido|recibido (tu|su) (mensaje|solicitud|consulta)|nos pondremos en contacto|thank you|successfully|message (has been )?sent|en breve (nos|te)/i;
const RX_PRIV = /privacidad|privacy|lopd|legal|pol[ií]tica|aviso legal|acepto|condiciones|rgpd|gdpr|protecci[oó]n de datos|t[ée]rminos|consiento|he le[ií]do/i;
const RX_COMERCIAL = /newsletter|comercial|publicidad|promoc|novedades|bolet[ií]n|ofertas|suscrib/i;

async function quitarCookies(page) {
  for (const rx of [/rechazar|denegar|solo (las )?necesarias|only necessary|reject/i, /aceptar|accept|entendido|de acuerdo|ok$/i]) {
    const b = page.getByRole("button", { name: rx }).first();
    if (await b.isVisible({ timeout: 500 }).catch(() => false)) { await b.click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(500); return; }
  }
}

// Formulario "de contacto" = el que tiene un textarea visible (o, si no hay, un input de email + 3 campos).
async function hayFormulario(page) {
  return page.evaluate(() => [...document.querySelectorAll("textarea")].some((t) => t.offsetParent && t.getBoundingClientRect().height > 20));
}

async function buscarFormulario(page, web) {
  await page.goto(web, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2500);
  await quitarCookies(page);
  const candidatos = await page.evaluate((src) => {
    const rx = new RegExp(src, "i");
    const out = [];
    for (const a of document.querySelectorAll("a[href]")) {
      const t = (a.textContent || "") + " " + a.getAttribute("href");
      if (rx.test(t) && a.href.startsWith("http") && !/mailto:|tel:|wa\.me|whatsapp|facebook|instagram|google/i.test(a.href)) out.push(a.href.split("#")[0]);
    }
    return [...new Set(out)].slice(0, 5);
  }, RX_CONTACTO.source);
  const base = new URL(page.url());
  for (const p of ["/contacto", "/contacto/", "/contact", "/contactar"]) candidatos.push(base.origin + p);
  if (await hayFormulario(page)) candidatos.unshift(page.url());
  for (const u of [...new Set(candidatos)]) {
    if (u !== page.url()) {
      const r = await page.goto(u, { waitUntil: "domcontentloaded", timeout: 25000 }).catch(() => null);
      if (!r || r.status() >= 400) continue;
      await page.waitForTimeout(2000);
      await quitarCookies(page);
    }
    if (await hayFormulario(page)) return page.url();
  }
  return null;
}

// Marca el formulario elegido (el primero con textarea visible) y devuelve sus campos visibles con su etiqueta.
async function leerCampos(page) {
  return page.evaluate(() => {
    const ta = [...document.querySelectorAll("textarea")].find((t) => t.offsetParent && t.getBoundingClientRect().height > 20);
    let form = ta.closest("form");
    if (!form) { form = ta; while (form.parentElement && form.querySelectorAll("input,textarea,select").length < 3) form = form.parentElement; }
    document.querySelectorAll("[data-wf-form]").forEach((x) => x.removeAttribute("data-wf-form"));
    form.setAttribute("data-wf-form", "1");
    const etiqueta = (el) => {
      let t = "";
      if (el.id) { const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`); if (l) t += l.textContent; }
      const lc = el.closest("label"); if (lc) t += " " + lc.textContent;
      t += " " + (el.getAttribute("aria-label") || "") + " " + (el.placeholder || "") + " " + (el.name || "") + " " + (el.id || "");
      // Texto del contenedor (la etiqueta suelta de al lado o el texto legal de la casilla), si es corto.
      for (let p = el.parentElement, k = 0; p && k < 3; p = p.parentElement, k++) {
        const pt = (p.textContent || "").replace(/\s+/g, " ").trim();
        if (pt && pt.length < 250 && p.querySelectorAll("input,textarea,select").length <= 2) { t += " " + pt; break; }
      }
      return t.replace(/\s+/g, " ").trim().slice(0, 300);
    };
    const campos = [];
    let i = 0;
    for (const el of form.querySelectorAll("input,textarea,select")) {
      const tipo = (el.type || el.tagName).toLowerCase();
      if (["hidden", "submit", "button", "image", "reset", "file"].includes(tipo)) continue;
      const visible = el.offsetParent !== null || (["checkbox", "radio"].includes(tipo) && el.closest("label")?.offsetParent);
      if (!visible) continue;
      // Trampas antispam (honeypot): campos sacados de pantalla, diminutos o que piden no rellenarse.
      const rc = el.getBoundingClientRect(), cs = getComputedStyle(el);
      const fuera = !["checkbox", "radio"].includes(tipo) && (rc.width < 4 || rc.height < 4 || rc.right < 0 || rc.left < -500 || cs.opacity === "0");
      if (fuera || /no rellen|leave (this )?(field )?(blank|empty)|honeypot|\bhp[-_]|ak_hp/i.test(etiqueta(el) + el.className)) continue;
      el.setAttribute("data-wf-i", String(i));
      const lab = etiqueta(el);
      campos.push({
        i: i++, tag: el.tagName.toLowerCase(), tipo, name: el.name || "", etiqueta: lab,
        requerido: el.required || el.getAttribute("aria-required") === "true" || /\*/.test(lab) || /required|obligatori/i.test(el.className),
        maxlength: el.maxLength > 0 ? el.maxLength : null,
        opciones: el.tagName === "SELECT" ? [...el.options].map((o) => ({ v: o.value, t: o.textContent.trim() })) : null,
      });
    }
    // Solo cuentan los retos que hay que resolver a mano. El reCAPTCHA v3 / invisible no pide nada: no es CAPTCHA a efectos del encargo.
    const iframes = [...document.querySelectorAll("iframe")];
    const grande = (el) => { const r = el.getBoundingClientRect(); return r.width > 30 && r.height > 30; };
    const captcha =
      iframes.some((f) => /recaptcha\/(api2|enterprise)\/anchor/.test(f.src) && !/size=invisible/.test(f.src) && grande(f)) ? "reCAPTCHA v2"
      : [...document.querySelectorAll(".g-recaptcha[data-sitekey]")].some((d) => !/invisible/.test(d.dataset.size || "") && !/v3|elementor-g-recaptcha/.test(d.className)) ? "reCAPTCHA v2"
      : iframes.some((f) => /hcaptcha/.test(f.src) && grande(f)) ? "hCaptcha"
      : document.querySelector(".cf-turnstile") || iframes.some((f) => /challenges\.cloudflare/.test(f.src)) ? "Turnstile"
      : campos.find((c) => /captcha|cu[aá]nto (es|son)|resuelve|\d\s*[+x×*-]\s*\d\s*=|operaci[oó]n|quiz|cf7sr/i.test(c.etiqueta)) ? "pregunta/suma de verificación"
      : null;
    return { campos, captcha };
  });
}

function mapear(c, row) {
  const e = c.etiqueta.toLowerCase();
  if (c.tipo === "checkbox") {
    if (RX_COMERCIAL.test(e)) return { accion: "no marcar" };
    if (RX_PRIV.test(e)) return { accion: "marcar" };
    return c.requerido ? { accion: "marcar", nota: "casilla obligatoria desconocida" } : { accion: "no marcar" };
  }
  if (c.tipo === "radio") return { accion: "radio" };
  if (c.tag === "select") {
    const op = c.opciones.find((o) => o.v && /otro|informaci|consulta|general|presupuesto/i.test(o.t)) || c.opciones.find((o) => o.v && !/selecciona|elige|escoge|--/i.test(o.t));
    return op ? { accion: "select", valor: op.v, nota: `desplegable «${c.etiqueta.slice(0, 40)}» → ${op.t}` } : { accion: "saltar" };
  }
  if (c.tag === "textarea") {
    const largo = c.maxlength && c.maxlength < row.mensaje.length;
    return { accion: "rellenar", valor: largo ? row.mensaje_corto : row.mensaje, nota: largo ? "mensaje_corto por límite" : null };
  }
  const tel = c.requerido ? { accion: "rellenar", valor: DATOS.tel } : { accion: "saltar" };
  if (c.tipo === "email") return { accion: "rellenar", valor: DATOS.email };
  if (c.tipo === "tel" || /tel[eé]f|phone|m[oó]vil|celular/.test(e)) return tel;
  if (/e-?mail|correo/.test(e)) return { accion: "rellenar", valor: DATOS.email };
  if (/asunto|subject|motivo|tema/.test(e)) return { accion: "rellenar", valor: row.asunto };
  if (/apellido|surname|last.?name/.test(e) && !/nombre|first/.test(e)) return { accion: "rellenar", valor: "Soto", apellido: true };
  if (/empresa|company|compa[ñn][ií]a|negocio/.test(e)) return c.requerido ? { accion: "rellenar", valor: DATOS.empresa } : { accion: "saltar" };
  if (/nombre|name|nom\b/.test(e)) return { accion: "rellenar", valor: DATOS.nombre };
  if (/mensaje|message|comentario|consulta/.test(e)) return { accion: "rellenar", valor: row.mensaje_corto };
  if (/web|url|sitio/.test(e)) return c.requerido ? { accion: "rellenar", valor: DATOS.web } : { accion: "saltar" };
  if (/ciudad|localidad|poblaci[oó]n|municipio|city|provincia/.test(e)) return c.requerido ? { accion: "rellenar", valor: "Valencia" } : { accion: "saltar" };
  if (/postal|\bcp\b|c\.p\.|zip/.test(e)) return c.requerido ? { accion: "rellenar", valor: "46001" } : { accion: "saltar" };
  if (c.tipo === "number" || c.tipo === "date") return c.requerido ? { accion: "desconocido" } : { accion: "saltar" };
  return c.requerido ? { accion: "desconocido" } : { accion: "saltar" };
}

async function rellenar(page, campos, row) {
  const notas = [];
  const plan = campos.map((c) => ({ c, m: mapear(c, row) }));
  // Si hay campo de apellido, el de nombre lleva solo "Nico".
  const hayApellido = plan.some((p) => p.m.apellido);
  const desconocidos = plan.filter((p) => p.m.accion === "desconocido");
  if (desconocidos.length) return { ok: false, notas: [`campo obligatorio sin mapear: ${desconocidos.map((p) => `«${p.c.etiqueta.slice(0, 50)}»`).join(", ")}`] };
  const radiosHechos = new Set();
  for (const { c, m } of plan) {
    const loc = page.locator(`[data-wf-form] [data-wf-i="${c.i}"]`);
    if (m.nota) notas.push(m.nota);
    try {
      if (m.accion === "rellenar") await loc.fill(hayApellido && m.valor === DATOS.nombre ? "Nico" : m.valor, { timeout: 5000 });
      else if (m.accion === "marcar") {
        // Casillas con estilo propio: si el clic no la marca, se pulsa su etiqueta y, en último caso, se marca con su evento.
        await loc.check({ timeout: 4000, force: true }).catch(async () => {
          await loc.evaluate((el) => (el.closest("label") || document.querySelector(`label[for="${CSS.escape(el.id)}"]`))?.click()).catch(() => {});
          if (!(await loc.isChecked())) await loc.evaluate((el) => { el.checked = true; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); });
        });
        if (!(await loc.isChecked())) throw new Error("la casilla sigue sin marcar");
      }
      else if (m.accion === "select") await loc.selectOption(m.valor, { timeout: 5000 });
      else if (m.accion === "radio" && c.name && !radiosHechos.has(c.name) && c.requerido) { await loc.check({ timeout: 5000, force: true }); radiosHechos.add(c.name); notas.push(`radio «${c.etiqueta.slice(0, 40)}»`); }
    } catch (err) { return { ok: false, notas: [...notas, `no pude rellenar «${c.etiqueta.slice(0, 50)}»: ${err.message.split("\n")[0]}`] }; }
  }
  if (!plan.some((p) => p.c.tag === "textarea" && p.m.accion === "rellenar")) return { ok: false, notas: [...notas, "sin campo de mensaje"] };
  if (!plan.some((p) => p.m.valor === DATOS.email)) return { ok: false, notas: [...notas, "sin campo de email"] };
  return { ok: true, notas, plan: plan.map((p) => ({ campo: p.c.etiqueta.slice(0, 60), tipo: p.c.tipo, accion: p.m.accion, valor: p.m.valor ? String(p.m.valor).slice(0, 40) : undefined })) };
}

async function enviar(page) {
  const antes = (await page.textContent("body").catch(() => "")) || "";
  const urlAntes = page.url();
  const boton = page.locator("[data-wf-form] button[type=submit], [data-wf-form] input[type=submit], [data-wf-form] button:not([type]), [data-wf-form] [role=button]")
    .filter({ hasNotText: /^\s*$/ }).first();
  const alt = page.locator("[data-wf-form] input[type=submit]").first();
  const b = (await boton.count()) ? boton : alt;
  if (!(await b.count())) return { estado: "error", nota: "no encuentro el botón de enviar" };
  await b.click({ timeout: 8000 }).catch(async () => b.click({ timeout: 5000, force: true }));
  for (let t = 0; t < 12; t++) {
    await page.waitForTimeout(1000);
    const ahora = (await page.textContent("body").catch(() => "")) || "";
    const nuevo = ahora.replace(antes, "");
    const m = (nuevo.match(RX_EXITO) || (page.url() !== urlAntes && ahora.match(RX_EXITO)));
    if (m) return { estado: "enviado", nota: `confirmación: «${m[0]}»` };
    if (await page.locator("form.sent, .wpcf7-mail-sent-ok, .elementor-message-success, .wpforms-confirmation-container, .gform_confirmation_message").count()) return { estado: "enviado", nota: "confirmación del plugin" };
    if (await page.locator("form.invalid, form.failed, form.spam, .wpcf7-validation-errors, .wpcf7-mail-sent-ng, .elementor-message-danger").count()) {
      const txt = (await page.locator(".wpcf7-response-output, .elementor-message").first().textContent().catch(() => "")) || "";
      return { estado: "error", nota: `el formulario rechazó el envío: ${txt.trim().slice(0, 120)}` };
    }
  }
  return { estado: "error", nota: "sin confirmación visible tras 12 s" };
}

// Chrome del sistema: el Chromium de este Playwright no está descargado y así se parece más a un navegador normal.
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const ctx = await browser.newContext({
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  locale: "es-ES", viewport: { width: 1280, height: 900 },
});
const filas = LISTA.filter((r) => (!SOLO || SOLO.has(r.n))).slice(DESDE, DESDE + LIMITE);
const cuenta = {};
async function procesar(row) {
  if (hechos.has(row.n)) { console.log(`${row.n} ${row.empresa} · ya en resultados.csv, salto`); return; }
  if (!SECO && log.some((x) => x.n === row.n && x.estado === "enviado")) { console.log(`${row.n} ${row.empresa} · ya enviado según el log, salto`); return; }
  const page = await ctx.newPage();
  const r = { n: row.n, empresa: row.empresa, web: row.web, seco: SECO, at: new Date().toISOString() };
  try {
    const url = await buscarFormulario(page, row.web);
    r.url_formulario = url || "";
    if (!url) { r.estado = "sin_formulario"; r.nota = "no detecté formulario con campo de mensaje"; }
    else {
      const { campos, captcha } = await leerCampos(page);
      if (captcha) { r.estado = "captcha"; r.nota = captcha; }
      else {
        const rel = await rellenar(page, campos, row);
        r.plan = rel.plan; r.nota = rel.notas.join("; ");
        await page.locator("[data-wf-form]").first().screenshot({ path: path.join(CAPT, `${row.n}-relleno.png`) }).catch(() => page.screenshot({ path: path.join(CAPT, `${row.n}-relleno.png`) }));
        if (!rel.ok) r.estado = "no_mapeado";
        else if (SECO) r.estado = "listo";
        else {
          const env = await enviar(page);
          r.estado = env.estado; r.nota = [r.nota, env.nota].filter(Boolean).join("; ");
          await page.screenshot({ path: path.join(CAPT, `${row.n}-despues.png`) }).catch(() => {});
        }
      }
    }
  } catch (err) {
    r.estado = /ERR_NAME|ERR_CONNECTION|ERR_CERT|Timeout|net::/i.test(err.message) ? "web_caida" : "error";
    r.nota = err.message.split("\n")[0].slice(0, 200);
  }
  await page.close();
  cuenta[r.estado] = (cuenta[r.estado] || 0) + 1;
  console.log(`${r.n} ${r.empresa} · ${r.estado}${r.nota ? " · " + r.nota : ""}${r.url_formulario ? " · " + r.url_formulario : ""}`);
  log.push(r);
  fs.writeFileSync(LOG_F, JSON.stringify(log, null, 2));
  if (!SECO && ["enviado", "captcha"].includes(r.estado)) {
    const fecha = new Date().toLocaleString("sv-SE", { timeZone: "Europe/Madrid" }).slice(0, 16);
    fs.appendFileSync(RES_F, [row.n, row.empresa, r.estado, fecha, r.url_formulario, r.nota || ""].map(csvCampo).join(",") + "\n");
  }
}
// Varias webs a la vez: casi todo el tiempo es esperar a que carguen.
const cola = [...filas];
await Promise.all(Array.from({ length: PARALELO }, async () => { while (cola.length) await procesar(cola.shift()); }));
await browser.close();
console.log("\nResumen:", cuenta);
