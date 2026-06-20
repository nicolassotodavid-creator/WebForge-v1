/** @type {import('tailwindcss').Config} */
const oklch = (v) => `oklch(var(${v}) / <alpha-value>)`;

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "Inter var",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      colors: {
        border: oklch("--border"),
        input: oklch("--input"),
        ring: oklch("--ring"),
        background: oklch("--background"),
        foreground: oklch("--foreground"),
        primary: {
          DEFAULT: oklch("--primary"),
          foreground: oklch("--primary-foreground"),
        },
        secondary: {
          DEFAULT: oklch("--secondary"),
          foreground: oklch("--secondary-foreground"),
        },
        destructive: {
          DEFAULT: oklch("--destructive"),
          foreground: oklch("--destructive-foreground"),
        },
        muted: {
          DEFAULT: oklch("--muted"),
          foreground: oklch("--muted-foreground"),
        },
        accent: {
          DEFAULT: oklch("--accent"),
          foreground: oklch("--accent-foreground"),
        },
        popover: {
          DEFAULT: oklch("--popover"),
          foreground: oklch("--popover-foreground"),
        },
        card: {
          DEFAULT: oklch("--card"),
          foreground: oklch("--card-foreground"),
        },
        success: oklch("--success"),
        warning: oklch("--warning"),
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        // Realce premium: brillo interior arriba + sombra proyectada profunda.
        elevated:
          "0 1px 0 0 oklch(1 0 0 / 0.05) inset, 0 10px 30px -12px oklch(0 0 0 / 0.55)",
        // Acción/acento con halo de índigo.
        glow: "0 0 0 1px oklch(var(--glow) / 0.30), 0 8px 28px -8px oklch(var(--glow) / 0.45)",
        "glow-sm": "0 6px 18px -8px oklch(var(--glow) / 0.50)",
        focus: "0 0 0 3px oklch(var(--ring) / 0.32)",
      },
      zIndex: {
        dropdown: "1000",
        sticky: "1100",
        "modal-backdrop": "1200",
        modal: "1300",
        toast: "1400",
        tooltip: "1500",
      },
      keyframes: {
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        // Deriva lenta del halo ambiental (login). Solo transform/opacity.
        aurora: {
          "0%, 100%": { transform: "translate3d(-3%, -2%, 0) scale(1)", opacity: "0.9" },
          "50%": { transform: "translate3d(3%, 2%, 0) scale(1.08)", opacity: "1" },
        },
        // Barrido del skeleton de carga.
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "spin-slow": {
          to: { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both",
        "fade-in": "fade-in 0.4s ease-out both",
        aurora: "aurora 18s ease-in-out infinite",
        shimmer: "shimmer 1.6s infinite",
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
        "out-quart": "cubic-bezier(0.25, 1, 0.5, 1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
