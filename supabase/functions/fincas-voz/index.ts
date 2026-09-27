// fincas-voz — [FINCAS] Backend del asistente de voz de recepción para administradores de fincas (demo
// "Administraciones Turia", agente en docs/fincas/agente-fincas/). Tres rutas:
//
//  · POST /fincas-voz/urgencia   → herramienta avisar_guardia. Crea la incidencia urgente, manda SMS al móvil de
//    guardia (si hay Twilio y móvil) y email urgente al gestor. Si es ascensor con gente dentro, el aviso pide
//    llamar YA a la empresa de mantenimiento. Un solo aviso por conversación.
//  · POST /fincas-voz/incidencia → herramienta registrar_incidencia. Crea o completa la incidencia y devuelve la
//    referencia REAL (INC-1001…) y si estamos en horario de oficina (hora de España, calculada aquí).
//  · POST /fincas-voz/post-call  → webhook post-llamada de ElevenLabs (firma HMAC). Manda al gestor el resumen de
//    la llamada con lo registrado, con copia a Nico (FINCAS_COPIA_EMAIL).
//
// En la demo, el móvil de guardia y el email del gestor son los de la administración que la prueba: la landing
// se los pasa al widget como variables (guardia_movil, gestor_email). Topes diarios para que nadie use la demo
// para mandar SMS o emails a terceros en bucle.
//
// verify_jwt=false: lo llama ElevenLabs. Las herramientas se autentican con la cabecera x-fincas-token
// (FINCAS_TOOL_TOKEN, guardada como secreto en ElevenLabs); el post-call, con la firma HMAC
// (FINCAS_VOZ_WEBHOOK_SECRET). SMS solo si existen FINCAS_TWILIO_SID y FINCAS_TWILIO_TOKEN.
import { createClient } from "jsr:@supabase/supabase-js@2";

const NOMBRE_DEMO = "Administraciones Turia";
const FROM = `${NOMBRE_DEMO} (demo) <hola@nico-soto.es>`;
const MAX_SMS_DIA = 30;
const MAX_EMAILS_DIA = 60;
const CATEGORIAS = ["agua", "ascensor_atrapados", "gas", "sin_luz", "acceso_abierto", "riesgo_personas", "otra"];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function iguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

// Cabecera "t=<unix>,v0=<hex>": HMAC-SHA256 de "<t>.<cuerpo>", ventana de 30 min (igual que simulador-voz-webhook).
async function firmaValida(rawBody: string, cabecera: string | null, secreto: string | undefined): Promise<boolean> {
  if (!secreto || !cabecera) return false;
  let t = "", v0 = "";
  for (const parte of cabecera.split(",")) {
    const [k, ...v] = parte.trim().split("=");
    if (k === "t") t = v.join("=");
    else if (k === "v0") v0 = v.join("=");
  }
  if (!t || !v0) return false;
  const ts = Number(t);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 30 * 60) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const esperado = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${rawBody}`)));
  return iguales(esperado, v0.toLowerCase());
}

// Hora de España y horario de oficina: L-J 9-14 y 16-19, V 9-14. Festivos no contemplados (es una demo).
function horaEspana(d = new Date()) {
  const partes = Object.fromEntries(new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid", weekday: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(d).map((p) => [p.type, p.value]));
  const dia = String(partes.weekday);
  const min = Number(partes.hour) * 60 + Number(partes.minute);
  const manana = min >= 9 * 60 && min < 14 * 60;
  const tarde = min >= 16 * 60 && min < 19 * 60;
  const enHorario = ["lunes", "martes", "miércoles", "jueves"].includes(dia) ? manana || tarde : dia === "viernes" ? manana : false;
  return { texto: `${dia} ${partes.hour}:${partes.minute}`, enHorario };
}

const emailValido = (e: unknown): e is string => typeof e === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());

// Móvil español a E.164; null si no parece un móvil.
function movilE164(v: unknown): string | null {
  if (typeof v !== "string") return null;
  let d = v.replace(/\D/g, "");
  if (d.startsWith("0034")) d = d.slice(4);
  if (d.length === 11 && d.startsWith("34")) d = d.slice(2);
  return /^[67]\d{8}$/.test(d) ? `+34${d}` : null;
}

const texto = (v: unknown, max = 500) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inicioDia = () => new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString();

async function enviarEmail(to: string[], bcc: string[], asunto: string, cuerpo: string): Promise<boolean> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key || (!to.length && !bcc.length)) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM,
      to: to.length ? to : bcc,
      ...(to.length && bcc.length ? { bcc } : {}),
      subject: asunto,
      text: cuerpo,
      html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#222">${esc(cuerpo).replace(/\n/g, "<br>\n")}</div>`,
    }),
  });
  if (!res.ok) console.error("[fincas-voz] Resend", res.status, (await res.text()).slice(0, 300));
  return res.ok;
}

