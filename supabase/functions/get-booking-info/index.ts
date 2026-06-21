// get-booking-info — datos PÚBLICOS por leadId. Lo consumen dos páginas de cliente:
//  - /book/:leadId (panel Vercel): oferta + pago.
//  - la landing warm nico-soto.es/:leadId (proyecto Lovable warm-web-offer): propuesta en frío.
// Sin auth. Devuelve: { business_name, contact_name, category, city, rating, review_count,
//   live_url, preview_image_url, highlights }.
// Usa la service key (es un edge function; los secrets nunca llegan al browser).
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
    .select("name, contact_name, category, city, rating, review_count")
    .eq("id", lead_id)
    .maybeSingle();

  if (!lead) return jsonResponse({ error: "Lead no encontrado." }, 404);

  const { data: site } = await supabase
    .from("sites")
    .select("live_url, preview_image_url")
    .eq("lead_id", lead_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Highlights reales de reseñas (temas concretos que repiten los clientes, sin nombres
  // inventados). Salen del brief más reciente. La landing los usa como citas de "Reseñas".
  const { data: brief } = await supabase
    .from("briefs")
    .select("highlights_from_reviews")
    .eq("lead_id", lead_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const rawHighlights = brief?.highlights_from_reviews;
  const highlights = Array.isArray(rawHighlights)
    ? rawHighlights.filter((h): h is string => typeof h === "string")
    : [];

  return jsonResponse({
    business_name: lead.name,
    contact_name: lead.contact_name ?? null,
    category: lead.category ?? null,
    city: lead.city ?? null,
    rating: lead.rating ?? null,
    review_count: lead.review_count ?? null,
    live_url: site?.live_url ?? null,
    preview_image_url: site?.preview_image_url ?? null,
    highlights,
  });
});
