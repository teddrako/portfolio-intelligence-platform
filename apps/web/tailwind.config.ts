import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      colors: {
        surface: {
          DEFAULT: "#07080F",
          raised:  "#0D0F1A",
          float:   "#111422",
          hover:   "#141728",
        },
        gain:  "#34D399",
        loss:  "#FB7185",
        brand: "#6366F1",
      },
      backgroundImage: {
        "mesh": [
          "radial-gradient(ellipse 80% 40% at 50% -10%, rgba(99,102,241,0.10), transparent 60%)",
          "radial-gradient(ellipse 40% 30% at 85% 90%, rgba(52,211,153,0.06), transparent 55%)",
        ].join(", "),
      },
      boxShadow: {
        "glass":        "0 4px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)",
        "glass-lg":     "0 8px 40px rgba(0,0,0,0.5),  inset 0 1px 0 rgba(255,255,255,0.07)",
        "glow-indigo":  "0 0 24px rgba(99,102,241,0.2)",
        "glow-emerald": "0 0 24px rgba(52,211,153,0.18)",
        "glow-rose":    "0 0 24px rgba(251,113,133,0.15)",
      },
      keyframes: {
        "fade-up": {
          "0%":   { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition:  "200% 0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.3s ease-out forwards",
        shimmer:   "shimmer 1.8s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
