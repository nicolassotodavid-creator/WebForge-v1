#!/usr/bin/env npx tsx
/**
 * backfill-emails.ts — Resuelve la WEB REAL del negocio y, de paso, su email.
 *
 * Por qué existe: el scrape solo ve la ficha de Google Maps. Muchos negocios NO enlazan su web
 * ahí (ponen su Instagram, o nada), aunque sí tengan web propia (caso TALLERES PRO CARS, que en
 * Maps enlaza instagram pero tiene talleresprocars.es). Esos quedaban como `has_website=false` y
 * sin URL, y el email tampoco se podía sacar.
 *
 * Qué hace, por cada lead sin web real resuelta (website_url NULL):
 *   1. Si Google Maps YA trae una web propia (no red social) → esa es la web.
 *   2. Si no → la DESCUBRE: adivina dominios desde el nombre (talleresprocars → .es/.com) y, como
 *      fallback, busca en DuckDuckGo. Verifica la propiedad cotejando el TELÉFONO de Maps en la
 *      página (señal fuerte, casi sin falsos positivos).
 *   3. Con la web resuelta: escribe `website_url`, pone `has_website=true` y, si el email está
 *      vacío, lo extrae de la web (home + páginas de contacto/legal).
 *
 * Uso:
 *   npx tsx orquestador/backfill-emails.ts                 → procesa el lote (escribe en DB)
 *   npx tsx orquestador/backfill-emails.ts --dry-run       → solo muestra qué haría
 *   npx tsx orquestador/backfill-emails.ts --lead <id>     → un solo lead (útil para probar)
 *   npx tsx orquestador/backfill-emails.ts --limit 50      → tope de leads por corrida
 *   npx tsx orquestador/backfill-emails.ts --self-test     → tests de las funciones puras (sin DB)
 *
 * Requiere .env con SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (salvo --self-test).
 */
import "./env.ts";
import { createClient } from "@supabase/supabase-js";
import { isRealWebsite, realWebsiteFromRaw } from "../supabase/functions/_shared/website.ts";

const DRY_RUN = process.argv.includes("--dry-run");
const SELF_TEST = process.argv.includes("--self-test");
const ONLY_LEAD = argValue("--lead");
const LIMIT = Number(argValue("--limit") ?? 50);

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

// OJO: para escanear texto necesitamos /g (matchAll). Para VALIDAR un email suelto usamos
// una regex SIN /g (EMAIL_ONE): reusar la global con .test() es stateful (lastIndex) y se
// salta resultados de forma intermitente.
const EMAIL_RX_G = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const EMAIL_ONE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const CONTACT_PATHS = ["", "contacto", "contacto/", "contact", "contacta", "contacta/", "aviso-legal", "aviso-legal/", "avisolegal", "legal", "privacidad"];

// Palabras genéricas del rótulo que NO sirven para identificar el dominio ni para verificar.
const GENERIC = new Set([
  "taller", "talleres", "clinica", "clínica", "dental", "bar", "restaurante", "cafe", "cafetería",
  "centro", "grupo", "auto", "autos", "car", "cars", "motor", "garaje", "garage", "the", "el", "la",
  "los", "las", "de", "del", "y", "en", "sl", "sa", "slu",
]);

function isJunkEmail(e: string): boolean {
  const x = e.toLowerCase();
  return (
    /\.(png|jpe?g|gif|webp|svg|css|js)$/.test(x) ||
    /(example|sentry|wixpress|\.wix|godaddy|placeholder|yourdomain|email@|user@|name@|@sentry|@2x)/.test(x)
  );
}

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// ---------- DESCUBRIMIENTO de la web real (funciones puras) ----------

// Tokens significativos del nombre, sin acentos, sin la ciudad, sin puntuación.
export function nameTokens(name: string, city?: string | null): string[] {
  const n = stripAccents((name ?? "").toLowerCase()).replace(/[^a-z0-9\s]/g, " ");
  const cityN = stripAccents((city ?? "").toLowerCase());
  return n
    .split(/\s+/)
    .filter((t) => t.length > 1)
    .filter((t) => !cityN || t !== cityN);
}

