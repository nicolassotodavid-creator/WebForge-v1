import { Routes, Route } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Import from "@/pages/Import";
import LeadDetail from "@/pages/LeadDetail";
import Settings from "@/pages/Settings";
import Pagos from "@/pages/Pagos";
import Book from "@/pages/Book";
import Gracias from "@/pages/Gracias";
import NotFound from "@/pages/NotFound";

export default function App() {
  return (
    <Routes>
      {/* Público (sin auth) */}
      <Route path="/login" element={<Login />} />
      <Route path="/book/:leadId" element={<Book />} />
      <Route path="/gracias" element={<Gracias />} />

      {/* Back-office (requiere sesión de operador) */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/import" element={<Import />} />
        <Route path="/leads/:id" element={<LeadDetail />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/pagos" element={<Pagos />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
