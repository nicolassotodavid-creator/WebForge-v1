import { Navigate, useLocation } from "react-router-dom";
import { useSession } from "@/hooks/useSession";
import Layout from "@/components/Layout";

// Presentación pública de Nico (proyecto Lovable "Your New Web"): lo que ve quien llega a la
// raíz del dominio sin ser operador. El panel sigue en /login.
export const PUBLIC_HOME_URL = "https://warm-web-offer.lovable.app";

// Envuelve las rutas del back-office: si no hay sesión, manda a /login
// (y desde la raíz "/", a la presentación pública en vez de al login).
export default function ProtectedRoute() {
  const { session, loading } = useSession();
  const { pathname } = useLocation();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-muted-foreground">
        Cargando…
      </div>
    );
  }

  if (!session && pathname === "/") {
    window.location.replace(PUBLIC_HOME_URL);
    return null;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Layout />;
}
