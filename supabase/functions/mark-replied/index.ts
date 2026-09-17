// mark-replied — Marca que un lead ha RESPONDIDO: sus mensajes enviados pasan a 'replied' (así
// cron-followups ya no le manda el Email 2 ni el 3) y queda el evento `replied` en su actividad.
//
// Dos entradas:
//  1) Automática: POST ?token=<INBOUND_REPLY_SECRET> con el aviso de "email recibido" del buzón
//     (webhook saliente de Zoho Mail para hola@nico-soto.es, u otro reenviador). Se saca el
//     remitente y se casa con leads.email; si el dominio no es de correo gratuito, también por
//     dominio. Sin lead que case → 200 { matched: false } (no es un error: la mayoría del correo
//     entrante no es de leads).
//  2) Manual: botón "Respondió" de la ficha → POST { lead_id, channel? } con la sesión del operador.
//
// verify_jwt=false: Zoho no manda JWT de Supabase; la entrada 1 exige el secreto y la 2 la sesión.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { canAccessLead } from "../_shared/leadAccess.ts";
import { extractSender, isFreeDomain, subjectOf } from "../_shared/replyMatch.ts";

const OWN_DOMAINS = ["nico-soto.es", "luvia-ia.es"];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// deno-lint-ignore no-explicit-any
async function markLead(supabase: any, leadId: string, payload: Record<string, unknown>) {
  const { data: msgs } = await supabase
    .from("outreach_messages")
    .update({ status: "replied" })
    .eq("lead_id", leadId)
    .eq("status", "sent")
    .select("id");
  await supabase.from("events").insert({ lead_id: leadId, type: "replied", payload });
  return (msgs ?? []).length;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const SECRET = Deno.env.get("INBOUND_REPLY_SECRET");
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? req.headers.get("x-webhook-token");
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();

  // Zoho puede mandar JSON o formulario.
  let body: Record<string, unknown> = {};
  const raw = await req.text();
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    body = Object.fromEntries(new URLSearchParams(raw));
  }

  // ── 1) Webhook del buzón ────────────────────────────────────────────────
  if (token) {
    if (!SECRET || token !== SECRET) return json({ error: "No autorizado" }, 401);
    const sender = extractSender(body, OWN_DOMAINS);
    if (!sender) return json({ ok: true, matched: false, reason: "sin remitente" });

    let { data: leads } = await supabase
      .from("leads").select("id, name").ilike("email", sender).limit(5);
    const domain = sender.split("@")[1];
    if (!leads?.length && domain && !isFreeDomain(domain)) {
      ({ data: leads } = await supabase
        .from("leads").select("id, name").ilike("email", `%@${domain}`).limit(5));
    }
    if (!leads?.length) {
      console.log(`mark-replied: sin lead para ${sender}`);
      return json({ ok: true, matched: false, sender });
    }
    const subject = subjectOf(body);
    const out = [];
    for (const lead of leads) {
      const n = await markLead(supabase, lead.id, { channel: "email", from: sender, subject, auto: true });
      out.push({ lead: lead.name, messages: n });
    }
    console.log(`mark-replied: ${sender} → ${out.map((o) => o.lead).join(", ")}`);
    return json({ ok: true, matched: true, leads: out });
  }

  // ── 2) Botón de la ficha ────────────────────────────────────────────────
  const { data: userData, error: userErr } = await supabase.auth.getUser(bearer);
  if (userErr || !userData?.user) return json({ error: "No autorizado" }, 401);
  const leadId = typeof body.lead_id === "string" ? body.lead_id : null;
  if (!leadId) return json({ error: "Falta lead_id." }, 400);
  const { data: lead } = await supabase.from("leads").select("id, owner").eq("id", leadId).maybeSingle();
  if (!lead) return json({ error: "Lead no encontrado." }, 404);
  if (!canAccessLead(lead.owner, { id: userData.user.id, email: userData.user.email ?? "" })) {
    return json({ error: "Este lead no es de tu cuenta." }, 403);
  }
  const channel = typeof body.channel === "string" ? body.channel : "manual";
  const n = await markLead(supabase, leadId, { channel, by: userData.user.email ?? null });
  return json({ ok: true, messages: n });
});
