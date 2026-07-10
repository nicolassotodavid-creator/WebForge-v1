// handoff-luvia — entrega una clínica CERRADA del flujo Luvia a la plataforma Luvia.
// Input: { lead_id }. Sesión de operador (Bearer JWT) o service_role. Crea el cliente en el
// Supabase de Luvia vía su Edge Function crear-cliente, guarda leads.luvia_client_id, marca el
// lead 'won' e inserta event 'luvia_handoff'. Idempotente: con luvia_client_id ya no repite.
// Secrets SOLO en servidor. La service key de Luvia NUNCA vive aquí (se usa un token bearer).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { canAccessLead, type Operator } from "../_shared/leadAccess.ts";
import { buildLuviaClientPayload, canHandoffToLuvia } from "../_shared/luviaHandoff.ts";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Método no permitido" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ADMIN_USER_ID = Deno.env.get("ADMIN_USER_ID");
  const LUVIA_FUNCTIONS_URL = Deno.env.get("LUVIA_FUNCTIONS_URL");
  const LUVIA_HANDOFF_TOKEN = Deno.env.get("LUVIA_HANDOFF_TOKEN");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return jsonResponse({ error: "Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY." }, 500);
  }
  if (!LUVIA_FUNCTIONS_URL || !LUVIA_HANDOFF_TOKEN) {
    return jsonResponse(
      {
        error:
          "Faltan LUVIA_FUNCTIONS_URL / LUVIA_HANDOFF_TOKEN. Configúralos como secretos: " +
          "npx supabase secrets set LUVIA_FUNCTIONS_URL=https://<ref-luvia>.supabase.co/functions/v1 LUVIA_HANDOFF_TOKEN=...",
      },
      500,
    );
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // --- Autorización: sesión de operador (Bearer) o service_role (interno) ---
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  let authorized = false;
  let operator: Operator | null = null; // != null solo si entra un operador real
  if (token === SERVICE_KEY) {
    authorized = true;
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
  try {
    const body = await req.json();
    leadId = body?.lead_id;
  } catch (_e) {
    return jsonResponse({ error: "Cuerpo no válido. Usa { lead_id }." }, 400);
  }
  if (!leadId) return jsonResponse({ error: "Falta lead_id." }, 400);

  // --- Lead ---
  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .maybeSingle();
  if (leadErr) return jsonResponse({ error: leadErr.message }, 500);
  if (!lead) return jsonResponse({ error: "Lead no encontrado." }, 404);

  // Aislamiento por cuenta: un operador solo actúa sobre SUS leads (admin, cualquiera).
  if (operator && !canAccessLead(lead.owner, operator)) {
    return jsonResponse({ error: "Este lead no es de tu cuenta." }, 403);
  }

  // Guarda de flujo: solo se entregan leads Luvia (owner ≠ admin). Un lead de web nunca.
  if (!canHandoffToLuvia(lead.owner, ADMIN_USER_ID)) {
    return jsonResponse({ error: "Este lead no es del flujo Luvia; no se entrega." }, 400);
  }

  // Idempotencia: si ya tiene cliente en Luvia, no se vuelve a crear.
  if (lead.luvia_client_id) {
    return jsonResponse({ ok: true, luvia_client_id: lead.luvia_client_id, already: true });
  }

  // --- Crear el cliente en la plataforma Luvia (contrato: POST crear-cliente) ---
  const payload = buildLuviaClientPayload(lead);
  let luviaClientId: string | undefined;
  try {
    const resp = await fetch(`${LUVIA_FUNCTIONS_URL}/crear-cliente`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LUVIA_HANDOFF_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const text = await resp.text();
      return jsonResponse(
        { error: `Luvia rechazó el alta (${resp.status}): ${text.slice(0, 300)}` },
        502,
      );
    }
    const result = await resp.json();
    luviaClientId = result?.cliente_id ? String(result.cliente_id) : undefined;
  } catch (e) {
    return jsonResponse(
      { error: `No se pudo contactar con Luvia: ${e instanceof Error ? e.message : String(e)}` },
      502,
    );
  }
  if (!luviaClientId) {
    return jsonResponse({ error: "Luvia no devolvió cliente_id." }, 502);
  }

  // --- Persistir SOLO en éxito: enlazar, cerrar y auditar ---
  const { error: updErr } = await supabase
    .from("leads")
    .update({ luvia_client_id: luviaClientId, status: "won", updated_at: new Date().toISOString() })
    .eq("id", leadId);
  if (updErr) return jsonResponse({ error: updErr.message }, 500);

  await supabase.from("events").insert({
    lead_id: leadId,
    type: "luvia_handoff",
    payload: { luvia_client_id: luviaClientId },
  });

  return jsonResponse({ ok: true, luvia_client_id: luviaClientId });
});
