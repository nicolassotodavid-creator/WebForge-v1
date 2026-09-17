// node --experimental-strip-types supabase/functions/_shared/replyMatch.test.ts
import assert from "node:assert/strict";
import { extractSender, isFreeDomain, subjectOf } from "./replyMatch.ts";

const own = ["nico-soto.es"];

// Zoho Mail (outgoing webhook): fromAddress + toAddress.
assert.equal(
  extractSender({ fromAddress: "Taller@TalleresMartos.com", toAddress: "hola@nico-soto.es", subject: "Re: Tu web" }, own),
  "taller@talleresmartos.com",
);
// Cabecera con nombre.
assert.equal(extractSender({ from: "Rocauto <rocautotalleres@gmail.com>" }, own), "rocautotalleres@gmail.com");
// Sin campo de remitente: primer email del cuerpo que no sea nuestro.
assert.equal(
  extractSender({ html: "El 16 sep, Nico <hola@nico-soto.es> escribió… info@rualcars.es" }, own),
  "info@rualcars.es",
);
// Rebotes y nuestros propios correos no cuentan.
assert.equal(extractSender({ from: "MAILER-DAEMON@amazonses.com", to: "hola@nico-soto.es" }, own), null);
assert.equal(extractSender({ from: "hola@nico-soto.es" }, own), null);
assert.equal(isFreeDomain("Hotmail.com"), true);
assert.equal(isFreeDomain("talleresmartos.com"), false);
assert.equal(subjectOf({ subject: "Re: Tu web está lista." }), "Re: Tu web está lista.");
console.log("replyMatch.test.ts OK");
