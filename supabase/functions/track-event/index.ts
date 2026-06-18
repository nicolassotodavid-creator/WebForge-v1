// track-event — Contrato: ARQUITECTURA_webforge_v2.md sec. 8
// POST { lead_id, type, payload? } → inserta en events.
// GET  ?lead_id=&type=email_opened&message_id= → pixel 1x1 para tracking de aperturas.
//
// Tipos soportados:
//   demo_viewed    → lead status='viewed' (solo si está en 'contacted')
//   email_opened   → outreach_messages.opened_at = now() (solo primera apertura)
//
// PÚBLICO: sin auth — el negocio llega desde el enlace del email, sin sesión.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// GIF 1×1 transparente (formato GIF89a mínimo válido).
const PIXEL_GIF = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, // GIF89a
  0x01, 0x00, 0x01, 0x00,             // width=1, height=1
  0x80, 0x00, 0x00,                   // GCT flag + color resolution
  0xff, 0xff, 0xff,                   // color 0: white
  0x00, 0x00, 0x00,                   // color 1: black
  0x21, 0xf9, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, // graphic control extension
  0x2c, 0x00, 0x00, 0x00, 0x00,       // image descriptor
  0x01, 0x00, 0x01, 0x00, 0x00,       // width=1, height=1, no local table
  0x02, 0x02, 0x44, 0x01, 0x00,       // image data (LZW)
  0x3b,                               // trailer
]);

function pixelResponse(): Response {
  return new Response(PIXEL_GIF, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleEvent(
  supabase: ReturnType<typeof createClient>,
  leadId: string,
  type: string,
  payload: unknown,
  messageId?: string | null,
) {
  // Insertar evento de auditoría (best-effort — no lanzamos error si falla)
  await supabase.from("events").insert({
    lead_id: leadId,
    type,
    payload: payload ?? (messageId ? { message_id: messageId } : {}),
  });

  // demo_viewed → avanzar lead a 'viewed' (solo si está en 'contacted', para no retroceder)
  if (type === "demo_viewed") {
    await supabase
      .from("leads")
      .update({ status: "viewed", updated_at: new Date().toISOString() })
      .eq("id", leadId)
      .eq("status", "contacted");
  }

  // email_opened → marcar la primera apertura en outreach_messages
  if (type === "email_opened" && messageId) {
    await supabase
      .from("outreach_messages")
      .update({ opened_at: new Date().toISOString() })
      .eq("id", messageId)
      .is("opened_at", null); // solo la primera apertura; no sobreescribir si ya tiene valor
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    // Para el pixel GET devolvemos el GIF de todas formas (no romper el email del cliente).
    if (req.method === "GET") return pixelResponse();
    return jsonResponse({ error: "Config Supabase incompleta." }, 500);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // ─── GET: pixel de apertura de email ────────────────────────────────────────
  if (req.method === "GET") {
    const url = new URL(req.url);
    const leadId = url.searchParams.get("lead_id");
    const type = url.searchParams.get("type");
    const messageId = url.searchParams.get("message_id");

    // Siempre devolvemos el pixel, aunque los params sean incorrectos.
    if (leadId && type) {
      await handleEvent(supabase, leadId, type, null, messageId).catch(() => {});
    }
    return pixelResponse();
  }

  // ─── POST: evento genérico ───────────────────────────────────────────────────
  if (req.method !== "POST") return jsonResponse({ error: "Solo GET o POST." }, 405);

  let body: { lead_id?: string; type?: string; payload?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "JSON inválido." }, 400);
  }

  const { lead_id, type, payload } = body ?? {};
  if (!lead_id) return jsonResponse({ error: "Falta lead_id." }, 400);
  if (!type) return jsonResponse({ error: "Falta type." }, 400);

  await handleEvent(supabase, lead_id, type, payload, null);

  return jsonResponse({ ok: true });
});
