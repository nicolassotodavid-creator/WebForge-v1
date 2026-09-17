// /aviso-legal — Página PÚBLICA: identificación del prestador (LSSI art. 10) y privacidad (RGPD)
// para /book y los emails de outreach. Datos en @/lib/business (NIF y domicilio no se pintan
// mientras estén vacíos). Mismo estilo que /book.
import { useEffect } from "react";
import { CONTACT_EMAIL, LEGAL_ADDRESS, LEGAL_NAME, LEGAL_NIF } from "@/lib/business";
import "./book.css";

export default function AvisoLegal() {
  useEffect(() => {
    document.title = "Aviso legal y privacidad · Nico Soto";
  }, []);

  return (
    <div className="lv-scope min-h-screen bg-paper px-4 py-12 text-ink sm:py-16">
      <article className="mx-auto max-w-2xl space-y-8 text-[15px] leading-relaxed">
        <header>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-brick">Legal</p>
          <h1 className="font-serif text-4xl leading-tight">Aviso legal y privacidad</h1>
        </header>

        <section className="space-y-2">
          <h2 className="font-serif text-2xl">Quién soy</h2>
          <ul className="space-y-1 opacity-80">
            <li>Titular: {LEGAL_NAME}, diseñador web (autónomo)</li>
            {LEGAL_NIF && <li>NIF: {LEGAL_NIF}</li>}
            {LEGAL_ADDRESS && <li>Domicilio: {LEGAL_ADDRESS}</li>}
            <li>
              Email: <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-2">{CONTACT_EMAIL}</a>
            </li>
            <li>Web: www.nico-soto.es</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-serif text-2xl">Por qué te he escrito</h2>
          <p className="opacity-80">
            Tomé el nombre, la dirección de email y las reseñas de tu negocio de su ficha pública de
            Google y de su propia web. Los uso solo para enseñarte la web que te he preparado y, si te
            interesa, hablar contigo sobre ella. La base es el interés legítimo en ofrecer un servicio
            profesional relacionado con tu actividad (RGPD art. 6.1.f).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-serif text-2xl">Qué hago con tus datos</h2>
          <p className="opacity-80">
            No los vendo ni los cedo a nadie. Los guardo mientras exista una conversación abierta
            contigo y, si no te interesa, dejo de escribirte. Los emails se envían con Resend y los
            datos se alojan en Supabase, dentro de la Unión Europea o con garantías equivalentes.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-serif text-2xl">Tus derechos</h2>
          <p className="opacity-80">
            Puedes darte de baja con el enlace de cualquier email o respondiendo «BAJA». También puedes
            pedir acceso, rectificación o supresión de tus datos escribiendo a{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-2">{CONTACT_EMAIL}</a>, y
            reclamar ante la Agencia Española de Protección de Datos (aepd.es).
          </p>
        </section>
      </article>
    </div>
  );
}
