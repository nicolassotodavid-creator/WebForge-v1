import type { SupabaseClient } from "@supabase/supabase-js";

export const PREVIEW_BUCKET = "site-previews";

// Descarga una imagen y la re-sube a Supabase Storage. Devuelve la URL pública, o null si algo falla.
// NUNCA lanza. No cae a la URL original a propósito: el caller decide el fallback.
export async function rehostToBucket(
  supabase: SupabaseClient,
  bucket: string,
  pathNoExt: string,
  url?: string,
): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`  ⚠ imagen HTTP ${res.status} (${url.slice(0, 60)}…) — no re-hospedada`);
      return null;
    }
    const contentType = res.headers.get("content-type") ?? "image/png";
    const ext = contentType.includes("webp") ? "webp"
      : (contentType.includes("jpeg") || contentType.includes("jpg")) ? "jpg"
      : "png";
    const bytes = new Uint8Array(await res.arrayBuffer());
    const path = `${pathNoExt}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(bucket)
      .upload(path, bytes, { contentType, upsert: true, cacheControl: "86400" });
    if (upErr) {
      console.warn(`  ⚠ no se pudo subir ${path} a Storage: ${upErr.message}`);
      return null;
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  } catch (e) {
    console.warn(`  ⚠ error re-hospedando ${url.slice(0, 60)}…: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

// Re-hospeda la captura del build de Lovable. Mantiene el comportamiento previo: si el re-host falla,
// cae a la URL original de Lovable (mejor algo que nada); null solo si no hay captura.
export async function rehostScreenshot(
  supabase: SupabaseClient,
  leadId: string,
  screenshotUrl?: string,
): Promise<string | null> {
  if (!screenshotUrl) return null;
  const rehosted = await rehostToBucket(supabase, PREVIEW_BUCKET, leadId, screenshotUrl);
  return rehosted ?? screenshotUrl;
}
