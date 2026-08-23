import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { findBrand } from "@/demo/brands";
import "./demo.css";

/**
 * Demo del Home Estimator con la marca de un lead concreto (/demo/:slug).
 *
 * Qué vende: el contraste entre las dos columnas del resultado. A la izquierda lo que ve
 * quien pide presupuesto; a la derecha la ficha que le llegaría a la empresa. Ese contraste
 * ES el argumento del mensaje de prospección ("cómo podría llegaros cada reforma ya explicada").
 *
 * No recoge ni envía ningún dato: todo el cálculo vive en el navegador.
 */

type Tipo = "integral" | "cocina" | "bano" | "local";
type Acabado = "basico" | "medio" | "alto";
type Timing = "ya" | "1-3" | "3-6" | "explorando";

const TIPOS: { id: Tipo; label: string; nota: string }[] = [
  { id: "integral", label: "Vivienda completa", nota: "Reforma integral de piso o casa" },
  { id: "cocina", label: "Cocina", nota: "Solo la cocina" },
  { id: "bano", label: "Baño", nota: "Uno o varios baños" },
  { id: "local", label: "Local o negocio", nota: "Oficina, comercio, hostelería" },
];

const ESTANCIAS = ["Cocina", "Baño principal", "Segundo baño", "Salón", "Dormitorios", "Terraza", "Fontanería", "Electricidad"];

const ACABADOS: { id: Acabado; label: string; nota: string }[] = [
  { id: "basico", label: "Funcional", nota: "Materiales estándar, sin cambiar distribución" },
  { id: "medio", label: "Medio", nota: "Buenos materiales, algún cambio de distribución" },
  { id: "alto", label: "Alto", nota: "Materiales de gama, diseño a medida" },
];

const TIMINGS: { id: Timing; label: string; peso: string }[] = [
  { id: "ya", label: "Cuanto antes", peso: "Caliente" },
  { id: "1-3", label: "En 1–3 meses", peso: "Caliente" },
  { id: "3-6", label: "En 3–6 meses", peso: "Templado" },
  { id: "explorando", label: "Solo estoy mirando", peso: "Frío" },
];

const PRESUPUESTOS = ["Menos de 15.000 €", "15.000 – 30.000 €", "30.000 – 60.000 €", "Más de 60.000 €", "Aún no lo sé"];

/** Rangos €/m² y precios base orientativos para reforma en el área de València. */
const PRECIO: Record<Tipo, { base: number; m2: Record<Acabado, number> }> = {
  integral: { base: 0, m2: { basico: 450, medio: 700, alto: 1050 } },
  local: { base: 0, m2: { basico: 400, medio: 620, alto: 950 } },
  cocina: { base: 4200, m2: { basico: 320, medio: 620, alto: 1050 } },
  bano: { base: 2800, m2: { basico: 300, medio: 560, alto: 950 } },
};

const eur = (n: number) => new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(Math.round(n / 100) * 100) + " €";

