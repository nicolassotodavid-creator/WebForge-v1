#!/usr/bin/env npx tsx
/**
 * enrich-brief.ts — Enriquece un lead con datos REALES antes de construirle la web.
 *
 * Por qué existe: el scrape de prospección corre barato (sin detalle de ficha ni reseñas), así que
 * los leads cuya ficha de Maps no trae `categories` salen con un brief GENÉRICO ("sector
 * energético", 2 servicios vagos) y, peor, CLÓNICO: sin vertical que inferir, el modelo cae en la
 * misma paleta y las mismas secciones para todos (caso IM2 vs Solarys, paleta idéntica). Construir
 * eso da dos webs gemelas y un email en frío sin reseñas que citar.
 *
 * Qué hace (una pasada Apify + una pasada a la web propia del negocio):
 *   1. DETALLE de la ficha: reseñas + fotos + categorías + descripción + horario, en UNA sola
 *      corrida del actor (más barato que tres). Lo funde en `leads.raw_json` y rellena
 *      `leads.category` si estaba vacía. Idempotente: no re-paga lo que ya está.
 *   2. WEB PROPIA: baja la home y hasta 3 páginas internas (servicios / quiénes somos) y extrae
 *      texto plano. Es la fuente que de verdad diferencia a un instalador solar de otro.
 *   3. Según --mode:
 *        highlights → SOLO refresca `highlights_from_reviews` del brief más reciente (conserva el
 *                     brief que ya estaba bien; es lo que necesita el Email 1 para citar reseñas).
 *        regen      → genera un brief NUEVO con BRIEF_PROMPT sobre los datos enriquecidos y lo
 *                     inserta (el build coge siempre el más reciente).
 *   4. GATE anti-genérico/clónico: compara el brief resultante con los demás briefs de la base
 *      (paleta, servicios, resumen, material de reseñas) y devuelve PASS/FAIL. Salida de código 2
 *      si no pasa, para poder encadenar "enriquece && encola build" sin construir basura.
 *
 * Uso:
 *   npx tsx orquestador/enrich-brief.ts --lead <id> --mode highlights
 *   npx tsx orquestador/enrich-brief.ts --lead <id> --mode regen
 *   npx tsx orquestador/enrich-brief.ts --lead <id> --mode regen --dry-run   (no escribe en DB)
 *   npx tsx orquestador/enrich-brief.ts --lead <id> --gate-only              (solo evalúa)
 */
import "./env.ts";
import { createClient } from "@supabase/supabase-js";
import { BRIEF_PROMPT, REVIEW_HIGHLIGHTS_PROMPT } from "../supabase/functions/_shared/prompts.ts";
import { llmJson, extractReviews, ORQUESTADOR_MODEL } from "./llm.ts";
import { placeIdFromLead } from "./reviews.ts";

