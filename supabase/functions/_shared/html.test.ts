// node --experimental-strip-types supabase/functions/_shared/html.test.ts
import { extractSiteTitle } from "./html.ts";

let failures = 0;
function assertEq(actual: unknown, expected: unknown, msg: string) {
  const ok = actual === expected;
  console.log(`${ok ? "✓" : "✗"} ${msg}  (got ${actual}, want ${expected})`);
  if (!ok) failures++;
}

assertEq(
  extractSiteTitle("<html><head><title>Talleres García | Inicio</title></head></html>"),
  "Talleres García",
  "corta el sufijo SEO tras |",
);
assertEq(
  extractSiteTitle("<title>Peluquería Loli - Peluquería en Salamanca</title>"),
  "Peluquería Loli",
  "corta el sufijo tras ' - ' (con espacios)",
);
assertEq(
  extractSiteTitle("<title>Semi-nuevos García</title>"),
  "Semi-nuevos García",
  "NO corta guiones sin espacios (parte del nombre)",
);
assertEq(
  extractSiteTitle('<meta property="og:site_name" content="Bar Casa Paco"/><title>Inicio | Bar</title>'),
  "Bar Casa Paco",
  "og:site_name gana al <title>",
);
assertEq(
  extractSiteTitle('<meta content="Bar Casa Paco" property="og:site_name"/>'),
  "Bar Casa Paco",
  "og:site_name con atributos en orden inverso",
);
assertEq(
  extractSiteTitle("<title>Peluquer&iacute;a Espa&ntilde;a &amp; M&aacute;s</title>"),
  "Peluquería España & Más",
  "decodifica entidades HTML comunes",
);
assertEq(extractSiteTitle("<html><body>sin titulo</body></html>"), null, "sin título → null");
assertEq(extractSiteTitle(""), null, "vacío → null");
assertEq(extractSiteTitle(null), null, "null → null");
assertEq(
  extractSiteTitle("<title>   \n  </title>"),
  null,
  "título en blanco → null",
);

console.log(failures === 0 ? "\nOK" : `\n${failures} FALLO(S)`);
if (failures) process.exit(1);
