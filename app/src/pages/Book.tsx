// /book/:leadId — Página PÚBLICA (sin auth).
import { useState, useEffect, FormEvent } from "react";
import { useParams } from "react-router-dom";
import { supabase, edgeFunctionErrorMessage } from "@/lib/supabase";
import { Loader2, ExternalLink, CheckCircle2, ArrowRight, ShieldCheck, Monitor } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CONTACT_EMAIL, whatsappLink } from "@/lib/business";

interface BookingInfo {
  business_name: string;
  category: string | null;
  city: string | null;
  live_url: string | null;
  // Captura re-hospedada de la web (Supabase Storage). Se muestra como preview estático
  // en vez de embeber la web viva: nunca se bloquea y escala a clicks ilimitados.
  preview_image_url: string | null;
}

const PRECIO = "397 €";
const LORA = "Lora, Georgia, serif";
const INTER = "Inter, system-ui, sans-serif";

// ── componente ───────────────────────────────────────────────────────────────

export default function Book() {
  const { leadId } = useParams<{ leadId: string }>();

  const [info, setInfo]         = useState<BookingInfo | null>(null);
  const [loading, setLoading]   = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name,      setName]      = useState("");
  const [email,     setEmail]     = useState("");
  const [phone,     setPhone]     = useState("");
  const [empresa,   setEmpresa]   = useState("");
  const [nif,       setNif]       = useState("");
  const [direccion, setDireccion] = useState("");
  const [cp, setCp] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [provincia, setProvincia] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError,  setFormError]  = useState<string | null>(null);

  // ── cargar datos del lead ──
  useEffect(() => {
    if (!leadId) { setLoadError("Enlace no válido."); setLoading(false); return; }

    if (leadId === "preview") {
      setInfo({
        business_name: "Talleres YuriCar",
        category: "Taller mecánico",
        city: "Valencia",
        live_url: "https://yuricars-landing-joy.lovable.app",
        preview_image_url: null,
      });
      setLoading(false);
      return;
    }

    supabase.functions.invoke("get-booking-info", { body: { lead_id: leadId } })
      .then(({ data, error }) => {
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setInfo(data as BookingInfo);
        supabase.functions.invoke("track-event", {
          body: { lead_id: leadId, type: "demo_viewed" },
        }).catch(() => {});
      })
      .catch((e: Error) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, [leadId]);

  // ── pago ──
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) { setFormError("Nombre y email son obligatorios."); return; }
    setSubmitting(true); setFormError(null);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { lead_id: leadId, contact: { name, email, phone }, fiscal: { empresa, nif, direccion, cp, ciudad, provincia } },
      });
      if (error) throw error;
      const url = (data as { checkout_url?: string })?.checkout_url;
      if (url) { window.location.href = url; }
      else throw new Error("No se recibió la URL de pago.");
    } catch (e: unknown) {
      setFormError(await edgeFunctionErrorMessage(e, "Error al procesar el pago."));
    } finally { setSubmitting(false); }
  }

  // ── renders de estado ──
  if (loading) return (
    <div className="grid min-h-screen place-items-center" style={{ backgroundColor: "#FAF8F4" }}>
      <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#78716C" }} />
    </div>
  );

  if (loadError) return (
    <div className="grid min-h-screen place-items-center px-4" style={{ backgroundColor: "#FAF8F4" }}>
      <div className="text-center space-y-2">
        <p style={{ fontFamily: LORA, fontSize: "1.25rem", color: "#1C1917" }}>Página no encontrada</p>
        <p style={{ color: "#78716C", fontSize: "0.875rem" }}>{loadError}</p>
      </div>
    </div>
  );

  // ── render principal ──
  // Mensaje de WhatsApp pre-rellenado, contextual al negocio. waHref es null
  // mientras no haya número configurado en business.ts → el botón no se pinta.
  const waMessage = info?.business_name
    ? `Hola Nico, soy de ${info.business_name}. Vi la web que me preparaste y quería preguntarte una cosa.`
    : "Hola Nico, vi la web que me preparaste y quería preguntarte una cosa.";
  const waHref = whatsappLink(waMessage);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FAF8F4", fontFamily: INTER }}>

      {/* ── HERO ── */}
      <div style={{ backgroundColor: "#1C1917", padding: "4rem 2rem 3.5rem" }}>
        <div style={{ maxWidth: "72rem", margin: "0 auto" }}>
          {info?.city && (
            <p style={{ color: "#78716C", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "1.25rem" }}>
              {info.city}
            </p>
          )}
          <h1 style={{ fontFamily: LORA, color: "#FAFAF9", fontSize: "clamp(2rem, 4vw, 3.25rem)", lineHeight: 1.2, maxWidth: "36rem", margin: 0 }}>
            {info?.business_name
              ? `Hola, ${info.business_name}. Te construí una web.`
              : "Hola. Te construí una web."}
          </h1>
          <p style={{ color: "#A8A29E", fontSize: "1rem", marginTop: "1rem", maxWidth: "30rem", lineHeight: 1.7 }}>
            Sin pedirte permiso. Sin cobrar por adelantado. Échale un vistazo — si te convence, me dices.
          </p>
        </div>
      </div>

      {/* ── BODY: dos columnas en desktop ── */}
      <div
        className="book-grid"
        style={{
          maxWidth: "72rem", margin: "0 auto", padding: "2.5rem 1.5rem",
          display: "grid", gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr)",
          gap: "2rem", alignItems: "start",
        }}
      >
        {/* ── COLUMNA IZQUIERDA — preview + qué incluye ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

          {/* Preview: captura estática de la web (o fallback si aún no hay) */}
          <div style={{ background: "white", borderRadius: "1rem", border: "1px solid #E7E5E4", overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>

            {/* Barra browser falsa */}
            <div style={{ background: "#F5F5F4", borderBottom: "1px solid #E7E5E4", padding: "0.6rem 1rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div style={{ display: "flex", gap: "0.35rem" }}>
                <div style={{ width: "0.65rem", height: "0.65rem", borderRadius: "50%", background: "#F87171" }} />
                <div style={{ width: "0.65rem", height: "0.65rem", borderRadius: "50%", background: "#FBBF24" }} />
                <div style={{ width: "0.65rem", height: "0.65rem", borderRadius: "50%", background: "#34D399" }} />
              </div>
              <span style={{ fontSize: "0.7rem", color: "#A8A29E", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {info?.live_url?.replace(/^https?:\/\//, "") ?? "tu-web.com"}
              </span>
            </div>

            {/* Contenido del preview: captura estática scrolleable, o fallback si aún no hay */}
            {info?.preview_image_url ? (
              <div style={{ height: "520px", overflowY: "auto", background: "white" }}>
                <img
                  src={info.preview_image_url}
                  alt={`Vista previa de la web de ${info.business_name}`}
                  loading="lazy"
                  style={{ width: "100%", display: "block" }}
                />
              </div>
            ) : (
              <WebPreviewFallback liveUrl={info?.live_url ?? null} businessName={info?.business_name ?? null} />
            )}

            {/* Botón ver web */}
            {info?.live_url && (
              <div style={{ padding: "1rem 1.25rem", borderTop: "1px solid #E7E5E4", display: "flex", justifyContent: "flex-end" }}>
                <a
                  href={info.live_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: "0.4rem",
                    fontSize: "0.8rem", color: "#44403C", fontWeight: 500, textDecoration: "none",
                    padding: "0.4rem 0.875rem", border: "1px solid #D6D3D1", borderRadius: "0.5rem",
                    background: "white",
                  }}
                >
                  Abrir en pantalla completa <ExternalLink style={{ width: "0.875rem", height: "0.875rem" }} />
                </a>
              </div>
            )}
          </div>

          {/* Qué incluye */}
          <div style={{ background: "white", borderRadius: "1rem", border: "1px solid #E7E5E4", padding: "1.75rem" }}>
            <h2 style={{ fontFamily: LORA, fontSize: "1.25rem", color: "#1C1917", marginBottom: "1.25rem" }}>¿Qué incluye?</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
              {([
                ["Web a medida para tu negocio", "Con tus servicios, fotos y reseñas reales. Mobile-first. Sin plantillas ni diseños genéricos."],
                ["Publicada bajo tu dominio en 24 h", "Te ayudo a conseguir el dominio si no tienes (~10 €/año) y lo dejamos todo listo y funcionando."],
                ["Un mes de soporte incluido", "Si quieres cambiar textos, fotos u horarios, me escribes y lo hago ese mismo día. Sin coste adicional."],
              ] as [string, string][]).map(([title, desc]) => (
                <div key={title} style={{ display: "flex", gap: "0.875rem", alignItems: "flex-start" }}>
                  <CheckCircle2 style={{ width: "1.1rem", height: "1.1rem", color: "#92400E", flexShrink: 0, marginTop: "0.15rem" }} />
                  <div>
                    <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "#1C1917" }}>{title}</p>
                    <p style={{ fontSize: "0.8rem", color: "#78716C", marginTop: "0.25rem", lineHeight: 1.6 }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── COLUMNA DERECHA — sticky ── */}
        <div className="book-sticky" style={{ display: "flex", flexDirection: "column", gap: "1.25rem", position: "sticky", top: "1.5rem" }}>

          {/* Quién soy */}
          <div style={{ background: "white", borderRadius: "1rem", border: "1px solid #E7E5E4", padding: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.875rem", marginBottom: "0.875rem" }}>
              <img
                src="https://unavatar.io/nicolassotodavid@gmail.com"
                alt="Nico"
                style={{ width: "3.25rem", height: "3.25rem", borderRadius: "50%", objectFit: "cover", border: "1px solid #E7E5E4", flexShrink: 0 }}
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "https://ui-avatars.com/api/?name=Nico+Soto&background=1C1917&color=FAFAF9&size=52";
                }}
              />
              <div>
                <p style={{ fontFamily: LORA, fontSize: "1rem", fontWeight: 600, color: "#1C1917" }}>Nico Soto</p>
                <p style={{ fontSize: "0.75rem", color: "#78716C" }}>Diseñador web · Valencia</p>
                <a href="https://linkedin.com/in/nicolassotodavid" target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: "0.7rem", color: "#2563EB", textDecoration: "none" }}>
                  Ver en LinkedIn →
                </a>
              </div>
            </div>
            <p style={{ fontSize: "0.8rem", color: "#57534E", lineHeight: 1.7 }}>
              Soy una persona, no una agencia. Busco negocios con buena reputación en Google y les construyo la web antes de presentarme. Sin contratos ni permanencias.
            </p>
          </div>

          {/* Garantía */}
          <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "1rem", padding: "1.25rem", display: "flex", gap: "0.875rem", alignItems: "flex-start" }}>
            <ShieldCheck style={{ width: "1.25rem", height: "1.25rem", color: "#92400E", flexShrink: 0, marginTop: "0.1rem" }} />
            <div>
              <p style={{ fontFamily: LORA, fontSize: "0.95rem", fontWeight: 600, color: "#78350F" }}>Garantía de 7 días</p>
              <p style={{ fontSize: "0.78rem", color: "#92400E", marginTop: "0.3rem", lineHeight: 1.6 }}>
                Si no estás contento, te devuelvo el dinero completo. Sin preguntas. <strong>El riesgo es mío, no tuyo.</strong>
              </p>
            </div>
          </div>

          {/* Precio */}
          <div style={{ background: "#1C1917", borderRadius: "1rem", padding: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ fontSize: "0.65rem", color: "#78716C", textTransform: "uppercase", letterSpacing: "0.12em" }}>Precio</p>
              <p style={{ fontFamily: LORA, fontSize: "2.5rem", fontWeight: 600, color: "#FAFAF9", lineHeight: 1.1, marginTop: "0.25rem" }}>{PRECIO}</p>
              <p style={{ fontSize: "0.75rem", color: "#78716C", marginTop: "0.3rem" }}>pago único · IVA incluido · sin permanencia</p>
            </div>
            <div style={{ fontSize: "0.75rem", color: "#A8A29E", textAlign: "right", lineHeight: 2 }}>
              <div>✓ Web a medida</div>
              <div>✓ Dominio incluido</div>
              <div>✓ 1 mes soporte</div>
              <div>✓ Garantía 7 días</div>
            </div>
          </div>

          {/* Formulario */}
          <div style={{ background: "white", borderRadius: "1rem", border: "1px solid #E7E5E4", padding: "1.5rem" }}>
            <h2 style={{ fontFamily: LORA, fontSize: "1.1rem", color: "#1C1917", marginBottom: "0.25rem" }}>Reservar la web</h2>
            <p style={{ fontSize: "0.78rem", color: "#A8A29E", marginBottom: "1.25rem" }}>Pago seguro con Stripe · menos de 2 minutos</p>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              <div>
                <Label htmlFor="b-name" style={{ fontSize: "0.8rem", color: "#44403C", fontWeight: 500 }}>Tu nombre</Label>
                <Input id="b-name" value={name} onChange={e => setName(e.target.value)} placeholder="Ana García" required autoComplete="name" style={{ marginTop: "0.3rem" }} />
              </div>
              <div>
                <Label htmlFor="b-email" style={{ fontSize: "0.8rem", color: "#44403C", fontWeight: 500 }}>Email de contacto</Label>
                <Input id="b-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ana@tuempresa.com" required autoComplete="email" style={{ marginTop: "0.3rem" }} />
              </div>
              <div>
                <Label htmlFor="b-phone" style={{ fontSize: "0.8rem", color: "#44403C", fontWeight: 500 }}>
                  Teléfono <span style={{ color: "#A8A29E", fontWeight: 400 }}>(opcional)</span>
                </Label>
                <Input id="b-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+34 600 000 000" autoComplete="tel" style={{ marginTop: "0.3rem" }} />
              </div>

              <div style={{ borderTop: "1px solid #F5F5F4", paddingTop: "0.875rem" }}>
                <p style={{ fontSize: "0.7rem", color: "#A8A29E", marginBottom: "0.75rem" }}>Datos para la factura</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <div>
                    <Label htmlFor="b-empresa" style={{ fontSize: "0.8rem", color: "#44403C", fontWeight: 500 }}>Nombre o razón social</Label>
                    <Input id="b-empresa" value={empresa} onChange={e => setEmpresa(e.target.value)} placeholder="Talleres Ejemplo S.L." required autoComplete="organization" style={{ marginTop: "0.3rem" }} />
                  </div>
                  <div>
                    <Label htmlFor="b-nif" style={{ fontSize: "0.8rem", color: "#44403C", fontWeight: 500 }}>NIF / CIF</Label>
                    <Input id="b-nif" value={nif} onChange={e => setNif(e.target.value)} placeholder="B12345678" required style={{ marginTop: "0.3rem" }} />
                  </div>
                  <div>
                    <Label htmlFor="b-dir" style={{ fontSize: "0.8rem", color: "#44403C", fontWeight: 500 }}>Dirección fiscal</Label>
                    <Input id="b-dir" value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="Calle Mayor 1, 1º" required autoComplete="street-address" style={{ marginTop: "0.3rem" }} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 0.45fr) minmax(0, 1fr)", gap: "0.75rem" }}>
                    <div>
                      <Label htmlFor="b-cp" style={{ fontSize: "0.8rem", color: "#44403C", fontWeight: 500 }}>CP</Label>
                      <Input id="b-cp" value={cp} onChange={e => setCp(e.target.value)} placeholder="46001" required inputMode="numeric" autoComplete="postal-code" style={{ marginTop: "0.3rem" }} />
                    </div>
                    <div>
                      <Label htmlFor="b-ciudad" style={{ fontSize: "0.8rem", color: "#44403C", fontWeight: 500 }}>Ciudad</Label>
                      <Input id="b-ciudad" value={ciudad} onChange={e => setCiudad(e.target.value)} placeholder="Valencia" required autoComplete="address-level2" style={{ marginTop: "0.3rem" }} />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="b-provincia" style={{ fontSize: "0.8rem", color: "#44403C", fontWeight: 500 }}>
                      Provincia <span style={{ color: "#A8A29E", fontWeight: 400 }}>(opcional)</span>
                    </Label>
                    <Input id="b-provincia" value={provincia} onChange={e => setProvincia(e.target.value)} placeholder="Valencia" autoComplete="address-level1" style={{ marginTop: "0.3rem" }} />
                  </div>
                </div>
              </div>

              {formError && (
                <p style={{ fontSize: "0.8rem", color: "#DC2626", background: "#FEF2F2", borderRadius: "0.5rem", padding: "0.75rem 1rem" }}>
                  {formError}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                  padding: "0.875rem", borderRadius: "0.75rem", border: "none", cursor: submitting ? "not-allowed" : "pointer",
                  background: "#1C1917", color: "white", fontSize: "0.875rem", fontWeight: 600,
                  opacity: submitting ? 0.6 : 1, fontFamily: INTER,
                }}
              >
                {submitting
                  ? <><Loader2 style={{ width: "1rem", height: "1rem", animation: "spin 1s linear infinite" }} /> Procesando…</>
                  : <>Quiero esta web · Pagar {PRECIO} <ArrowRight style={{ width: "1rem", height: "1rem" }} /></>}
              </button>

              <p style={{ fontSize: "0.7rem", color: "#A8A29E", textAlign: "center" }}>
                Pago 100 % seguro con Stripe · Garantía de devolución 7 días
              </p>
            </form>
          </div>

          {/* Dudas */}
          <div style={{ textAlign: "center", paddingBottom: "2rem" }}>
            <p style={{ fontSize: "0.75rem", color: "#A8A29E", marginBottom: "0.75rem" }}>
              ¿Tienes dudas antes de pagar? Escríbeme directamente.
            </p>

            {waHref && (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex", alignItems: "center", gap: "0.5rem",
                  padding: "0.6rem 1.1rem", borderRadius: "0.75rem",
                  background: "#25D366", color: "white", fontSize: "0.8rem", fontWeight: 600,
                  textDecoration: "none", marginBottom: "0.875rem",
                }}
              >
                <WhatsAppIcon /> Escríbeme por WhatsApp
              </a>
            )}

            <div>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                style={{ fontSize: "0.75rem", color: "#57534E", textDecoration: "underline", textUnderlineOffset: "3px" }}
              >
                {CONTACT_EMAIL}
              </a>
            </div>
          </div>

        </div>
      </div>

      {/* Responsive */}
      <style>{`
        @media (max-width: 768px) {
          .book-grid { grid-template-columns: 1fr !important; }
          .book-sticky { position: static !important; }
        }
      `}</style>
    </div>
  );
}

