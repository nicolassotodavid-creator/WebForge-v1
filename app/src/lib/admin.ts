// Helper puro: ¿el email de la sesión es el del admin (David)?
// NO es una frontera de seguridad — la RLS de Supabase lo es. Solo decide qué se PINTA
// en el panel: el admin ve la maquinaria de webs; cualquier otro usuario (Luvia) no.

// Fallback si VITE_ADMIN_EMAIL no llega al build (p.ej. falta en Vercel). Sin esto, una
// env var ausente dejaría a David sin la maquinaria de webs. Debe coincidir con ADMIN_EMAIL
// del backend (_shared/leadAccess.ts) e is_admin() de la migración 0016_lead_ownership.sql.
export const ADMIN_EMAIL_FALLBACK = "nicolassotodavid@gmail.com";
export function isAdminEmail(
  email: string | null | undefined,
  adminEmail: string | null | undefined,
): boolean {
  if (!email || !adminEmail) return false;
  return email.trim().toLowerCase() === adminEmail.trim().toLowerCase();
}
