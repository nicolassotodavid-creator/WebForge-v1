// node --experimental-strip-types supabase/functions/_shared/prompts.test.ts
import { LUVIA_OUTREACH_PROMPT } from "./prompts.ts";

let failures = 0;
function assert(cond: boolean, msg: string) {
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) failures++;
}

assert(LUVIA_OUTREACH_PROMPT.includes("Nico"), "el prompt firma como Nico");
assert(!LUVIA_OUTREACH_PROMPT.includes("Miguel"), "el prompt NO menciona a Miguel");
assert(LUVIA_OUTREACH_PROMPT.includes("demo_url"), "el prompt ramifica según demo_url");
assert(/reply-first|responder|respondan/i.test(LUVIA_OUTREACH_PROMPT), "conserva el fallback reply-first");

console.log(failures === 0 ? "\nOK" : `\n${failures} FALLO(S)`);
if (failures) process.exit(1);
