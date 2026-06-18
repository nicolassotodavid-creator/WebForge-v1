import { createClient } from "@supabase/supabase-js";

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
