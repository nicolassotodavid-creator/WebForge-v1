// unsubscribe — Baja del outreach con UN click (RFC 8058).
// La abren dos actores:
//   • Gmail/Yahoo → POST automático a la URL de `List-Unsubscribe` (cabecera
//     `List-Unsubscribe-Post: List-Unsubscribe=One-Click`). Espera 2xx.
//   • El prospecto → GET al pinchar "Darte de baja" en el pie → página de confirmación.
// Efecto: leads.do_not_contact=true + unsubscribed_at=now(), evento 'unsubscribed'.
// A partir de ahí generate-outreach / send-email / cron-followups ya NO le escriben
// (todos consultan isOptedOut / do_not_contact). Misma columna que la BAJA manual (ver 0020).
//
// Pública (verify_jwt=false): la autorización es la FIRMA HMAC del enlace, no un JWT.
// Idempotente: dar de baja dos veces no duplica el evento ni rompe nada.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { verifyUnsubscribe } from "../_shared/unsubscribe.ts";

function htmlPage(title: string, message: string, status = 200): Response {
  const body = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${title}</title></head>
<body style="margin:0;background:#ffffff;font-family:-apple-system,'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr><td align="center" style="padding:64px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:460px;">
        <tr><td style="color:#1a1a1a;">
          <h1 style="margin:0 0 12px;font-size:22px;">${title}</h1>
          <p style="margin:0;color:#57534E;font-size:16px;line-height:1.6;">${message}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  return new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

Deno.serve(async (req: Request) => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return new Response("Config incompleta.", { status: 500 });
  }

  // Solo GET (humano) o POST (one-click). HEAD lo mandan algunos escáneres de enlaces: 200 vacío.
  const method = req.method.toUpperCase();
  if (method === "HEAD") return new Response(null, { status: 200 });
  if (method !== "GET" && method !== "POST") {
    return new Response("Método no permitido.", { status: 405 });
  }

  // lead + sig van SIEMPRE en la query (el one-click de Gmail hace POST a la misma URL).
  const url = new URL(req.url);
  const leadId = url.searchParams.get("lead") ?? "";
  const sig = url.searchParams.get("sig") ?? "";

  const ok = await verifyUnsubscribe(leadId, sig, SERVICE_KEY);
  if (!ok) {
    // Firma inválida: no damos de baja a nadie. Al humano una página; al one-click un 400.
    return method === "GET"
      ? htmlPage("Enlace no válido", "Este enlace de baja no es válido o ha caducado. Si quieres dejar de recibir correos, responde <strong>BAJA</strong> al último email y lo gestiono.", 400)
      : new Response(JSON.stringify({ error: "firma inválida" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Solo escribir/auditar si aún no estaba dado de baja (idempotencia + no duplicar eventos).
  const { data: lead } = await supabase
    .from("leads")
    .select("id, do_not_contact")
    .eq("id", leadId)
    .maybeSingle();

  if (lead && lead.do_not_contact !== true) {
    const nowIso = new Date().toISOString();
    await supabase
      .from("leads")
      .update({ do_not_contact: true, unsubscribed_at: nowIso })
      .eq("id", leadId);
    // Auditoría best-effort: no romper la baja si el insert del evento fallara.
    await supabase.from("events").insert({
      lead_id: leadId,
      type: "unsubscribed",
      payload: { via: method === "POST" ? "one_click" : "link" },
    });
  }

  // Confirmación. Nota: aunque el lead no exista (o ya estuviera de baja) devolvemos éxito:
  // no filtramos si el contacto está o no en la base, y Gmail solo necesita un 2xx.
  return method === "GET"
    ? htmlPage("Baja confirmada", "Hecho. No volverás a recibir correos míos. Gracias por tu tiempo.")
    : new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
});
