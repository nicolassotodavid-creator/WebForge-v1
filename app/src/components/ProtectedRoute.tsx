import { Navigate } from "react-router-dom";
import { useSession } from "@/hooks/useSession";
import Layout from "@/components/Layout";

// Envuelve las rutas del back-office: si no hay sesión, manda a /login.
export default function ProtectedRoute() {
  const { session, loading } = useSession();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-muted-foreground">
        Cargando…
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Layout />;
}
