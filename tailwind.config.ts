import type { Config } from "tailwindcss";

// Configurazione Tailwind con il tema a CSS variables di shadcn/ui.
// I token (--background, --primary, ecc.) sono definiti in app/globals.css.
const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // Token semantici shadcn/ui, mappati sulla palette del design system
        // (variabili definite in app/globals.css, valori raw hex/rgba).
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },

        // --- Token espliciti del design system (docs/COACH_IA_DESIGN_SYSTEM.md) ---
        // Sfondi
        base: "var(--bg-base)",
        surface: {
          DEFAULT: "var(--bg-surface)",
          2: "var(--bg-surface-2)",
        },
        // Livello di testo senza equivalente shadcn:
        faint: "var(--text-faint)",
        // Identità blu petrolio
        brand: {
          DEFAULT: "var(--brand)",
          hover: "var(--brand-hover)",
          dim: "var(--brand-dim)",
          on: "var(--brand-on)",
        },
        // Accento rame caldo (nome legacy mantenuto per compatibilità)
        amber: {
          DEFAULT: "var(--amber)",
          hover: "var(--amber-hover)",
          dim: "var(--amber-dim)",
          on: "var(--amber-on)",
        },
        telemetry: {
          blue: "var(--accent-blue)",
          "blue-dim": "var(--accent-blue-dim)",
          gold: "var(--accent-gold)",
          "gold-dim": "var(--accent-gold-dim)",
        },
        zone: {
          z1: "var(--zone-z1)",
          z2: "var(--zone-z2)",
          z3: "var(--zone-z3)",
          z4: "var(--zone-z4)",
          z5: "var(--zone-z5)",
        },
        // Semaforico readiness (solo per stato/readiness)
        "ready-go": {
          DEFAULT: "var(--ready-go)",
          border: "var(--ready-go-border)",
        },
        "ready-modify": {
          DEFAULT: "var(--ready-modify)",
          border: "var(--ready-modify-border)",
        },
        "ready-skip": {
          DEFAULT: "var(--ready-skip)",
          border: "var(--ready-skip-border)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        card: "16px",
        metric: "11px",
      },
      fontFamily: {
        display: [
          "Archivo",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        body: [
          "Archivo",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        data: [
          "IBM Plex Mono",
          "SFMono-Regular",
          "Consolas",
          "Liberation Mono",
          "monospace",
        ],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
