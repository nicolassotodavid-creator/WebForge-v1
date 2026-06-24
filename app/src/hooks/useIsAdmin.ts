import { useSession } from "./useSession";
import { isAdminEmail, ADMIN_EMAIL_FALLBACK } from "@/lib/admin";

// ¿La sesión actual es la del admin (David)? Mira el email de la sesión contra
// VITE_ADMIN_EMAIL (con fallback hardcodeado si la env var no está en el build).
// Solo decide qué se muestra en el panel; la RLS es la frontera real.
export function useIsAdmin(): boolean {
  const { session } = useSession();
  return isAdminEmail(
    session?.user?.email,
    import.meta.env.VITE_ADMIN_EMAIL || ADMIN_EMAIL_FALLBACK,
  );
}
