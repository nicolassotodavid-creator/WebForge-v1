// [SIMULADOR] Saca el logo de la web de cada empresa (Playwright + Chrome) y propone un color de marca a partir DEL LOGO
// (nunca del CSS). Uso: node docs/prospeccion/extraer-logos-reformas.mjs <entrada.json> <salida-marca.json>
//   entrada: [{slug, url}]   salida: [{slug, logo:{file}|null, color:{mono,primary,secondary,raw,multi}, candidatos:[...]}]
// Los logos van a app/public/demo/logos/<slug>.<ext>. Revisar SIEMPRE a ojo con una lámina de contactos (el extractor
// coge a veces el icono de Google del sello de reseñas, el og:image no es el logo y los logos multicolor engañan).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire("/Users/nico/.npm/_npx/e41f203b7505f1fb/node_modules/");
const { chromium } = require("playwright");

const [, , ENTRADA, SALIDA] = process.argv;
const OUT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../app/public/demo/logos");
const items = JSON.parse(fs.readFileSync(ENTRADA, "utf8"));
const MALO = /google|gstatic|maps|review|resena|reseña|trustpilot|facebook|instagram|whatsapp|badge|sello|habitissimo|cronoshare|wix\.com\/|placeholder|avatar|flag|bandera|sprite|icon-|cookie/i;

const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36", ignoreHTTPSErrors: true });

async function candidatos(page) {
  return page.evaluate(() => {
    const abs = (u) => { try { return new URL(u, location.href).href; } catch { return null; } };
    const out = [];
    const els = [...document.querySelectorAll("img, svg")];
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.width < 40 || r.height < 14 || r.top > 400 && !el.closest("header,nav,[class*=logo i],[id*=logo i]")) continue;
      const attrs = [el.className?.baseVal ?? el.className, el.id, el.alt, el.getAttribute("src"), el.getAttribute("data-src"), el.parentElement?.className, el.parentElement?.id, el.closest("a")?.getAttribute("href")].join(" ");
      let score = 0;
      if (/logo/i.test(attrs)) score += 5;
      if (el.closest("header,nav,[class*=header i],[id*=header i]")) score += 3;
      const a = el.closest("a"); if (a && /^(\/|#|https?:\/\/[^/]+\/?)$/.test(a.getAttribute("href") || "") ) score += 3;
      if (r.top < 200) score += 2;
      if (r.width / r.height > 1.2 && r.width / r.height < 8) score += 1;
      if (r.width > 700) score -= 4;
      const tag = el.tagName.toLowerCase();
      out.push({ tag, score, w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top),
        src: tag === "img" ? abs(el.currentSrc || el.getAttribute("src") || el.getAttribute("data-src")) : null,
        svg: tag === "svg" ? el.outerHTML : null, attrs: attrs.slice(0, 120) });
    }
    return out;
  });
}

async function comoPng(page, buf, mime) {
  const b64 = buf.toString("base64");
  return page.evaluate(async ({ b64, mime }) => {
    const img = new Image(); img.src = `data:${mime};base64,${b64}`; await img.decode();
    const c = document.createElement("canvas"); c.width = img.naturalWidth || 600; c.height = img.naturalHeight || 200;
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); return c.toDataURL("image/png").split(",")[1];
  }, { b64, mime });
}

const res = [];
async function una({ slug, url }) {
  const page = await ctx.newPage();
  const r = { slug, url, logo: null, candidatos: [] };
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
    await page.waitForTimeout(2500);
    let cands = (await candidatos(page)).filter((c) => (c.src && !MALO.test(c.src + c.attrs)) || c.svg);
    cands.sort((a, b) => b.score - a.score);
    r.candidatos = cands.slice(0, 4).map((c) => ({ tag: c.tag, score: c.score, w: c.w, h: c.h, src: c.src, attrs: c.attrs }));
    const mejor = cands.find((c) => c.score >= 5);
    if (mejor) {
      let file;
      if (mejor.svg) { file = `${slug}.svg`; const s = mejor.svg.includes("xmlns") ? mejor.svg : mejor.svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"'); fs.writeFileSync(path.join(OUT, file), s); }
      else {
        const resp = await ctx.request.get(mejor.src, { timeout: 15000, headers: { Referer: url } });
        if (resp.ok()) {
          const buf = await resp.body(); const ct = (resp.headers()["content-type"] || "").split(";")[0];
          if (/svg/.test(ct) || /\.svg(\?|$)/i.test(mejor.src)) { file = `${slug}.svg`; fs.writeFileSync(path.join(OUT, file), buf); }
          else if (/png/.test(ct)) { file = `${slug}.png`; fs.writeFileSync(path.join(OUT, file), buf); }
          else if (/jpe?g/.test(ct)) { file = `${slug}.jpg`; fs.writeFileSync(path.join(OUT, file), buf); }
          else { file = `${slug}.png`; fs.writeFileSync(path.join(OUT, file), Buffer.from(await comoPng(page, buf, ct || "image/webp"), "base64")); }
        }
      }
      if (file) r.logo = { file };
    }
  } catch (e) { r.error = String(e.message).slice(0, 120); }
  await page.close();
  res.push(r);
  console.log(slug, r.logo?.file ?? "SIN LOGO", r.error ?? "");
}
const cola = [...items];
// Tope duro por web: alguna se queda colgada (Cloudflare, redirecciones infinitas) y bloquearía todo el lote.
const conTope = (it) => Promise.race([una(it), new Promise((ok) => setTimeout(() => { if (!res.find((r) => r.slug === it.slug)) { res.push({ slug: it.slug, url: it.url, logo: null, candidatos: [], error: "tope 60 s" }); console.log(it.slug, "SIN LOGO tope 60 s"); } ok(); }, 60000))]);
await Promise.all(Array.from({ length: 4 }, async () => { while (cola.length) await conTope(cola.shift()); }));

