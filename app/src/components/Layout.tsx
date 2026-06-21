import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, Upload, Settings as SettingsIcon, LogOut, Moon, Sun, Wallet, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/hooks/useSession";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/pagos", label: "Pagos", icon: Wallet, end: false },
  { to: "/emails", label: "Emails", icon: Mail, end: false },
  { to: "/import", label: "Importar", icon: Upload, end: false },
  { to: "/settings", label: "Ajustes", icon: SettingsIcon, end: false },
];

function useDarkMode() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem("theme");
    // Dark-first: si el operador no ha elegido, arrancamos en oscuro.
    return saved ? saved === "dark" : true;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  return [dark, setDark] as const;
}

export default function Layout() {
  const navigate = useNavigate();
  const { session } = useSession();
  const [dark, setDark] = useDarkMode();

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="relative min-h-screen bg-background">
      {/* Glow ambiental fijo en la parte superior — profundidad sin ruido. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(48rem_18rem_at_50%_-5rem,oklch(var(--glow)/0.12),transparent)]"
      />

      <header className="sticky top-0 z-sticky border-b border-border/70 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <div className="flex items-center gap-2.5 font-semibold tracking-tight">
            <span className="relative grid h-7 w-7 place-items-center rounded-lg bg-primary text-[0.7rem] font-bold text-primary-foreground shadow-glow-sm">
              WF
              <span className="absolute inset-0 rounded-lg ring-1 ring-inset ring-white/15" />
            </span>
            WebForge
          </div>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {session?.user?.email}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDark((d) => !d)}
              title={dark ? "Modo claro" : "Modo noche"}
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" />
              Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
