// Nordia: email de la web propia (home + contacto), señales de la web (WhatsApp, chatbot, cita online)
// y dolores en las 30 últimas reseñas. Escribe <ciudad>/senales.json y <ciudad>/despachos.csv.
// Uso: node docs/nordia/prospeccion/analyze.mjs <ciudad>
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(DIR, (process.argv[2] ?? "Valencia").toLowerCase());
const places = JSON.parse(fs.readFileSync(path.join(OUT, "raw-pass2.json"), "utf8"));
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
const BAD = /\.(png|jpe?g|gif|webp|svg|css|js)$|sentry|wixpress|example\.|domain\.|email\.com$|@2x|yourmail|tuemail|u003e|tudominio|correo@|nombre@/i;

async function get(url) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "es-ES,es" }, redirect: "follow", signal: AbortSignal.timeout(15000) });
    return r.ok ? { html: await r.text(), url: r.url } : null;
  } catch { return null; }
}
function cfDecode(hex) {
  const k = parseInt(hex.slice(0, 2), 16);
  let s = "";
  for (let i = 2; i < hex.length; i += 2) s += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ k);
  return s;
}
function emailsIn(html) {
  const out = new Set();
  const txt = html.replace(/&#64;|&#x40;|\[at\]|\(at\)/gi, "@").replace(/%40/g, "@");
  for (const m of txt.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)) out.add(m[0].toLowerCase());
  for (const m of html.matchAll(/data-cfemail="([0-9a-f]+)"/gi)) out.add(cfDecode(m[1]).toLowerCase());
  return [...out].filter((e) => !BAD.test(e));
}
function links(html, base, re) {
  const out = new Set();
  for (const m of html.matchAll(/href=["']([^"'#]+)["']/gi)) {
    if (!re.test(m[1])) continue;
    try {
      const u = new URL(m[1], base);
      if (u.hostname.replace(/^www\./, "") === new URL(base).hostname.replace(/^www\./, "")) out.add(u.href);
    } catch {}
  }
  return [...out].slice(0, 3);
}

// Dolores en reseñas. Las positivas de rapidez también cuentan: el cliente valora que le contesten.
const PAIN = {
  no_contesta: /no (me )?(cog|coj)(e|en|ían|ió)|no contesta|no responde|imposible (contactar|hablar|localizar)|sin respuesta|no (me )?devuelv|no (me )?(han|ha) (vuelto a )?llamad|ni (me )?contesta|tarda(n|ron|ba)? (mucho |días |semanas )?en (contestar|responder)|nunca (lo |la )?cog/i,
  rapidez: /(responde|contesta|contestó|respondió|atendió)[a-z]* (muy )?(rápid|enseguida|al momento|en el mismo día|en minutos)|respuesta rápida|rapidez en (la respuesta|responder|contestar)|disponib(le|ilidad) (siempre|total|24)|incluso (en )?fin(es)? de semana|a cualquier hora/i,
  whatsapp: /whats ?app|wasap/i,
  seguimiento: /(informad|al tanto|al corriente)[oa]?s? (en todo momento|de todo)|me (mantuvo|mantuvieron|tenía|tuvo) informad/i,
  cobro: /factur|honorario|provisi[oó]n de fondos|me cobr|cobrar|precio|presupuesto|caro|minuta/i,
  cita: /primera (consulta|cita)|consulta gratu|cita (r[aá]pid|enseguida|al d[ií]a)/i,
};

