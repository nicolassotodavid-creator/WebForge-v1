// [LUVIA] Revisión del decisor de las clínicas prospectadas: deriva 6+2 campos por clínica y los
// guarda en el panel (leads). NO busca clínicas nuevas.
//
//   node orquestador/luvia-decisor.mjs                 # revisa + re-verifica fuentes, escribe informe local (no toca la DB)
//   node orquestador/luvia-decisor.mjs --no-verify     # sin abrir las fuentes (todo lo no verificado queda "probable")
//   node orquestador/luvia-decisor.mjs --apply         # además PATCH a leads (requiere migración 0027 aplicada)
//
// Entrada: docs/luvia/prospeccion/clinicas-luvia-investigacion-*.json + el CSV de las 50 (datos de
// terceros: NO están en git). Salida: docs/luvia/prospeccion/decisor-revision-*.{json,csv} (tampoco).
//
// Criterio (lo que significa cada valor):
//  - decision_confidence = 'confirmado' SOLO si en ESTA pasada se reabre una fuente y se ve el nombre
//    (≥2 palabras) junto a una palabra de cargo. Sin poder reabrirla, queda 'probable'.
//  - director_medico nunca pasa de 'probable': sin propiedad identificada no se sabe quién aprueba el gasto.
//  - phone_type 'movil_directo' solo si el móvil está publicado como suyo, o es el móvil de la clínica
//    y ella es la única profesional. Cualquier otra línea de clínica = 'centralita'.
//  - contact_permission: ninguna clínica ha dado consentimiento. 'contacto_publicado' = el canal está
//    publicado por la clínica para contacto profesional (NO es consentimiento para publicidad).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const args = new Set(process.argv.slice(2));
const VERIFY = !args.has("--no-verify");
const APPLY = args.has("--apply");
const DIR = resolve(root, "docs/luvia/prospeccion");
const FECHA = "2026-10-15";

// ---------- entorno ----------
const env = {};
for (const l of readFileSync(resolve(root, ".env"), "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const SB = env.SUPABASE_URL.replace(/\/$/, "");
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

// ---------- entrada ----------
function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}
const csv = parseCsv(readFileSync(resolve(DIR, "clinicas-luvia-50-2026-10-15.csv"), "utf8"));
const research = new Map(
  JSON.parse(readFileSync(resolve(DIR, "clinicas-luvia-investigacion-2026-10-15.json"), "utf8")).map((x) => [x.placeId, x]),
);
const pids = csv.map((r) => r.google_place_id);

async function sb(path, init) {
  const r = await fetch(`${SB}/rest/v1/${path}`, { headers: H, ...init });
  if (!r.ok) throw new Error(`${r.status} ${path.slice(0, 60)}: ${(await r.text()).slice(0, 200)}`);
  return r.status === 204 ? null : r.json();
}
const inList = (a) => `(${a.join(",")})`;
const dbLeads = await sb(
  `leads?select=id,name,owner,status,email,phone,whatsapp,has_website,do_not_contact,google_place_id&google_place_id=in.${encodeURIComponent(inList(pids))}`,
);
const dbBy = new Map(dbLeads.map((l) => [l.google_place_id, l]));
const outreach = await sb(
  `outreach_messages?select=lead_id&lead_id=in.${encodeURIComponent(inList(dbLeads.map((l) => l.id)))}`,
);
const contactedIds = new Set(outreach.map((o) => o.lead_id));

// ---------- utilidades de texto ----------
const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const STOP = new Set(["de", "del", "la", "las", "los", "el", "y", "e", "dra", "dr", "doctora", "doctor", "dona", "don", "sra", "sr", "probablemente", "nombre", "pila", "probable"]);
function nameTokens(nombre) {
  const base = String(nombre ?? "").split("(")[0];
  return [...new Set(norm(base).split(/[^a-z]+/).filter((t) => t.length >= 3 && !STOP.has(t)))];
}
function cleanName(nombre) {
  return String(nombre ?? "").split("(")[0].replace(/[\s,;]+$/, "").trim();
}
const ENT = {
  nbsp: " ", amp: "&", quot: '"', apos: "'", lt: "<", gt: ">",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú",
  agrave: "à", egrave: "è", ograve: "ò", ntilde: "ñ", Ntilde: "Ñ", uuml: "ü", Uuml: "Ü", ccedil: "ç", middot: "·", ordf: "ª", ordm: "º",
};
function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&([a-zA-Z]+);/g, (m, n) => ENT[n] ?? m)
    .replace(/\s+/g, " ");
}
const OWN_RX = /titular|propietari|administrador|socio|socia|fundador|gerente|director general|\bnif\b|\bcif\b|razon social|nombramiento|due(n|ñ)a|responsable del (sitio|fichero|tratamiento)/;
// Fuente "fuerte": aviso legal / política de privacidad de la web propia o registro mercantil.
// Portada, "equipo" o prensa NO bastan: ahí el cargo de un vecino cae en la misma ventana.
const STRONG_URL = /aviso-?legal|\/legal|privacidad|politica|condiciones|empresia\.es|borme|registro/i;
const PRO_RX = /directora|director|medic|doctora|doctor|colegiad|responsable sanitari|especialista/;

