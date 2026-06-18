// /gracias — Página PÚBLICA de confirmación tras el pago con Stripe.
// Stripe redirige aquí con ?session_id=cs_xxx tras checkout.session.completed.
import { CheckCircle2 } from "lucide-react";

export default function Gracias() {
  return (
    <div className="min-h-screen bg-zinc-50 grid place-items-center px-4">
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm max-w-sm w-full p-8 text-center space-y-5">
        <div className="flex justify-center">
          <CheckCircle2 className="h-14 w-14 text-emerald-500" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold text-zinc-900">¡Pago recibido!</h1>
          <p className="text-zinc-500 text-sm leading-relaxed">
            Muchas gracias. Me pongo en contacto contigo en las próximas horas
            para publicar la web bajo tu dominio y explicarte los siguientes pasos.
          </p>
        </div>

        <div className="bg-zinc-50 rounded-xl px-4 py-3 text-left space-y-1.5">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Qué pasa ahora</p>
          <ul className="text-sm text-zinc-600 space-y-1">
            <li>1. Te escribo por email con los siguientes pasos.</li>
            <li>2. Elegimos el dominio (o usamos el tuyo).</li>
            <li>3. La web está publicada en 24 horas.</li>
          </ul>
        </div>

        <div className="pt-1">
          <a
            href="mailto:nicolassotodavid@gmail.com"
            className="text-xs text-zinc-400 underline underline-offset-2 hover:text-zinc-700"
          >
            ¿Alguna duda? nicolassotodavid@gmail.com
          </a>
        </div>
      </div>
    </div>
  );
}
