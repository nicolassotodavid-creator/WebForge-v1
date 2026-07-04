// Single-flight: colapsa llamadas concurrentes en UNA sola ejecución de `fn`.
//
// Si `fn` ya está en vuelo, las llamadas que llegan mientras tanto comparten esa MISMA
// promesa en vez de arrancar otra ejecución. Cuando se asienta (resuelve o rechaza), el
// candado se libera y la SIGUIENTE llamada vuelve a ejecutar `fn` desde cero.
//
// Por qué en WebForge: el refresh del token OAuth de Lovable ROTA el refresh_token en cada
// uso. Con el pool de builds en paralelo (runPool), dos workers podrían llamar a refrescar a
// la vez y el segundo invalidaría el refresh del primero (o pisaría el .env). Envolver el
// refresh con singleFlight garantiza un único refresh compartido por ráfaga, sin importar
// cuántos workers lo pidan simultáneamente. Ver lovable.ts.
//
// `fn` debe devolver una promesa (p.ej. una función `async`); si lanza de forma síncrona, ese
// error se propaga al primer llamador y el candado no llega a activarse.
export function singleFlight<T>(fn: () => Promise<T>): () => Promise<T> {
  let inFlight: Promise<T> | null = null;
  return () => {
    if (inFlight) return inFlight;
    // `finally` libera el candado tanto si resuelve como si rechaza, para que un fallo
    // transitorio (p.ej. red al refrescar) no deje el single-flight bloqueado para siempre.
    const p = fn().finally(() => {
      inFlight = null;
    });
    inFlight = p;
    return p;
  };
}