const APIFY_ACTOR = "compass~crawler-google-places";
const APIFY_SYNC = `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items`;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const ONLY_LEAD = argValue("--lead");
const MODE = (argValue("--mode") ?? "regen") as "highlights" | "regen";
const DRY_RUN = process.argv.includes("--dry-run");
const GATE_ONLY = process.argv.includes("--gate-only");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en la raíz .env.");
  process.exit(1);
}
if (!ONLY_LEAD) {
  console.error("Falta --lead <id>.");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

interface BriefRow {
  id: string;
  lead_id: string;
  business_summary?: string | null;
  tone?: string | null;
  value_props?: unknown;
  highlights_from_reviews?: unknown;
  recommended_sections?: unknown;
  services?: unknown;
  suggested_palette?: unknown;
  hero_copy?: string | null;
  created_at?: string;
}

// ── 1. Pasada de DETALLE de la ficha (reseñas + fotos + categorías + descripción, una corrida) ──
async function fetchPlaceDetail(placeId: string): Promise<Record<string, unknown> | null> {
  const token = process.env.APIFY_TOKEN ?? process.env.APIFY_TOKEN_2;
  if (!token) throw new Error("Falta APIFY_TOKEN en el .env de la raíz.");
  const input = {
    placeIds: [placeId],
    scrapePlaceDetailPage: true,
    maxReviews: 15,
    reviewsSort: "newest",
    scrapeReviewsPersonalData: false,
    maxImages: 15,
    maxCrawledPlacesPerSearch: 1,
    language: "es",
  };
  // timeout=300: el detalle de ficha + 15 reseñas se ha visto agotar los 120 s por defecto.
  const res = await fetch(`${APIFY_SYNC}?token=${token}&timeout=300`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`Apify devolvió ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  }
  const items = (await res.json()) as unknown;
  if (!Array.isArray(items) || items.length === 0) return null;
  return items[0] as Record<string, unknown>;
}

// ── 2. Pasada a la WEB PROPIA del negocio: texto plano de home + páginas internas relevantes ────
const INNER_RX = /(servicio|producto|soluciones|quienes|quiénes|sobre-nosotros|nosotros|empresa|instalacion|proyectos)/i;

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchHtml(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(15_000),
      redirect: "follow",
    });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

async function fetchOwnSiteText(siteUrl: string, maxChars = 7000): Promise<{ text: string; pages: string[] }> {
  const pages: string[] = [];
  const home = await fetchHtml(siteUrl);
  if (!home) return { text: "", pages };
  pages.push(siteUrl);
  let text = htmlToText(home);

  // Enlaces internos que suelan describir SERVICIOS reales (lo que diferencia a un negocio de otro).
  const origin = new URL(siteUrl).origin;
  const seen = new Set<string>([siteUrl.replace(/\/$/, "")]);
  const inner: string[] = [];
  for (const m of home.matchAll(/href=["']([^"'#]+)["']/gi)) {
    if (inner.length >= 3) break;
    let href = m[1];
    if (/^(mailto:|tel:|javascript:)/i.test(href)) continue;
    if (!INNER_RX.test(href)) continue;
    try {
      const abs = new URL(href, siteUrl).toString().replace(/\/$/, "");
      if (!abs.startsWith(origin) || seen.has(abs)) continue;
      seen.add(abs);
      inner.push(abs);
    } catch { /* href inválido */ }
  }
  for (const url of inner) {
    const html = await fetchHtml(url);
    if (!html) continue;
    pages.push(url);
    text += "\n\n" + htmlToText(html);
  }
  return { text: text.slice(0, maxChars), pages };
}

// ── 4. GATE anti-genérico / anti-clónico ────────────────────────────────────────────────────────
// Marcadores de un brief escrito SIN datos: el modelo rellena con perífrasis en vez de servicios.
const GENERIC_RX = [
  /sector energético/i,
  /soluciones relacionadas con/i,
  /particulares y\/o empresas/i,
  /y su entorno/i,
  /especializad[oa] en el sector/i,
];

function svcNames(b: BriefRow): string[] {
  const s = Array.isArray(b.services) ? b.services : [];
  return s
    .map((x) => (x && typeof x === "object" ? String((x as Record<string, unknown>).name ?? "") : String(x)))
    .map((n) => n.trim().toLowerCase())
    .filter(Boolean);
}

function paletteKey(b: BriefRow): string {
  const p = (b.suggested_palette ?? {}) as Record<string, unknown>;
  return [p.primary, p.accent, p.bg].map((v) => String(v ?? "").toLowerCase()).join("|");
}

function gate(brief: BriefRow, others: { name: string; brief: BriefRow }[]): string[] {
  const problems: string[] = [];

  const hl = Array.isArray(brief.highlights_from_reviews) ? brief.highlights_from_reviews : [];
  if (hl.length < 2) problems.push(`sin material de reseñas (highlights_from_reviews=${hl.length})`);

  const svc = svcNames(brief);
  if (svc.length < 3) problems.push(`solo ${svc.length} servicio(s): el brief no sostiene una web a medida`);

  const summary = String(brief.business_summary ?? "");
  for (const rx of GENERIC_RX) {
    if (rx.test(summary)) problems.push(`resumen genérico (coincide ${rx})`);
  }

  const pk = paletteKey(brief);
  for (const o of others) {
    if (pk && pk === paletteKey(o.brief)) problems.push(`paleta CLÓNICA de "${o.name}" (${pk})`);
    const shared = svc.filter((n) => svcNames(o.brief).includes(n));
    if (shared.length >= 2) problems.push(`servicios clónicos de "${o.name}": ${shared.join(", ")}`);
  }
  return problems;
}

async function otherBriefs(leadId: string): Promise<{ name: string; brief: BriefRow }[]> {
  // Un brief por lead (el más reciente), excluyendo el lead que estamos evaluando.
  const { data } = await supabase
    .from("briefs")
    .select("*, leads!inner(id,name)")
    .neq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(200);
  const byLead = new Map<string, { name: string; brief: BriefRow }>();
  for (const row of (data ?? []) as (BriefRow & { leads?: { id: string; name: string } })[]) {
    const lid = row.lead_id;
    if (!byLead.has(lid)) byLead.set(lid, { name: row.leads?.name ?? lid, brief: row });
  }
  return [...byLead.values()];
}

async function main() {
  const { data: lead, error } = await supabase.from("leads").select("*").eq("id", ONLY_LEAD).maybeSingle();
  if (error || !lead) throw new Error(`Lead ${ONLY_LEAD} no encontrado: ${error?.message ?? "sin fila"}`);
  console.log(`\n▶ ${lead.name} (${lead.city ?? "?"}) — modo ${GATE_ONLY ? "gate-only" : MODE}${DRY_RUN ? " (DRY-RUN)" : ""}`);

  const { data: briefs } = await supabase
    .from("briefs").select("*").eq("lead_id", lead.id).order("created_at", { ascending: false });
  const latest = (briefs ?? [])[0] as BriefRow | undefined;

  if (GATE_ONLY) {
    if (!latest) throw new Error("Este lead no tiene brief.");
    const problems = gate(latest, await otherBriefs(lead.id));
    console.log(problems.length ? `  ✗ GATE FAIL:\n${problems.map((p) => `      - ${p}`).join("\n")}` : "  ✓ GATE PASS");
    process.exit(problems.length ? 2 : 0);
  }

  // ── 1. Detalle de ficha (idempotente) ──────────────────────────────────────────────────────────
  const raw = { ...((lead.raw_json ?? {}) as Record<string, unknown>) };
  const hasReviews = extractReviews(raw).length > 0;
  const hasCats = Array.isArray(raw.categories) && (raw.categories as unknown[]).length > 0;
  let categoryName = (raw.categoryName as string | null) ?? lead.category ?? null;

  if (!hasReviews || !hasCats) {
    const placeId = placeIdFromLead(lead);
    if (!placeId) {
      console.log("  · sin placeId ChIJ…: no se puede enriquecer desde Maps.");
    } else {
      const item = await fetchPlaceDetail(placeId);
      if (!item) {
        console.log("  · el actor no devolvió la ficha.");
      } else {
        for (const k of ["reviews", "imageUrls", "categories", "categoryName", "description",
                         "additionalInfo", "openingHours", "reviewsCount", "totalScore", "website"]) {
          const v = item[k];
          if (v == null) continue;
          if (Array.isArray(v) && v.length === 0) continue;
          raw[k] = v;
        }
        categoryName = (item.categoryName as string | null) ?? categoryName;
        const cats = Array.isArray(item.categories) ? (item.categories as string[]) : [];
        console.log(`  · ficha: reseñas=${extractReviews(raw).length} · fotos=${
          Array.isArray(raw.imageUrls) ? (raw.imageUrls as unknown[]).length : 0
        } · categorías=[${cats.join(", ") || "—"}]${raw.description ? " · con descripción" : ""}`);
        if (!DRY_RUN) {
          const upd: Record<string, unknown> = { raw_json: raw, updated_at: new Date().toISOString() };
          if (!lead.category && categoryName) upd.category = categoryName;
          const { error: uErr } = await supabase.from("leads").update(upd).eq("id", lead.id);
          if (uErr) throw new Error(`No se pudo guardar raw_json: ${uErr.message}`);
        }
      }
    }
  } else {
    console.log(`  · ficha ya enriquecida (reseñas=${extractReviews(raw).length}) — no se re-paga Apify.`);
  }

  // ── 2. Web propia ──────────────────────────────────────────────────────────────────────────────
  let siteText = "";
  const siteUrl = (lead.website_url as string | null) ?? (raw.website as string | null) ?? null;
  if (siteUrl && MODE === "regen") {
    const { text, pages } = await fetchOwnSiteText(siteUrl);
    siteText = text;
    console.log(`  · web propia: ${text.length} chars de ${pages.length} página(s) — ${pages.join(" · ") || "ninguna"}`);
  }

  const reviews = extractReviews(raw);

  // ── 3. Modo ────────────────────────────────────────────────────────────────────────────────────
  let result: BriefRow | undefined;

  if (MODE === "highlights") {
    if (!latest) throw new Error("Este lead no tiene brief que enriquecer.");
    if (reviews.length === 0) throw new Error("No hay reseñas reales con las que enriquecer el brief.");
    const hl = await llmJson<{ highlights_from_reviews?: string[] }>(
      REVIEW_HIGHLIGHTS_PROMPT, { reviews },
    );
    const list = hl.highlights_from_reviews ?? [];
    console.log(`  · highlights (${list.length}):${list.map((h) => `\n      · ${h}`).join("")}`);
    if (!DRY_RUN && list.length) {
      const { error: bErr } = await supabase.from("briefs")
        .update({ highlights_from_reviews: list }).eq("id", latest.id);
      if (bErr) throw new Error(`No se pudo actualizar el brief: ${bErr.message}`);
      console.log(`  ✓ brief ${latest.id} (${latest.created_at}) enriquecido — el resto del brief se conserva.`);
    }
    result = { ...latest, highlights_from_reviews: list };
  } else {
    const payload = {
      name: lead.name,
      category: categoryName,
      categories: raw.categories ?? [],
      city: lead.city,
      address: lead.address,
      phone: lead.phone,
      rating: lead.rating,
      review_count: lead.review_count,
      google_description: raw.description ?? null,
      opening_hours: raw.openingHours ?? null,
      reviews,
      // Texto REAL de la web del negocio: de aquí salen los servicios concretos en vez de perífrasis.
      website_excerpt: siteText || null,
    };
    const brief = await llmJson<BriefRow>(BRIEF_PROMPT, payload, 2500);
    console.log(`  · brief nuevo: ${String(brief.business_summary ?? "").slice(0, 110)}…`);
    console.log(`    servicios: ${svcNames(brief).join(" · ") || "—"}`);
    console.log(`    paleta: ${paletteKey(brief)} · highlights: ${
      Array.isArray(brief.highlights_from_reviews) ? brief.highlights_from_reviews.length : 0}`);
    if (!DRY_RUN) {
      const { data: ins, error: iErr } = await supabase.from("briefs").insert({
        lead_id: lead.id,
        business_summary: brief.business_summary ?? null,
        tone: brief.tone ?? null,
        value_props: brief.value_props ?? null,
        highlights_from_reviews: brief.highlights_from_reviews ?? null,
        recommended_sections: brief.recommended_sections ?? null,
        services: brief.services ?? null,
        suggested_palette: brief.suggested_palette ?? null,
        hero_copy: brief.hero_copy ?? null,
        model_used: ORQUESTADOR_MODEL,
      }).select().single();
      if (iErr) throw new Error(`No se pudo insertar el brief: ${iErr.message}`);
      console.log(`  ✓ brief nuevo insertado (${ins.id}) — el build coge el más reciente.`);
    }
    result = brief;
  }

  // ── 4. Gate ────────────────────────────────────────────────────────────────────────────────────
  const problems = gate(result!, await otherBriefs(lead.id));
  if (problems.length) {
    console.log(`  ✗ GATE FAIL — NO construir:\n${problems.map((p) => `      - ${p}`).join("\n")}`);
    process.exit(2);
  }
  console.log("  ✓ GATE PASS — brief específico y no clónico: se puede encolar el build.");
}

main().catch((e) => {
  console.error(`\n✗ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
