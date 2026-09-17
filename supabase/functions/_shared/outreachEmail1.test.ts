// node --experimental-strip-types supabase/functions/_shared/outreachEmail1.test.ts
import {
  assembleEmail1Body,
  cleanBusinessName,
  cleanIntro,
  EMAIL1_SIGNATURE,
  email1Issues,
  greetingLine,
  pickReviewQuotes,
  stripUnverifiedQuotes,
} from "./outreachEmail1.ts";
import { renderEmail, withWhatsappFooter } from "./emailTemplate.ts";
import { OUTREACH_PROMPT } from "./prompts.ts";

let failures = 0;
function eq(actual: unknown, expected: unknown, msg: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "✓" : "✗"} ${msg}${ok ? "" : `  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`}`);
  if (!ok) failures++;
}
function ok(cond: boolean, msg: string) {
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) failures++;
}

// ── Nombre limpio y saludo ──────────────────────────────────────────────────
eq(cleanBusinessName("Auto Service Valencia- Servicio de automóviles premium 🇪🇦🇬🇧🇵🇱"), "Auto Service Valencia", "quita coletilla SEO y banderas");
eq(cleanBusinessName("TALLERES HUGAL S.L CHAPA Y PINTURA"), "Talleres Hugal", "quita S.L y lo de detrás + mayúsculas");
eq(cleanBusinessName("Construcciones United | Reformas | Valencia"), "Construcciones United", "corta en |");
eq(cleanBusinessName("Taller Ruiz Azuaga -Chapa y pintura- Reparación de vehículos"), "Taller Ruiz Azuaga", "corta en ' -'");
eq(cleanBusinessName("Talleres Seron SLU"), "Talleres Seron", "quita SLU");
eq(cleanBusinessName("Racing Bike & Talleres Lebasi S.L."), "Racing Bike & Talleres Lebasi", "quita S.L.");
eq(cleanBusinessName("Taller Garaje 34"), "Taller Garaje 34", "nombre normal intacto");
eq(greetingLine(null), "Hola,", "sin contacto → 'Hola,'");
eq(greetingLine("maría José López"), "Hola María,", "con contacto → nombre de pila");

// ── Citas literales de reseñas ──────────────────────────────────────────────
const raw = {
  reviews: [
    { stars: 5, text: "Muy buen trato y me dejaron el coche como nuevo en dos días. Recomendable 100%" },
    { stars: 2, text: "Tardaron mucho y el trato fue muy frío con nosotros." },
    { stars: 5, text: "Great service, very fast and friendly staff." },
    { stars: 5, text: "Todo perfecto, pero el precio es algo alto para lo que es." },
    { stars: 4, text: "Son muy profesionales y te explican todo con paciencia." },
    { stars: 5, text: "No dudéis en contactar con ellos para cualquier cosa." },
    { stars: 5, text: "estaba roto y lo arreglaron en un momento muy bien" },
  ],
};
const quotes = pickReviewQuotes(raw, 2);
eq([...quotes].sort(), ["Muy buen trato y me dejaron el coche como nuevo en dos días", "Son muy profesionales y te explican todo con paciencia"], "elige frases literales positivas en español");
eq(pickReviewQuotes({}, 2), [], "sin reseñas → []");

// ── Comillas no literales fuera ─────────────────────────────────────────────
const r1 = stripUnverifiedQuotes('Tus clientes hablan de "alta satisfacción y profesionalidad".', quotes);
eq(r1.text, "Tus clientes hablan de alta satisfacción y profesionalidad.", "cita inventada → sin comillas");
const r2 = stripUnverifiedQuotes("Dicen «me dejaron el coche como nuevo».", quotes);
eq(r2.removed.length, 0, "fragmento literal → se conserva la cita");

// ── Limpieza de la intro ────────────────────────────────────────────────────
eq(
  cleanIntro("Hola Talleres Hugal, vi vuestras reseñas.\n\nTe hice una web.\n\nUn saludo,\nNico\nDiseño webs para negocios locales."),
  "Vi vuestras reseñas.\n\nTe hice una web.",
  "quita saludo pegado y firma",
);
eq(cleanIntro("Vi tu ficha.\n\nMira: https://x.lovable.app"), "Vi tu ficha.\n\nMira:", "quita URLs");

// ── Validación ──────────────────────────────────────────────────────────────
ok(email1Issues("Tenéis 445 clientes satisfechos y 20 años de experiencia.", [], { rating: 4.7, review_count: 445 }).length >= 3, "detecta vosotros + clientes + años");
eq(email1Issues("Vi que tienes un 4,7 en Google con 445 reseñas.\n\nTe hice una web; la tienes abajo.", [], { rating: 4.7, review_count: 445 }), [], "email correcto → sin problemas");
ok(email1Issues("Si podéis, mirad la web.", []).some((i) => i.includes("vosotros")), "detecta -éis genérico");
ok(email1Issues(Array(100).fill("palabra").join(" "), []).some((i) => i.includes("palabras")), "detecta >80 palabras");

// ── Ensamblado: firma siempre, debajo de la captura ─────────────────────────
const LINK = "https://www.nico-soto.es/book/abc";
const body = assembleEmail1Body({ intro: 'Vi tu nota.\n\nClientes: "alta satisfacción".', greeting: "Hola,", link: LINK, quotes });
eq(body, `Hola,\n\nVi tu nota.\n\nClientes: alta satisfacción.\n\n${LINK}\n\n${EMAIL1_SIGNATURE}`, "saludo → intro → URL → firma");
ok(body.endsWith("Nico\nDiseño webs para negocios locales."), "termina en firma aunque la IA no firme");
const withWa = withWhatsappFooter(body, "34600000000");
const html = renderEmail({ bodyText: withWa, previewImageUrl: "https://x/p.png", webUrl: "https://w.lovable.app", bookingUrl: LINK });
ok(html.indexOf("p.png") < html.indexOf(">Nico<") || html.indexOf("p.png") < html.indexOf("Nico<br>"), "la firma queda DEBAJO de la captura");
ok(html.indexOf("Diseño webs") < html.indexOf("wa.me"), "WhatsApp debajo de la firma");

// ── Prompt ──────────────────────────────────────────────────────────────────
ok(OUTREACH_PROMPT.includes("review_quotes") && OUTREACH_PROMPT.includes("NUNCA los pongas entre comillas"), "prompt: citas solo literales");
ok(/80 palabras/.test(OUTREACH_PROMPT) && /vosotros/.test(OUTREACH_PROMPT), "prompt: 80 palabras y tuteo");
ok(/NUNCA "N clientes"/.test(OUTREACH_PROMPT), "prompt: reseñas ≠ clientes");

console.log(failures === 0 ? "\nOK" : `\n${failures} FALLO(S)`);
if (failures) process.exit(1);