// ---------- verificación de fuentes ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Caché de páginas (untracked): la escritura final usa EXACTAMENTE lo que se revisó. --refresh la ignora.
const CACHE_FILE = resolve(DIR, `decisor-fuentes-cache-${FECHA}.json`);
let CACHE = {};
try { if (!args.has("--refresh")) CACHE = JSON.parse(readFileSync(CACHE_FILE, "utf8")); } catch { /* sin caché */ }
async function fetchText(url) {
  if (url in CACHE) return CACHE[url];
  const res = await fetchTextLive(url);
  CACHE[url] = res.ok ? { ok: true, text: res.text.slice(0, 400000) } : res;
  return CACHE[url];
}
async function fetchTextLive(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(url, {
      signal: ctl.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept-Language": "es-ES,es;q=0.9",
      },
    });
    if (!r.ok) return { ok: false, why: `HTTP ${r.status}` };
    return { ok: true, text: htmlToText(await r.text()) };
  } catch (e) {
    return { ok: false, why: e.name === "AbortError" ? "timeout" : String(e.cause?.code ?? e.message).slice(0, 40) };
  } finally {
    clearTimeout(t);
  }
}

/**
 * Busca en la página una ventana con el nombre (≥2 palabras DISTINTAS del nombre juntas) y una
 * palabra de cargo. Devuelve la cita real. Exigir las 2 palabras en la misma ventana evita el falso
 * positivo de "Copyright © Doctora Matas" (marca, no persona).
 */
function findProof(pageText, tokens, needOwnership) {
  const n = norm(pageText);
  const hit = tokens.filter((t) => new RegExp(`\\b${t}\\b`).test(n));
  if (hit.length < 2) return { ok: false, matched: hit.length };
  const rx = needOwnership ? OWN_RX : new RegExp(`${OWN_RX.source}|${PRO_RX.source}`);
  for (const tk of hit) {
    const re = new RegExp(`\\b${tk}\\b`, "g");
    let m, guard = 0;
    while ((m = re.exec(n)) && guard++ < 25) {
      const a = Math.max(0, m.index - 140), b = Math.min(n.length, m.index + 160);
      const win = n.slice(a, b);
      if (hit.filter((t) => new RegExp(`\\b${t}\\b`).test(win)).length >= 2 && rx.test(win))
        return { ok: true, quote: pageText.slice(a, b).trim().replace(/\s+/g, " ") };
    }
  }
  return { ok: false, matched: hit.length };
}

const LEGAL_PATHS = ["/aviso-legal", "/aviso-legal/", "/es/aviso-legal", "/legal", "/politica-de-privacidad", "/aviso-legal-y-politica-de-privacidad"];
const THIRD_PARTY = /linkedin\.com|instagram\.com|facebook\.com|doctoralia|empresia|einforma|axesor|noudiari|google\./i;

/** ¿El email "verificado (publicado)" es de la persona decisora y no de otra (recepción, gerente…)? */
function emailEsPersonal(email, estado, fuenteEmail, tokens) {
  if (!/^verificado/.test(String(estado ?? ""))) return false;
  const f = norm(fuenteEmail);
  if (/no hay email|es el de (la|el) (gerente|recepcion|administrativ|secretari)|otra persona/.test(f)) return false;
  const local = norm(String(email ?? "").split("@")[0]).replace(/[^a-z]/g, "");
  if (tokens.some((t) => t.length >= 4 && local.includes(t))) return true;
  return /titular|nominal|personal|se presenta|es ella|su marca|suyo|suya/.test(f);
}

// ---------- reglas de derivación ----------
function roleOf(cargo) {
  const c = norm(cargo);
  if (/titular|propietari|due(n|ñ)a|socio unico|socia unica|socio\/a unic|persona fisica|fundador|fundadora|cofundador|autonom/.test(c)) return "propietario";
  if (/administrador|administradora/.test(c)) return "administrador";
  if (/gerente|director general|\bceo\b/.test(c)) return "gerente";
  if (/director|directora/.test(c)) return "director_medico";
  return "desconocido";
}
const isMobile = (p) => /^[67]/.test(String(p ?? "").replace(/\D/g, "").slice(-9));
const SOLO_RX = /unica profesional|lleva sola|atiende ella|ella misma|el mismo facultativo|unipersonal|autonoma/;

