// node --experimental-strip-types supabase/functions/_shared/prompts.test.ts
import { LUVIA_OUTREACH_PROMPT } from "./prompts.ts";

let failures = 0;
function assert(cond: boolean, msg: string) {
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) failures++;
}

assert(LUVIA_OUTREACH_PROMPT.includes("Nico"), "el prompt firma como Nico");
assert(!LUVIA_OUTREACH_PROMPT.includes("Miguel"), "el prompt NO menciona a Miguel");
assert(LUVIA_OUTREACH_PROMPT.includes("reviews"), "el prompt usa las reseñas reales");
assert(LUVIA_OUTREACH_PROMPT.includes("short_name"), "el prompt pide short_name (para el WhatsApp)");
assert(/SIN firma/.test(LUVIA_OUTREACH_PROMPT), "la firma la pone el sistema, no la IA");
assert(/LITERAL/.test(LUVIA_OUTREACH_PROMPT), "citas solo literales");

console.log(failures === 0 ? "\nOK" : `\n${failures} FALLO(S)`);
if (failures) process.exit(1);
