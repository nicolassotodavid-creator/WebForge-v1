// get-booking-info — datos PÚBLICOS para la landing /book/:leadId.
// Sin auth. Devuelve: { business_name, category, city, live_url }.
// El panel usa la service key; aquí usamos la service key porque es un edge function
// (los secrets nunca llegan al browser).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) return jsonResponse({ error: "Config incompleta." }, 500);

  let lead_id: string | undefined;
  // Acepta GET (?lead_id=...) y POST ({ lead_id })
  if (req.method === "GET") {
    lead_id = new URL(req.url).searchParams.get("lead_id") ?? undefined;
  } else if (req.method === "POST") {
    try { lead_id = (await req.json())?.lead_id; } catch { /* ignore */ }
  } else {
    return jsonResponse({ error: "Método no permitido" }, 405);
  }

  if (!lead_id) return jsonResponse({ error: "Falta lead_id." }, 400);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: lead } = await supabase
    .from("leads")
    .select("name, category, city")
    .eq("id", lead_id)
    .maybeSingle();

  if (!lead) return jsonResponse({ error: "Lead no encontrado." }, 404);

  const { data: site } = await supabase
    .from("sites")
    .select("live_url")
    .eq("lead_id", lead_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return jsonResponse({
    business_name: lead.name,
    category: lead.category ?? null,
    city: lead.city ?? null,
    live_url: site?.live_url ?? null,
  });
});
