// prepare-luvia-demo: el operador prepara la demo de Luvia para un lead.
// 1) lee la URL de la web de la clínica del lead
// 2) llama al endpoint create-demo del Supabase de Luvia (extrae + guarda snapshot, devuelve id)
// 3) persiste luvia_demo_id / luvia_demo_url en el lead
// Gate: la revisión de la demo la hace el operador abriendo la URL; aquí solo se prepara.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildDemoUrl } from "../_shared/luviaDemo.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { lead_id } = await req.json();
    if (!lead_id) return json({ error: "Falta lead_id." }, 400);

    const base = Deno.env.get("LUVIA_DEMO_BASE");
    const createUrl = Deno.env.get("LUVIA_CREATE_DEMO_URL");
    const token = Deno.env.get("LUVIA_API_TOKEN");
    if (!base || !createUrl || !token)
      return json({ error: "Config de Luvia incompleta (LUVIA_DEMO_BASE/LUVIA_CREATE_DEMO_URL/LUVIA_API_TOKEN)." }, 500);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: lead, error: leadErr } = await supabase
      .from("leads").select("id, website_url").eq("id", lead_id).maybeSingle();
    if (leadErr) return json({ error: leadErr.message }, 500);
    if (!lead) return json({ error: "Lead no encontrado." }, 404);
    if (!lead.website_url) return json({ error: "El lead no tiene website_url; no se puede montar la demo." }, 409);

    const res = await fetch(createUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ clinic_url: lead.website_url }),
    });
    const out = await res.json().catch(() => null);
    if (!res.ok || !out?.id)
      return json({ error: `Luvia create-demo falló (${res.status}): ${out?.error ?? "sin id"}` }, 502);

    const demoUrl = buildDemoUrl(base, out.id);
    const { error: updErr } = await supabase
      .from("leads").update({ luvia_demo_id: out.id, luvia_demo_url: demoUrl }).eq("id", lead_id);
    if (updErr) return json({ error: `Guardando la demo: ${updErr.message}` }, 500);

    return json({ ok: true, demo_url: demoUrl, empty: out.empty === true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "error" }, 500);
  }
});
