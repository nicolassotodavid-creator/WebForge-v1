// resend-webhook — Recibe eventos de Resend y suprime destinatarios problemáticos.
//   email.bounced    (rebote duro / permanente) → do_not_contact=true
//   email.complained (marcó como spam)          → do_not_contact=true
// Por qué: seguir escribiendo a direcciones que rebotan o que ya te marcaron spam HUNDE la
// reputación del dominio → más correos a spam. Suprimir a la primera protege la bandeja del
// resto. Reutiliza la MISMA columna leads.do_not_contact (0020) que respetan los 3 envíos.
//
// Público (verify_jwt=false): lo llama Resend, no el browser. La autorización es la firma
// Svix (HMAC-SHA256) que la propia función verifica con RESEND_WEBHOOK_SECRET (whsec_...).
// No lleva CORS. Idempotente: re-suprimir no duplica evento.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { verifySvixSignature } from "../_shared/svix.ts";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const WEBHOOK_SECRET = Deno.env.get("RESEND_WEBHOOK_SECRET");
  if (!SUPABASE_URL || !SERVICE_KEY || !WEBHOOK_SECRET) {
    return jsonResponse(
      { error: "Config incompleta (SUPABASE_URL, SERVICE_KEY, RESEND_WEBHOOK_SECRET)." },
      500,
    );
  }
  if (req.method !== "POST") return jsonResponse({ error: "Solo POST." }, 405);

  // Leer el body como texto ANTES de verificar la firma (no consumir el stream dos veces).
  const body = await req.text();
  const svixId = req.headers.get("svix-id") ?? "";
  const svixTimestamp = req.headers.get("svix-timestamp") ?? "";
  const svixSignature = req.headers.get("svix-signature") ?? "";

  // Protección replay: rechazar timestamps de más de 5 min (el de Svix va en segundos Unix).
  const ts = Number(svixTimestamp);
  if (!ts || Math.abs(Date.now() / 1000 - ts) > 300) {
    return jsonResponse({ error: "Timestamp ausente o fuera de ventana." }, 400);
  }

  const valid = await verifySvixSignature(WEBHOOK_SECRET, svixId, svixTimestamp, body, svixSignature);
  if (!valid) return jsonResponse({ error: "Firma Svix inválida." }, 401);

  let event: { type?: string; data?: { email_id?: string; to?: string[]; bounce?: unknown } };
  try {
    event = JSON.parse(body);
  } catch {
    return jsonResponse({ error: "JSON inválido." }, 400);
  }

  const type = event.type ?? "";
  // Solo suprimimos ante rebote duro o queja de spam. El resto (delivered, opened, clicked,
  // delivery_delayed) se ignora con 200 para que Resend no reintente.
  const SUPPRESS: Record<string, string> = {
    "email.bounced": "email_bounced",
    "email.complained": "email_complained",
  };
  const eventType = SUPPRESS[type];
  if (!eventType) return jsonResponse({ received: true, ignored: type });

  const recipients = (event.data?.to ?? []).filter((x): x is string => typeof x === "string");
  if (recipients.length === 0) return jsonResponse({ received: true, no_recipients: true });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const nowIso = new Date().toISOString();
  let suppressed = 0;

  for (const email of recipients) {
    // ilike sin comodines = igualdad case-insensitive (los emails no distinguen mayúsculas).
    const { data: leads } = await supabase
      .from("leads")
      .select("id, do_not_contact")
      .ilike("email", email);

    for (const lead of leads ?? []) {
      if (lead.do_not_contact === true) continue; // idempotente
      await supabase
        .from("leads")
        .update({ do_not_contact: true, unsubscribed_at: nowIso })
        .eq("id", lead.id);
      await supabase.from("events").insert({
        lead_id: lead.id,
        type: eventType,
        payload: { email, email_id: event.data?.email_id ?? null, resend_type: type },
      });
      suppressed++;
    }
  }

  // Resend espera 2xx para no reintentar.
  return jsonResponse({ received: true, suppressed });
});
