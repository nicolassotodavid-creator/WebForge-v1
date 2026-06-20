import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        navigate("/", { replace: true });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        if (data.session) {
          navigate("/", { replace: true });
        } else {
          setInfo(
            "Cuenta creada. Si tu Supabase pide confirmar el email, revisa tu correo y luego inicia sesión.",
          );
          setMode("signin");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de autenticación");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ambient relative grid min-h-screen place-items-center overflow-hidden px-4 py-10">
      {/* Halos de acento en deriva lenta — profundidad ambiental. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-12%] h-[42rem] w-[42rem] -translate-x-1/2 rounded-full bg-primary/20 blur-[130px] animate-aurora" />
        <div className="absolute bottom-[-18%] right-[6%] h-[30rem] w-[30rem] rounded-full bg-primary/10 blur-[130px] animate-aurora [animation-delay:-9s]" />
      </div>

      {/* Rejilla técnica que se desvanece hacia los bordes. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.35] [background-image:linear-gradient(to_right,oklch(var(--border)/0.6)_1px,transparent_1px),linear-gradient(to_bottom,oklch(var(--border)/0.6)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_55%_45%_at_50%_0%,black,transparent_75%)]"
      />

      <div className="w-full max-w-[25rem] animate-fade-in-up">
        {/* Lockup de marca */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="relative grid h-14 w-14 place-items-center rounded-2xl bg-primary text-lg font-bold tracking-tight text-primary-foreground shadow-glow">
            WF
            <span className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/15" />
          </div>
          <h1 className="mt-5 text-[1.75rem] font-semibold tracking-tight">
            WebForge
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Panel de operador
          </p>
        </div>

        {/* Panel de autenticación */}
        <div className="rounded-2xl border border-border bg-card/85 p-6 shadow-elevated backdrop-blur-xl sm:p-7">
          <div className="mb-5">
            <h2 className="text-lg font-semibold tracking-tight">
              {mode === "signin" ? "Inicia sesión" : "Crea tu cuenta"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "signin"
                ? "Entra con tu cuenta de operador."
                : "Solo la primera vez. Después usarás «entrar»."}
            </p>
          </div>

          {!isSupabaseConfigured && (
            <div className="mb-5 rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">
              <p className="font-medium">Faltan las variables de Supabase.</p>
              <p className="mt-1 text-destructive/80">
                Copia <code className="rounded bg-destructive/15 px-1 py-0.5 text-[0.8em]">app/.env.example</code> a{" "}
                <code className="rounded bg-destructive/15 px-1 py-0.5 text-[0.8em]">app/.env.local</code>, pega tu
                URL y anon key, y reinicia <code className="rounded bg-destructive/15 px-1 py-0.5 text-[0.8em]">npm run dev</code>.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@correo.com"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <p className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            {info && (
              <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                {info}
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              className="group w-full"
              disabled={loading}
            >
              {loading ? (
                "Un momento…"
              ) : (
                <>
                  {mode === "signin" ? "Entrar" : "Crear cuenta"}
                  <ArrowRight className="transition-transform duration-150 group-hover:translate-x-0.5" />
                </>
              )}
            </Button>
          </form>

          <button
            type="button"
            className="mt-5 w-full text-center text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setInfo(null);
            }}
          >
            {mode === "signin"
              ? "¿Primera vez? Crear cuenta de operador"
              : "Ya tengo cuenta · Entrar"}
          </button>
        </div>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          Acceso restringido a operadores de WebForge
        </p>
      </div>
    </div>
  );
}
