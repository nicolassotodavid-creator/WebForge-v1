import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

// Marca este navegador como del operador (cookie en todo nico-soto.es, 1 año). track-click y
// /book la leen para que los clics y visitas de Nico no cuenten como interés del negocio.
export function markOperatorDevice() {
  if (typeof document === "undefined") return;
  const host = window.location.hostname;
  const domain = host.endsWith("nico-soto.es") ? "; domain=.nico-soto.es" : "";
  document.cookie = `wf_op=1; path=/; max-age=31536000; secure; samesite=lax${domain}`;
}

export function isOperatorDevice(): boolean {
  return typeof document !== "undefined" && /(?:^|;\s*)wf_op=1(?:;|$)/.test(document.cookie);
}

// Hook simple para conocer la sesión del operador y reaccionar a login/logout.
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
      if (data.session) markOperatorDevice();
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setLoading(false);
      if (s) markOperatorDevice();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, loading };
}
