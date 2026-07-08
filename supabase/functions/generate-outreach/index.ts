// generate-outreach — Contrato: ARQUITECTURA_webforge_v2.md sec. 8 y 10 (Fase 5).
// Input: { lead_id, email_number? }. Solo para leads status='approved'|'contacted' (Luvia exento de gates de web).
// email_number: 1 (gancho, IA personalizada), 2 (recordatorio día 4, template), 3 (cierre día 7, template).
// Canal sale de lead.segment: 'local' -> 'email', 'b2b' -> 'linkedin'.
// Guarda el draft en outreach_messages con email_number. Secrets SOLO en servidor.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { OUTREACH_PROMPT, LUVIA_OUTREACH_PROMPT } from "../_shared/prompts.ts";
import { isLuviaLead } from "../_shared/luvia.ts";
import { bookingLink, withWhatsappFooter } from "../_shared/emailTemplate.ts";
import { canAccessLead, isAdminEmail, type Operator } from "../_shared/leadAccess.ts";
import { isOptedOut } from "../_shared/contactability.ts";

const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractJson(text: string): Record<string, unknown> {
  let t = text.trim();
  t = t.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("respuesta sin JSON");
  return JSON.parse(t.slice(start, end + 1));
}

// Asunto de respaldo de Luvia si la IA no devuelve uno (en Luvia el subject lo propone el modelo).
function getLuviaSubject(): string {
  return "Una recepción que no duerme para tu clínica";
}

// Subjects fijos por segmento (no los decide Claude).
function getSubject(hasWebsite: boolean, emailNumber: number): string {
  const base = hasWebsite
    ? "Tu web está lista. ¿Te gusta cómo ha quedado?"
    : "Tu web está lista.";
  return emailNumber === 1 ? base : `Re: ${base}`;
}

