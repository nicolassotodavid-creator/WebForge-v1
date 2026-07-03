// node --experimental-strip-types orquestador/photos.test.ts
import { extractPhotoCandidates, parseCurationResponse, photoManifest } from "./photos.ts";

let failures = 0;
function assertEq(actual: unknown, expected: unknown, msg: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  const ok = a === e;
  console.log(`${ok ? "✓" : "✗"} ${msg}  (got ${a}, want ${e})`);
  if (!ok) failures++;
}

// extractPhotoCandidates
assertEq(extractPhotoCandidates(null), [], "raw null → []");
assertEq(extractPhotoCandidates({}), [], "raw sin fotos → []");
assertEq(
  extractPhotoCandidates({ imageUrl: "https://a/cover.jpg" }),
  ["https://a/cover.jpg"],
  "solo imageUrl (portada)",
);
assertEq(
  extractPhotoCandidates({
    imageUrl: "https://a/cover.jpg",
    imageUrls: ["https://a/cover.jpg", "https://a/2.jpg", { imageUrl: "https://a/3.jpg" }, { url: "https://a/4.jpg" }],
  }),
  ["https://a/cover.jpg", "https://a/2.jpg", "https://a/3.jpg", "https://a/4.jpg"],
  "portada + galería (strings y objetos), dedupe de la portada",
);
assertEq(
  extractPhotoCandidates({ imageUrls: ["ftp://x", "not-a-url", "https://ok/1.jpg"] }),
  ["https://ok/1.jpg"],
  "descarta no-http(s)",
);
assertEq(
  extractPhotoCandidates({ imageUrls: Array.from({ length: 20 }, (_, i) => `https://a/${i}.jpg`) }).length,
  15,
  "tope 15",
);

// parseCurationResponse
assertEq(parseCurationResponse('{"order":[3,0,7]}', 10), [3, 0, 7], "índices válidos en orden");
assertEq(parseCurationResponse('```json\n{"order":[1,1,2]}\n```', 10), [1, 2], "dedupe y quita vallas ```");
assertEq(parseCurationResponse('{"order":[0,5,99,-1]}', 6), [0, 5], "descarta fuera de rango");
assertEq(parseCurationResponse('{"order":[]}', 10), [], "vacío = sin fotos");
assertEq(parseCurationResponse("no soy json", 10), [], "no-JSON → [] (nunca lanza)");
assertEq(parseCurationResponse('{"order":[0,1,2,3,4,5,6,7]}', 10), [0, 1, 2, 3, 4, 5], "tope 6");

// photoManifest
assertEq(
  photoManifest({ hero: null, gallery: [] }).includes("No hay fotos"),
  true,
  "sin fotos → instrucción tipográfica",
);
{
  const m = photoManifest({ hero: "https://h/hero.jpg", gallery: ["https://g/1.jpg", "https://g/2.jpg"] });
  assertEq(m.includes("https://h/hero.jpg") && m.includes("https://g/1.jpg") && m.includes("https://g/2.jpg"), true, "con fotos → incluye todas las URLs");
  assertEq(m.includes("hero"), true, "con fotos → marca el hero");
}

console.log(failures === 0 ? "\nOK" : `\n${failures} FALLO(S)`);
if (failures > 0) process.exit(1);
