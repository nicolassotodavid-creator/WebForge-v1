// Identidad REAL del negocio (logo + color de marca) para el build en Lovable.
//
// Por qué existe: la paleta la inventaba el brief SIN ver nada del negocio, y el logo no existía en
// el pipeline. Resultado (13-sep-2026): los 9 talleres construidos salieron azul marino + rojo, cuando
// Talleres Serón es verde (#39b54a) y tiene logo en su web. Ahora:
//   1. Si el negocio tiene web propia, se buscan candidatos a logo en su HTML (findLogoCandidates).
//   2. UNA llamada de visión (Haiku) sobre esos candidatos + las fotos curadas decide qué logo es de
//      verdad suyo y qué color de marca se ve (logo, rótulo, fachada, uniformes). Ante la duda, nada.
//   3. El logo ganador se re-hospeda en nuestro bucket; el color se oscurece hasta que un botón con
//      texto blanco cumpla AA (4,5:1), la lección de las demos del simulador.
// Helpers PUROS arriba (brand.test.ts); red abajo. Nunca lanza: sin marca → wordmark + paleta del brief.

import type { SupabaseClient } from "@supabase/supabase-js";
import { llmVisionJson } from "./llm.ts";
import { rehostToBucket, PREVIEW_BUCKET } from "./preview.ts";

export interface Brand {
  logoUrl: string | null;
  logoOnDark: boolean; // logo blanco/claro: necesita fondo oscuro
  primary: string | null; // color de marca, ya apto para botón con texto blanco
  secondary: string | null;
  source: "logo" | "fotos" | null;
  evidence: string | null; // de dónde sale el color, en pocas palabras
}

export const NO_BRAND: Brand = {
  logoUrl: null, logoOnDark: false, primary: null, secondary: null, source: null, evidence: null,
};

// ---------- color ----------

