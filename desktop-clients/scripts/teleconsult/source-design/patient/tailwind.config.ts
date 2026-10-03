import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        forest: { DEFAULT: "#134E4A", 900: "#0C3532", 700: "#1C6560", 500: "#2F8A82", 200: "#A9D3CC", 100: "#D3EAE5" },
        mint: { DEFAULT: "#EAF4F0", 50: "#F5FAF8" },
        sun: { DEFAULT: "#F2B84B", 100: "#FCEBC7", 600: "#B07A12" },
        ink: { DEFAULT: "#1F2A2E", 600: "#4A585D", 400: "#7C8A8F", 200: "#C9D2D4" },
        rose: { 50: "#FDEEEE", 500: "#D9485F", 600: "#B83149" },
      },
      fontFamily: {
        sans: ['"Figtree"', "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      borderRadius: { "4xl": "2rem" },
      keyframes: {
        rise: { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        breathe: { "0%,100%": { transform: "scale(1)", opacity: "0.55" }, "50%": { transform: "scale(1.12)", opacity: "0.2" } },
      },
      animation: { rise: "rise .25s ease-out", breathe: "breathe 4s ease-in-out infinite" },
    },
  },
  plugins: [],
};
export default config;
