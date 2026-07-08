// /book/:leadId — Página PÚBLICA (sin auth). Diseño de Nico (portado de su proyecto
// Lovable "warm-web-offer" / "Your New Web"): propuesta editorial paper/ink/brick,
// Instrument Serif + DM Sans, marquee, comparativa 1.500€ vs 397€, garantía 7 días, FAQ.
// Datos reales del lead vía get-booking-info. CTA primaria = PAGO con Stripe Checkout
// (create-checkout); respaldo = WhatsApp pre-escrito. Stripe recoge NIF/dirección, no la página.
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Palette, Search, ClipboardList, Star, Zap, Smartphone, ChevronDown, Loader2, Lock, ShieldCheck } from "lucide-react";
import { CONTACT_EMAIL, whatsappLink } from "@/lib/business";
import { Reveal } from "@/components/Reveal";
import "./book.css";

const NICO_NAME = "Nico";

interface BookingInfo {
  business_name: string;
  category: string | null;
  city: string | null;
  live_url: string | null;
  preview_image_url: string | null;
  rating: number | null;
  review_count: number | null;
  contact_name: string | null;
}

// Contenido estático (idéntico al diseño de Nico) — igual para todos los negocios.
const OUTCOMES = [
  { title: "Captar clientes nuevos", body: "La gente que busca calidad está dispuesta a venir si tu imagen transmite confianza desde el primer clic." },
  { title: "Mostrar servicios y precios", body: "Que vean qué hacéis y tarifas antes de decidirse." },
  { title: "Aparecer en Google", body: "Web optimizada para que te encuentren cuando alguien busca tu servicio en tu zona." },
];
const INCLUDED = [
  { title: "Diseño exclusivo", body: "Hecho a medida para tu negocio, sin plantillas genéricas." },
  { title: "Optimización SEO local", body: "Apareces cuando buscan tu servicio en tu zona." },
  { title: "Servicios y tarifas visibles", body: "Tus clientes ven qué ofreces y cuánto cuesta antes de contactar." },
  { title: "Reseñas de Google integradas", body: "Tus valoraciones reales, visibles desde el primer momento." },
  { title: "Carga ultra-rápida", body: "Web ligera que abre al instante en cualquier dispositivo." },
  { title: "Adaptado a móviles", body: "Se ve y funciona perfecto en cualquier pantalla." },
];
const FAQ = [
  { q: "¿Y si no me gusta la web?", a: "Tienes 7 días de garantía total. Si no te convence, te devuelvo el dinero sin preguntas." },
  { q: "¿Necesito saber de tecnología?", a: "Nada. Yo me encargo del dominio, hosting, correos y todo lo técnico. Tú solo me das el visto bueno." },
  { q: "¿Es caro comparado con hacerla yo?", a: "Una agencia te cobra 1.500€ o más. Conmigo pagas 397€ + IVA una sola vez y la web es tuya para siempre." },
  { q: "¿Y si ya tengo web?", a: "La reemplazamos. Esta está optimizada para móvil, velocidad y Google — lo que probablemente la tuya no hace." },
  { q: "¿Hay cuotas mensuales?", a: "Ninguna. Es un pago único y la web es tuya. El hosting del primer año va incluido." },
  { q: "¿Cuánto tarda en estar lista?", a: "La estructura ya está construida. En cuanto me confirmes, la adapto a tu negocio y está online en 48-72 horas." },
];

function domainHintFrom(name: string): string {
  const slug = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "").slice(0, 20);
  return `${slug || "tunegocio"}.es`;
}

const Stars = ({ size = "text-lg" }: { size?: string }) => (
  <div className={`flex gap-0.5 text-brick leading-none ${size}`}>
    {"★★★★★".split("").map((s, i) => (
      <span key={i}>{s}</span>
    ))}
  </div>
);

