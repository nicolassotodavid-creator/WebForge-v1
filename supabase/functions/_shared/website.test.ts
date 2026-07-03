// node --experimental-strip-types supabase/functions/_shared/website.test.ts
import { normalizeUrlInput, siteHost } from "./website.ts";

let failures = 0;
function assertEq(actual: unknown, expected: unknown, msg: string) {
  const ok = actual === expected;
  console.log(`${ok ? "✓" : "✗"} ${msg}  (got ${actual}, want ${expected})`);
  if (!ok) failures++;
}

// normalizeUrlInput — lo que pega el operador
assertEq(normalizeUrlInput("talleres-garcia.com"), "https://talleres-garcia.com/", "sin esquema → https://");
assertEq(normalizeUrlInput("  https://talleres.com/inicio "), "https://talleres.com/inicio", "trim y respeta path");
assertEq(normalizeUrlInput("http://viejo.es"), "http://viejo.es/", "http se respeta");
assertEq(normalizeUrlInput(""), null, "vacío → null");
assertEq(normalizeUrlInput("   "), null, "espacios → null");
assertEq(normalizeUrlInput("no es una url"), null, "texto sin dominio → null");
assertEq(normalizeUrlInput("ftp://cosa.com"), null, "esquema no http(s) → null");
assertEq(normalizeUrlInput(null), null, "null → null");

// siteHost — clave de duplicados
assertEq(siteHost("https://www.Talleres-Garcia.COM/contacto"), "talleres-garcia.com", "minúsculas y sin www");
assertEq(siteHost("http://talleres.com"), "talleres.com", "sin www ya");
assertEq(siteHost("no-url"), null, "no URL → null");
assertEq(siteHost(undefined), null, "undefined → null");

console.log(failures === 0 ? "\nOK" : `\n${failures} FALLO(S)`);
if (failures) process.exit(1);