const out = {};
const rows = [];
await Promise.all(places.map(async (p) => {
  const site = (p.website ?? "").replace(/\?.*$/, "");
  const home = site ? await get(site) : null;
  const found = new Set();
  let htmlAll = "";
  if (home) {
    htmlAll += home.html;
    emailsIn(home.html).forEach((e) => found.add(e));
    let cands = links(home.html, home.url, /contact|contacto|contacta|donde|ubicaci/i);
    if (!cands.length) cands = ["/contacto", "/contacto/", "/contact", "/es/contacto"].map((x) => new URL(x, home.url).href);
    for (const c of cands) {
      const pg = await get(c);
      if (!pg) continue;
      htmlAll += pg.html;
      emailsIn(pg.html).forEach((e) => found.add(e));
      if (found.size) break;
    }
    // La LSSI obliga a poner un email en el aviso legal: respaldo cuando home y contacto lo esconden.
    if (!found.size) {
      let legal = links(home.html, home.url, /aviso-legal|aviso_legal|legal|privacidad|privacy/i);
      if (!legal.length) legal = ["/aviso-legal", "/aviso-legal/", "/politica-de-privacidad/"].map((x) => new URL(x, home.url).href);
      for (const c of legal) {
        const pg = await get(c);
        if (!pg) continue;
        emailsIn(pg.html).forEach((e) => found.add(e));
        if (found.size) break;
      }
    }
    const team = links(home.html, home.url, /equipo|nosotros|quienes-somos|qui[eé]nes|despacho\/?$|about/i)[0];
    if (team) { const pg = await get(team); if (pg) htmlAll += pg.html; }
  }
  const host = site ? new URL(site).hostname.replace(/^www\./, "") : "";
  const emails = [...found];
  const own = emails.filter((e) => e.endsWith("@" + host) || e.split("@")[1] === host);
  const web = {
    whatsapp: /wa\.me\/|api\.whatsapp\.com|joinchat|whatsapp/i.test(htmlAll),
    chatbot: /tidio|intercom|crisp\.chat|landbot|livechat|tawk\.to|zendesk|hubspot.*chat|chatbot|smartsupp|drift\.com/i.test(htmlAll),
    cita_online: /calendly|cal\.com|reservar cita|pide (tu )?cita|reserva (tu )?(cita|consulta)|agendar|bookings|simplybook|doctoralia/i.test(htmlAll),
    sedes: [...new Set((htmlAll.replace(/<[^>]+>/g, " ").match(/(?:\d+|dos|tres|cuatro|cinco|seis)\s+(?:oficinas|sedes|despachos)/gi) ?? []).map((s) => s.toLowerCase()))].slice(0, 3),
  };
  const rev = (p.reviews ?? []).map((r) => ({ t: r.text ?? r.textTranslated ?? "", s: r.stars, d: r.publishedAtDate?.slice(0, 10) })).filter((r) => r.t);
  const pains = {};
  const quotes = [];
  for (const [k, re] of Object.entries(PAIN)) {
    const hits = rev.filter((r) => re.test(r.t));
    pains[k] = hits.length;
    for (const h of hits.slice(0, 2)) {
      const m = h.t.match(re);
      const i = Math.max(0, (m?.index ?? 0) - 90);
      quotes.push({ k, s: h.s, d: h.d, q: h.t.slice(i, i + 220).replace(/\s+/g, " ") });
    }
  }
  const owner = (p.reviews ?? []).filter((r) => r.responseFromOwnerText).length;
  out[p.placeId] = { title: p.title, web: site, reachable: !!home, emails, own, ...web, pains, quotes, owner_replies: owner, n_rev: rev.length };
  rows.push({
    placeId: p.placeId, nombre: p.title, categoria: p.categoryName, reseñas: p.reviewsCount, nota: p.totalScore,
    telefono: p.phone ?? "", web: site, email: own[0] ?? emails[0] ?? "", emails_todos: emails.join(" "),
    direccion: p.address ?? "", whatsapp_web: web.whatsapp ? 1 : 0, chatbot: web.chatbot ? 1 : 0, cita_online: web.cita_online ? 1 : 0,
    sedes: web.sedes.join("; "), ...Object.fromEntries(Object.entries(pains).map(([k, v]) => ["r_" + k, v])), respuestas_dueño: owner,
  });
}));
fs.writeFileSync(path.join(OUT, "senales.json"), JSON.stringify(out, null, 1));
const cols = Object.keys(rows[0]);
const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
fs.writeFileSync(path.join(OUT, "despachos.csv"), [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n"));
console.log(`fichas=${rows.length} con_email=${rows.filter((r) => r.email).length} whatsapp=${rows.filter((r) => r.whatsapp_web).length} chatbot=${rows.filter((r) => r.chatbot).length} no_contesta>0=${rows.filter((r) => r.r_no_contesta).length}`);
