// [FINCAS] Saca el email visible de la web propia (home + página de contacto). Sin email → "solo formulario".
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const places = JSON.parse(fs.readFileSync(path.join(DIR, "raw-pass2.json"), "utf8"));
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
const BAD = /\.(png|jpe?g|gif|webp|svg|css|js)$|sentry|wixpress|example\.|domain\.|email\.com$|@2x|yourmail|tuemail|u003e/i;

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

function contactLinks(html, base) {
  const links = new Set();
  for (const m of html.matchAll(/href=["']([^"'#]+)["']/gi)) {
    if (!/contact|contacto|contacta|donde|ubicaci|sobre-nosotros|about/i.test(m[1])) continue;
    try {
      const u = new URL(m[1], base);
      if (u.hostname.replace(/^www\./, "") === new URL(base).hostname.replace(/^www\./, "")) links.add(u.href);
    } catch {}
  }
  return [...links].slice(0, 3);
}

const out = {};
await Promise.all(places.map(async (p) => {
  if (!p.website) { out[p.placeId] = { web: null, reachable: false, emails: [], pages: [] }; console.log(`SIN WEB\t${p.title.slice(0,45)}`); return; }
  const site = p.website.replace(/\?.*$/, "");
  const home = await get(site);
  const found = new Set(), pages = [site];
  let htmlAll = "";
  if (home) {
    htmlAll += home.html;
    emailsIn(home.html).forEach((e) => found.add(e));
    let cands = contactLinks(home.html, home.url);
    if (!cands.length) cands = ["/contacto", "/contacto/", "/contact", "/es/contacto"].map((x) => new URL(x, home.url).href);
    for (const c of cands) {
      const pg = await get(c);
      if (!pg) continue;
      pages.push(c);
      htmlAll += pg.html;
      emailsIn(pg.html).forEach((e) => found.add(e));
      if (found.size) break;
    }
  }
  out[p.placeId] = { web: site, reachable: !!home, emails: [...found], pages };
  console.log(`${home ? "ok " : "ERR"} ${[...found].join(", ") || "—"}\t${p.title.slice(0, 45)}`);
}));
fs.writeFileSync(path.join(DIR, "emails.json"), JSON.stringify(out, null, 1));