// Color a partir del logo (canvas): tono dominante saturado, oscurecido hasta contraste 4,5 con blanco.
const pg = await ctx.newPage();
await pg.setContent("<html><body></body></html>");
for (const r of res) {
  r.color = { mono: true, primary: "#23232e", secondary: "#5c5c6b" };
  if (!r.logo) continue;
  const f = path.join(OUT, r.logo.file);
  const mime = f.endsWith(".svg") ? "image/svg+xml" : f.endsWith(".jpg") ? "image/jpeg" : "image/png";
  const b64 = fs.readFileSync(f).toString("base64");
  try {
    const c = await pg.evaluate(async ({ b64, mime }) => {
      const img = new Image(); img.src = `data:${mime};base64,${b64}`; await img.decode();
      const k = Math.min(1, 160 / Math.max(img.naturalWidth || 160, img.naturalHeight || 60));
      const w = Math.max(1, Math.round((img.naturalWidth || 160) * k)), h = Math.max(1, Math.round((img.naturalHeight || 60) * k));
      const cv = document.createElement("canvas"); cv.width = w; cv.height = h; const g = cv.getContext("2d"); g.drawImage(img, 0, 0, w, h);
      const d = g.getImageData(0, 0, w, h).data; const buckets = new Map(); let fg = 0, sat = 0;
      for (let i = 0; i < d.length; i += 4) {
        const [R, G, B, A] = [d[i], d[i + 1], d[i + 2], d[i + 3]]; if (A < 128) continue;
        if (R > 235 && G > 235 && B > 235) continue; fg++;
        const mx = Math.max(R, G, B), mn = Math.min(R, G, B), s = mx ? (mx - mn) / mx : 0;
        if (s < 0.28 || mx < 50) continue; sat++;
        const hue = (() => { const dd = mx - mn; let hh = mx === R ? ((G - B) / dd) % 6 : mx === G ? (B - R) / dd + 2 : (R - G) / dd + 4; return (hh * 60 + 360) % 360; })();
        const key = Math.round(hue / 20); const o = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 }; o.n++; o.r += R; o.g += G; o.b += B; buckets.set(key, o);
      }
      const arr = [...buckets.entries()].sort((a, b) => b[1].n - a[1].n);
      return { fg, sat, top: arr.slice(0, 2).map(([k, o]) => ({ hue: k * 20, n: o.n, rgb: [Math.round(o.r / o.n), Math.round(o.g / o.n), Math.round(o.b / o.n)] })) };
    }, { b64, mime });
    const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const cr = (rgb) => 1.05 / (lum(rgb) + 0.05);
    const hex = (rgb) => "#" + rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
    r.color.raw = c;
    if (c.fg > 0 && c.sat / c.fg >= 0.10 && c.top[0]) {
      let rgb = c.top[0].rgb.slice(), guard = 0; const orig = hex(rgb);
      while (cr(rgb) < 4.5 && guard++ < 60) rgb = rgb.map((v) => v * 0.94);
      r.color = { mono: false, primary: hex(rgb), secondary: orig, raw: c, multi: !!(c.top[1] && c.top[1].n > c.top[0].n * 0.6 && Math.abs(c.top[1].hue - c.top[0].hue) > 40 && Math.abs(c.top[1].hue - c.top[0].hue) < 320) };
    }
  } catch (e) { r.color.error = String(e.message).slice(0, 80); }
}
await browser.close();
res.sort((a, b) => items.findIndex((i) => i.slug === a.slug) - items.findIndex((i) => i.slug === b.slug));
fs.writeFileSync(SALIDA, JSON.stringify(res, null, 1));
console.log(`logos: ${res.filter((r) => r.logo).length}/${res.length}`);
