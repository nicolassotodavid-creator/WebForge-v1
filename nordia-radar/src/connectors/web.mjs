// Web del despacho: pasada ligera y respetuosa (robots.txt, 1 petición/seg, máx. 6 páginas).
// Sirve para la ACTUALIZACIÓN periódica: detecta páginas de empleo nuevas y cambios en la página de
// equipo frente a la pasada anterior. Todo lo que produce es HIPÓTESIS hasta que una persona lo mira:
// el texto de una web no basta para dar por hecha una contratación o un crecimiento.
import crypto from 'node:crypto';
import { domainOf, p, readJson, today, writeJson } from '../lib/util.mjs';

const UA = 'NordiaRadar/0.1 (investigacion comercial; respeta robots.txt)';
const PATHS = {
  equipo: ['/equipo', '/nosotros', '/quienes-somos', '/el-despacho', '/despacho', '/equip', '/qui-som'],
  empleo: ['/trabaja-con-nosotros', '/empleo', '/unete', '/carreras', '/treballa-amb-nosaltres', '/ofertas-de-empleo'],
};
const HIRING = /(trabaja con nosotros|[uú]nete a(l| nuestro) equipo|buscamos|seleccionamos|incorporar(emos)? (a|un|una)|oferta de empleo|vacante|treballa amb nosaltres|enví(a|anos) tu (cv|curr[ií]culum))/i;
const ADMIN = /(administrativ|secretari|recepcion|paralegal|auxiliar|gestor(a)? de expedientes|procura)/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,text/plain' }, redirect: 'follow', signal: AbortSignal.timeout(15000) });
    if (!res.ok) return { status: res.status, text: '' };
    return { status: res.status, text: await res.text(), finalUrl: res.url };
  } catch (err) {
    return { status: 0, text: '', error: err.message };
  }
}

// Parser mínimo de robots.txt: reglas Disallow/Allow del grupo `*` (o del nuestro).
function robotsRules(txt) {
  const rules = [];
  let applies = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const [k, ...rest] = line.split(':');
    const v = rest.join(':').trim();
    if (/^user-agent$/i.test(k)) applies = v === '*' || /nordiaradar/i.test(v);
    else if (applies && /^(dis)?allow$/i.test(k) && v) rules.push({ allow: /^allow$/i.test(k), path: v });
  }
  return rules;
}
function allowed(rules, path) {
  let best = null;
  for (const r of rules) {
    const re = new RegExp('^' + r.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
    if (re.test(path) && (!best || r.path.length > best.path.length)) best = r;
  }
  return !best || best.allow;
}

const textOf = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12);

export async function scanWeb(firm) {
  const domain = domainOf(firm.web);
  if (!domain) return null;
  const base = new URL(firm.web).origin;
  const cacheFile = p('data/cache/web', `${domain}.json`);
  const prev = readJson(cacheFile, {});
  const robots = await get(`${base}/robots.txt`);
  // 401/403/429 en robots.txt = la web no quiere visitas automáticas (o nos frena): no insistir y
  // conservar la pasada anterior tal cual.
  if ([401, 403, 429].includes(robots.status)) return { ...prev, dominio: domain, robots: robots.status, senales: [], bloqueado: true };
  const rules = robots.status === 200 ? robotsRules(robots.text) : [];

  const pages = {};
  // La página de equipo que vio el investigador va primero; si no, las rutas habituales.
  const known = firm.abogados?.fuente && domainOf(firm.abogados.fuente) === domain ? new URL(firm.abogados.fuente).pathname : null;
  const candidates = { equipo: [known, ...PATHS.equipo].filter((x) => x && x !== '/'), empleo: PATHS.empleo };
  for (const [kind, paths] of Object.entries(candidates)) {
    for (const path of [...new Set(paths)]) {
      if (!allowed(rules, path)) continue;
      await sleep(1000);
      const r = await get(base + path);
      const landedHome = r.finalUrl && new URL(r.finalUrl).pathname === '/'; // redirección a la home = no existe
      if (r.status === 200 && r.text.length > 500 && !landedHome) { pages[kind] = { url: r.finalUrl || base + path, text: textOf(r.text) }; break; }
    }
  }

  const senales = [];
  const empleo = pages.empleo?.text || '';
  if (empleo && HIRING.test(empleo)) {
    senales.push({
      tipo: ADMIN.test(empleo) ? 'contratacion' : 'crecimiento',
      subtipo: ADMIN.test(empleo) ? 'admin' : 'otro',
      descripcion: `Página de empleo publicada${ADMIN.test(empleo) ? ' con mención a puestos administrativos' : ''} (detección automática, revisar)`,
      url: pages.empleo.url, fecha_evidencia: null, fecha_comprobacion: today(), estado: 'hipotesis', fuente: 'web_scan',
    });
  }
  const equipoHash = pages.equipo ? hash(pages.equipo.text) : null;
  if (equipoHash && prev.equipoHash && prev.paginas?.equipo === pages.equipo.url && prev.equipoHash !== equipoHash) {
    senales.push({
      tipo: 'crecimiento', subtipo: 'otro',
      descripcion: `La página de equipo ha cambiado desde la pasada del ${prev.fecha} (¿incorporación o salida?, revisar)`,
      url: pages.equipo.url, fecha_evidencia: today(), fecha_comprobacion: today(), estado: 'hipotesis', fuente: 'web_scan',
    });
  }
  const out = { dominio: domain, fecha: today(), robots: robots.status, paginas: Object.fromEntries(Object.entries(pages).map(([k, v]) => [k, v.url])), equipoHash, senales };
  writeJson(cacheFile, out);
  return out;
}

export function webSignals(domain) {
  return readJson(p('data/cache/web', `${domain}.json`), { senales: [] }).senales || [];
}
