// Meta Ad Library — API oficial (Graph API `ads_archive`). DESACTIVADO hasta que exista un token.
// Desbloqueo (lo hace Nico, gratis): cuenta de desarrollador de Meta + verificación de identidad en
// facebook.com/ID + app → token de usuario. Guardarlo como META_ADLIB_TOKEN en el entorno (nunca en git).
// En la UE la API devuelve todos los anuncios entregados en la UE (DSA), no solo los políticos.
import { p, plain, readJson, today, writeJson } from '../lib/util.mjs';

const VERSION = process.env.META_GRAPH_VERSION || 'v26.0';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// El nombre de la página tiene que parecerse al del despacho: evita atribuir anuncios de otro.
const similar = (a, b) => {
  const words = (s) => plain(s).replace(/\b(abogados?|advocats?|bufete|despacho|asociados|slp|sl)\b/g, '').split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  const A = new Set(words(a));
  return words(b).some((w) => A.has(w));
};

export async function run(firms) {
  const token = process.env.META_ADLIB_TOKEN;
  if (!token) {
    console.log('META_ADLIB_TOKEN no definido: conector desactivado. Usa `ads-checklist` (verificación manual) o mira docs/fuentes.md para desbloquearlo.');
    return;
  }
  const cache = readJson(p('data/cache/meta-api.json'), {});
  for (const f of firms) {
    const url = new URL(`https://graph.facebook.com/${VERSION}/ads_archive`);
    url.searchParams.set('search_terms', f.nombre);
    url.searchParams.set('ad_reached_countries', JSON.stringify(['ES']));
    url.searchParams.set('ad_active_status', 'ACTIVE');
    url.searchParams.set('ad_type', 'ALL');
    url.searchParams.set('fields', 'id,page_id,page_name,ad_delivery_start_time,ad_creative_link_captions');
    url.searchParams.set('limit', '25');
    url.searchParams.set('access_token', token);
    const res = await fetch(url);
    const body = await res.json();
    if (!res.ok) { console.error(`${f.key}: error ${res.status} ${body?.error?.message}`); if (res.status === 429) break; continue; }
    const ads = (body.data || []).filter((a) => similar(f.nombre, a.page_name) || (a.ad_creative_link_captions || []).some((c) => plain(c).includes(f.key)));
    cache[f.key] = {
      fecha: today(),
      activa: ads.length ? 'si' : 'no',
      n: ads.length,
      senales: ads.length ? [{
        tipo: 'publicidad', subtipo: 'activa',
        descripcion: `${ads.length} anuncio(s) activo(s) en Meta de la página «${ads[0].page_name}» (desde ${String(ads[0].ad_delivery_start_time).slice(0, 10)})`,
        url: `https://www.facebook.com/ads/library/?id=${ads[0].id}`,
        fecha_evidencia: today(), fecha_comprobacion: today(), estado: 'verificado', fuente: 'meta_ad_library_api',
      }] : [],
    };
    console.log(`${f.key}: ${ads.length} anuncios activos`);
    await sleep(1500);
  }
  writeJson(p('data/cache/meta-api.json'), cache);
}
