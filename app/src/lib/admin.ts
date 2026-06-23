// Helper puro: ¿el email de la sesión es el del admin (David)?
// NO es una frontera de seguridad — la RLS de Supabase lo es. Solo decide qué se PINTA
// en el panel: el admin ve la maquinaria de webs; cualquier otro usuario (Luvia) no.
export function isAdminEmail(
  email: string | null | undefined,
  adminEmail: string | null | undefined,
): boolean {
  if (!email || !adminEmail) return false;
  return email.trim().toLowerCase() === adminEmail.trim().toLowerCase();
}
