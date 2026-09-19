// [SIMULADOR] Auditoría Home Estimator de empresas de reformas con web (mismo método que la del 20-ago y Madrid 1):
// home + hasta 3 páginas de contacto/presupuesto, campos del formulario, WhatsApp, captcha, embebidos y
// calculadoras, email publicado en su web. Con eso, el modelo da clase A/B/C, score y servicios.
// Guarda cada fila en events (type 'home_estimator_audit', payload.lote) y en <lote>-pool.json.
//
// Uso: node docs/prospeccion/auditar-reformas.mjs --lote madrid-4 --cities "Majadahonda,Tres Cantos" --desde 2026-09-19
//      (audita leads de esas ciudades creados desde esa fecha que no tengan ya auditoría)
import fs from "node:fs";
import path from "node:path";

const DIR = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(DIR, "../..");
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, ".env"), "utf8").split("\n")
  .filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const arg = (k) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : null);
const LOTE = arg("--lote");
const CITIES = (arg("--cities") || "").split(",").map((s) => s.trim()).filter(Boolean);
const DESDE = arg("--desde");
if (!LOTE || !CITIES.length || !DESDE) { console.error("Falta --lote, --cities o --desde"); process.exit(1); }
const MODEL = env.ORQUESTADOR_MODEL || "claude-sonnet-4-6";
const SB = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" };
const REST = `${env.SUPABASE_URL}/rest/v1`;

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36";
async function get(url) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow", signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    return { url: r.url, html: (await r.text()).slice(0, 600000) };
  } catch { return null; }
}
const texto = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