async function enviarSms(to: string, cuerpo: string): Promise<boolean> {
  const sid = Deno.env.get("FINCAS_TWILIO_SID"), token = Deno.env.get("FINCAS_TWILIO_TOKEN");
  if (!sid || !token) return false;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
    // Remitente alfanumérico: en España no hace falta número propio ni registro previo.
    body: new URLSearchParams({ To: to, From: Deno.env.get("FINCAS_SMS_FROM") || "TURIA", Body: cuerpo }),
  });
  if (!res.ok) console.error("[fincas-voz] Twilio", res.status, (await res.text()).slice(0, 300));
  return res.ok;
}

function copia(): string[] {
  const c = Deno.env.get("FINCAS_COPIA_EMAIL");
  return emailValido(c) ? [c.trim()] : [];
}

const db = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

// deno-lint-ignore no-explicit-any
type Body = Record<string, any>;

async function urgencia(b: Body): Promise<Response> {
  const sb = db();
  const hora = horaEspana();
  const conv = texto(b.conversation_id, 100);
  const categoria = CATEGORIAS.includes(b.categoria) ? b.categoria : "otra";

  if (conv) {
    const { data: previa } = await sb.from("incidencias_fincas").select("referencia, aviso_guardia_canal")
      .eq("conversation_id", conv).not("aviso_guardia_at", "is", null).limit(1).maybeSingle();
    if (previa) {
      return json({ referencia: previa.referencia, avisado: true, ya_avisado: true, canal: previa.aviso_guardia_canal, hora_espana: hora.texto });
    }
  }

  const movil = movilE164(b.guardia_movil);
  const gestor = emailValido(b.gestor_email) ? b.gestor_email.trim() : null;
  const { data: fila, error } = await sb.from("incidencias_fincas").insert({
    conversation_id: conv, tipo_llamada: "vecino", urgente: true, categoria_urgencia: categoria,
    direccion: texto(b.direccion), comunidad_gestionada: typeof b.comunidad_gestionada === "boolean" ? b.comunidad_gestionada : null,
    ubicacion: texto(b.ubicacion), descripcion: texto(b.descripcion, 1000), nombre: texto(b.nombre, 120),
    telefono: texto(b.telefono, 30), idioma: texto(b.idioma, 10), fuera_horario: !hora.enHorario,
    gestor_email: gestor, guardia_movil: movil,
  }).select("id, referencia").single();
  if (error || !fila) {
    console.error("[fincas-voz] insert urgencia", error?.message);
    return json({ avisado: false, error: "No se pudo registrar. Di al vecino que lo marcas como urgente y que, si hay riesgo, llame al 112." });
  }

  const { count: smsHoy } = await sb.from("incidencias_fincas").select("id", { count: "exact", head: true })
    .eq("aviso_guardia_canal", "sms").gte("aviso_guardia_at", inicioDia());
  const ascensor = categoria === "ascensor_atrapados";
  const lugar = [texto(b.direccion, 120), texto(b.ubicacion, 60)].filter(Boolean).join(", ");
  const sms = [
    `URGENTE ${fila.referencia} (${NOMBRE_DEMO}, demo)`,
    lugar,
    texto(b.descripcion, 160),
    b.telefono ? `Tel. vecino: ${String(b.telefono).replace(/[^\d+ ]/g, "")}` : null,
    ascensor ? "Gente atrapada en el ascensor: avisa YA a la empresa de mantenimiento del ascensor." : null,
  ].filter(Boolean).join(" · ");

  let canal = "ninguno";
  if (movil && (smsHoy ?? 0) < MAX_SMS_DIA && (await enviarSms(movil, sms))) canal = "sms";

  const cuerpo = [
    `Aviso URGENTE del asistente de recepción (${hora.texto}).`,
    "",
    `Referencia: ${fila.referencia}`,
    `Comunidad: ${b.direccion ?? "—"}${b.comunidad_gestionada === false ? "  (NO está en la lista de comunidades gestionadas)" : ""}`,
    `Dónde: ${b.ubicacion ?? "—"}`,
    `Qué pasa: ${b.descripcion ?? "—"}`,
    `Tipo: ${categoria}`,
    `Contacto: ${b.nombre ?? "—"} · ${b.telefono ?? "—"}`,
    ascensor ? "\nHay gente atrapada en el ascensor: avisa YA a la empresa de mantenimiento del ascensor." : "",
    categoria === "gas" || categoria === "riesgo_personas" ? "\nAl vecino se le ha dicho que llame primero al 112." : "",
    canal === "sms" ? `\nTambién se ha enviado SMS al móvil de guardia (${movil}).` : "",
    "",
    "—",
    "Demo del asistente de recepción para administradores de fincas · nico-soto.es",
  ].join("\n");
  const emailOk = await enviarEmail(gestor ? [gestor] : [], copia(), `URGENTE ${fila.referencia} · ${categoria} · ${b.direccion ?? "dirección sin confirmar"}`, cuerpo);
  if (canal === "ninguno" && emailOk && gestor) canal = "email";

  await sb.from("incidencias_fincas").update({
    aviso_guardia_at: canal !== "ninguno" ? new Date().toISOString() : null, aviso_guardia_canal: canal, updated_at: new Date().toISOString(),
  }).eq("id", fila.id);

  return json({
    referencia: fila.referencia,
    avisado: canal !== "ninguno",
    canal,
    hora_espana: hora.texto,
    en_horario: hora.enHorario,
    nota: canal === "ninguno"
      ? "El aviso automático no ha salido. No digas que el responsable ya está avisado: di que queda marcado como urgente y que, si hay riesgo, llamen al 112."
      : "El responsable de guardia ya tiene el aviso.",
  });
}

