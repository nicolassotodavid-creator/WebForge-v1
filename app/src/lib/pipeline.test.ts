// node --experimental-strip-types src/lib/pipeline.test.ts
import { visibleStages, WEB_ONLY_STAGES } from "./pipeline.ts";
import { PIPELINE_ORDER } from "./types.ts";

let failures = 0;
function assert(cond: boolean, msg: string) {
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) failures++;
}

const admin = visibleStages(true);
assert(admin.length === PIPELINE_ORDER.length, "admin ve TODAS las etapas");

const luvia = visibleStages(false);
assert(
  luvia.length === PIPELINE_ORDER.length - WEB_ONLY_STAGES.length,
  "no-admin ve menos etapas (sin las de web)",
);
assert(!luvia.some((s) => WEB_ONLY_STAGES.includes(s)), "no-admin NO ve etapas de web");
assert(
  luvia.includes("new") && luvia.includes("contacted") && luvia.includes("won"),
  "no-admin conserva new/contacted/won",
);

console.log(failures === 0 ? "\nOK" : `\n${failures} FALLO(S)`);
if (failures) process.exit(1);
