// node --experimental-strip-types supabase/functions/_shared/luviaDemo.test.ts
import { buildDemoUrl } from "./luviaDemo.ts";

let failures = 0;
function assertEq(a: unknown, b: unknown, m: string) {
  console.log(`${a === b ? "✓" : "✗"} ${m}  (got ${a})`);
  if (a !== b) failures++;
}

assertEq(buildDemoUrl("https://luvia-ia.es", "abc"), "https://luvia-ia.es/demo/abc", "url normal");
assertEq(buildDemoUrl("https://luvia-ia.es/", "abc"), "https://luvia-ia.es/demo/abc", "quita slash final");

console.log(failures === 0 ? "\nOK" : `\n${failures} FALLO(S)`);
if (failures) process.exit(1);
