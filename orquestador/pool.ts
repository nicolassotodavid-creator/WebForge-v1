// Pool de concurrencia: procesa `items` con como mucho `concurrency` en vuelo a la vez.
//
// N workers van tomando del índice compartido `i` (`i++` es atómico en el bucle de eventos
// de JS: no hay `await` entre leer y escribir el índice, así que dos workers nunca cogen el
// mismo item). Un worker que lanza SÍ propaga (Promise.all rechaza y aborta el pool); por eso
// el llamador envuelve cada `worker` en su propio try/catch cuando quiere que un fallo aislado
// no tumbe la cola (así lo hace run.ts con el tally de resultados).
//
// Es el mecanismo que baja el wall-clock de la cola de builds de N×build a
// ≈ceil(N/concurrencia)×build. Extraído de run.ts para poder testear la concurrencia aislada.
export async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let i = 0;
  const n = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        await worker(items[i++]);
      }
    }),
  );
}
