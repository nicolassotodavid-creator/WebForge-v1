// crear-cliente — Edge Function del proyecto LUVIA (NO de WebForge).
// Recibe una clínica CERRADA desde WebForge (función handoff-luvia) y la crea como cliente
// en la base de datos de Luvia. Es la otra mitad del puente.
//
// Contrato: POST con Authorization: Bearer <LUVIA_HANDOFF_TOKEN> y cuerpo
//   { webforge_lead_id, nombre, categoria, telefono, whatsapp, email,
//     direccion, ciudad, pais, rating, resenas, source }
// Responde { cliente_id }. Idempotente por webforge_lead_id (no duplica).
//
// DÓNDE VA: en tu repo/proyecto Supabase de Luvia, en supabase/functions/crear-cliente/index.ts
// Secretos en Luvia: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (ya existen por defecto) + LUVIA_HANDOFF_TOKEN.
import { createClient } from "jsr:@supabase/supabase-js@2";

// Si tu tabla de clientes se llama distinto, cámbialo aquí (y ajusta los nombres de columnas abajo).
const CLIENTES_TABLE = "clientes";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
  const HANDOFF_TOKEN = Deno.env.get("LUVIA_HANDOFF_TOKEN");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return jsonResponse({ error: "Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY." }, 500);
  }
  if (!HANDOFF_TOKEN) {
    return jsonResponse({ error: "Falta LUVIA_HANDOFF_TOKEN." }, 500);
  }

  // Auth: token bearer compartido con WebForge (el mismo valor en los dos proyectos).
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token || token !== HANDOFF_TOKEN) {
    return jsonResponse({ error: "No autorizado" }, 401);
  }

  // Payload
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch (_e) {
    return jsonResponse({ error: "Cuerpo no válido." }, 400);
  }
  const webforgeLeadId = body?.webforge_lead_id ? String(body.webforge_lead_id) : "";
  const nombre = body?.nombre ? String(body.nombre) : "";
  if (!webforgeLeadId || !nombre) {
    return jsonResponse({ error: "Faltan webforge_lead_id o nombre." }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Idempotencia: si ya existe un cliente con ese webforge_lead_id, se devuelve el suyo.
  const { data: existing, error: selErr } = await supabase
    .from(CLIENTES_TABLE)
    .select("id")
    .eq("webforge_lead_id", webforgeLeadId)
    .maybeSingle();
  if (selErr) return jsonResponse({ error: selErr.message }, 500);
  if (existing?.id) return jsonResponse({ cliente_id: String(existing.id) });

  // Alta del cliente. Ajusta los nombres de columna si tu tabla difiere.
  const { data: inserted, error: insErr } = await supabase
    .from(CLIENTES_TABLE)
    .insert({
      webforge_lead_id: webforgeLeadId,
      nombre,
      categoria: body?.categoria ?? null,
      telefono: body?.telefono ?? null,
      whatsapp: body?.whatsapp ?? null,
      email: body?.email ?? null,
      direccion: body?.direccion ?? null,
      ciudad: body?.ciudad ?? null,
      pais: body?.pais ?? null,
      rating: body?.rating ?? null,
      resenas: body?.resenas ?? null,
      source: body?.source ?? "webforge",
    })
    .select("id")
    .single();
  if (insErr) return jsonResponse({ error: insErr.message }, 500);

  return jsonResponse({ cliente_id: String(inserted.id) });
});