// Emails publicados: mailto + texto. Fuera los de plantillas, imágenes y dominios de terceros típicos.
function emails(html) {
  const raw = [...html.matchAll(/mailto:([^"'?\s>]+)/gi), ...html.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)]
    .map((m) => decodeURIComponent(m[1] || m[0]).toLowerCase().trim());
  return [...new Set(raw)].filter((e) => !/\.(png|jpe?g|webp|gif|svg)$|example|sentry|wixpress|domain\.|tudominio|email\.com|@2x/.test(e));
}
function campos(html) {
  const out = [];
  for (const m of html.matchAll(/<(input|select|textarea)\b([^>]*)>/gi)) {
    const at = m[2];
    const type = (at.match(/type=["']?([a-z]+)/i) || [])[1] || m[1].toLowerCase();
    if (/hidden|submit|button|checkbox|radio|search/.test(type)) continue;
    const n = [(at.match(/name=["']([^"']+)/i) || [])[1], (at.match(/placeholder=["']([^"']+)/i) || [])[1]].filter(Boolean).join(" ");
    out.push(`${m[1].toLowerCase() === "input" ? type : m[1].toLowerCase()}:${n}`.slice(0, 60));
  }
  return [...new Set(out)].slice(0, 25);
}

async function auditar(lead) {
  const home = await get(lead.website_url);
  if (!home) return { caida: true };
  const base = new URL(home.url);
  const enlaces = [...home.html.matchAll(/href=["']([^"'#]+)["']/gi)].map((m) => { try { return new URL(m[1], base).href; } catch { return null; } })
    .filter((u) => u && new URL(u).hostname === base.hostname && /contact|presupuest|cotiza|pide|solicita/i.test(u));
  const paginas = [home];
  for (const u of [...new Set(enlaces)].slice(0, 3)) { const p = await get(u); if (p) paginas.push(p); }
  const html = paginas.map((p) => p.html).join("\n");
  return {
    caida: false,
    paginas: paginas.map((p) => p.url),
    email_web: emails(html).filter((e) => e.endsWith(base.hostname.replace(/^www\./, "")))[0] || emails(html)[0] || null,
    emails_web: emails(html).slice(0, 5),
    campos_formulario: campos(html),
    whatsapp: /wa\.me|api\.whatsapp|whatsapp\.com\/send/i.test(html),
    captcha: /recaptcha|hcaptcha|turnstile/i.test(html),
    embebidos: ["typeform", "jotform", "hubspot", "calendly", "tally.so"].filter((k) => html.toLowerCase().includes(k)),
    calculadora: /calculadora|simulador|configurador|estimador|calcula tu presupuesto|presupuesto online|precio orientativo/i.test(texto(html)),
    texto: paginas.map((p) => `[${p.url}] ${texto(p.html).slice(0, 2500)}`).join("\n").slice(0, 6000),
  };
}

const SYSTEM = `Auditas webs de empresas de reformas españolas para Home Estimator: un simulador que se pone en la web
de la empresa, pregunta al cliente final tipo de obra, metros, estancias, calidades y presupuesto, le da un precio
orientativo y manda a la empresa el contacto ya cualificado.

Clases:
- A: reformista (integrales, cocinas, baños, pisos) que pide presupuesto con un formulario genérico o solo teléfono/WhatsApp; encaje perfecto.
- B: buen encaje pero algo lo complica (ya pregunta tipo de reforma o m², mezcla obra nueva/industrial, web pobre).
- C: no prioritario (ya tiene calculadora o configurador de precio, no es reformista residencial, franquicia/gran empresa, web caída o sin contenido).

Devuelve SOLO JSON: {"clase":"A|B|C","home_estimator_score":0-10 (medios puntos),"servicios":"2 o 3 servicios que nombra su web, minúsculas, con comas e 'y', máx 6 palabras; si no nombra ninguno 'reformas integrales de viviendas'","motivo":"una frase","es_reformista":true|false}.
No inventes nada que no esté en los datos.`;

async function clasificar(lead, a) {
  const user = `Empresa: ${lead.name} (${lead.city}) · ${lead.category} · ${lead.rating}★ ${lead.review_count} reseñas
Web: ${lead.website_url}
Campos del formulario: ${a.campos_formulario.join(", ") || "(ninguno)"}
WhatsApp: ${a.whatsapp} · Captcha: ${a.captcha} · Embebidos: ${a.embebidos.join(",") || "no"} · Palabras de calculadora: ${a.calculadora}
Texto de la web:
${a.texto}`;
  for (let i = 0; i < 3; i++) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 400, system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }], messages: [{ role: "user", content: user }] }),
    });
    if (!r.ok) { await new Promise((ok) => setTimeout(ok, 3000 * (i + 1))); continue; }
    const t = (await r.json()).content?.[0]?.text || "";
    try { return JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1)); } catch { /* reintenta */ }
  }
  return null;
}

const ciudades = CITIES.map((c) => `"${c}"`).join(",");
const leads = await (await fetch(`${REST}/leads?select=id,name,city,category,rating,review_count,website_url,web:raw_json->>website,email,phone,whatsapp&created_at=gte.${DESDE}&city=in.(${encodeURIComponent(ciudades)})&has_website=is.true&do_not_contact=is.false`, { headers: SB })).json()
  .then((ls) => (Array.isArray(ls) ? ls.map((l) => ({ ...l, website_url: l.website_url || l.web })).filter((l) => l.website_url) : ls));
// El ingest del scrape deja la web en raw_json.website; website_url se rellena después (o nunca).
if (!Array.isArray(leads)) throw new Error(JSON.stringify(leads));
const ya = new Set((await (await fetch(`${REST}/events?select=lead_id&type=eq.home_estimator_audit&lead_id=in.(${leads.map((l) => l.id).join(",")})`, { headers: SB })).json()).map((e) => e.lead_id));
const pendientes = leads.filter((l) => !ya.has(l.id));
console.log(`${leads.length} leads en esas ciudades · ${ya.size} ya auditados · ${pendientes.length} por auditar`);

const POOL = path.join(DIR, `${LOTE}-pool.json`);
const pool = fs.existsSync(POOL) ? JSON.parse(fs.readFileSync(POOL, "utf8")) : [];
let hechos = 0;
async function uno(lead) {
  const a = await auditar(lead);
  const c = a.caida ? { clase: "C", home_estimator_score: 0, servicios: "", motivo: "web caída", es_reformista: null } : await clasificar(lead, a);
  if (!c) { console.log(`  ✗ ${lead.name}: sin clasificación`); return; }
  const fila = {
    lead_id: lead.id, nombre: lead.name, ciudad: lead.city, url: lead.website_url, rating: lead.rating, resenas: lead.review_count,
    email: lead.email, email_web: a.email_web, emails_web: a.emails_web, telefono: lead.phone, lote: LOTE,
    clase: c.clase, home_estimator_score: c.home_estimator_score, servicios: c.servicios, motivo_encaje: c.motivo,
    campos_formulario: a.campos_formulario, whatsapp: a.whatsapp, captcha: a.captcha, embebidos: a.embebidos,
    estimacion_automatica: a.calculadora, paginas: a.paginas, caida: a.caida, audited_at: new Date().toISOString(),
  };
  pool.push(fila);
  await fetch(`${REST}/events`, { method: "POST", headers: SB, body: JSON.stringify({ lead_id: lead.id, type: "home_estimator_audit", payload: fila }) });
  console.log(`  ${++hechos}/${pendientes.length} ${c.clase} ${String(c.home_estimator_score).padStart(3)} ${lead.name} · ${fila.email_web || lead.email || "sin email"}`);
}
// 4 en paralelo
for (let i = 0; i < pendientes.length; i += 4) {
  await Promise.all(pendientes.slice(i, i + 4).map(uno));
  fs.writeFileSync(POOL, JSON.stringify(pool, null, 1));
}
const n = (k) => pool.filter((p) => p.clase === k).length;
console.log(`Hecho: A ${n("A")} · B ${n("B")} · C ${n("C")} → ${path.basename(POOL)}`);
