// node --experimental-strip-types orquestador/pool.test.ts
import { runPool } from "./pool.ts";

let failures = 0;
function assert(ok: boolean, msg: string, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${msg}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

await (async () => {
  // 1. Procesa TODOS los items exactamente una vez (sin perder ni duplicar).
  {
    const items = Array.from({ length: 10 }, (_, i) => i);
    const seen: number[] = [];
    await runPool(items, 3, async (n) => { await sleep(1); seen.push(n); });
    const sorted = [...seen].sort((a, b) => a - b);
    assert(
      seen.length === 10 && JSON.stringify(sorted) === JSON.stringify(items),
      "procesa los 10 items exactamente una vez",
      `vistos=${seen.length}`,
    );
  }

  // 2. Nunca hay más de `concurrency` workers en vuelo a la vez.
  {
    let active = 0, maxActive = 0;
    await runPool(Array.from({ length: 12 }), 3, async () => {
      active++; maxActive = Math.max(maxActive, active);
      await sleep(5);
      active--;
    });
    assert(maxActive <= 3, "respeta el tope de concurrencia (3)", `maxActive=${maxActive}`);
    assert(maxActive === 3, "llega a saturar la concurrencia con 12 items", `maxActive=${maxActive}`);
  }

  // 3. concurrency > items: los procesa todos, sin arrancar workers de más.
  {
    let active = 0, maxActive = 0;
    const seen: number[] = [];
    await runPool([10, 20], 5, async (n) => {
      active++; maxActive = Math.max(maxActive, active);
      await sleep(2); seen.push(n); active--;
    });
    assert(seen.length === 2, "procesa los 2 items aunque concurrency=5");
    assert(maxActive <= 2, "no arranca más workers que items", `maxActive=${maxActive}`);
  }

  // 4. Lista vacía: resuelve sin llamar al worker.
  {
    let called = 0;
    await runPool([], 3, async () => { called++; });
    assert(called === 0, "lista vacía → worker nunca se llama");
  }

  // 5. Un worker que captura su propio error NO detiene el pool (patrón de run.ts).
  {
    const done: number[] = [];
    await runPool(Array.from({ length: 6 }, (_, i) => i), 2, async (n) => {
      try {
        if (n === 2) throw new Error("fallo simulado del item 2");
        done.push(n);
      } catch { done.push(-1); } // el worker absorbe su error, como hace run.ts con el tally
    });
    assert(done.length === 6, "un fallo capturado no tumba el pool (6 procesados)", `procesados=${done.length}`);
    assert(done.includes(-1), "el item que falló se contabilizó como fallo");
  }

  // 6. Contrato: un worker que LANZA sin capturar propaga (Promise.all rechaza).
  {
    let rejected = false;
    try {
      await runPool([1, 2, 3], 2, async (n) => { if (n === 2) throw new Error("boom"); });
    } catch { rejected = true; }
    assert(rejected, "un throw sin capturar propaga fuera de runPool");
  }

  console.log(failures === 0 ? "\nOK — pool.test.ts" : `\nFALLOS: ${failures}`);
  process.exit(failures === 0 ? 0 : 1);
})();