// ── Icono de WhatsApp (lucide-react ya no incluye marcas) ────────────────────

function WhatsAppIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.519 5.26l-.999 3.648 3.969-1.607zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.612-.916-2.207-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
    </svg>
  );
}

// ── Fallback cuando aún no hay captura de la web ─────────────────────────────

function WebPreviewFallback({
  liveUrl,
  businessName,
}: {
  liveUrl: string | null;
  businessName: string | null;
}) {
  const LORA = "Lora, Georgia, serif";
  const INTER = "Inter, system-ui, sans-serif";

  return (
    <div
      style={{
        height: "520px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.5rem",
        padding: "2rem",
        background: "linear-gradient(135deg, #FAF8F4 0%, #F5F5F0 100%)",
        textAlign: "center",
      }}
    >
      {/* Icono decorativo */}
      <div
        style={{
          width: "4rem", height: "4rem", borderRadius: "1rem",
          background: "#1C1917", display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
        }}
      >
        <Monitor style={{ width: "2rem", height: "2rem", color: "#FAFAF9" }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <p style={{ fontFamily: LORA, fontSize: "1.15rem", fontWeight: 600, color: "#1C1917" }}>
          {businessName ? `La web de ${businessName} está lista.` : "Tu web está publicada y funcionando."}
        </p>
        <p style={{ fontFamily: INTER, fontSize: "0.875rem", color: "#78716C", lineHeight: 1.6, maxWidth: "22rem" }}>
          Ábrela en una pestaña nueva para verla al 100 %. Está construida para verse perfecta en móvil y ordenador.
        </p>
      </div>

      {liveUrl && (
        <a
          href={liveUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex", alignItems: "center", gap: "0.5rem",
            padding: "0.75rem 1.5rem", borderRadius: "0.75rem",
            background: "#1C1917", color: "white",
            fontSize: "0.875rem", fontWeight: 600, fontFamily: INTER,
            textDecoration: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
        >
          Ver mi web <ExternalLink style={{ width: "0.875rem", height: "0.875rem" }} />
        </a>
      )}

      {liveUrl && (
        <p style={{ fontFamily: "monospace", fontSize: "0.7rem", color: "#A8A29E" }}>
          {liveUrl.replace(/^https?:\/\//, "")}
        </p>
      )}
    </div>
  );
}
