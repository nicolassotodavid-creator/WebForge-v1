import { Navigate, useLocation } from "react-router-dom";
import { useSession } from "@/hooks/useSession";
import Layout from "@/components/Layout";
import Book from "@/pages/Book";

// Envuelve las rutas del back-office: si no hay sesión, manda a /login
// (y en la raíz "/", la presentación pública de Nico en vez del login; el panel entra por /login).
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
    return <Book home />;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Layout />;
}
