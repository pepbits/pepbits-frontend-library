import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Cool clinical white, not cream
        paper: "#F4F7F6",
        // Monitor-trace mint, used only on dark scrub surfaces
        mint: "#7FE0C6",
        signal: "#C93439",
        caution: { DEFAULT: "#9A6212", soft: "#FBF1DF" },
        // Scrub green-teal: primary brand
        scrub: {
          50: "#EEF7F5",
          100: "#D5ECE7",
          200: "#ABD8CF",
          300: "#77BDB1",
          400: "#3F9C8F",
          500: "#1A8075",
          600: "#0D6B63",
          700: "#0A5751",
          800: "#08453F",
          900: "#062F2C",
        },
        // Blue-slate ink for text and neutrals
        ink: {
          50: "#F2F5F7",
          100: "#E3E9ED",
          200: "#C7D2D9",
          300: "#9DAEB9",
          400: "#6D8393",
          500: "#4D6475",
          600: "#384D5C",
          700: "#283B48",
          800: "#1A2C38",
          900: "#0F2430",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "step-in": {
          from: { opacity: "0", transform: "translateX(14px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        trace: { from: { strokeDashoffset: "1" }, to: { strokeDashoffset: "0" } },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "20%, 60%": { transform: "translateX(-6px)" },
          "40%, 80%": { transform: "translateX(6px)" },
        },
        pop: {
          "0%": { transform: "scale(0.6)", opacity: "0" },
          "60%": { transform: "scale(1.08)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        ring: {
          from: { transform: "scale(1)", opacity: "0.8" },
          to: { transform: "scale(2.8)", opacity: "0" },
        },
      },
      animation: {
        "fade-in": "fade-in 200ms ease-out both",
        "fade-up": "fade-up 320ms cubic-bezier(.2,.7,.2,1) both",
        "step-in": "step-in 380ms cubic-bezier(.2,.7,.2,1) both",
        trace: "trace 1.8s cubic-bezier(.65,0,.35,1) both",
        shake: "shake 380ms ease-in-out",
        pop: "pop 520ms cubic-bezier(.2,.9,.3,1.3) both",
        ring: "ring 1s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
