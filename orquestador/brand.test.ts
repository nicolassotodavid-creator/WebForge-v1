// node --experimental-strip-types orquestador/brand.test.ts
import {
  normalizeHex, contrastWithWhite, ensureWhiteTextContrast, isNeutral, findLogoCandidates,
  parseBrandResponse, brandManifest, NO_BRAND,
} from "./brand.ts";

let failures = 0;
function assertEq(actual: unknown, expected: unknown, msg: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  const ok = a === e;
  console.log(`${ok ? "✓" : "✗"} ${msg}  (got ${a}, want ${e})`);
  if (!ok) failures++;
}

// color
assertEq(normalizeHex("#39B54A"), "#39b54a", "hex en mayúsculas");
assertEq(normalizeHex("39b54a"), "#39b54a", "hex sin almohadilla");
assertEq(normalizeHex("#abc"), "#aabbcc", "hex corto");
assertEq(normalizeHex("verde"), null, "no-hex → null");
assertEq(Math.round(contrastWithWhite("#000000")), 21, "negro 21:1");
assertEq(Math.round(contrastWithWhite("#ffffff")), 1, "blanco 1:1");
{
  const g = ensureWhiteTextContrast("#39b54a");
  assertEq(contrastWithWhite(g) >= 4.5 && g !== "#39b54a", true, `verde Serón oscurecido hasta AA (${g})`);
}
assertEq(ensureWhiteTextContrast("#1a3a5c"), "#1a3a5c", "un tono que ya cumple no se toca");
assertEq(isNeutral("#cccccc"), true, "gris = neutro");
assertEq(isNeutral("#e30613"), false, "rojo ≠ neutro");

// logo candidates (HTML real de Talleres Serón, simplificado)
{
  const html = `
    <header><img class="attachment-full custom-logo" src="/wp-content/uploads/logo-seron.png" alt="Talleres Serón"></header>
    <img src="https://talleresseron.com/wp-content/uploads/2023/06/kit-digital-logos.png" alt="kit-digital-logos">
    <img src="data:image/gif;base64,R0l" data-src="https://cdn.x.com/img/logo-footer.png" alt="logo">
    <img src="/img/logo.svg" alt="logo">
    <img src="/img/taller.jpg" alt="nuestro taller">
    <img src="/img/icon-logo-whatsapp.png" alt="logo whatsapp">
    <link rel="apple-touch-icon" href="/apple-icon-180.png">`;
  assertEq(
    findLogoCandidates(html, "https://talleresseron.com/", "Talleres Seron SLU"),
    [
      "https://talleresseron.com/wp-content/uploads/logo-seron.png",
      "https://cdn.x.com/img/logo-footer.png",
      "https://talleresseron.com/apple-icon-180.png",
    ],
    "custom-logo primero; fuera Kit Digital, SVG, WhatsApp y fotos; lazy data-src; apple-touch-icon al final",
  );
}
assertEq(findLogoCandidates("<p>sin imágenes</p>", "https://x.es/"), [], "sin candidatas → []");

// parseBrandResponse
{
  const r = parseBrandResponse(
    { logo_index: 0, logo_background: "dark", primary: "#39b54a", secondary: "#cccccc", color_source: "logo", evidence: "verde del logo" },
    2,
  );
  assertEq(r.logoIndex, 0, "logo aceptado");
  assertEq(r.logoOnDark, true, "logo claro → fondo oscuro");
  assertEq(r.secondary, null, "secundario gris descartado");
  assertEq(r.source, "logo", "fuente logo");
  assertEq(contrastWithWhite(r.primary!) >= 4.5, true, "primario apto para texto blanco");
}
assertEq(parseBrandResponse({ logo_index: 5 }, 2).logoIndex, null, "índice fuera de rango → sin logo");
assertEq(parseBrandResponse({ logo_index: 0 }, 0).logoIndex, null, "sin candidatas → sin logo");
assertEq(
  parseBrandResponse({ logo_index: null, primary: "#1f4ea3", color_source: "logo" }, 1).primary,
  null,
  "color 'del logo' con logo rechazado (Kit Digital) → sin color",
);
{
  const r = parseBrandResponse({ logo_index: null, primary: "#d62828", color_source: "fotos", evidence: "rótulo rojo" }, 0);
  assertEq([r.primary, r.source, r.evidence], ["#d62828", "fotos", "rótulo rojo"], "color del rótulo");
}
{
  const r = parseBrandResponse({ logo_index: 0, primary: "#111111", secondary: "#e30613", color_source: "logo" }, 1);
  assertEq([r.primary, r.secondary], ["#e30613", null], "primario negro → sube el secundario de color");
}
assertEq(parseBrandResponse("basura", 2), { logoIndex: null, logoOnDark: false, primary: null, secondary: null, source: null, evidence: null }, "basura → vacío");

// brandManifest
{
  const m = brandManifest({ logoUrl: "https://b/logo.png", logoOnDark: true, primary: "#1f7a2e", secondary: null, source: "logo", evidence: "verde del logo" });
  assertEq(m.includes("https://b/logo.png") && m.includes("fondo oscuro") && m.includes("#1f7a2e"), true, "con logo claro y color");
}
{
  const m = brandManifest({ ...NO_BRAND }, "#2a6f97");
  assertEq(m.includes("NO dibujes") && m.includes("#2a6f97"), true, "sin logo → wordmark; sin color → acento de reserva");
}

console.log(failures === 0 ? "\nOK" : `\n${failures} FALLO(S)`);
if (failures > 0) process.exit(1);
