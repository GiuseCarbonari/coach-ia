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
        // Testo: text-primary (#F5F2EC) → `text-foreground`; text-secondary
        // (#B8B2A6) → `text-secondary`; text-muted (#9A9488) → `text-muted`
        // (mappati sui token shadcn sopra). Qui solo il livello senza
        // equivalente shadcn:
        faint: "var(--text-faint)",
        // Accento ambra (brand)
        amber: {
          DEFAULT: "var(--amber)",
          hover: "var(--amber-hover)",
          dim: "var(--amber-dim)",
          on: "var(--amber-on)",
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
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