// Candidatos de dominio a partir del nombre. Pensado para PYMES españolas: junta los tokens
// ("talleresprocars"), prueba también sin la primera palabra genérica ("procars"), y .es/.com.
export function candidateUrls(name: string, city?: string | null): string[] {
  const toks = nameTokens(name, city);
  if (!toks.length) return [];
  const bases = new Set<string>();
  bases.add(toks.join(""));
  bases.add(toks.join("-"));
  if (toks.length >= 2) bases.add(toks.slice(-2).join("")); // dos últimas
  if (toks.length > 2 && GENERIC.has(toks[0])) bases.add(toks.slice(1).join("")); // sin genérico inicial
  const tlds = [".es", ".com"];
  const urls: string[] = [];
  for (const base of bases) {
    if (base.length < 3 || base.length > 40) continue;
    for (const tld of tlds) urls.push(`https://${base}${tld}`);
  }
  return [...new Set(urls)];
}

// Teléfono de Google Maps reducido a sus 9 dígitos finales (formato ES) para cotejarlo en la web.
export function phone9(raw: Record<string, unknown>): string | null {
  const p = String(raw["phoneUnformatted"] ?? raw["phone"] ?? "").replace(/\D/g, "");
  return p.length >= 9 ? p.slice(-9) : null;
}

// ¿La página es del negocio?
//  - Si el lead TIENE teléfono, la prueba ES el teléfono: tiene que aparecer en la página.
//    (El "match por nombre" es CIRCULAR en dominios adivinados — el dominio se construye desde
//    el nombre, así que cualquier página de ese dominio "contiene el nombre". Por eso, con un
//    nombre genérico como "Taller mecánico 24 horas" caía en mecanico24horas.com de Bogotá.)
//  - Si el lead NO tiene teléfono, solo aceptamos match por nombre cuando `allowNameOnly` (lo usa
//    la búsqueda DDG, que es un hallazgo independiente; NUNCA el dominio adivinado).
export function verifyOwnership(
  html: string, phone: string | null, toks: string[], allowNameOnly = false,
): boolean {
  if (!html) return false;
  if (phone) return html.replace(/\D/g, "").includes(phone);
  if (!allowNameOnly) return false;
  const text = stripAccents(html.toLowerCase());
  const distinctive = toks.filter((t) => t.length >= 4 && !GENERIC.has(t));
  if (!distinctive.length) return false;
  return distinctive.filter((t) => text.includes(t)).length >= Math.min(2, distinctive.length);
}

// ---------- helpers de red ----------

async function fetchText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept": "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(12_000),
      redirect: "follow",
    });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

