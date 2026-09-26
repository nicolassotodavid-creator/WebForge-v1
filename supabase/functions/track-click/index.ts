// track-click — Redirector con seguimiento para los enlaces que recibe el prospecto.
// GET /track-click/<leadId>/<web|book|wa|demo|home|lwa|lweb>?m=<message_id>&c=<email|whatsapp>[&s=<slug demo>]
// En los emails y en el WhatsApp manual va como https://www.nico-soto.es/r/<leadId>/<destino>
// (app/vercel.json lo reescribe aquí), así el prospecto ve el dominio de la marca.
//
//  1) Resuelve el destino EN EL SERVIDOR a partir del lead: web → última sites.live_url,
//     book → BOOKING_BASE/<lead>, wa → wa.me/WHATSAPP_NUMBER, demo → presupuestos.nico-soto.es/demo/<s>
//     ([SIMULADOR], host fijo), home → APP_URL (portada de la marca), [LUVIA] lwa → WhatsApp de ventas
//     de Luvia con el texto que llevaba el email (sacado del cuerpo guardado, validado contra el número
//     fijo), lweb → luvia-ia.es. Nunca redirige a una URL que venga en el propio enlace.
//  2) Apunta `link_clicked` en events: destino, canal, mensaje y si parece automático (vista previa
//     de WhatsApp, escáner del correo, HEAD o clic a <60 s del envío).
//  3) Un clic de una persona cuenta como "ha visto la web": lead contacted → viewed, igual que
//     demo_viewed en /book.
//
// PÚBLICO (verify_jwt=false): lo abre el prospecto sin sesión. Si algo falla, redirige igualmente.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { bookingLink } from "../_shared/emailTemplate.ts";
import {
  demoUrl,
  isLikelyBot,
  isLuviaWhatsappUrl,
  isTooSoonAfterSend,
  LUVIA_WEB,
  luviaWhatsappUrl,
  parseClickPath,
} from "../_shared/clickTracking.ts";

const DEFAULT_FALLBACK = "https://www.nico-soto.es";

function redirect(location: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: location, "Cache-Control": "no-store" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Método no permitido", { status: 405 });
  }

  const url = new URL(req.url);
  const fallback = Deno.env.get("APP_URL") || DEFAULT_FALLBACK;
  const parsed = parseClickPath(url.pathname);
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!parsed || !SUPABASE_URL || !SERVICE_KEY) return redirect(fallback);

  const { leadId, target } = parsed;
  const messageId = url.searchParams.get("m");
  const channel = url.searchParams.get("c") ?? (messageId ? "email" : null);
  const bookUrl = bookingLink(Deno.env.get("BOOKING_BASE"), leadId);

  let destination: string | null = null;
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    const [siteRes, msgRes] = await Promise.all([
      target === "web"
        ? supabase
          .from("sites")
          .select("live_url")
          .eq("lead_id", leadId)
          .not("live_url", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
        : Promise.resolve({ data: null }),
      messageId
        ? supabase.from("outreach_messages").select("sent_at, body").eq("id", messageId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    if (target === "web") {
      destination = (siteRes.data as { live_url?: string } | null)?.live_url ?? bookUrl;
    } else if (target === "book") {
      destination = bookUrl;
    } else if (target === "demo") {
      destination = demoUrl(url.searchParams.get("s"));
    } else if (target === "home") {
      destination = fallback;
    } else if (target === "lweb") {
      destination = LUVIA_WEB;
    } else if (target === "lwa") {
      // El mismo enlace (con el nombre de la clínica ya escrito) que llevaba el email.
      const body = (msgRes.data as { body?: string } | null)?.body ?? "";
      const fromBody = body.match(/https:\/\/wa\.me\/\d+\?text=\S+/)?.[0];
      destination = isLuviaWhatsappUrl(fromBody) ? fromBody! : luviaWhatsappUrl(null);
    } else {
      const n = (Deno.env.get("WHATSAPP_NUMBER") ?? "").replace(/\D/g, "");
      destination = n.length >= 8 ? `https://wa.me/${n}` : null;
    }

    const ua = req.headers.get("user-agent");
    const tooSoon = isTooSoonAfterSend((msgRes.data as { sent_at?: string } | null)?.sent_at, new Date());
    // Cookie wf_op la pone el panel (useSession) en .nico-soto.es: el clic es de Nico, no del negocio.
    const operator = /(?:^|;\s*)wf_op=1(?:;|$)/.test(req.headers.get("cookie") ?? "");
    const automatic = req.method === "HEAD" || isLikelyBot(ua) || tooSoon || operator;

    await supabase.from("events").insert({
      lead_id: leadId,
      type: "link_clicked",
      payload: {
        target,
        channel,
        message_id: messageId,
        automatic,
        ...(tooSoon ? { too_soon: true } : {}),
        ...(operator ? { operator: true } : {}),
        ua: ua ? ua.slice(0, 200) : null,
      },
    });

    // El simulador no toca leads.status: el pipeline de webs no debe enterarse.
    if (!automatic && target !== "demo") {
      await supabase
        .from("leads")
        .update({ status: "viewed", updated_at: new Date().toISOString() })
        .eq("id", leadId)
        .eq("status", "contacted");
    }
  } catch (e) {
    console.error("track-click:", e instanceof Error ? e.message : e);
    if (!destination) {
      destination = target === "book"
        ? bookUrl
        : target === "demo"
        ? demoUrl(url.searchParams.get("s"))
        : target === "lwa"
        ? luviaWhatsappUrl(null)
        : target === "lweb"
        ? LUVIA_WEB
        : null;
    }
  }

  return redirect(destination ?? fallback);
});
