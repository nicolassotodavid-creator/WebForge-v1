// /gracias — Página PÚBLICA de confirmación tras el pago con Stripe.
// Stripe redirige aquí con ?session_id=cs_xxx tras checkout.session.completed.
// Mismo estilo que /book (book.css: lv-scope, paper/ink/brick, Instrument Serif + DM Sans).
import { useEffect } from "react";
import { CheckCircle2 } from "lucide-react";
import { CONTACT_EMAIL, whatsappLink } from "@/lib/business";
import "./book.css";

export default function Gracias() {
  useEffect(() => {
    document.title = "Pago recibido · Nico Soto";
  }, []);

  const wa = whatsappLink("Hola Nico, acabo de pagar mi web. ¿Cómo seguimos?");

  return (
    <div className="lv-scope grid min-h-screen place-items-center bg-paper px-4 py-10 text-ink">
      <div className="w-full max-w-md rounded-sm bg-paper p-8 text-center shadow-2xl shadow-ink/5 ring-1 ring-ink/10 sm:p-10">
        <div className="flex justify-center">
          <CheckCircle2 className="h-14 w-14 text-brick" strokeWidth={1.5} />
        </div>

        <h1 className="mt-5 font-serif text-4xl leading-tight">¡Pago recibido!</h1>
        <p className="mt-3 text-[15px] leading-relaxed opacity-75">
          Muchas gracias. Me pongo en contacto contigo en las próximas horas
          para publicar la web bajo tu dominio y explicarte los siguientes pasos.
        </p>

        <div className="mt-7 rounded-sm border border-ink/5 bg-ink/[0.03] px-5 py-4 text-left">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-brick">Qué pasa ahora</p>
          <ol className="space-y-1.5 text-sm opacity-80">
            <li>1. Te escribo por WhatsApp o email con los siguientes pasos.</li>
            <li>2. Elegimos el dominio (o usamos el tuyo).</li>
            <li>3. En 48-72 horas la web está publicada.</li>
          </ol>
        </div>

        {wa && (
          <a href={wa} target="_blank" rel="noopener noreferrer"
            className="mt-6 flex w-full items-center justify-center rounded-sm bg-[#25D366] py-3.5 text-sm font-medium text-white shadow-lg shadow-[#25D366]/20 transition-transform hover:-translate-y-0.5">
            Escríbeme por WhatsApp
          </a>
        )}

        <p className="mt-4 text-xs opacity-55">
          ¿Prefieres email?{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-2 hover:opacity-100">
            {CONTACT_EMAIL}
          </a>
        </p>
      </div>
    </div>
  );
}