const out = [];
for (const r of csv) {
  const x = research.get(r.google_place_id);
  const db = dbBy.get(r.google_place_id);
  if (!x || !db) { console.error("FALTA en json/db:", r.clinica); continue; }
  const dec = x.decisor ?? {};
  const cargo = String(dec.cargo ?? "");
  const fuente = String(dec.fuente ?? "");
  const razones = [];

  // ----- cargo / rol -----
  const role = roleOf(cargo);
  const tokens = nameTokens(dec.nombre);
  const nameIncomplete = tokens.length < 2 || /^probablemente/i.test(String(dec.nombre ?? ""));

  // ----- evidencia (re-verificación) -----
  const urls = [...new Set((fuente.match(/https?:\/\/[^\s)\]'"]+/g) ?? []).map((u) => u.replace(/[.,;]+$/, "")))];
  let proof = null, weak = null, fetched = 0, failed = [];
  if (VERIFY && !nameIncomplete) {
    for (const u of urls) {
      if (/linkedin\.com|instagram\.com/i.test(u)) { failed.push(`${new URL(u).hostname}: requiere sesión`); continue; }
      const res = await fetchText(u);
      await sleep(600);
      if (!res.ok) { failed.push(`${new URL(u).hostname}: ${res.why}`); continue; }
      fetched++;
      const p = findProof(res.text, tokens, role !== "director_medico");
      if (p.ok) {
        if (STRONG_URL.test(u)) { proof = { url: u, quote: p.quote }; break; }
        weak ??= { url: u, quote: p.quote };
      }
    }
    // Segunda oportunidad: el aviso legal de la web propia (la fuente citada puede ser la home,
    // que a veces es una SPA sin texto o no nombra a la titular).
    if (!proof) {
      const origins = new Set();
      for (const u of [...urls, x.web].filter(Boolean)) {
        try { const o = new URL(u); if (!THIRD_PARTY.test(o.hostname)) origins.add(o.origin); } catch { /* url rota */ }
      }
      outer: for (const o of origins) {
        for (const pth of LEGAL_PATHS) {
          const res = await fetchText(o + pth);
          await sleep(400);
          if (!res.ok) continue;
          fetched++;
          const p = findProof(res.text, tokens, role !== "director_medico");
          if (p.ok) { proof = { url: o + pth, quote: p.quote }; break outer; }
        }
      }
    }
  }

  // ----- confianza -----
  const cautela = /probabl|sin confirmar|no identificad|no consta|no figura/.test(norm(cargo + " " + fuente));
  const mancomunada = /mancomun/.test(norm(cargo));
  let confidence;
  if (nameIncomplete) { confidence = "sin_verificar"; razones.push("nombre incompleto (sin apellido confirmado)"); }
  else if (!proof) {
    confidence = "probable";
    razones.push(
      !VERIFY ? "no se reabrió la fuente (--no-verify)"
        : weak ? "nombre + cargo solo en portada/equipo/prensa, no en aviso legal ni registro"
        : fetched ? "se abrió la fuente pero no aparece nombre + cargo"
        : "no se pudo reabrir la fuente",
    );
  } else confidence = "confirmado";
  if (confidence === "confirmado" && (cautela || role === "director_medico" || mancomunada)) {
    confidence = "probable";
    razones.push(cautela ? "la propia investigación marca cautela" : role === "director_medico" ? "directora médica sin propiedad identificada: no se sabe quién aprueba el gasto" : "administración mancomunada: firma conjunta con otra persona");
  }

  // ----- teléfono -----
  const tel = x.telefono_directo_decisor ?? {};
  const solo = SOLO_RX.test(norm(`${cargo} ${x.notas ?? ""} ${x.motivo_clasificacion ?? ""}`));
  const clinicPhone = db.phone || r.telefono_clinica || "";
  let phone_type;
  if (tel.valor && isMobile(tel.valor)) { phone_type = "movil_directo"; razones.push("móvil publicado como suyo"); }
  else if (clinicPhone && isMobile(clinicPhone) && solo) { phone_type = "movil_directo"; razones.push("móvil de la clínica y es la única profesional"); }
  else if (clinicPhone) { phone_type = "centralita"; razones.push(`línea de clínica (${isMobile(clinicPhone) ? "móvil" : "fijo"}), no consta que llegue a ella`); }
  else phone_type = "desconocido";

  // ----- canal y permiso -----
  const ed = x.email_decisor ?? {};
  const decisorEmailPublicado =
    emailEsPersonal(ed.valor, ed.estado, r.fuente_email_decisor, tokens) && !/RECHAZO/.test(String(x._smtp ?? ""));
  if (/^verificado/.test(String(ed.estado ?? "")) && !decisorEmailPublicado)
    razones.push("email publicado pero no consta que sea suyo (de otra persona o genérico)");
  const emailClinica = db.email || "";
  let contact_channel = null;
  if (phone_type === "movil_directo") contact_channel = "telefono";
  else if (decisorEmailPublicado || emailClinica) contact_channel = "email";
  else if (clinicPhone) contact_channel = "telefono";
  let contact_permission = "sin_consentimiento";
  if (db.do_not_contact) contact_permission = "baja";
  else if (contact_channel) contact_permission = "contacto_publicado";

  // ----- preparación comercial -----
  const decide = ["propietario", "administrador", "gerente"].includes(role);
  const llegaAElla = phone_type === "movil_directo" || decisorEmailPublicado || (solo && (emailClinica || clinicPhone));
  let sales_readiness, why;
  if (db.do_not_contact || db.status !== "new" || contactedIds.has(db.id)) { sales_readiness = "descartado"; why = "ya contactada o con baja"; }
  else if (decide && confidence === "confirmado" && llegaAElla) { sales_readiness = "listo_para_contacto"; why = "decide, está confirmada y hay vía que le llega"; }
  else if (!clinicPhone && !emailClinica && !decisorEmailPublicado) { sales_readiness = "descartado"; why = "sin ningún canal"; }
  else {
    sales_readiness = "pendiente_de_verificar";
    why = !decide ? "no consta que decida el gasto" : confidence !== "confirmado" ? "decisión sin confirmar" : "decisor identificado pero sin vía directa verificada";
  }
  razones.push(`→ ${sales_readiness}: ${why}`);

  const shown = proof ?? weak;
  const evidence = shown
    ? `${shown.url} — «${shown.quote}» (${proof ? "reverificado" : "visto, sin aviso legal/registro:"} ${FECHA})`
    : `${urls[0] ?? "sin URL"} — ${cargo.slice(0, 200)} (citado en la investigación del ${FECHA}; ${failed.length ? "no se pudo reabrir: " + failed.slice(0, 2).join(", ") : "sin reverificar"})`;

  out.push({
    rank: Number(r.rank), clase: r.clase, clinica: r.clinica, ciudad: r.ciudad, n_centros: x.n_centros, solo,
    lead_id: db.id, google_place_id: r.google_place_id,
    patch: {
      business_decision_maker: role,
      decision_maker_name: cleanName(dec.nombre) || null,
      decision_evidence: evidence.slice(0, 900),
      decision_confidence: confidence,
      phone_type,
      contact_permission,
      contact_channel,
      sales_readiness,
    },
    razones,
  });
}

writeFileSync(CACHE_FILE, JSON.stringify(CACHE));

// ---------- informe ----------
out.sort((a, b) => a.rank - b.rank);
const cnt = (k) => out.reduce((m, o) => ((m[o.patch[k]] = (m[o.patch[k]] ?? 0) + 1), m), {});
console.log(`\n${out.length} clínicas revisadas (verificación de fuentes: ${VERIFY ? "sí" : "no"})`);
for (const k of ["business_decision_maker", "decision_confidence", "phone_type", "contact_permission", "contact_channel", "sales_readiness"])
  console.log(` ${k.padEnd(24)}`, JSON.stringify(cnt(k)));
writeFileSync(resolve(DIR, `decisor-revision-${FECHA}.json`), JSON.stringify(out, null, 2));
const cols = ["rank", "clase", "clinica", "ciudad", "n_centros", "solo", "business_decision_maker", "decision_maker_name", "decision_confidence", "phone_type", "contact_permission", "contact_channel", "sales_readiness", "decision_evidence", "razones"];
const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
writeFileSync(
  resolve(DIR, `decisor-revision-${FECHA}.csv`),
  [cols.join(","), ...out.map((o) => cols.map((c) => esc(c in o ? (Array.isArray(o[c]) ? o[c].join(" | ") : o[c]) : o.patch[c])).join(","))].join("\n"),
);

// ---------- escritura ----------
if (APPLY) {
  let ok = 0;
  for (const o of out) {
    await sb(`leads?id=eq.${o.lead_id}&owner=eq.${dbBy.get(o.google_place_id).owner}`, {
      method: "PATCH",
      headers: { ...H, Prefer: "return=minimal" },
      body: JSON.stringify(o.patch),
    });
    ok++;
  }
  console.log(`\n✔ ${ok} leads actualizados en el panel`);
} else {
  console.log("\n(sin --apply: no se ha escrito nada en la DB)");
}
