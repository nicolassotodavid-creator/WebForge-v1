// webs-voz-webhook — [WEBS] ElevenLabs manda aquí el resumen de cada conversación del asistente de voz de la
// portada de nico-soto.es (agente "Webs — ventas", docs/webs/agente-webs/). El agente tiene este webhook como
// override del de la cuenta, así que sus conversaciones no llegan al post-call de Luvia ni del simulador.
//
// Por cada conversación:
//  · verifica la firma HMAC (cabecera ElevenLabs-Signature, secreto WEBS_VOZ_WEBHOOK_SECRET);
//  · la guarda en events (type 'webs_voz', sin lead: es un visitante de la portada);
//  · avisa a Nico por email (WEBS_AVISO_EMAIL, o SIMULADOR_AVISO_EMAIL si no está) con lo que recogió el agente:
//    nombre, negocio, WhatsApp, email y transcripción, para poder contrastar lo que el agente entendió.
//
// verify_jwt=false: lo llama ElevenLabs, no el navegador. Responde 200 aunque no pueda avisar, para que
// ElevenLabs no desactive el webhook por fallos repetidos; el error queda en el log.
import { createClient } from "jsr:@supabase/supabase-js@2";

const AGENT_ID = "agent_1601m3e9qecjem5awt0b32a3xfng";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

// Cabecera "t=<unix>,v0=<hex>". Misma verificación que el post-call de Luvia: HMAC-SHA256 de "<t>.<cuerpo>",
// con ventana de 30 min contra repeticiones.
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
  const recibido = v0.toLowerCase();
  if (esperado.length !== recibido.length) return false;
  let diff = 0;
  for (let i = 0; i < esperado.length; i++) diff |= esperado.charCodeAt(i) ^ recibido.charCodeAt(i);
  return diff === 0;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  const rawBody = await req.text();
  if (!(await firmaValida(rawBody, req.headers.get("elevenlabs-signature"), Deno.env.get("WEBS_VOZ_WEBHOOK_SECRET")))) {
    return json({ error: "firma inválida" }, 401);
  }

  // deno-lint-ignore no-explicit-any
  let payload: any;
  try { payload = JSON.parse(rawBody); } catch { return json({ error: "JSON inválido" }, 400); }
  if (payload?.type !== "post_call_transcription") return json({ ok: true, ignorado: payload?.type ?? "desconocido" });
  const data = payload.data ?? {};
  const agentId = data.agent_id ?? data.metadata?.agent_id;
  if (agentId !== AGENT_ID) return json({ ok: true, ignorado: "otro agente" });

  // deno-lint-ignore no-explicit-any
  const dc: Record<string, any> = data.analysis?.data_collection_results ?? {};
  const val = (k: string) => {
    const v = dc[k]?.value;
    return v === null || v === undefined || v === "" ? null : v;
  };
  const empresa: string = val("negocio") ?? "(negocio sin nombre)";
  const nombre = val("nombre"), email = val("email"), whatsapp = val("whatsapp"), objecion = val("objecion");
  const interesado = val("interesado");
  const turnos: Array<{ role: string; message: string | null }> = (data.transcript ?? []).filter((t: { message?: string }) => t?.message);
  const hablo = turnos.some((t) => t.role === "user");
  const duracion = Number(data.metadata?.call_duration_secs ?? 0);
  const resumen: string = data.analysis?.transcript_summary ?? "";

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  const leadId: string | null = null;
  const { error: errEvento } = await supabase.from("events").insert({
    lead_id: leadId,
    type: "webs_voz",
    payload: { conversation_id: data.conversation_id, empresa, nombre, email, whatsapp, interesado, objecion, duracion, hablo, resumen },
  });
  if (errEvento) console.error("[webs-voz] no se pudo guardar el evento:", errEvento.message);

  // Aviso a Nico.
  const destino = (Deno.env.get("WEBS_AVISO_EMAIL") ?? Deno.env.get("SIMULADOR_AVISO_EMAIL"));
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!destino || !resendKey) {
    console.error("[webs-voz] falta WEBS_AVISO_EMAIL/SIMULADOR_AVISO_EMAIL o RESEND_API_KEY: no se avisa");
    return json({ ok: true, avisado: false });
  }
  const quiere = interesado === true && (email || whatsapp);
  const asunto = quiere
    ? `🔥 Webs: ${empresa} quiere contratar`
    : !hablo
    ? `Webs (portada): ${empresa} abrió el asistente y no habló`
    : interesado === false
    ? `Webs (portada): ${empresa} habló con el asistente (no le interesa)`
    : `Webs (portada): ${empresa} habló con el asistente`;
  const waDigits = whatsapp ? String(whatsapp).replace(/\D/g, "") : "";
  const waLink = waDigits ? `https://wa.me/${waDigits.length === 9 ? "34" + waDigits : waDigits}` : "";
  const lineas = [
    `Negocio: ${empresa}`,
    `Nombre: ${nombre ?? "—"}`,
    `Email: ${email ?? "—"}`,
    `WhatsApp: ${whatsapp ?? "—"}${waLink ? `  (${waLink})` : ""}`,
    `¿Le interesa?: ${interesado === true ? "sí" : interesado === false ? "no" : "no lo dijo"}`,
    `Lo que le frena: ${objecion ?? "—"}`,
    `Duración: ${Math.round(duracion)} s`,
    "",
    resumen ? `Resumen: ${resumen}` : "",
    quiere ? "\nContéstale hoy por WhatsApp para cerrarlo." : "",
    "",
    "Conversación:",
    ...turnos.slice(-30).map((t) => `${t.role === "agent" ? "Asistente" : "Empresa"}: ${t.message}`),
  ].filter((l, i, a) => !(l === "" && a[i - 1] === ""));
  const texto = lineas.join("\n");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Webs <hola@nico-soto.es>",
      to: [destino],
      subject: asunto,
      text: texto,
      html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#222">${esc(texto).replace(/\n/g, "<br>\n")}</div>`,
    }),
  });
  if (!res.ok) console.error("[webs-voz] Resend", res.status, (await res.text()).slice(0, 300));
  return json({ ok: true, avisado: res.ok, lead_id: leadId });
});
