# Webs más rápidas: throughput de la cola de builds (hardening del pool)

**Fecha:** 2026-07-04 · **Estado:** implementado, PR `perf/pool-throughput` pendiente de merge a `main`.

## Problema

"Necesito que se hagan más rápidas las webs." Aclarado con el usuario: el dolor es
**throughput de la cola**, no la latencia de una web suelta.

- La latencia de **una** web (~4 min) es tiempo de generación **de Lovable**
  (`create_project` con `wait:true, timeout_seconds:600` en `lovable.ts`). No lo
  controlamos; la única palanca por-web (bajar el carrusel a 6-8 reseñas) ya está hecha.
- El throughput SÍ era nuestro y estaba roto **en serie**: launchd (`com.webforge.builds`,
  cada 60 s) **no solapa instancias**, y el `run.ts` de entonces recorría la cola con un
  `for`. Resultado: N webs aprobadas = N × 4 min, una detrás de otra.

## Hallazgo durante la implementación

El **pool de concurrencia** (`runPool` + `BUILD_CONCURRENCY`, default 3) que arregla el
throughput **ya estaba mergeado a `origin/main`** (PR #2, commit `3fb22ea`). No hacía falta
"enviarlo": lo que faltaba era (a) **desplegarlo** en el Mac que construye (un `git pull`) y
(b) cerrar el **único borde nuevo** que el paralelismo introduce.

## Cambio de este PR

1. **Single-flight del refresh de token** (`single-flight.ts` + uso en `lovable.ts`). Con el
   pool corriendo 3 builds a la vez, dos workers podían refrescar el token OAuth de Lovable
   simultáneamente; Lovable **rota** el `refresh_token` en cada uso, así que dos refrescos a
   la vez se invalidan mutuamente (y compiten por escribir el `.env`). El single-flight colapsa
   las llamadas concurrentes en **un solo refresh compartido por ráfaga**; al asentarse, el
   candado se libera para el siguiente refresh que haga falta. `refreshAccessToken` pasa a ser
   `singleFlight(doRefreshAccessToken)`.

2. **`runPool` extraído a `pool.ts`** (movido verbatim desde `run.ts`, comportamiento idéntico)
   para poder **testear la concurrencia aislada** — antes, embebido y con los side-effects del
   módulo, no tenía tests.

3. **Tests puros** (`pool.test.ts`, `single-flight.test.ts`, estilo `node --experimental-strip-types`)
   y script `npm test`.

## Aislamiento / interfaces

- `pool.ts` → `runPool<T>(items, concurrency, worker)`: N workers toman de un índice compartido
  (`i++` atómico en el event loop). Un worker que lanza propaga; `run.ts` envuelve cada worker en
  su try/catch para que un fallo aislado no tumbe la cola.
- `single-flight.ts` → `singleFlight(fn)`: devuelve un wrapper que comparte la promesa en vuelo.
  Genérico y sin dependencias.

## Verificación

- `npm run typecheck` limpio; tests **15/15**.
- Revisión adversaria con 4 lentes independientes (equivalencia de `runPool`, corrección de
  `singleFlight`, integración en `lovable.ts`, estado mutable compartido en el flujo paralelo):
  **0 hallazgos**, veredicto `ship`.

## Despliegue (fuera de este repo)

El Mac que construye (`davidnicolassoto-2:~/webforge`) usa lo que hay en `main`. Tras mergear
este PR: `git checkout main && git pull` en ese Mac. Sin ese pull, el pool + hardening no llegan
a la máquina que construye. Opcional: `BUILD_CONCURRENCY=2` en su `.env` si Lovable devuelve
rate limits (default 3).

## Fuera de alcance (anotado para más adelante)

Sacar los builds del Mac a un runner en la nube / GitHub Actions — arreglaría el throughput *y*
mataría la fricción de los dos Macs (adiós al `git pull` manual). Mayor: secretos en CI y adaptar
el refresh del token, que hoy escribe en `.env`.
