// node --experimental-strip-types supabase/functions/_shared/email.test.ts
import { emailScore, extractEmails, isJunkEmail, pickBestEmail } from "./email.ts";

let failures = 0;
function assertEq(actual: unknown, expected: unknown, msg: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  const ok = a === e;
  console.log(`${ok ? "✓" : "✗"} ${msg}  (got ${a}, want ${e})`);
  if (!ok) failures++;
}

// Felipe Cebrià (Mobirise): la primera letra va dentro de un enlace a support@mobirise.com.
assertEq(
  extractEmails('<span class="list-group-text"><a href="mailto:support@mobirise.com">f</a>elipe@felipecebria.com</span>'),
  ["felipe@felipecebria.com"],
  "une la letra partida por la etiqueta y descarta el email del constructor",
);

// MESFORM (Webnode): el placeholder del editor no es un email del negocio.
assertEq(
  extractEmails('{"wnd.pc.ContactInfoBlock.placeholder.infoMail":"P.ej. contacto@ejemplo.com"}'),
  [],
  "descarta placeholders en español (ejemplo)",
);

// BONO PROYECTOS: errata en la home, email bueno en el aviso legal con otro TLD.
assertEq(
  pickBestEmail(["info@bonoporyectos.com", "administracion@bonoproyectos.com"], "www.bonoproyectos.es"),
  "administracion@bonoproyectos.com",
  "prefiere la misma marca (otro TLD) a un dominio con errata",
);

assertEq(
  pickBestEmail(["reformas.juan@gmail.com", "info@reformasjuan.es"], "reformasjuan.es"),
  "info@reformasjuan.es",
  "prefiere el dominio propio a gmail",
);
assertEq(pickBestEmail(["otra@agencia.com"], "reformasjuan.es"), "otra@agencia.com", "si solo hay uno ajeno, lo devuelve");
assertEq(pickBestEmail([], "reformasjuan.es"), null, "sin emails → null");

assertEq(
  extractEmails('<p>Escríbenos a <a href="#">info@taller.es</a><span>Horario de 9 a 14</span></p>'),
  ["info@taller.es"],
  "recorta el texto pegado tras el TLD",
);
assertEq(
  extractEmails("<ul><li>hola@clima.com</li><li>Teléfono 600 000 000</li></ul>"),
  ["hola@clima.com"],
  "no funde textos de bloques distintos",
);
assertEq(extractEmails("contacto&#64;obras.es"), ["contacto@obras.es"], "decodifica &#64;");
assertEq(
  extractEmails('<a href="mailto:Info@Obras.es?subject=Hola">Escríbenos</a> info@obras.es'),
  ["info@obras.es"],
  "mailto con asunto y duplicados en minúsculas",
);

assertEq(isJunkEmail("noreply@empresa.com"), true, "noreply es basura");
assertEq(isJunkEmail("logo@2x.png"), true, "assets son basura");
assertEq(isJunkEmail("info@reformasvalencia.es"), false, "un email normal no es basura");
assertEq(emailScore("a@sub.obras.es", "obras.es"), 3, "subdominio del propio dominio puntúa 3");

if (failures) {
  console.error(`\n${failures} test(s) fallidos`);
  process.exit(1);
}
console.log("\nemail.test.ts OK");
