// run-score-sweep.ts — Drena a mano el barrido que puntúa la web que el negocio YA tiene.
//
// Por qué existe: ese barrido corre solo en dos sitios y ambos van a cuentagotas — el paso 0 del
// run diario (Mac encendido) y el pg_cron `cron-score-sites` (6 webs cada 15 min). Tras un scrape
// de prospección grande quedan decenas de leads sin puntuar y la nota es justo el filtro que
// decide a quién vale la pena entrarle ("buenas reseñas + web mala"). Esto lo vacía en minutos.
//
// Uso:  npm run score          (o: SITE_SCORE_BATCH=25 npx tsx run-score-sweep.ts)
// Coste: ~medio céntimo por web (Haiku 4.5). No contacta a nadie ni toca el gate humano.
import "./env.ts";
import { createClient } from "@supabase/supabase-js";
import { scoreExistingSites } from "./score-existing-sites.ts";

const MAX_ROUNDS = Number(process.env.SCORE_ROUNDS ?? 12);

async function main() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_USER_ID } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Faltan vars de Supabase en .env");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  let total = 0;
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const { scored, skipped, failed } = await scoreExistingSites(supabase, ADMIN_USER_ID);
    total += scored;
    console.log(`— ronda ${round}: ${scored} puntuadas · ${skipped} saltadas · ${failed} fallos`);
    // Ronda vacía = no quedan leads con web propia sin analizar. Los `failed` NO marcan
    // site_analyzed_at (se reintentan), así que salimos también si solo hubo fallos: seguir
    // sería un bucle infinito sobre las mismas webs caídas.
    if (scored === 0) break;
  }
  console.log(`✔ total puntuadas: ${total}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