// Templates literales para Email 2 y 3 (sin IA — son 3 líneas, no merece la pena).
// `link` va SOLO en su propia línea para que la plantilla lo renderice como botón "Ver la web →".
function buildTemplateBody(
  emailNumber: 2 | 3,
  hasWebsite: boolean,
  nombre: string,
  link: string,
): string {
  if (emailNumber === 2) {
    return `Hola ${nombre},\nSolo por si no lo viste.\n\n${link}\n\nNico`;
  }
  // Email 3
  const verb = hasWebsite ? "lo dejo caer" : "la doy de baja";
  return (
    `Hola ${nombre},\n` +
    `Esta semana ${verb} — tengo otros negocios esperando y no puedo tenerlo activo indefinidamente.\n` +
    `Por si acaso, aquí la tienes:\n\n${link}\n\nNico`
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Método no permitido" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return jsonResponse({ error: "Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY." }, 500);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // --- Autorización: sesión de operador (Bearer) o service_role (orquestador) ---
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  let authorized = false;
  let operator: Operator | null = null; // != null solo si entra un operador real
  if (token === SERVICE_KEY) {
    authorized = true; // llamada interna desde el orquestador (de confianza)
  } else if (token) {
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data?.user) {
      authorized = true;
      operator = { id: data.user.id, email: data.user.email ?? "" };
    }
  }
  if (!authorized) return jsonResponse({ error: "No autorizado" }, 401);

  // --- Input ---
  let leadId: string | undefined;
  let emailNumber = 1;
  try {
    const body = await req.json();
    leadId = body?.lead_id;
    if (body?.email_number && [1, 2, 3].includes(Number(body.email_number))) {
      emailNumber = Number(body.email_number);
    }
  } catch (_e) {
    return jsonResponse({ error: "Cuerpo no válido. Usa { lead_id, email_number? }." }, 400);
  }
  if (!leadId) return jsonResponse({ error: "Falta lead_id." }, 400);

  // Email 1 necesita ANTHROPIC_API_KEY; 2 y 3 no.
  if (emailNumber === 1 && !ANTHROPIC_API_KEY) {
    return jsonResponse(
      { error: "Falta ANTHROPIC_API_KEY para generar Email 1 con IA." },
      500,
    );
  }

  // --- Lead ---
  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .maybeSingle();
  if (leadErr) return jsonResponse({ error: leadErr.message }, 500);
  if (!lead) return jsonResponse({ error: "Lead no encontrado." }, 404);

  // Aislamiento por cuenta: un operador solo redacta para SUS leads (admin, cualquiera). El
  // service_role del orquestador trae operator=null y se salta esta comprobación.
  if (operator && !canAccessLead(lead.owner, operator)) {
    return jsonResponse({ error: "Este lead no es de tu cuenta." }, 403);
  }

  // BAJA (opt-out): si el lead pidió no ser contactado, no se redacta ni se envía nada.
  if (isOptedOut(lead)) {
    return jsonResponse({ error: "Este lead pidió BAJA (do_not_contact); no se le contacta." }, 409);
  }

  const ADMIN_USER_ID = Deno.env.get("ADMIN_USER_ID");
  // La rama Luvia solo se activa cuando el LLAMADOR es un operador real no-admin
  // (email = misma fuente de verdad que RLS / leadAccess.ts), de modo que el admin
  // nunca puede disparar un email Luvia aunque ADMIN_USER_ID esté mal configurado.
  const luvia =
    isLuviaLead(lead.owner, ADMIN_USER_ID) && !!operator && !isAdminEmail(operator.email);

  if (!luvia && lead.status !== "approved" && lead.status !== "contacted") {
    return jsonResponse(
      { error: `El lead debe estar 'approved' o 'contacted' (está '${lead.status}').` },
      409,
    );
  }
  // Luvia este sprint solo Email 1 (sin secuencia de seguimientos propia).
  if (luvia && emailNumber !== 1) {
    return jsonResponse(
      { error: "Los seguimientos de Luvia aún no están disponibles (solo Email 1)." },
      409,
    );
  }

  const segment = lead.segment === "b2b" ? "b2b" : "local";
  const channel = luvia ? "email" : (segment === "b2b" ? "linkedin" : "email");
  const hasWebsite = lead.has_website === true;

  // --- Idempotency: no generar el mismo email_number dos veces para el mismo lead ---
  const { data: existingMsg } = await supabase
    .from("outreach_messages")
    .select("id, status")
    .eq("lead_id", leadId)
    .eq("email_number", emailNumber)
    .maybeSingle();
  if (existingMsg) {
    return jsonResponse(
      {
        error: `Ya existe un mensaje email_number=${emailNumber} para este lead (id=${existingMsg.id}, status=${existingMsg.status}). Usa ese o bórralo antes de regenerar.`,
        existing_id: existingMsg.id,
      },
      409,
    );
  }

  // --- Email 3: no enviar si el Email 2 fue abierto ---
  if (emailNumber === 3) {
    const { data: email2 } = await supabase
      .from("outreach_messages")
      .select("id, opened_at, status")
      .eq("lead_id", leadId)
      .eq("email_number", 2)
      .maybeSingle();
    if (!email2) {
      return jsonResponse(
        { error: "No existe Email 2 para este lead. Envía el Email 2 antes." },
        409,
      );
    }
    if (email2.opened_at) {
      return jsonResponse(
        {
          error:
            "El Email 2 fue abierto por el lead — no se envía el Email 3 para no quemar el contacto.",
          opened_at: email2.opened_at,
        },
        409,
      );
    }
    if (email2.status !== "sent") {
      return jsonResponse(
        { error: `El Email 2 aún no se ha enviado (status=${email2.status}).` },
        409,
      );
    }
  }

  // --- Brief (el más reciente) ---
  const { data: brief, error: briefErr } = await supabase
    .from("briefs")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (briefErr) return jsonResponse({ error: briefErr.message }, 500);
  if (!luvia && !brief && emailNumber === 1) {
    return jsonResponse(
      { error: "Este lead no tiene brief todavía. Genera el brief antes del mensaje." },
      409,
    );
  }

  // --- Site con URL en vivo ---
  const { data: site } = await supabase
    .from("sites")
    .select("live_url,status,created_at")
    .eq("lead_id", leadId)
    .not("live_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const liveUrl: string | null = site?.live_url ?? null;
  if (!luvia && channel === "email" && !liveUrl) {
    return jsonResponse(
      { error: "La web aún no tiene URL en vivo (live_url); no se puede redactar el email." },
      409,
    );
  }

  const subject = getSubject(hasWebsite, emailNumber);
  const nombre = lead.contact_name ?? lead.name;

  // TODOS los emails (1, 2 y 3) llevan UNA sola CTA → la página de venta /book (no la web cruda):
  // /book muestra la captura de la web + la oferta + el botón de pago, así el prospecto puede COMPRAR.
  // Si no hay BOOKING_BASE configurado, cae a la live_url para no dejar el email sin enlace.
  // El enlace lo añade el sistema (no la IA): en frío la copy es suave, pero aterriza en /book.
  const emailLink = bookingLink(Deno.env.get("BOOKING_BASE"), leadId) ?? liveUrl!;

  // ─────────────────────────────────────────────────────────────────────────────
  // EMAIL 2 y 3: templates literales, sin IA
  // ─────────────────────────────────────────────────────────────────────────────
  if (emailNumber === 2 || emailNumber === 3) {
    const bodyText = buildTemplateBody(emailNumber, hasWebsite, nombre, emailLink);

    const { data: inserted, error: insErr } = await supabase
      .from("outreach_messages")
      .insert({
        lead_id: leadId,
        channel,
        subject: channel === "email" ? subject : null,
        body: withWhatsappFooter(bodyText, Deno.env.get("WHATSAPP_NUMBER"), channel),
        status: "draft",
        generated_by_model: "template",
        email_number: emailNumber,
      })
      .select()
      .single();
    if (insErr) return jsonResponse({ error: `Guardando el mensaje: ${insErr.message}` }, 500);

    return jsonResponse({ ok: true, channel, email_number: emailNumber, message: inserted });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // EMAIL 1: IA personalizada (Claude Haiku)
  //  - Web (OUTREACH_PROMPT): vende la web de muestra; el sistema añade CTA → /book.
  //  - Luvia (LUVIA_OUTREACH_PROMPT): ofrece el agente de chat; SIN link (CTA = responder).
  // ─────────────────────────────────────────────────────────────────────────────
  const systemPrompt = luvia ? LUVIA_OUTREACH_PROMPT : OUTREACH_PROMPT;
  const payload = luvia
    ? {
        business: {
          name: lead.name,
          category: lead.category,
          city: lead.city,
          rating: lead.rating,
          review_count: lead.review_count,
        },
      }
    : {
        segment,
        channel,
        has_website: hasWebsite,
        live_url: liveUrl,
        business: { name: lead.name, category: lead.category, city: lead.city },
        contact: { name: lead.contact_name ?? null, role: lead.contact_role ?? null },
        brief: brief
          ? {
              business_summary: brief.business_summary,
              tone: brief.tone,
              value_props: brief.value_props,
              highlights_from_reviews: brief.highlights_from_reviews,
              services: brief.services,
              hero_copy: brief.hero_copy,
            }
          : null,
      };

  let anthropicData: { content?: { text?: string }[]; error?: { message?: string } };
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1200,
        system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: JSON.stringify(payload) }],
      }),
    });
    anthropicData = await res.json();
    if (!res.ok) {
      return jsonResponse(
        { error: `Claude devolvió ${res.status}: ${anthropicData?.error?.message ?? "error"}` },
        502,
      );
    }
  } catch (e) {
    return jsonResponse(
      { error: `No se pudo contactar con Claude: ${e instanceof Error ? e.message : "error"}` },
      502,
    );
  }

  const text = anthropicData.content?.[0]?.text ?? "";
  let draft: Record<string, unknown>;
  try {
    draft = extractJson(text);
  } catch (_e) {
    return jsonResponse({ error: "Claude no devolvió un JSON válido.", raw: text.slice(0, 500) }, 422);
  }

  const bodyText = typeof draft.body === "string" ? draft.body.trim() : "";
  if (!bodyText) {
    return jsonResponse({ error: "El mensaje redactado vino vacío.", raw: text.slice(0, 500) }, 422);
  }

  // Web: asunto fijo del sistema + CTA → /book añadida por el sistema.
  // Luvia: asunto lo propone la IA (con respaldo fijo) y NO se añade ningún link.
  const finalSubject = luvia
    ? (typeof draft.subject === "string" && draft.subject.trim() ? draft.subject.trim() : getLuviaSubject())
    : subject;
  const finalBody = luvia
    ? bodyText
    : (channel === "email" ? `${bodyText}\n\n${emailLink}` : bodyText);

  const { data: inserted, error: insErr } = await supabase
    .from("outreach_messages")
    .insert({
      lead_id: leadId,
      channel,
      subject: channel === "email" ? finalSubject : null,
      body: luvia ? finalBody : withWhatsappFooter(finalBody, Deno.env.get("WHATSAPP_NUMBER"), channel),
      status: "draft",
      generated_by_model: ANTHROPIC_MODEL,
      email_number: 1,
    })
    .select()
    .single();
  if (insErr) return jsonResponse({ error: `Guardando el mensaje: ${insErr.message}` }, 500);

  return jsonResponse({ ok: true, channel, email_number: 1, message: inserted });
});
