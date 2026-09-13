// Monta el prompt de construcción para Lovable. Lo comparten run.ts (build normal) y rebuild-site.ts
// (reconstruir en sitio): parte variable (Sonnet) + FOTOS curadas + MARCA real + sistema de diseño.

import type { SupabaseClient } from "@supabase/supabase-js";
import { BUILD_PROMPT, DESIGN_SYSTEM } from "../supabase/functions/_shared/prompts.ts";
import { llmText, extractReviews } from "./llm.ts";
import { curatePhotos, extractPhotoCandidates, photoManifest, type CuratedPhotos } from "./photos.ts";
import { extractBrand, brandManifest, normalizeHex, NO_BRAND, type Brand } from "./brand.ts";
import { businessFacts } from "./facts.ts";

export interface BuildLead {
  id: string;
  name: string;
  category?: string | null;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  rating?: number | null;
  review_count?: number | null;
  google_place_id?: string | null;
  raw_json?: unknown;
  website_url?: string | null;
  facebook?: string | null;
}

// Payload para el modelo: SOLO datos reales de la ficha (categorías, horario en 24 h, pagos/cita previa,
// barrio, enlace de Maps, WhatsApp si el teléfono es móvil) + reseñas. Ver facts.ts.
export function leadPayload(lead: BuildLead) {
  return businessFacts(lead, lead.raw_json, extractReviews(lead.raw_json));
}

export async function composeBuildPrompt(
  supabase: SupabaseClient,
  lead: BuildLead,
  brief: Record<string, unknown>,
  bookingUrl: string,
  dryRun = false,
): Promise<{ buildPrompt: string; curated: CuratedPhotos; brand: Brand }> {
  // Curación por visión (Haiku): solo ganadoras, re-hospedadas. Fallback: sin fotos.
  const curated: CuratedPhotos = dryRun
    ? { hero: null, gallery: [] }
    : await curatePhotos(supabase, lead.id, extractPhotoCandidates(lead.raw_json), {
        name: lead.name,
        category: lead.category ?? null,
        city: lead.city ?? null,
      });

  // Marca real: logo de su web + color del logo o del rótulo/fachada (visión sobre las fotos curadas).
  // Antes la paleta la inventaba el brief sin ver nada: los talleres salían todos azul marino + rojo.
  // En dry-run no se escribe en Storage → sin marca.
  const brand: Brand = dryRun
    ? { ...NO_BRAND }
    : await extractBrand(supabase, lead.id, {
        name: lead.name,
        category: lead.category ?? null,
        siteUrl: lead.website_url ?? null,
        photos: [curated.hero, ...curated.gallery].filter((u): u is string => typeof u === "string"),
      });
  console.log(`  · marca: logo=${brand.logoUrl ? "sí" : "no"}${brand.logoOnDark ? " (claro, sobre fondo oscuro)" : ""} · color=${brand.primary ?? "—"}${brand.evidence ? ` (${brand.evidence})` : ""}`);

  // El color real sustituye al que inventó el brief: así el panel y el copy no lo contradicen.
  const briefPalette = (brief.suggested_palette ?? {}) as Record<string, unknown>;
  const briefForPrompt = brand.primary
    ? { ...brief, suggested_palette: { ...briefPalette, primary: brand.primary, accent: brand.secondary ?? brand.primary } }
    : brief;
  if (brand.primary && !dryRun && typeof brief.id === "string") {
    await supabase.from("briefs").update({ suggested_palette: briefForPrompt.suggested_palette }).eq("id", brief.id);
  }

  const variablePrompt = await llmText(
    BUILD_PROMPT.replaceAll("{{BOOKING_URL}}", bookingUrl),
    {
      brief: briefForPrompt,
      business: leadPayload(lead),
      photos: { hero: curated.hero != null, gallery: curated.gallery.length },
      brand: { logo: brand.logoUrl != null, color: brand.primary != null },
    },
    4500, // más secciones con material real (servicios, por qué, FAQ, horario…) + 6-8 reseñas literales sin truncar el CTA/badge del final
  );
  // Prompt final a Lovable = parte variable (Sonnet) + fotos + MARCA (logo/color reales) + design-system invariante.
  const buildPrompt = [
    variablePrompt,
    photoManifest(curated),
    brandManifest(brand, normalizeHex(briefPalette.primary)),
    DESIGN_SYSTEM,
  ]
    .filter((part) => part.trim().length > 0)
    .join("\n\n");
  return { buildPrompt, curated, brand };
}
