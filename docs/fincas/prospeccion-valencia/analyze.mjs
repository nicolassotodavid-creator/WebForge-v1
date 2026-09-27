// [FINCAS] Señal principal: quejas de que no cogen el teléfono / no atienden incidencias — el dolor exacto
// que resuelve el asistente de voz de recepción. Lee raw-pass2.json y emails.json (si existe).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));
const places = read("raw-pass2.json");
let emails = {};
try { emails = read("emails.json"); } catch {}

// Colegios profesionales / asociaciones no son el perfil (no son la empresa que administra).
const NOT_A_FIT = /^colegio\b/i;

const SIGNALS = {
  // El dolor central: nadie coge el teléfono / no hay manera de contactar con la administración.
  telefono: /no (te |le |me |nos )?(cog(en|e|ieron|i[oó])|contest(an|a|aron|ó)|respond(en|e|ieron|ió)) (el |al )?(tel[eé]fono|llamad)|no (hay |)(hay )?(manera|forma) de (contactar|hablar|comunicar)|imposible (contactar|hablar|localizar)|(nunca|jamás) (contestan|responden|cogen|están)|no (se )?(ponen|pone) al tel[eé]fono|tel[eé]fono (muerto|apagado|no funciona)|nadie (contesta|responde|coge|atiende)|no (hay|queda) quien (lo |la |)(coja|conteste|atienda)|(contestador|buz[oó]n) (autom[aá]tico|de voz) (siempre|todo el (día|rato))|no (te |me |nos |le )?(atienden|localizan)|line?a? (siempre )?ocupada|no (da|dan) (se[nñ]ales?|noticias)|communicat\w* (is|was) (impossible|terrible)|(never|can'?t|cannot|impossible to) (get|reach|contact) (them|anyone|someone)|(no one|nobody) (answers|picks up|responds)|phone (is )?(dead|never answered)/i,
  // Segundo dolor: la incidencia/urgencia (avería, gotera, ascensor) se queda sin gestionar o tarda mucho.
  incidencia: /(la |una |)(aver[ií]a|urgencia|gotera|incidencia|fuga) (sin (resolver|atender|solucionar)|no (se )?(resuelve|atienden|solucionan|gestiona))|(tard(an|a|aron|ó)|llev(an|a|ó)) (semanas|meses|d[ií]as) (en|para) (resolver|solucionar|atender|arreglar)|sin (resolver|solucionar|atender) (meses|semanas|a[ñn]os)|no (hacen|toman) nada (ante|con) (la|una|las) (aver[ií]a|urgencia|incidencia)|dejan (todo|la comunidad) (abandonad[oa]|sin atender)|no (se )?(presentan|aparecen) (ante|en) (una|la) (urgencia|emergencia)|(mala|p[eé]sima|nula) gesti[oó]n de (incidencias|urgencias|aver[ií]as)/i,
};

function textOf(r) { return [r.text, r.textTranslated].filter(Boolean).join(" \n "); }
function sentenceWith(text, rx) {
  const parts = text.split(/(?<=[.!?¡¿\n])\s+/);
  const s = parts.find((p) => rx.test(p)) ?? text;
  const t = s.trim().replace(/\s+/g, " ");
  if (t.length <= 150) return t;
  const m = t.match(rx);
  const i = Math.max(0, (m?.index ?? 0) - 60);
  return (i > 0 ? "…" : "") + t.slice(i, i + 140).trim() + "…";
}

const rows = [];
for (const p of places) {
  if (NOT_A_FIT.test(p.title)) continue;
  const reviews = (p.reviews ?? []).filter((r) => r.text);
  const counts = { telefono: 0, incidencia: 0 };
  const hits = [];
  for (const r of reviews) {
    const own = /^(es|en)/.test(r.originalLanguage ?? "es") || !r.textTranslated ? r.text : r.textTranslated;
    for (const [k, rx] of Object.entries(SIGNALS)) {
      if (!rx.test(textOf(r))) continue;
      counts[k]++;
      if (rx.test(own)) hits.push({ k, stars: r.stars, quote: sentenceWith(own, rx), date: r.publishedAtDate?.slice(0, 10) });
    }
  }
  const score = counts.telefono * 2 + counts.incidencia; // el dolor del teléfono pesa el doble, es el pitch directo
  const pri = { telefono: 0, incidencia: 1 };
  hits.sort((a, b) => ((a.stars <= 3 ? 0 : 1) - (b.stars <= 3 ? 0 : 1)) || pri[a.k] - pri[b.k] || a.quote.length - b.quote.length);
  const quotes = [];
  for (const h of hits) {
    if (quotes.some((q) => q.k === h.k)) continue;
    quotes.push(h);
    if (quotes.length === 2) break;
  }
  const low = reviews.filter((r) => r.stars <= 3).length;
  const all = p.reviews ?? [];
  const ownerReplies = all.filter((r) => r.responseFromOwnerText).length;
  const ds = all.map((r) => r.publishedAtDate).filter(Boolean).sort();
  const months = ds.length ? Math.round((new Date(ds.at(-1)) - new Date(ds[0])) / 2.6e9) : 0;
  const burst = all.length >= 30 && months <= 2 ? `Ojo: las 30 últimas reseñas caen en ${months || "<1"} mes(es) (posible campaña de reseñas)` : "";
  const e = emails[p.placeId] ?? {};
  const web = p.website ? p.website.replace(/\?.*$/, "") : "";
  const domain = (web.match(/\/\/(?:www\.)?([^/]+)/)?.[1] ?? "").toLowerCase();
  const goodEmails = (e.emails ?? []).filter((x) => !/wixpress|example\.|sentry/.test(x));
  goodEmails.sort((a, b) => (/^(info|hola|administracion|admin)@/.test(b) ? 1 : 0) - (/^(info|hola|administracion|admin)@/.test(a) ? 1 : 0) || (b.endsWith(domain) ? 1 : 0) - (a.endsWith(domain) ? 1 : 0));
  const email = goodEmails[0] ?? (web ? (e.reachable === false ? "web no carga (sin comprobar)" : "solo formulario") : "sin web");
  rows.push({
    nombre: p.title,
    web: web || "sin web",
    email,
    telefono: p.phone ?? "",
    direccion: p.address ?? "",
    n_resenas: p.reviewsCount,
    rating: p.totalScore,
    score_dolor: score,
    detalle_score: `telefono ${counts.telefono} · incidencia ${counts.incidencia}`,
    cita_gancho: quotes.map((q) => `«${q.quote}» (${q.stars}★, ${q.date ?? ""})`).join(" | "),
    notas: [`${low}/${reviews.length || 30} reseñas recientes de 1-3★`, `El dueño contesta ${ownerReplies}/${all.length}`, burst, reviews.length < 30 ? `${reviews.length} con texto` : ""].filter(Boolean).join(". "),
    _hits: hits,
  });
}
rows.sort((a, b) => b.score_dolor - a.score_dolor || b.n_resenas - a.n_resenas);

const cols = ["nombre", "web", "email", "telefono", "direccion", "n_resenas", "rating", "score_dolor", "detalle_score", "cita_gancho", "notas"];
const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
fs.writeFileSync(path.join(DIR, "fincas_valencia.csv"), "﻿" + [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n") + "\n");
fs.writeFileSync(path.join(DIR, "senales-detalle.json"), JSON.stringify(rows.map((r) => ({ nombre: r.nombre, score: r.score_dolor, hits: r._hits })), null, 1));
for (const r of rows) console.log(`${String(r.score_dolor).padStart(2)} | ${r.detalle_score} | ${r.nombre.slice(0, 45)} | ${r.email}`);
console.log(`\ntotal=${rows.length} con_dolor=${rows.filter((r) => r.score_dolor > 0).length}`);
