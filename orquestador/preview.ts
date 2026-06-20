// Re-hospedaje de la captura del build en Supabase Storage.
// Lovable da una captura del build (latest_screenshot_url); la descargamos y la subimos a un
// bucket público propio para que /book muestre una imagen estática (nunca se bloquea, escala
// a clicks ilimitados) en vez de embeber la web viva en un <iframe>.
// Lo usan tanto el flujo normal (run.ts) como el backfill (backfill-previews.ts).

import type { SupabaseClient } from "@supabase/supabase-js";

export const PREVIEW_BUCKET = "site-previews";

/**
 * Descarga la captura de Lovable y la re-sube a Supabase Storage (bucket público).
 * Devuelve la URL pública re-hospedada. NUNCA lanza: si algo falla, cae a la URL original de
 * Lovable (mejor algo que nada) o a null. La preview de /book usa lo que devuelva esto.
 */
export async function rehostScreenshot(
  supabase: SupabaseClient,
  leadId: string,
  screenshotUrl?: string,
): Promise<string | null> {
  if (!screenshotUrl) return null;
  try {
    const res = await fetch(screenshotUrl);
    if (!res.ok) {
      console.warn(`  ⚠ captura HTTP ${res.status} — no re-hospedada, uso la URL de Lovable`);
      return screenshotUrl;
    }
    const contentType = res.headers.get("content-type") ?? "image/png";
    const ext = contentType.includes("webp") ? "webp"
      : (contentType.includes("jpeg") || contentType.includes("jpg")) ? "jpg"
      : "png";
    const bytes = new Uint8Array(await res.arrayBuffer());
    const path = `${leadId}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from(PREVIEW_BUCKET)
      // cacheControl 1 día: la captura casi nunca cambia y así el CDN la sirve en caliente
      // (clave para escalar a muchos clicks/día sin re-descargar la imagen cada vez).
      .upload(path, bytes, { contentType, upsert: true, cacheControl: "86400" });
    if (upErr) {
      console.warn(`  ⚠ no se pudo subir la captura a Storage: ${upErr.message} — uso la URL de Lovable`);
      return screenshotUrl;
    }
    const { data } = supabase.storage.from(PREVIEW_BUCKET).getPublicUrl(path);
    console.log(`  · captura re-hospedada: ${data.publicUrl}`);
    return data.publicUrl;
  } catch (e) {
    console.warn(`  ⚠ error re-hospedando captura: ${e instanceof Error ? e.message : e} — uso la URL de Lovable`);
    return screenshotUrl;
  }
}
