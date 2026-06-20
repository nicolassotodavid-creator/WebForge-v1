import { createClient, FunctionsHttpError } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Solo claves PÚBLICAS aquí (URL + anon key). La service key NUNCA va en el frontend.
export const isSupabaseConfigured = Boolean(url && anonKey);

if (!isSupabaseConfigured) {
  // Aviso claro en consola para cuando aún no se han pegado las variables.
  console.warn(
    "[WebForge] Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. " +
      "Copia app/.env.example a app/.env.local y pega tus valores públicos de Supabase.",
  );
}

// Si no está configurado usamos valores dummy para que la app cargue y muestre el aviso,
// en lugar de romperse al arrancar.
export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  anonKey || "placeholder-anon-key",
);

// `supabase.functions.invoke` lanza un FunctionsHttpError cuyo .message es siempre el
// genérico "Edge Function returned a non-2xx status code". El motivo real (p. ej.
// "Falta APIFY_TOKEN_2", "No autorizado", "Apify devolvió 4xx…") viaja en el cuerpo
// JSON de la respuesta, accesible vía error.context. Este helper lo extrae para que el
// operador vea el error real en pantalla en lugar del genérico.
export async function edgeFunctionErrorMessage(
  error: unknown,
  fallback = "Error llamando a la Edge Function.",
): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      const msg = body?.error ?? body?.message;
      if (msg) return String(msg);
    } catch {
      try {
        const txt = await error.context.text();
        if (txt) return txt.slice(0, 300);
      } catch {
        /* sin cuerpo legible */
      }
    }
  }
  return error instanceof Error ? error.message : fallback;
}
