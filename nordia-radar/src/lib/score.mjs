import { monthsAgo, plain } from './util.mjs';

const verified = (s) => s.estado === 'verificado';
const fmtDate = (d) => (d ? String(d).slice(0, 7) : 'sin fecha');

// Devuelve { total, bloques: {nombre: puntos}, desglose: [{bloque, puntos, motivo, url}] }.
// Regla: nada puntúa sin una señal verificada con URL; las hipótesis se listan con 0 puntos.
export function scoreFirm(firm, cfg, ref) {
  const B = cfg.bloques;
  const desglose = [];
  const add = (bloque, puntos, motivo, url = null) => desglose.push({ bloque, puntos, motivo, url });
  const senales = firm.senales || [];
  const ok = senales.filter((s) => verified(s) && s.url);

  // 1. Contratación administrativa u operativa
  {
    let best = 0, why = null;
    for (const s of ok.filter((s) => s.tipo === 'contratacion' && s.subtipo !== 'abogado')) {
      const m = monthsAgo(s.fecha_evidencia, ref);
      let pts, txt;
      if (m === null) [pts, txt] = [B.contratacion.admin_sin_fecha, 'oferta sin fecha visible'];
      else if (m <= B.contratacion.admin_reciente_meses) [pts, txt] = [B.contratacion.admin_reciente, `oferta reciente (${fmtDate(s.fecha_evidencia)})`];
      else if (m <= B.contratacion.admin_antigua_meses) [pts, txt] = [B.contratacion.admin_antigua, `oferta de ${fmtDate(s.fecha_evidencia)}`];
      else [pts, txt] = [0, `oferta antigua (${fmtDate(s.fecha_evidencia)}), no puntúa`];
      if (pts > best || why === null) { best = Math.max(best, pts); why = { pts, txt: `${txt}: ${s.descripcion}`, url: s.url }; }
    }
    if (why) add('contratacion', Math.min(best, B.contratacion.max), why.txt, why.url);
  }

  // 2. Publicidad activa verificada (solo desde la verificación manual o una API oficial)
  {
    const pubs = ok.filter((s) => s.tipo === 'publicidad');
    const activa = pubs.find((s) => s.subtipo === 'activa');
    const reciente = pubs.find((s) => s.subtipo === 'reciente');
    if (activa) add('publicidad', B.publicidad.activa, activa.descripcion, activa.url);
    else if (reciente) add('publicidad', B.publicidad.reciente_no_activa, reciente.descripcion, reciente.url);
  }

  // 3. Tamaño y perfil
  {
    const T = B.perfil.tamano;
    const n = firm.abogados?.n;
    const conf = firm.abogados?.tipo === 'confirmado';
    if (n) {
      let pts = 0;
      if (n >= T.ideal_min && n <= T.ideal_max) pts = conf ? T.ideal_confirmado : T.ideal_estimado;
      else if (n >= T.cercano_min && n <= T.cercano_max) pts = conf ? T.cercano_confirmado : T.cercano_estimado;
      add('perfil', pts, `${n} abogados (${conf ? 'confirmado' : 'estimado'})${pts ? '' : ', fuera del rango'}`, firm.abogados.fuente || null);
    }
    // Solo cuenta si el cargo publicado es de decisión (lo de entre paréntesis suele ser una nota del investigador).
    const cargo = String(firm.decisor?.cargo || '').split('(')[0];
    if (firm.decisor?.nombre && firm.decisor?.fuente && /(soci|fundador|titular|director|gerente|ceo|propietari)/i.test(cargo)) {
      add('perfil', B.perfil.decisor_publico, `decisor público: ${firm.decisor.nombre} (${firm.decisor.cargo || 'cargo sin publicar'})`, firm.decisor.fuente);
    }
  }

  // 4. Carga documental por especialidad publicada (hecho: la especialidad; inferencia: la carga)
  {
    let best = 0, which = null;
    for (const esp of firm.especialidades || []) {
      for (const [k, v] of Object.entries(B.carga_documental.por_especialidad)) {
        if (plain(esp).includes(plain(k)) && v > best) [best, which] = [v, esp];
      }
    }
    if (which) add('carga_documental', Math.min(best, B.carga_documental.max), `especialidad publicada: ${which} (carga documental estimada por especialidad)`);
  }

  // 5. Crecimiento (incluye ofertas de abogado)
  {
    const C = B.crecimiento;
    for (const s of ok.filter((s) => s.tipo === 'crecimiento' || (s.tipo === 'contratacion' && s.subtipo === 'abogado'))) {
      const m = monthsAgo(s.fecha_evidencia, ref);
      if (m !== null && m > C.ventana_meses) { add('crecimiento', 0, `${s.descripcion} (${fmtDate(s.fecha_evidencia)}, fuera de ventana)`, s.url); continue; }
      const sub = s.tipo === 'contratacion' ? 'abogado' : s.subtipo;
      const base = C.por_senal[sub] ?? C.por_senal.otro;
      add('crecimiento', m === null ? Math.min(base, C.sin_fecha ?? base) : base, `${s.descripcion} (${fmtDate(s.fecha_evidencia)})`, s.url);
    }
  }

  // 6. Necesidad tecnológica o intención de compra
  {
    const I = B.intencion;
    let best = null;
    for (const s of ok.filter((s) => s.tipo === 'intencion')) {
      const pts = I.por_senal[s.subtipo] ?? I.por_senal.otro;
      if (!best || pts > best.pts) best = { pts, s };
    }
    if (best) add('intencion', best.pts, best.s.descripcion, best.s.url);
  }

  // Hipótesis: visibles, sin puntos
  for (const s of senales.filter((s) => !verified(s))) add(s.tipo, 0, `HIPÓTESIS (no puntúa): ${s.descripcion}`, s.url || null);

  const bloques = {};
  for (const [k, def] of Object.entries(B)) {
    const sum = desglose.filter((d) => d.bloque === k).reduce((a, d) => a + d.puntos, 0);
    bloques[k] = Math.min(sum, def.max);
  }
  const total = Object.values(bloques).reduce((a, b) => a + b, 0);
  return { total, bloques, desglose };
}
