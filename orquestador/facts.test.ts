// node --experimental-strip-types orquestador/facts.test.ts
import {
  formatHoursText, formatOpeningHours, flattenAdditionalInfo, whatsappUrl, phoneHref,
  googleMapsUrl, socialLinks, businessFacts,
} from "./facts.ts";

let failures = 0;
function assertEq(actual: unknown, expected: unknown, msg: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  const ok = a === e;
  console.log(`${ok ? "✓" : "✗"} ${msg}  (got ${a}, want ${e})`);
  if (!ok) failures++;
}

// formatHoursText
assertEq(formatHoursText("9 AM to 6 PM"), "9:00–18:00", "rango simple");
assertEq(formatHoursText("9 AM to 2 PM, 4 to 7 PM"), "9:00–14:00 y 16:00–19:00", "jornada partida, inicio hereda PM");
assertEq(formatHoursText("8:30 AM to 1:30 PM, 3 to 6:30 PM"), "8:30–13:30 y 15:00–18:30", "con minutos");
assertEq(formatHoursText("8 to 1 PM"), "8:00–13:00", "heredar PM daría 20:00 > 13:00 → mañana");
assertEq(formatHoursText("12 PM to 4 PM"), "12:00–16:00", "12 PM = mediodía");
assertEq(formatHoursText("Cerrado"), "Cerrado", "cerrado");
assertEq(formatHoursText("Open 24 hours"), "Abierto 24 horas", "24 horas");
assertEq(formatHoursText("con cita previa"), "con cita previa", "formato desconocido → tal cual");

// formatOpeningHours
assertEq(
  formatOpeningHours([
    { day: "domingo", hours: "Cerrado" },
    { day: "lunes", hours: "9 AM to 6 PM" },
    { day: "sábado", hours: "Cerrado" },
  ]),
  [{ dia: "lunes", horario: "9:00–18:00" }, { dia: "sábado", horario: "Cerrado" }, { dia: "domingo", horario: "Cerrado" }],
  "ordena de lunes a domingo",
);
assertEq(formatOpeningHours([{ day: "Monday", hours: "9 AM to 2 PM" }]), [{ dia: "lunes", horario: "9:00–14:00" }], "días en inglés → español");
assertEq(formatOpeningHours(null), null, "sin horario → null");

// flattenAdditionalInfo (ficha real de Talleres Hugal)
assertEq(
  flattenAdditionalInfo({
    Pagos: [{ "Pagos móviles mediante NFC": true }, { "Tarjetas de crédito": true }, { "Tarjetas de débito": true }, { "Tarjetas de crédito": true }],
    Servicios: [{ Sanitario: true }, { "Taller mecánico": true }],
    "Qué ofrece": [{ "Cambio de aceite": true }],
    Otros: [{ Wifi: false }],
  }),
  {
    Pagos: ["Pagos móviles mediante NFC", "Tarjetas de crédito", "Tarjetas de débito"],
    Servicios: ["Taller mecánico"],
    "Qué ofrece": ["Cambio de aceite"],
  },
  "solo atributos a true, sin duplicados ni ruido",
);
assertEq(flattenAdditionalInfo([]), null, "array → null");

// teléfonos
assertEq(whatsappUrl("+34 645 79 10 90"), "https://wa.me/34645791090", "móvil con prefijo → wa.me");
assertEq(whatsappUrl("666633403"), "https://wa.me/34666633403", "móvil sin prefijo");
assertEq(whatsappUrl("+34 963 42 12 39"), null, "fijo → sin WhatsApp");
assertEq(whatsappUrl(null), null, "sin teléfono");
assertEq(phoneHref("+34 963 74 85 71"), "tel:+34963748571", "tel: sin espacios");

// Maps
assertEq(
  googleMapsUrl({ name: "X" }, { url: "https://www.google.com/maps/search/?api=1&query=X&query_place_id=ChIJabc" }),
  "https://www.google.com/maps/search/?api=1&query=X&query_place_id=ChIJabc",
  "usa la URL de Maps del actor",
);
assertEq(
  googleMapsUrl({ name: "Taller Sol", address: "C/ Mayor 1", google_place_id: "ChIJxyz" }, {}),
  "https://www.google.com/maps/search/?api=1&query=Taller%20Sol%2C%20C%2F%20Mayor%201&query_place_id=ChIJxyz",
  "la construye con nombre + dirección + place id",
);

// redes
assertEq(
  socialLinks(
    { name: "Vifran", facebook: "https://www.facebook.com/Taller-Vifran-118919050021147/?ti=as" },
    { website: "https://www.facebook.com/Taller-Vifran-118919050021147/?ti=as" },
  ),
  ["https://www.facebook.com/Taller-Vifran-118919050021147/"],
  "dedupe y quita la query",
);
assertEq(socialLinks({ name: "X" }, { website: "https://wa.me/message/ABC" }), [], "wa.me no es red social");

// businessFacts
{
  const f = businessFacts(
    { name: "Talleres Parc Central", category: "Taller mecánico", city: "València", phone: "+34 645 79 10 90", rating: 4.9, review_count: 331 },
    { categories: ["Taller mecánico"], neighborhood: "Jesús", openingHours: [{ day: "lunes", hours: "9 AM to 6 PM" }] },
    [{ author: null, rating: 5, text: "Muy bien" }],
  );
  assertEq(f.categories, ["Taller mecánico"], "facts: categorías");
  assertEq(f.neighborhood, "Jesús", "facts: barrio");
  assertEq(f.whatsapp_url, "https://wa.me/34645791090", "facts: WhatsApp del móvil");
  assertEq(f.opening_hours, [{ dia: "lunes", horario: "9:00–18:00" }], "facts: horario formateado");
  assertEq(f.reviews.length, 1, "facts: reseñas pasan tal cual");
}

console.log(failures === 0 ? "\nOK" : `\n${failures} FALLO(S)`);
if (failures > 0) process.exit(1);