export default function Book() {
  const { leadId } = useParams<{ leadId: string }>();
  const [info, setInfo] = useState<BookingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [waSent, setWaSent] = useState(false);

  useEffect(() => {
    if (!leadId) { setLoadError("Enlace no válido."); setLoading(false); return; }
    if (leadId === "preview") {
      setInfo({
        business_name: "Talleres YuriCar", category: "taller", city: "Valencia",
        live_url: "https://yuricars-landing-joy.lovable.app", preview_image_url: null,
        rating: 4.9, review_count: 87, contact_name: "Yuri",
      });
      setLoading(false);
      return;
    }
    supabase.functions.invoke("get-booking-info", { body: { lead_id: leadId } })
      .then(({ data, error }) => {
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setInfo(data as BookingInfo);
        supabase.functions.invoke("track-event", { body: { lead_id: leadId, type: "demo_viewed" } }).catch(() => {});
      })
      .catch((e: Error) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, [leadId]);

  // ── estados ──
  if (loading) return (
    <div className="lv-scope grid min-h-screen place-items-center bg-paper">
      <Loader2 className="h-6 w-6 animate-spin text-brick" />
    </div>
  );
  if (loadError || !info) return (
    <div className="lv-scope grid min-h-screen place-items-center bg-paper px-4 text-center">
      <div>
        <p className="font-serif text-2xl text-ink">Página no encontrada</p>
        <p className="mt-2 text-sm text-ink/50">{loadError ?? "No se pudo cargar la propuesta."}</p>
      </div>
    </div>
  );

  // ── datos derivados ──
  const businessName = info.business_name;
  const city = info.city ?? "tu ciudad";
  const category = (info.category ?? "negocio").toLowerCase();
  const previewUrl = info.live_url ?? "#";
  const screenshotUrl = info.preview_image_url;
  const rating = info.rating != null ? String(info.rating) : "4.9";
  const domainHint = domainHintFrom(businessName);
  const greeting = info.contact_name ? `Hola ${info.contact_name}, ` : "Hola, ";
  const waDefault = whatsappLink(`Hola ${NICO_NAME}, soy de ${businessName}. Vi la web que me preparaste y quería preguntarte una cosa.`) ?? "#";

  const isPreview = !leadId || leadId === "preview";
  const waReserva = whatsappLink(
    `Hola ${NICO_NAME}, soy de ${businessName}. Vi la web que me preparaste y quiero reservarla. ¿Cómo seguimos?`,
  ) ?? "#";

  // CTA primaria: pago con tarjeta. Abre Stripe Checkout (create-checkout). Nunca "muere":
  // muestra carga y, si algo falla, un mensaje claro con salida por WhatsApp.
  const goToCheckout = async () => {
    if (paying) return;
    if (isPreview) {
      setPayError("Es una vista previa. En tu enlace real, este botón te lleva al pago seguro.");
      return;
    }
    setPaying(true);
    setPayError(null);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { lead_id: leadId, contact: { name: info.contact_name ?? businessName } },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.checkout_url) throw new Error("sin checkout_url");
      window.location.href = data.checkout_url as string;
    } catch {
      setPaying(false);
      setPayError("No se pudo abrir el pago ahora mismo. Prueba otra vez o escríbeme por WhatsApp y lo resolvemos.");
    }
  };

  // CTA de respaldo: WhatsApp. Registra la intención (booking_started) para que quede en el
  // panel aunque no llegue a enviar el mensaje, y deja un acuse en pantalla.
  const goToWhatsapp = () => {
    if (!isPreview) {
      supabase.functions
        .invoke("track-event", { body: { lead_id: leadId, type: "booking_started", payload: { channel: "whatsapp" } } })
        .catch(() => {});
    }
    window.open(waReserva, "_blank");
    setWaSent(true);
  };

  return (
    <div className="lv-scope bg-paper text-ink min-h-screen overflow-x-hidden selection:bg-brick/10 selection:text-brick">
      {/* NAV */}
      <nav className="sticky top-0 z-40 border-b border-ink/5 bg-paper/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6 lg:h-16 lg:px-10">
          <span className="font-serif text-xl italic lg:text-2xl">{NICO_NAME}.</span>
          <div className="flex items-center gap-6">
            <a href="#incluye" className="hidden text-sm opacity-70 hover:opacity-100 lg:block">Qué incluye</a>
            <a href="#nico" className="hidden text-sm opacity-70 hover:opacity-100 lg:block">Sobre mí</a>
            <a href="#contact" className="text-sm font-medium tracking-tight text-brick">Reservar propuesta →</a>
          </div>
        </div>
      </nav>

      <main>
        {/* HERO */}
        <section className="relative mx-auto max-w-6xl px-5 pt-8 pb-10 sm:px-6 sm:pt-10 sm:pb-12 lg:grid lg:grid-cols-[1fr_1.2fr] lg:gap-14 lg:px-10 lg:pt-24 lg:pb-28">
          <div aria-hidden className="pointer-events-none absolute -top-20 -left-24 -z-10 size-[420px] rounded-full bg-brick/15 blur-3xl lv-blob" />
          <div aria-hidden className="pointer-events-none absolute top-40 right-0 -z-10 size-[360px] rounded-full bg-ink/10 blur-3xl lv-blob" style={{ animationDelay: "-7s" }} />

          <Reveal>
            <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-ink/10 bg-paper/70 backdrop-blur px-3 py-1">
              <span className="relative grid place-items-center">
                <span className="size-1.5 rounded-full bg-brick lv-pulse-ring" />
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wider opacity-70">
                Propuesta para {businessName} · {city}
              </span>
            </div>

            <h1 className="font-serif text-[2.5rem] leading-[1.05] text-balance mb-5 sm:text-5xl sm:mb-6 lg:text-7xl">
              He diseñado una nueva web para tu <span className="lv-text-gradient italic">{category}</span>.
            </h1>

            <p className="max-w-[44ch] text-[15px] leading-relaxed text-pretty opacity-80 mb-7 sm:text-base sm:mb-8 lg:text-lg">
              {greeting}estuve mirando negocios locales con buena reputación en Google pero con una web que no les hace justicia. El tuyo me llamó la atención, así que me tomé la libertad de montarla. Si te gusta, es tuya.
            </p>

            <div className="flex flex-col gap-2.5 mb-10 sm:flex-row sm:gap-3 sm:mb-12 lg:mb-0">
              <a href={previewUrl} target="_blank" rel="noopener noreferrer"
                className="lv-shine-wrap group flex items-center justify-center gap-2 rounded-sm bg-ink px-5 py-3.5 text-sm font-medium text-paper ring-1 ring-ink transition-transform hover:scale-[1.02] active:scale-[0.98] sm:px-6">
                <span>Ver la web completa</span>
                <span className="transition-transform duration-500 group-hover:translate-x-1">→</span>
              </a>
              <a href={waDefault} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-sm border border-ink/15 px-5 py-3.5 text-sm font-medium transition-all duration-500 hover:bg-ink/5 hover:border-ink/30 sm:px-6">
                Preguntar por WhatsApp
              </a>
            </div>
          </Reveal>

          {/* Browser mockup */}
          <Reveal delay={150} className="relative flex flex-col lv-float lg:justify-center">
            <div className="flex items-center gap-1.5 rounded-t-lg border border-ink/10 border-b-0 bg-ink/5 px-4 py-2.5">
              <div className="size-2 rounded-full bg-ink/20" />
              <div className="size-2 rounded-full bg-ink/20" />
              <div className="size-2 rounded-full bg-ink/20" />
              <div className="flex-1 ml-2 truncate text-[10px] font-mono text-ink/40">{domainHint}</div>
            </div>
            <div className={`relative w-full border border-ink/10 border-t-0 rounded-b-lg overflow-hidden bg-ink/5 shadow-2xl shadow-ink/20 ${screenshotUrl ? "" : "aspect-[4/5] lg:aspect-auto lg:flex-1 lg:min-h-0"}`}>
              {screenshotUrl && (
                <img src={screenshotUrl} alt="Vista previa de la web" className="block w-full h-auto" />
              )}
              <a href={previewUrl} target="_blank" rel="noopener noreferrer"
                className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-paper via-paper/90 to-transparent flex items-end justify-center pb-4">
                <span className="font-serif italic text-brick text-base lv-underline-grow pb-0.5">Abrir web completa →</span>
              </a>
            </div>
          </Reveal>
        </section>

        {/* TRUST — marquee */}
        <section className="border-y border-ink/10 bg-ink text-paper py-5 overflow-hidden">
          <div className="flex w-max lv-marquee-track gap-12 whitespace-nowrap">
            {Array.from({ length: 2 }).map((_, dup) => (
              <div key={dup} className="flex items-center gap-12 pr-12">
                {Array.from({ length: 6 }).map((__, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Stars />
                    <p className="text-sm font-medium italic opacity-90 lg:text-base">Los clientes ya hablan bien de ti en Google</p>
                    <span className="text-xs uppercase tracking-widest opacity-50">{rating}/5 · Google</span>
                    <span className="text-brick">✦</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>

        {/* OUTCOMES */}
        <section className="bg-ink text-paper px-5 pt-12 pb-8 sm:px-6 sm:pt-14 sm:pb-10 lg:pt-32 lg:pb-16">
          <div className="mx-auto max-w-6xl lg:px-4">
            <Reveal>
              <p className="text-[10px] font-medium uppercase tracking-widest text-brick mb-3">Para qué sirve</p>
              <h2 className="font-serif text-[2rem] leading-tight mb-6 sm:text-4xl sm:mb-8 lg:text-5xl lg:mb-16 lg:max-w-2xl">Lo que consigues con tu propia web.</h2>
            </Reveal>
            <div className="space-y-6 lg:grid lg:grid-cols-3 lg:gap-10 lg:space-y-0">
              {OUTCOMES.map((o, i) => (
                <Reveal key={o.title} delay={i * 120} className="flex gap-5 lg:flex-col lg:gap-4">
                  <div className="shrink-0 font-serif text-brick text-2xl leading-none lg:text-4xl">{String(i + 1).padStart(2, "0")}</div>
                  <div>
                    <h3 className="text-base font-medium mb-2 lg:text-lg">{o.title}</h3>
                    <p className="text-sm leading-relaxed opacity-60 max-w-[40ch]">{o.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* CONVINCE BAND */}
        <section className="relative bg-ink text-paper overflow-hidden">
          <div className="mx-auto max-w-6xl px-5 pt-2 pb-10 sm:px-6 sm:pb-12 lg:px-10 lg:pb-16">
            <Reveal>
              <div className="relative rounded-sm border border-paper/10 bg-gradient-to-br from-paper/[0.04] to-transparent px-5 py-6 sm:px-8 sm:py-7 lg:px-12 lg:py-8">
                <p className="text-[10px] font-medium uppercase tracking-widest text-brick mb-4 sm:mb-5">Haz la cuenta</p>
                <div className="grid gap-5 lg:grid-cols-[1fr_auto_1fr] lg:items-center lg:gap-8">
                  <div className="text-center lg:text-right">
                    <p className="text-[11px] uppercase tracking-widest opacity-50 mb-1">Una agencia</p>
                    <p className="font-serif text-3xl leading-none line-through decoration-brick decoration-2 opacity-60 sm:text-4xl">1.500€</p>
                    <p className="text-xs opacity-50 mt-1.5">o más · con cuotas</p>
                  </div>
                  <div className="hidden lg:flex flex-col items-center gap-1.5 text-paper/30">
                    <div className="h-8 w-px bg-paper/15" />
                    <span className="font-serif italic text-sm">vs</span>
                    <div className="h-8 w-px bg-paper/15" />
                  </div>
                  <div className="lg:hidden flex items-center justify-center gap-3 text-paper/30">
                    <div className="h-px w-10 bg-paper/15" />
                    <span className="font-serif italic text-sm">vs</span>
                    <div className="h-px w-10 bg-paper/15" />
                  </div>
                  <div className="text-center lg:text-left">
                    <p className="text-[11px] uppercase tracking-widest text-brick mb-1">Conmigo</p>
                    <p className="font-serif text-4xl leading-none text-paper sm:text-5xl">397<span className="text-brick">€</span></p>
                    <p className="text-xs opacity-70 mt-1.5">+ IVA · una sola vez · tuya para siempre</p>
                  </div>
                </div>
                <div className="mt-5 pt-4 border-t border-paper/10 text-center sm:mt-6 sm:pt-5">
                  <p className="font-serif italic text-sm leading-snug text-paper/80 sm:text-base">Sin cuotas. Sin contratos. Sin sorpresas.</p>
                </div>
              </div>
            </Reveal>
          </div>
          <div className="h-8 bg-gradient-to-b from-ink to-paper" aria-hidden />
        </section>

        {/* INCLUDED */}
        <section id="incluye" className="mx-auto max-w-6xl px-5 py-12 sm:px-6 sm:py-14 lg:px-10 lg:py-32">
          <Reveal>
            <p className="text-[10px] font-medium uppercase tracking-widest text-brick mb-3">Qué incluye</p>
            <h2 className="font-serif text-[2rem] leading-tight mb-2 sm:text-4xl lg:text-5xl">Todo en un pago.</h2>
            <p className="text-[15px] opacity-60 mb-6 sm:text-base sm:mb-8 lg:mb-14 lg:text-lg">Sin cuotas mensuales, sin sorpresas.</p>
          </Reveal>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {INCLUDED.map((item, idx) => {
              const Icon = item.title === "Diseño exclusivo" ? Palette
                : item.title === "Optimización SEO local" ? Search
                : item.title === "Servicios y tarifas visibles" ? ClipboardList
                : item.title === "Reseñas de Google integradas" ? Star
                : item.title === "Carga ultra-rápida" ? Zap
                : Smartphone;
              return (
                <Reveal key={item.title} delay={idx * 80}
                  className="group lv-lift rounded-sm border border-ink/5 bg-ink/[0.02] p-6 hover:bg-ink/[0.04] hover:border-brick/20 lg:p-8">
                  <div className="mb-4 inline-flex size-11 items-center justify-center rounded-sm bg-brick/10 text-brick transition-all duration-500 group-hover:bg-brick group-hover:text-paper group-hover:rotate-6">
                    <Icon className="size-5 lg:size-6" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-sm font-medium leading-snug lg:text-base mb-1">{item.title}</h3>
                  <p className="text-sm leading-relaxed opacity-60">{item.body}</p>
                </Reveal>
              );
            })}
          </div>
        </section>

        {/* ABOUT NICO */}
        <section id="nico" className="bg-ink/[0.03] border-y border-ink/5 px-5 py-12 sm:px-6 sm:py-14 lg:py-28">
          <Reveal className="mx-auto flex max-w-3xl flex-col items-center text-center">
            <div className="size-20 rounded-full bg-ink/5 ring-1 ring-ink/10 mb-5 grid place-items-center font-serif italic text-2xl text-ink/60 lv-float sm:size-24 sm:mb-6 sm:text-3xl lg:size-28 lg:text-4xl">N</div>
            <p className="text-[10px] font-medium uppercase tracking-widest opacity-50 mb-3">Quién está detrás</p>
            <h2 className="font-serif text-3xl mb-4 lg:text-5xl">Soy {NICO_NAME}.</h2>
            <p className="text-[15px] leading-relaxed opacity-80 max-w-[52ch] text-pretty sm:text-sm lg:text-lg">
              No trabajo en una agencia. Soy un autónomo que diseña webs para negocios locales. Construyo la web antes de presentarme — si te convence, hablamos. Si no, sin drama.
            </p>
          </Reveal>
        </section>

        {/* PRICING + FORM */}
        <section id="contact" className="mx-auto max-w-6xl px-5 py-12 sm:px-6 sm:py-14 lg:px-10 lg:py-32">
          <div className="lg:grid lg:grid-cols-[1fr_1.1fr] lg:gap-16">
            <Reveal className="text-center lg:text-left lg:sticky lg:top-24 lg:self-start">
              <p className="text-[10px] font-medium uppercase tracking-widest text-brick mb-3">Inversión única</p>
              <div className="font-serif text-[5.5rem] leading-none mb-3 lv-text-gradient sm:text-7xl sm:mb-4 lg:text-[9rem]">397€</div>
              <p className="text-xs opacity-60 italic mb-6 sm:mb-8 lg:text-sm lg:mb-16">+ IVA · sin cuotas ni contratos. La web es tuya.</p>
              <div className="hidden lg:block">
                <div className="flex gap-5 items-center">
                  <div className="shrink-0 size-20 rounded-full ring-2 ring-brick grid place-items-center">
                    <div className="text-center leading-none">
                      <div className="font-serif text-3xl text-brick">7</div>
                      <div className="text-[8px] font-bold tracking-widest text-brick uppercase">días</div>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="font-serif text-xl mb-1">Garantía de devolución</p>
                    <p className="text-sm opacity-70 leading-relaxed">Si no estás contento en 7 días, te devuelvo el dinero entero.</p>
                  </div>
                </div>
              </div>
            </Reveal>

            <Reveal delay={120} className="mt-2 bg-paper ring-1 ring-ink/10 rounded-sm p-5 shadow-2xl shadow-ink/5 sm:mt-4 sm:p-7 lg:p-10">
              <div className="grid grid-cols-3 gap-2 mb-7 pb-6 border-b border-ink/5">
                {[["Garantía", "7 días"], ["Pago", "único"], ["Respuesta", "<1h"]].map(([k, v]) => (
                  <div key={k} className="text-center">
                    <p className="text-[9px] font-medium uppercase tracking-widest opacity-40">{k}</p>
                    <p className="text-xs font-medium mt-1">{v}</p>
                  </div>
                ))}
              </div>

              {/* Acción primaria: pago con tarjeta */}
              <button type="button" onClick={goToCheckout} disabled={paying}
                className="lv-shine-wrap group w-full flex items-center justify-center gap-2.5 rounded-sm bg-brick py-4 text-[15px] font-medium text-paper ring-1 ring-brick shadow-lg shadow-brick/20 transition-all duration-300 hover:shadow-xl hover:shadow-brick/30 hover:-translate-y-0.5 active:translate-y-px disabled:cursor-wait disabled:opacity-70 disabled:hover:translate-y-0 lg:text-base lg:py-5">
                {paying ? (
                  <><Loader2 className="size-4 animate-spin" /> Abriendo pago seguro…</>
                ) : (
                  <><Lock className="size-4" strokeWidth={2} /> Reservar mi web · 397€ + IVA
                    <span className="transition-transform duration-300 group-hover:translate-x-1">→</span></>
                )}
              </button>
              {payError && <p className="mt-2.5 text-[13px] leading-snug text-brick">{payError}</p>}

              {/* Acción de respaldo: WhatsApp */}
              <button type="button" onClick={goToWhatsapp}
                className="mt-3 w-full flex items-center justify-center gap-2.5 rounded-sm border border-ink/15 py-3.5 text-sm font-medium text-ink transition-all duration-300 hover:border-[#25D366]/60 hover:bg-[#25D366]/[0.06]">
                <WhatsAppIcon size={18} /> ¿Prefieres hablar antes? Escríbeme
              </button>
              {waSent && (
                <p className="mt-2.5 text-center text-[13px] leading-snug text-ink/70">
                  Te espero en WhatsApp 👋 Te respondo en menos de una hora.
                </p>
              )}

              {/* Confianza + salida por email */}
              <div className="mt-6 pt-5 border-t border-ink/5 text-center">
                <p className="inline-flex items-center gap-1.5 text-[11px] opacity-55">
                  <ShieldCheck className="size-3.5 text-brick" /> Pagas en la pantalla segura de Stripe
                </p>
                <p className="mt-2 text-[11px] opacity-45">
                  ¿Sin WhatsApp? Escríbeme a{" "}
                  <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-2 hover:opacity-100">{CONTACT_EMAIL}</a>
                </p>
              </div>
            </Reveal>

            <div className="mt-8 flex gap-5 items-center lg:hidden">
              <div className="shrink-0 size-20 rounded-full ring-2 ring-brick grid place-items-center">
                <div className="text-center leading-none">
                  <div className="font-serif text-3xl text-brick">7</div>
                  <div className="text-[8px] font-bold tracking-widest text-brick uppercase">días</div>
                </div>
              </div>
              <div>
                <p className="font-serif text-xl mb-1">Garantía total</p>
                <p className="text-sm opacity-70 leading-relaxed">Si en 7 días no estás contento, te devuelvo el dinero entero. Sin preguntas.</p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-6xl px-5 py-12 sm:px-6 sm:py-14 lg:px-10 lg:py-32">
          <div className="lg:grid lg:grid-cols-[1fr_2fr] lg:gap-16">
            <Reveal className="mb-8 lg:mb-0">
              <p className="text-[10px] font-medium uppercase tracking-widest text-brick mb-3">Dudas frecuentes</p>
              <h2 className="font-serif text-[2rem] leading-tight text-balance sm:text-4xl lg:text-5xl">Antes de decidirte.</h2>
            </Reveal>
            <div>
              {FAQ.map((item, i) => (
                <Reveal key={item.q} delay={i * 60}>
                  <FaqItem q={item.q} a={item.a} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-6 py-12 border-t border-ink/5 text-center lg:px-10">
        <p className="text-[10px] font-medium uppercase tracking-widest opacity-40 italic">Hecho a mano por {NICO_NAME} para {businessName}</p>
      </footer>

      {/* Desktop FAB */}
      <a href={waDefault} target="_blank" rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 hidden size-14 items-center justify-center rounded-full bg-ink text-paper shadow-xl shadow-ink/30 ring-1 ring-ink transition-transform hover:scale-110 active:scale-95 lg:flex lg:size-16"
        aria-label="Hablar por WhatsApp">
        <WhatsAppIcon size={22} />
      </a>

      {/* Mobile sticky buy bar: pago (primario) + WhatsApp (respaldo) */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex items-stretch bg-ink shadow-[0_-8px_32px_rgba(0,0,0,0.25)] lg:hidden">
        <button type="button" onClick={goToCheckout} disabled={paying}
          className="flex flex-1 items-center justify-center gap-2 py-3.5 text-paper text-sm font-medium tracking-tight transition-transform active:scale-[0.98] disabled:opacity-70"
          aria-label="Reservar mi web por 397 euros más IVA">
          {paying ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
          <span>{paying ? "Abriendo pago…" : "Reservar · 397€ + IVA"}</span>
        </button>
        <button type="button" onClick={goToWhatsapp}
          className="flex items-center justify-center px-6 bg-[#25D366] text-white transition-transform active:scale-[0.98]"
          aria-label="Escribir por WhatsApp">
          <WhatsAppIcon size={20} />
        </button>
      </div>
    </div>
  );
}

function WhatsAppIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden className="lg:size-6">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`group rounded-sm border transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${open ? "border-ink/10 bg-ink/[0.02] shadow-sm" : "border-transparent hover:border-ink/5"}`}>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-4 px-5 py-5 text-left lg:px-6 lg:py-6">
        <span className={`h-5 w-0.5 shrink-0 rounded-full transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${open ? "bg-brick" : "bg-transparent group-hover:bg-ink/10"}`} />
        <span className="flex-1 font-serif text-lg transition-colors duration-300 lg:text-xl">{q}</span>
        <ChevronDown className={`shrink-0 size-5 text-brick transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${open ? "rotate-180" : ""}`} />
      </button>
      <div className={`grid transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="overflow-hidden">
          <p className="px-5 pb-5 text-sm leading-relaxed opacity-70 max-w-[60ch] lg:px-6 lg:pb-6 lg:text-base">{a}</p>
        </div>
      </div>
    </div>
  );
}