export default function Demo() {
  const { slug } = useParams();
  const brand = findBrand(slug);

  const [paso, setPaso] = useState(0);
  const [tipo, setTipo] = useState<Tipo | null>(null);
  const [m2, setM2] = useState(90);
  const [estancias, setEstancias] = useState<string[]>([]);
  const [acabado, setAcabado] = useState<Acabado | null>(null);
  const [timing, setTiming] = useState<Timing | null>(null);
  const [presupuesto, setPresupuesto] = useState<string | null>(null);

  const estimacion = useMemo(() => {
    if (!tipo || !acabado) return null;
    const p = PRECIO[tipo];
    const centro = p.base + m2 * p.m2[acabado];
    const extra = tipo === "integral" ? 1 + Math.min(estancias.length, 8) * 0.015 : 1;
    return { min: centro * 0.85 * extra, max: centro * 1.15 * extra };
  }, [tipo, m2, acabado, estancias.length]);

  if (!brand) {
    return (
      <div className="demo-404">
        <h1>Esta demo no existe</h1>
        <p>El enlace no corresponde a ninguna demo preparada.</p>
        <Link to="/">Volver</Link>
      </div>
    );
  }

  const maxM2 = tipo === "cocina" || tipo === "bano" ? 30 : 300;
  const minM2 = tipo === "cocina" || tipo === "bano" ? 4 : 30;

  const pasos = [
    { titulo: "¿Qué quieres reformar?", listo: tipo !== null },
    { titulo: "¿Cuántos metros cuadrados?", listo: true },
    { titulo: "¿Qué incluye la reforma?", listo: tipo !== "integral" || estancias.length > 0 },
    { titulo: "¿Qué nivel de acabado buscas?", listo: acabado !== null },
    { titulo: "¿Cuándo te gustaría empezar?", listo: timing !== null },
    { titulo: "¿Qué inversión manejas?", listo: presupuesto !== null },
  ];
  // La pregunta por estancias solo tiene sentido en reforma integral.
  const visibles = pasos.filter((_, i) => i !== 2 || tipo === "integral");
  const idxReal = (i: number) => pasos.indexOf(visibles[i]);
  const total = visibles.length;
  const fin = paso >= total;

  const style = {
    "--brand": brand.primary,
    "--brand-2": brand.secondary,
  } as React.CSSProperties;

  return (
    <div className="demo" style={style} data-mono={brand.mono ? "true" : undefined}>
      <p className="demo-flag">
        Demo preparada por <strong>Nico Soto</strong> para {brand.empresa}. No es la web de {brand.empresa}.
      </p>

      <header className="demo-bar">
        {brand.logo ? (
          <span className={"demo-logo" + (brand.logoOnDark ? " on-dark" : "")}>
            <img src={brand.logo} alt={brand.empresa} />
          </span>
        ) : (
          // Su web no publica un logo: se compone el nombre en su color, que es más
          // digno que estirar la foto social hasta que no se lea.
          <span className="demo-wordmark">{brand.empresa}</span>
        )}
        <span className="demo-bar-txt">
          <strong>{brand.empresa}</strong>
          <span>{brand.ciudad}</span>
        </span>
      </header>

      <main className="demo-main">
        {!fin ? (
          <section className="demo-card">
            <div className="demo-progress" aria-hidden="true">
              {visibles.map((_, i) => (
                <span key={i} className={i <= paso ? "on" : ""} />
              ))}
            </div>
            <p className="demo-step">Paso {paso + 1} de {total}</p>
            <h1>{visibles[paso].titulo}</h1>

            {idxReal(paso) === 0 && (
              <div className="demo-grid">
                {TIPOS.map((t) => (
                  <button key={t.id} type="button" className={"demo-opt" + (tipo === t.id ? " sel" : "")}
                    onClick={() => { setTipo(t.id); setM2(t.id === "cocina" || t.id === "bano" ? 10 : 90); }}>
                    <strong>{t.label}</strong><span>{t.nota}</span>
                  </button>
                ))}
              </div>
            )}

            {idxReal(paso) === 1 && (
              <div className="demo-m2">
                <output>{m2} m²</output>
                <input type="range" min={minM2} max={maxM2} step={1} value={m2}
                  onChange={(e) => setM2(Number(e.target.value))} aria-label="Metros cuadrados" />
                <div className="demo-m2-ends"><span>{minM2} m²</span><span>{maxM2} m²</span></div>
              </div>
            )}

            {idxReal(paso) === 2 && (
              <div className="demo-chips">
                {ESTANCIAS.map((e) => (
                  <button key={e} type="button" className={"demo-chip" + (estancias.includes(e) ? " sel" : "")}
                    onClick={() => setEstancias((prev) => prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e])}>
                    {e}
                  </button>
                ))}
              </div>
            )}

            {idxReal(paso) === 3 && (
              <div className="demo-grid">
                {ACABADOS.map((a) => (
                  <button key={a.id} type="button" className={"demo-opt" + (acabado === a.id ? " sel" : "")}
                    onClick={() => setAcabado(a.id)}>
                    <strong>{a.label}</strong><span>{a.nota}</span>
                  </button>
                ))}
              </div>
            )}

            {idxReal(paso) === 4 && (
              <div className="demo-grid demo-grid-2">
                {TIMINGS.map((t) => (
                  <button key={t.id} type="button" className={"demo-opt" + (timing === t.id ? " sel" : "")}
                    onClick={() => setTiming(t.id)}>
                    <strong>{t.label}</strong>
                  </button>
                ))}
              </div>
            )}

            {idxReal(paso) === 5 && (
              <div className="demo-grid demo-grid-2">
                {PRESUPUESTOS.map((p) => (
                  <button key={p} type="button" className={"demo-opt" + (presupuesto === p ? " sel" : "")}
                    onClick={() => setPresupuesto(p)}>
                    <strong>{p}</strong>
                  </button>
                ))}
              </div>
            )}

            <div className="demo-nav">
              <button type="button" className="demo-back" disabled={paso === 0} onClick={() => setPaso((p) => p - 1)}>
                Atrás
              </button>
              <button type="button" className="demo-next" disabled={!visibles[paso].listo} onClick={() => setPaso((p) => p + 1)}>
                {paso === total - 1 ? "Ver mi estimación" : "Siguiente"}
              </button>
            </div>
          </section>
        ) : (
          <section className="demo-result">
            <div className="demo-col">
              <p className="demo-col-tag">Lo que ve tu cliente</p>
              <div className="demo-card demo-quote">
                <h1>Tu reforma está entre</h1>
                <p className="demo-figure">{eur(estimacion!.min)} – {eur(estimacion!.max)}</p>
                <p className="demo-note">
                  Estimación orientativa según {m2} m² y acabado{" "}
                  {ACABADOS.find((a) => a.id === acabado)?.label.toLowerCase()}.{" "}
                  {brand.empresa} confirmará el presupuesto tras verlo.
                </p>
                <button type="button" className="demo-next demo-cta">Quiero que me llaméis</button>
              </div>
            </div>

            <div className="demo-col">
              <p className="demo-col-tag">Lo que te llega a ti</p>
              <div className="demo-card demo-lead">
                <dl>
                  <div><dt>Tipo</dt><dd>{TIPOS.find((t) => t.id === tipo)?.label}</dd></div>
                  <div><dt>Superficie</dt><dd>{m2} m²</dd></div>
                  {tipo === "integral" && (
                    <div><dt>Incluye</dt><dd>{estancias.join(", ")}</dd></div>
                  )}
                  <div><dt>Acabado</dt><dd>{ACABADOS.find((a) => a.id === acabado)?.label}</dd></div>
                  <div><dt>Empezaría</dt><dd>{TIMINGS.find((t) => t.id === timing)?.label}</dd></div>
                  <div><dt>Inversión</dt><dd>{presupuesto}</dd></div>
                  <div><dt>Horquilla</dt><dd>{eur(estimacion!.min)} – {eur(estimacion!.max)}</dd></div>
                </dl>
                <p className={"demo-temp t-" + timing}>
                  {TIMINGS.find((t) => t.id === timing)?.peso}
                  <span>· lo sabes antes de coger el teléfono</span>
                </p>
              </div>
            </div>

            <button type="button" className="demo-restart" onClick={() => { setPaso(0); setTipo(null); setEstancias([]); setAcabado(null); setTiming(null); setPresupuesto(null); }}>
              Probar otra vez
            </button>
          </section>
        )}
      </main>

      <footer className="demo-foot">
        <p>
          Maqueta sin conexión a ningún sistema: no guarda ni envía nada. El logo y los colores son
          de {brand.empresa} para que veáis cómo quedaría en <a href={brand.web} target="_blank" rel="noopener noreferrer">vuestra web</a>.
        </p>
        <p>Nico Soto · <a href="mailto:hola@nico-soto.es">hola@nico-soto.es</a></p>
      </footer>
    </div>
  );
}