function extractEmail(html: string, domainHost: string): string | null {
  const found = new Set<string>();
  for (const m of html.matchAll(/mailto:([^"'?>\s]+)/gi)) {
    const e = decodeURIComponent(m[1]).trim().toLowerCase();
    if (EMAIL_ONE.test(e) && !isJunkEmail(e)) found.add(e);
  }
  for (const m of html.matchAll(EMAIL_RX_G)) {
    const e = m[0].toLowerCase();
    if (!isJunkEmail(e)) found.add(e);
  }
  if (found.size === 0) return null;
  const list = [...found];
  const host = domainHost.replace(/^www\./, "");
  const sameDomain = list.find((e) => e.endsWith(`@${host}`) || e.endsWith(`.${host}`));
  return sameDomain ?? list[0];
}

async function findEmailForSite(origin: string): Promise<string | null> {
  const host = new URL(origin).hostname;
  for (const path of CONTACT_PATHS) {
    const url = path ? `${origin}/${path}` : origin;
    const html = await fetchText(url);
    if (!html) continue;
    const email = extractEmail(html, host);
    if (email) return email;
  }
  return null;
}

// Dominios de resultados de DuckDuckGo (HTML, sin API key). Best-effort: si DDG bloquea, [].
async function ddgDomains(query: string): Promise<string[]> {
  const html = await fetchText(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
  if (!html) return [];
  const out = new Set<string>();
  for (const m of html.matchAll(/uddg=([^"&]+)/g)) {
    try {
      const target = decodeURIComponent(m[1]);
      if (!isRealWebsite(target)) continue; // descarta redes/mapas
      out.add(new URL(target).origin);
    } catch { /* url rara, ignora */ }
    if (out.size >= 6) break;
  }
  return [...out];
}

// Devuelve el ORIGIN de la web real del negocio, o null. Verifica propiedad por teléfono/nombre.
async function discoverWebsite(
  name: string, city: string | null, raw: Record<string, unknown>,
): Promise<{ origin: string; how: string } | null> {
  const phone = phone9(raw);
  const toks = nameTokens(name, city);

  // 1) Adivinar dominios desde el nombre. Solo se acepta si el TELÉFONO del lead aparece en la
  //    página (sin allowNameOnly): el dominio se construye desde el nombre, así que verificar por
  //    nombre sería circular. Si el lead no tiene teléfono, esta vía no puede confirmar nada.
  for (const url of candidateUrls(name, city)) {
    const html = await fetchText(url);
    if (html && verifyOwnership(html, phone, toks)) {
      return { origin: new URL(url).origin, how: `dominio adivinado (${new URL(url).hostname})` };
    }
  }

  // 2) Fallback: buscar en DuckDuckGo (hallazgo INDEPENDIENTE del nombre). Verifica por teléfono
  //    si lo hay; si no, acepta match fuerte por nombre (allowNameOnly) porque el dominio no lo
  //    elegimos nosotros.
  const q = `${name} ${city ?? ""}`.trim();
  for (const origin of await ddgDomains(q)) {
    const html = await fetchText(origin);
    if (html && verifyOwnership(html, phone, toks, true)) {
      return { origin, how: `búsqueda DDG (${new URL(origin).hostname})` };
    }
  }
  return null;
}

// ---------- self-test (sin DB) ----------

function selfTest(): void {
  let ok = 0, fail = 0;
  const check = (cond: boolean, msg: string) => {
    if (cond) { ok++; } else { fail++; console.error(`  ✗ ${msg}`); }
  };
  const cu = candidateUrls("TALLERES PRO CARS VALENCIA", "València");
  check(cu.includes("https://talleresprocars.es"), `candidateUrls debe incluir talleresprocars.es → ${cu.join(", ")}`);
  check(cu.includes("https://procars.es"), "candidateUrls debe incluir procars.es (sin genérico inicial)");
  check(phone9({ phoneUnformatted: "+34697445564" }) === "697445564", "phone9 saca los 9 finales");
  check(verifyOwnership("llama al 697 44 55 64 hoy", "697445564", []), "verifyOwnership pasa con el teléfono en la página");
  check(!verifyOwnership("otra empresa cualquiera", "697445564", ["zzzz"]), "verifyOwnership falla si el teléfono NO está, aunque el lead tenga teléfono");
  // Caso Bogotá: nombre genérico coincide pero el teléfono del lead NO está → debe rechazar.
  check(!verifyOwnership("Mecánico 24 Horas Bogotá, servicio a domicilio", "691201837", ["mecanico", "horas"]), "verifyOwnership rechaza match por nombre cuando hay teléfono y no aparece");
  // Dominio adivinado sin teléfono en el lead: no se puede confirmar por nombre (circular).
  check(!verifyOwnership("Bienvenido a Procars Reparaciones", null, ["procars", "reparaciones"]), "verifyOwnership (domain-guess) NO acepta solo-nombre");
  // DDG sin teléfono: sí acepta match fuerte por nombre (allowNameOnly).
  check(verifyOwnership("Bienvenido a Procars Reparaciones", null, ["procars", "reparaciones"], true), "verifyOwnership (DDG) acepta 2 tokens distintivos cuando no hay teléfono");
  check(nameTokens("TALLERES PRO CARS VALENCIA", "Valencia").join(",") === "talleres,pro,cars", "nameTokens quita la ciudad");
  console.log(`\nself-test: ${ok} OK, ${fail} fallos`);
  process.exit(fail ? 1 : 0);
}

// ---------- main ----------

interface LeadRow {
  id: string;
  name: string;
  email: string | null;
  has_website: boolean | null;
  website_url: string | null;
  city: string | null;
  raw_json: Record<string, unknown> | null;
}

async function main() {
  if (SELF_TEST) return selfTest();

  const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("❌ Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env");
    process.exit(1);
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  console.log(`WebForge — resolver web real + email${DRY_RUN ? " (DRY-RUN)" : ""}\n`);

  // select("*") en vez de filtrar por website_url en la query: así el script funciona aunque la
  // migración 0009 aún no esté aplicada (en ese caso website_url llega undefined = sin resolver).
  let q = supabase.from("leads").select("*").order("created_at", { ascending: true });
  if (ONLY_LEAD) q = q.eq("id", ONLY_LEAD);
  const { data, error } = await q;
  if (error) { console.error("❌ Error leyendo leads:", error.message); process.exit(1); }

  const all = (data ?? []) as LeadRow[];
  // Pendientes de resolver: sin website_url y sin web real ya presente en el scrape... salvo que
  // les falte el email (esos también los reprocesamos para intentar sacarlo de su web real).
  const todo = all
    .filter((l) => ONLY_LEAD || !l.website_url || !l.email)
    .slice(0, LIMIT);

  if (!todo.length) { console.log("No hay leads que resolver. Nada que hacer."); return; }
  console.log(`${todo.length} leads a procesar.\n`);

  let resolvedWeb = 0, gotEmail = 0;
  const pending: string[] = [];

  for (const lead of todo) {
    const raw = (lead.raw_json ?? {}) as Record<string, unknown>;
    // Web real ya resuelta (columna) o presente en el scrape (no red social).
    let origin = lead.website_url && isRealWebsite(lead.website_url) ? new URL(lead.website_url).origin : null;
    let how = origin ? "ya resuelta" : "";
    if (!origin) {
      const fromRaw = realWebsiteFromRaw(raw);
      if (fromRaw) { origin = new URL(fromRaw).origin; how = "web en Google Maps"; }
    }
    // Si Maps solo trae redes / nada → intentar descubrirla.
    if (!origin) {
      process.stdout.write(`· ${lead.name} → descubriendo… `);
      const found = await discoverWebsite(lead.name, lead.city, raw);
      if (found) { origin = found.origin; how = found.how; console.log(`✅ ${origin} [${how}]`); }
      else { console.log("sin web propia encontrada"); pending.push(`${lead.name} (sin web localizable)`); continue; }
    }

    // Construir el update. website_url + has_website solo si descubrimos/confirmamos web real.
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (!lead.website_url || lead.website_url !== origin) update.website_url = origin;
    if (!lead.has_website) update.has_website = true;

    // Email: solo si falta. Lo sacamos de la web real.
    let emailMsg = lead.email ? `email ya tenía (${lead.email})` : "";
    if (!lead.email) {
      const email = await findEmailForSite(origin);
      if (email) { update.email = email; emailMsg = `email ✅ ${email}`; }
      else emailMsg = "email no visible en la web";
    }

    const willWriteWeb = "website_url" in update || "has_website" in update;
    console.log(`  ${lead.name}: web=${origin} [${how}] · ${emailMsg}`);

    if (!DRY_RUN) {
      const { error: upErr } = await supabase.from("leads").update(update).eq("id", lead.id);
      if (upErr) { console.log(`   ❌ no se pudo guardar: ${upErr.message}`); continue; }
    }
    if (willWriteWeb) resolvedWeb++;
    if ("email" in update) gotEmail++;
  }

  console.log(`\n── Resumen ──`);
  console.log(`${DRY_RUN ? "Se resolverían" : "Webs resueltas"}: ${resolvedWeb} · emails nuevos: ${gotEmail}`);
  if (pending.length) {
    console.log(`Sin web localizable: ${pending.length}`);
    for (const p of pending) console.log(`   · ${p}`);
  }
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
