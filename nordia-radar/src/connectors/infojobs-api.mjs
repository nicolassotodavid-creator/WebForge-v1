// InfoJobs — API oficial de ofertas. DESACTIVADO hasta tener credenciales.
// Desbloqueo (gratis): registrar una app en developer.infojobs.net → INFOJOBS_CLIENT_ID y
// INFOJOBS_CLIENT_SECRET en el entorno. Devuelve ofertas para TRIAR a mano: no crea despachos solo,
// porque muchas ofertas no muestran el nombre real del despacho.
import { p, today, writeJson } from '../lib/util.mjs';

const BASE = process.env.INFOJOBS_API_BASE || 'https://api.infojobs.net/api/9/offer';

export async function run(q = 'administrativo despacho abogados', province = 'madrid') {
  const id = process.env.INFOJOBS_CLIENT_ID;
  const secret = process.env.INFOJOBS_CLIENT_SECRET;
  if (!id || !secret) {
    console.log('INFOJOBS_CLIENT_ID/SECRET no definidos: conector desactivado. Mientras tanto, la búsqueda se hace con buscador + revisión manual (ver docs/fuentes.md).');
    return;
  }
  const url = new URL(BASE);
  url.searchParams.set('q', q);
  url.searchParams.set('province', province);
  url.searchParams.set('maxResults', '50');
  url.searchParams.set('order', 'updated-desc');
  url.searchParams.set('sinceDate', process.env.INFOJOBS_SINCE || '_30_DAYS');
  const res = await fetch(url, { headers: { authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64') } });
  if (!res.ok) throw new Error(`InfoJobs ${res.status}: ${await res.text()}`);
  const body = await res.json();
  const offers = (body.items || body.offers || []).map((o) => ({
    titulo: o.title, empresa: o.author?.name || null, ciudad: o.city, fecha: o.published || o.updated, url: o.link,
  }));
  const file = p('data/cache/infojobs', `${today()}-${province}-${q.replace(/\W+/g, '-').slice(0, 40)}.json`);
  writeJson(file, { q, province, fecha: today(), ofertas: offers });
  console.log(`${offers.length} ofertas → ${file}. Triar a mano y pasar las buenas a data/manual/hallazgos.csv.`);
}
