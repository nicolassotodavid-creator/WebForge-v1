// node --experimental-strip-types orquestador/single-flight.test.ts
import { singleFlight } from "./single-flight.ts";

let failures = 0;
function assert(ok: boolean, msg: string, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${msg}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

await (async () => {
  // 1. Llamadas CONCURRENTES colapsan en una sola ejecución de fn, y todas ven el mismo valor.
  {
    let calls = 0;
    const wrapped = singleFlight(async () => { calls++; await sleep(10); return `v${calls}`; });
    const [a, b, c] = await Promise.all([wrapped(), wrapped(), wrapped()]);
    assert(calls === 1, "3 llamadas concurrentes → fn se ejecuta UNA vez", `calls=${calls}`);
    assert(a === "v1" && b === "v1" && c === "v1", "las 3 reciben el mismo resultado", `${a},${b},${c}`);
  }

  // 2. Tras asentarse, el candado se libera: una llamada posterior vuelve a ejecutar fn.
  {
    let calls = 0;
    const wrapped = singleFlight(async () => { calls++; await sleep(1); return calls; });
    const first = await wrapped();
    const second = await wrapped();
    assert(calls === 2, "llamadas secuenciales (no solapadas) ejecutan fn cada vez", `calls=${calls}`);
    assert(first === 1 && second === 2, "cada ejecución produce su propio valor", `${first},${second}`);
  }

  // 3. Si fn RECHAZA: los llamadores concurrentes comparten el rechazo Y el candado se libera,
  //    de modo que un reintento posterior vuelve a ejecutar fn (y puede tener éxito).
  {
    let calls = 0;
    const wrapped = singleFlight(async () => {
      calls++;
      await sleep(5);
      if (calls === 1) throw new Error("fallo transitorio");
      return "ok";
    });
    let errs = 0;
    await Promise.all([
      wrapped().catch(() => { errs++; }),
      wrapped().catch(() => { errs++; }),
    ]);
    assert(calls === 1 && errs === 2, "un rechazo se comparte entre los concurrentes (1 fn, 2 errores)", `calls=${calls}, errs=${errs}`);
    const retry = await wrapped();
    assert(calls === 2 && retry === "ok", "el candado se libera tras rechazar: el reintento re-ejecuta fn", `calls=${calls}`);
  }

  console.log(failures === 0 ? "\nOK — single-flight.test.ts" : `\nFALLOS: ${failures}`);
  process.exit(failures === 0 ? 0 : 1);
})();