export function normalizeHex(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = v.trim().match(/^#?([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (!m) return null;
  let h = m[1].toLowerCase();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return `#${h}`;
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastWithWhite(hex: string): number {
  return 1.05 / (luminance(hex) + 0.05);
}

// Oscurece el tono (mismo matiz) hasta que el texto blanco encima se lea con contraste AA.
export function ensureWhiteTextContrast(hex: string, min = 4.5): string {
  let c = rgb(hex);
  let out = hex;
  for (let i = 0; i < 40 && contrastWithWhite(out) < min; i++) {
    c = [Math.round(c[0] * 0.9), Math.round(c[1] * 0.9), Math.round(c[2] * 0.9)];
    out = toHex(c);
  }
  return out;
}

// Blancos, grises y negros no son "color de marca" para un acento.
export function isNeutral(hex: string): boolean {
  const [r, g, b] = rgb(hex);
  return Math.max(r, g, b) - Math.min(r, g, b) < 28;
}

// ---------- logo ----------

const EXCLUDE_RX = /(kit[-_ ]?digital|next[-_ ]?generation|financiado|ministerio|feder\b|fondos[-_ ]europeos|union[-_ ]europea|plan[-_ ]de[-_ ]recuperaci|partners?\b|sponsors?\b|clientes|payment|visa|mastercard|paypal|whatsapp|facebook|instagram|tripadvisor|trustpilot|google|bandera|flag|cookie|loader|spinner|placeholder|gravatar|avatar)/i;

const GENERIC = new Set([
  "taller", "talleres", "auto", "autos", "motor", "motors", "cars", "chapa", "pintura", "reparacion",
  "vehiculos", "servicio", "servicios", "valencia", "malaga", "grupo",
]);

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function nameTokens(name: string): string[] {
  return stripAccents(name.toLowerCase())
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4 && !GENERIC.has(t));
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? (m[1] ?? m[2] ?? m[3] ?? "") : null;
}

function resolveUrl(src: string, base: string): string | null {
  try {
    const u = new URL(src.trim(), base);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

// Candidatas a logo en el HTML de la home, de más a menos probable (tope 3). La visión decide después.
// Fuera: SVG e ICO (la API de visión no los lee), data: URIs, sellos de Kit Digital/fondos europeos,
// iconos de redes y pagos.
export function findLogoCandidates(html: string, baseUrl: string, businessName = ""): string[] {
  const tokens = nameTokens(businessName);
  const best = new Map<string, { score: number; order: number }>();
  let order = 0;
  const add = (src: string | null, score: number, hay: string) => {
    if (!src || score <= 0) return;
    if (/^data:/i.test(src.trim())) return;
    const url = resolveUrl(src, baseUrl);
    if (!url || /\.(svg|ico)(\?|#|$)/i.test(url)) return;
    if (EXCLUDE_RX.test(hay) || EXCLUDE_RX.test(url)) return;
    const prev = best.get(url);
    if (!prev || prev.score < score) best.set(url, { score, order: prev?.order ?? order++ });
  };

  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    let src = attr(tag, "src");
    if (!src || /^data:/i.test(src)) src = attr(tag, "data-src") ?? attr(tag, "data-lazy-src") ?? src;
    const width = Number(attr(tag, "width"));
    if (Number.isFinite(width) && width > 0 && width < 32) continue;
    const hay = [src, attr(tag, "alt"), attr(tag, "class"), attr(tag, "id"), attr(tag, "title")]
      .filter(Boolean).join(" ").toLowerCase();
    let score = 0;
    if (/custom-logo/.test(hay)) score += 5;
    if (/logo/.test(hay)) score += 3;
    if (score > 0 && tokens.some((t) => stripAccents(hay).includes(t))) score += 1;
    if (score >= 3) add(src, score, hay);
  }
  // Icono del sitio (apple-touch-icon, 180 px): último recurso, suele ser el isotipo.
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    if (/rel\s*=\s*["']?[^"'>]*apple-touch-icon/i.test(tag)) add(attr(tag, "href"), 2, tag.toLowerCase());
  }

  return [...best.entries()]
    .sort((a, b) => b[1].score - a[1].score || a[1].order - b[1].order)
    .slice(0, 3)
    .map(([url]) => url);
}

// ---------- respuesta de la visión ----------

export interface ParsedBrand {
  logoIndex: number | null;
  logoOnDark: boolean;
  primary: string | null;
  secondary: string | null;
  source: "logo" | "fotos" | null;
  evidence: string | null;
}

// Valida la respuesta de la visión. Sesgo conservador: ante cualquier incoherencia, sin color/logo.
export function parseBrandResponse(obj: unknown, nLogos: number): ParsedBrand {
  const o = (obj && typeof obj === "object" ? obj : {}) as Record<string, unknown>;
  const li = typeof o.logo_index === "number" ? o.logo_index : Number.NaN;
  const logoIndex = Number.isInteger(li) && li >= 0 && li < nLogos ? li : null;

  let primary = normalizeHex(o.primary);
  let secondary = normalizeHex(o.secondary);
  if (primary && isNeutral(primary)) {
    primary = secondary && !isNeutral(secondary) ? secondary : null;
    secondary = null;
  }
  if (secondary && (isNeutral(secondary) || secondary === primary)) secondary = null;

  let source: "logo" | "fotos" | null = o.color_source === "logo" || o.color_source === "fotos"
    ? o.color_source
    : null;
  // Color "del logo" pero ningún logo aceptado = color de un logo rechazado (p.ej. el azul del Kit
  // Digital). Se descarta.
  if (source === "logo" && logoIndex === null) {
    primary = null;
    secondary = null;
  }
  if (!primary) source = null;
  else if (!source) source = logoIndex !== null ? "logo" : "fotos";

  return {
    logoIndex,
    logoOnDark: logoIndex !== null && o.logo_background === "dark",
    primary: primary ? ensureWhiteTextContrast(primary) : null,
    secondary: primary ? secondary : null,
    source,
    evidence: primary && typeof o.evidence === "string" ? o.evidence.trim().slice(0, 120) : null,
  };
}

// ---------- bloque determinista para el prompt de Lovable ----------

export function brandManifest(brand: Brand, fallbackPrimary?: string | null): string {
  const lines = ["MARCA (identidad real del negocio; manda sobre cualquier color o logo mencionado antes):"];
  if (brand.logoUrl) {
    lines.push(`- Logo REAL del negocio: ${brand.logoUrl}. Úsalo en el header y en el footer: alto 36-44px, ancho automático (object-contain), sin deformarlo, recortarlo, recolorearlo ni añadirle efectos. Favicon: el propio logo.`);
    lines.push(brand.logoOnDark
      ? "- Es un logo CLARO (hecho para fondo oscuro): el header va sobre fondo oscuro (casi-negro o el color de marca) para que se lea. Nunca sobre blanco."
      : "- Es un logo para fondo claro: header blanco. Si en algún bloque va sobre fondo oscuro, ponlo dentro de una placa blanca con esquinas redondeadas.");
    lines.push("- Pon el nombre en texto junto al logo solo si el logo no lo incluye ya.");
  } else {
    lines.push("- No hay logo real disponible: header con WORDMARK tipográfico del nombre (fuente display). NO dibujes, generes ni inventes un logo, isotipo, monograma o icono decorativo junto al nombre (nada de llaves inglesas, engranajes ni coches haciendo de logo). Favicon con la inicial.");
  }
  if (brand.primary) {
    lines.push(`- Color de marca REAL: ${brand.primary}${brand.evidence ? ` (${brand.evidence})` : ""}. Es el ÚNICO color de acento: botones CTA con texto blanco, enlaces, iconos y detalles.`);
    if (brand.secondary) {
      lines.push(`- Color secundario de la marca: ${brand.secondary}, solo en detalles pequeños (subrayados, etiquetas); nunca en fondos grandes.`);
    }
  } else if (fallbackPrimary) {
    lines.push(`- No se ha detectado un color de marca fiable. Acento: ${fallbackPrimary} (botones CTA con texto blanco, enlaces, iconos). Si con texto blanco no llega a contraste AA, oscurécelo.`);
  }
  return lines.join("\n");
}

// ---------- red ----------

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function fetchHomeHtml(url: string): Promise<{ html: string; base: string } | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" }, redirect: "follow", signal: ctrl.signal });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (ct && !ct.includes("html")) return null;
    return { html: (await res.text()).slice(0, 600_000), base: res.url || url };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const BRAND_SYSTEM = `Eres director de arte. Identificas la identidad visual REAL de un negocio local para su web.
Recibes imágenes numeradas desde 0. El texto indica cuáles son CANDIDATAS A LOGO (sacadas de la web del propio
negocio) y cuáles son FOTOS reales de su ficha de Google (fachada, rótulo, interior, trabajos).
Devuelve ÚNICAMENTE un objeto JSON válido (sin markdown):
{"logo_index": número o null, "logo_background": "light" o "dark", "primary": "#rrggbb" o null, "secondary": "#rrggbb" o null, "color_source": "logo" o "fotos" o null, "evidence": "texto corto"}

LOGO: logo_index = índice de la candidata que sea SIN DUDA el logotipo de ESTE negocio (lleva su nombre o es
su marca inconfundible) y se lea bien. null si ninguna lo es: sellos de Kit Digital, fondos europeos o
ministerios; logos de fabricantes, aseguradoras o redes de talleres (Bosch, Michelin, Eurotaller…) salvo que
sean claramente el del negocio; iconos genéricos; fotos; banners con mucho texto; imágenes borrosas.
logo_background = "dark" si el logo es blanco o muy claro y solo se lee sobre fondo oscuro; si no, "light".

COLOR: primary = el color corporativo dominante del negocio. Si hay logo válido, sácalo del logo
(color_source "logo"). Si no, SOLO si en las fotos se ve con claridad un color de marca propio y repetido
(rótulo, fachada pintada, uniformes, toldo, vehículos rotulados del negocio), color_source "fotos". NUNCA el
color del coche de un cliente, de una pared cualquiera, del cielo ni de productos de otras marcas, y NUNCA de
texto o gráficos sobreimpresos en la foto (etiquetas "ANTES"/"DESPUÉS", flechas, marcas de agua, collages o
montajes editados): eso lo añadió quien editó la foto, no es la marca. Tampoco el color de la MAQUINARIA,
herramientas, elevadores, estanterías o productos (son del fabricante, no del negocio): en Garaje 34 el azul de
los elevadores salió como "color corporativo" y no lo es. Blancos,
grises y negros no cuentan como color de marca. secondary = un segundo color de marca claro si existe; si no,
null. Ante la duda, null: mejor sin color que con uno inventado. evidence = de dónde sale, en pocas palabras
(p.ej. "verde del logo", "rótulo rojo de la fachada").`;

function describeImages(name: string, category: string | null | undefined, nLogos: number, total: number): string {
  const who = `Negocio: ${name}${category ? ` (${category})` : ""}.`;
  const logos = nLogos > 0
    ? `Imágenes 0..${nLogos - 1}: candidatas a logo sacadas de su web.`
    : "NO hay candidatas a logo: logo_index debe ser null.";
  const photos = total > nLogos
    ? `Imágenes ${nLogos}..${total - 1}: fotos reales del negocio.`
    : "No hay fotos del negocio.";
  return `${who} ${logos} ${photos}`;
}

export async function extractBrand(
  supabase: SupabaseClient,
  leadId: string,
  ctx: { name: string; category?: string | null; siteUrl?: string | null; photos: string[] },
): Promise<Brand> {
  try {
    let logos: string[] = [];
    if (ctx.siteUrl && /^https?:\/\//i.test(ctx.siteUrl)) {
      const page = await fetchHomeHtml(ctx.siteUrl);
      if (page) logos = findLogoCandidates(page.html, page.base, ctx.name);
    }
    const photos = ctx.photos.slice(0, 6);
    let pool = [...logos, ...photos];
    let nLogos = logos.length;
    if (pool.length === 0) return { ...NO_BRAND };

    let parsed: unknown;
    try {
      parsed = await llmVisionJson(BRAND_SYSTEM, pool, describeImages(ctx.name, ctx.category, nLogos, pool.length), 400);
    } catch (e) {
      if (nLogos === 0) throw e;
      // Plan B (molde de photos.ts): la API de visión no pudo bajar algún logo de la web del negocio →
      // los subimos a nuestro bucket y reintentamos. Los que no se puedan bajar se descartan.
      console.warn(`  ⚠ la visión no pudo leer los logos (${(e instanceof Error ? e.message : String(e)).slice(0, 80)}) — re-hospedando y reintentando…`);
      const staged: string[] = [];
      for (let i = 0; i < logos.length; i++) {
        const u = await rehostToBucket(supabase, PREVIEW_BUCKET, `photos/${leadId}/logocand${i}`, logos[i]);
        if (u) staged.push(u);
      }
      nLogos = staged.length;
      pool = [...staged, ...photos];
      if (pool.length === 0) return { ...NO_BRAND };
      parsed = await llmVisionJson(BRAND_SYSTEM, pool, describeImages(ctx.name, ctx.category, nLogos, pool.length), 400);
    }

    const r = parseBrandResponse(parsed, nLogos);
    let logoUrl: string | null = null;
    if (r.logoIndex !== null) {
      logoUrl = await rehostToBucket(supabase, PREVIEW_BUCKET, `photos/${leadId}/logo`, pool[r.logoIndex]);
    }
    return {
      logoUrl,
      logoOnDark: logoUrl ? r.logoOnDark : false,
      primary: r.primary,
      secondary: r.secondary,
      source: r.source,
      evidence: r.evidence,
    };
  } catch (e) {
    console.error(`  · detección de marca falló (no crítico: wordmark + paleta del brief): ${e instanceof Error ? e.message : e}`);
    return { ...NO_BRAND };
  }
}
