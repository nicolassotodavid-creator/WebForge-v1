// Reveal — animación de entrada al hacer scroll (IntersectionObserver). Portado del
// diseño de Nico (Lovable "warm-web-offer"). Los estilos viven en pages/book.css.
import { useEffect, useRef, type CSSProperties, type ReactNode, type ElementType } from "react";

type RevealProps = {
  children: ReactNode;
  as?: ElementType;
  delay?: number;
  className?: string;
  id?: string;
  style?: CSSProperties;
  once?: boolean;
};

export function Reveal({
  children,
  as,
  delay = 0,
  className,
  id,
  style,
  once = true,
}: RevealProps) {
  const Tag = (as ?? "div") as ElementType;
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.setAttribute("data-reveal", "out");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            el.setAttribute("data-reveal", "in");
            if (once) io.unobserve(el);
          } else if (!once) {
            el.setAttribute("data-reveal", "out");
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once]);

  return (
    <Tag
      ref={ref as never}
      id={id}
      className={className}
      style={{ ...(style ?? {}), ["--reveal-delay" as never]: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}