async function incidencia(b: Body): Promise<Response> {
  const sb = db();
  const hora = horaEspana();
  const conv = texto(b.conversation_id, 100);
  const tipo = b.tipo_llamada === "no_vecino" ? "no_vecino" : "vecino";
  const campos = {
    tipo_llamada: tipo,
    direccion: texto(b.direccion), ubicacion: texto(b.ubicacion), descripcion: texto(b.descripcion, 1000),
    comunidad_gestionada: typeof b.comunidad_gestionada === "boolean" ? b.comunidad_gestionada : null,
    nombre: texto(b.nombre, 120), telefono: texto(b.telefono, 30), empresa: texto(b.empresa, 160),
    motivo: texto(b.motivo, 1000), idioma: texto(b.idioma, 10),
    gestor_email: emailValido(b.gestor_email) ? b.gestor_email.trim() : null,
    guardia_movil: movilE164(b.guardia_movil),
    updated_at: new Date().toISOString(),
  };
  // Quita los null para no pisar lo que ya guardó avisar_guardia.
  const limpio = Object.fromEntries(Object.entries(campos).filter(([, v]) => v !== null));

  // Sin nombre o teléfono reales no se registra: el LLM a veces llama antes de pedirlos y rellena "Por confirmar",
  // y el gestor se queda sin forma de contactar. "no_facilitado" es la salida si el llamante se niega a darlos.
  const relleno = (v: string | null) => !v || /confirm|pendiente|desconocid|sin nombre|^n\/?a$/i.test(v);
  const faltan = [
    ...(relleno(campos.nombre) && campos.nombre !== "no_facilitado" ? ["nombre"] : []),
    ...((campos.telefono ?? "").replace(/\D/g, "").length < 9 && campos.telefono !== "no_facilitado" ? ["telefono"] : []),
  ];
  if (faltan.length) {
    return json({
      registrado: false,
      faltan,
      nota: `Todavía NO está registrado y no hay referencia. Pide ${faltan.join(" y ")} (el teléfono, confírmalo cifra a cifra) y vuelve a usar registrar_incidencia con todo. Si el llamante se niega a darlo, pon "no_facilitado" en ese campo.`,
    });
  }

  // Si ya avisó a guardia en esta llamada, completa esa misma incidencia (misma referencia).
  const ref = texto(b.referencia, 20);
  if (ref && conv) {
    const { data: previa } = await sb.from("incidencias_fincas").select("id, referencia, urgente")
      .eq("referencia", ref.toUpperCase().replace(/\s/g, "")).eq("conversation_id", conv).maybeSingle();
    if (previa) {
      await sb.from("incidencias_fincas").update(limpio).eq("id", previa.id);
      return json({ referencia: previa.referencia, urgente: previa.urgente, hora_espana: hora.texto, en_horario: hora.enHorario });
    }
  }

  const urgente = b.urgente === true;
  const { data: fila, error } = await sb.from("incidencias_fincas").insert({
    ...limpio, conversation_id: conv, urgente,
    categoria_urgencia: urgente && CATEGORIAS.includes(b.categoria_urgencia) ? b.categoria_urgencia : null,
    fuera_horario: !hora.enHorario,
  }).select("referencia").single();
  if (error || !fila) {
    console.error("[fincas-voz] insert incidencia", error?.message);
    return json({ error: "No se pudo registrar. Di que lo has apuntado y que el gestor le llamará; no des referencia." });
  }
  return json({
    referencia: fila.referencia,
    hora_espana: hora.texto,
    en_horario: hora.enHorario,
    nota: hora.enHorario
      ? "En horario de oficina: el gestor lo revisa hoy."
      : "Fuera de horario: si no es urgente, di que el gestor lo revisa el próximo día laborable a partir de las 9.",
  });
}

