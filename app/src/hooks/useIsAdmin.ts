import { useSession } from "./useSession";
import { isAdminEmail } from "@/lib/admin";

// ¿La sesión actual es la del admin (David)? Mira el email de la sesión contra
// VITE_ADMIN_EMAIL. Solo decide qué se muestra en el panel; la RLS es la frontera real.
export function useIsAdmin(): boolean {
  const { session } = useSession();
  return isAdminEmail(session?.user?.email, import.meta.env.VITE_ADMIN_EMAIL);
}
