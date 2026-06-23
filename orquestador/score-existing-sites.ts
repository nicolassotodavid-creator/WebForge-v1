// score-existing-sites.ts — Barrido diario: puntúa la web que el negocio YA tiene.
// Coge leads con web propia (has_website) aún sin analizar, baja su HTML y deja en `leads.site_*`
// una nota 1-10 (Haiku 4.5, ~medio céntimo/web). Es ORIENTATIVO y de prospección: nota baja =
// web floja = buen candidato. NO toca el gate humano ni la web que construimos nosotros (`sites`).
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveWebsite } from "../supabase/functions/_shared/website.ts";
import { analyzeExistingSite } from "./analyze.ts";

// Tope de webs por corrida (acota coste/tiempo del cron). Override con SITE_SCORE_BATCH.
const SWEEP_BATCH = Number(process.env.SITE_SCORE_BATCH ?? 25);

interface LeadRow {
  id: string;
  name: string;
  category: string | null;
  city: string | null;
  rating: number | null;
  review_count: number | null;
  raw_json: unknown;
  website_url: string | null;
}

export interface SweepResult {
  scored: number;
  skipped: number;
  failed: number;
}

export async function scoreExistingSites(supabase: SupabaseClient): Promise<SweepResult> {
  // Leads con web propia y sin analizar, los más antiguos primero. Tope por corrida.
  const { data, error } = await supabase
    .from("leads")
    .select("id,name,category,city,rating,review_count,raw_json,website_url")
    .eq("has_website", true)
    .is("site_analyzed_at", null)
    .order("created_at", { ascending: true })
    .limit(SWEEP_BATCH);
  if (error) throw new Error(error.message);

  const leads = (data ?? []) as LeadRow[];
  const result: SweepResult = { scored: 0, skipped: 0, failed: 0 };

  for (const lead of leads) {
    // Prefiere la web real descubierta (website_url) sobre raw_json (que puede ser su Instagram).
    const url = resolveWebsite(lead);

    // has_website=true pero sin URL parseable: lo marcamos analizado para no re-escanearlo cada día.
    if (!url) {
      await supabase
        .from("leads")
        .update({
          site_analyzed_at: new Date().toISOString(),
          site_analysis: { summary: "No se encontró una URL de web en los datos del lead." },
        })
        .eq("id", lead.id);
      result.skipped++;
      continue;
    }

    try {
      const { analysis, signals } = await analyzeExistingSite({ lead, url });
      if (signals) analysis._widgets = signals; // vendors visibles en la ficha
      const score = typeof analysis.score === "number" ? analysis.score : null;
      await supabase
        .from("leads")
        .update({
          site_score: score,
          site_analysis: analysis,
          site_analyzed_at: new Date().toISOString(),
          // null = no se pudo bajar la web (sin comprobar); true/false = comprobado.
          site_has_chat: signals ? signals.hasChat : null,
          site_has_whatsapp: signals ? signals.hasWhatsapp : null,
        })
        .eq("id", lead.id);
      console.log(`  · web actual puntuada: ${lead.name} → ${score ?? "?"}/10`);
      result.scored++;
    } catch (e) {
      // Error transitorio (Claude / red / timeout): NO marcamos analyzed_at → se reintenta mañana.
      console.error(`  ✗ no se pudo puntuar la web de ${lead.name}: ${e instanceof Error ? e.message : e}`);
      result.failed++;
    }
  }

  return result;
}