async function postCall(req: Request): Promise<Response> {
  const rawBody = await req.text();
  if (!(await firmaValida(rawBody, req.headers.get("elevenlabs-signature"), Deno.env.get("FINCAS_VOZ_WEBHOOK_SECRET")))) {
    return json({ error: "firma inválida" }, 401);
  }
  // deno-lint-ignore no-explicit-any
  let payload: any;
  try { payload = JSON.parse(rawBody); } catch { return json({ error: "JSON inválido" }, 400); }
  if (payload?.type !== "post_call_transcription") return json({ ok: true, ignorado: payload?.type ?? "desconocido" });
  const data = payload.data ?? {};
  const agente = Deno.env.get("FINCAS_AGENT_ID");
  if (agente && (data.agent_id ?? data.metadata?.agent_id) !== agente) return json({ ok: true, ignorado: "otro agente" });

  const conv: string = data.conversation_id;
  const vars = data.conversation_initiation_client_data?.dynamic_variables ?? {};
  const turnos: { role: string; message: string | null }[] = (data.transcript ?? []).filter((t: { message: unknown }) => t.message);
  const hablo = turnos.some((t) => t.role === "user");
  if (!hablo) return json({ ok: true, ignorado: "sin conversación" });

  const sb = db();
  const { data: filas } = await sb.from("incidencias_fincas").select("*").eq("conversation_id", conv).order("created_at");
  const incs = filas ?? [];
  if (incs.length && incs.every((i) => i.resumen_enviado_at)) return json({ ok: true, ignorado: "ya enviado" });

  const { count: emailsHoy } = await sb.from("incidencias_fincas").select("id", { count: "exact", head: true })
    .gte("resumen_enviado_at", inicioDia());
  const gestor = emailValido(vars.gestor_email) ? vars.gestor_email.trim() : incs.find((i) => i.gestor_email)?.gestor_email ?? null;
  const to = gestor && (emailsHoy ?? 0) < MAX_EMAILS_DIA ? [gestor] : [];

  const principal = incs.find((i) => i.urgente) ?? incs[0];
  const asunto = principal
    ? `${principal.urgente ? "URGENTE · " : ""}${principal.referencia} · ${principal.tipo_llamada === "no_vecino" ? `Llamada de ${principal.empresa ?? principal.nombre ?? "no vecino"}` : principal.direccion ?? "dirección sin confirmar"}`
    : "Llamada sin incidencia registrada";
  const bloques = incs.map((i) => [
    `${i.referencia}${i.urgente ? `  ·  URGENTE (${i.categoria_urgencia ?? "—"})` : ""}${i.fuera_horario ? "  ·  fuera de horario" : ""}`,
    i.tipo_llamada === "no_vecino"
      ? `No vecino: ${i.nombre ?? "—"}${i.empresa ? ` (${i.empresa})` : ""} · Tel. ${i.telefono ?? "—"}\nMotivo: ${i.motivo ?? "—"}`
      : [
        `Comunidad: ${i.direccion ?? "—"}${i.comunidad_gestionada === false ? "  (NO está en la lista de comunidades gestionadas)" : ""}`,
        `Dónde: ${i.ubicacion ?? "—"}`,
        `Qué pasa: ${i.descripcion ?? "—"}`,
        `Contacto: ${i.nombre ?? "—"} · ${i.telefono ?? "—"}`,
        i.aviso_guardia_at ? `Aviso a guardia: ${i.aviso_guardia_canal} a las ${new Date(i.aviso_guardia_at).toLocaleTimeString("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" })}` : null,
      ].filter(Boolean).join("\n"),
  ].join("\n"));
  const cuerpo = [
    `Resumen de la llamada atendida por el asistente de recepción (${horaEspana(new Date((data.metadata?.start_time_unix_secs ?? Date.now() / 1000) * 1000)).texto}, ${data.metadata?.call_duration_secs ?? "?"} s).`,
    "",
    ...(bloques.length ? bloques.flatMap((b) => [b, ""]) : ["No se registró ninguna incidencia.", ""]),
    data.analysis?.transcript_summary ? `Resumen: ${data.analysis.transcript_summary}\n` : "",
    "Conversación:",
    ...turnos.slice(-40).map((t) => `${t.role === "agent" ? "Asistente" : "Llamante"}: ${t.message}`),
    "",
    "—",
    "Demo del asistente de recepción para administradores de fincas · nico-soto.es",
  ].join("\n");

  const ok = await enviarEmail(to, copia(), asunto, cuerpo);
  if (ok && incs.length) {
    await sb.from("incidencias_fincas").update({ resumen_enviado_at: new Date().toISOString() }).in("id", incs.map((i) => i.id));
  }
  return json({ ok: true, enviado: ok, incidencias: incs.length });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  const ruta = new URL(req.url).pathname.split("/").filter(Boolean).pop();
  if (ruta === "post-call") return postCall(req);

  const token = Deno.env.get("FINCAS_TOOL_TOKEN");
  if (!token || !iguales(req.headers.get("x-fincas-token") ?? "", token)) return json({ error: "no autorizado" }, 401);
  let b: Body;
  try { b = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }
  if (ruta === "urgencia") return urgencia(b);
  if (ruta === "incidencia") return incidencia(b);
  return json({ error: "ruta desconocida" }, 404);
});
