import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#0E2A3B", 950: "#071923", 900: "#0A2130", 800: "#123447", 700: "#1B4459", 600: "#2A5870", 400: "#6D8C9C", 200: "#B9CAD3" },
        canvas: "#F3F6F7",
        line: "#DCE3E6",
        pulse: { 50: "#E8F5F5", 100: "#CBEAEA", 300: "#7CC9C9", 500: "#0F8B8D", 600: "#0B7476", 700: "#085E60" },
        alarm: { 50: "#FCEDEF", 100: "#F8D3D9", 500: "#D6334A", 600: "#B42339" },
        caution: { 50: "#FBF3E2", 100: "#F5E2B8", 500: "#C98A0E", 600: "#A06C05" },
        vital: { 50: "#E9F6EF", 500: "#2E9D63", 600: "#22804F" },
        monitor: { bg: "#06141C", grid: "#0E2633", ecg: "#52E08A", spo2: "#5CC8FF", bp: "#F5D25C", temp: "#FF9A76", rr: "#E7E7F0" },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      fontSize: { "2xs": ["0.6875rem", { lineHeight: "1rem" }] },
      boxShadow: { panel: "0 1px 0 rgba(14,42,59,0.04), 0 1px 2px rgba(14,42,59,0.06)", pop: "0 12px 40px -8px rgba(7,25,35,0.35)" },
      keyframes: {
        "slide-in": { from: { transform: "translateX(100%)" }, to: { transform: "translateX(0)" } },
        "slide-left": { from: { transform: "translateX(-100%)" }, to: { transform: "translateX(0)" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "rise": { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "translateY(0)" } },
      },
      animation: { "slide-in": "slide-in .22s ease-out", "slide-left": "slide-left .2s ease-out", "fade-in": "fade-in .15s ease-out", rise: "rise .18s ease-out" },
    },
  },
  plugins: [],
};
export default config;
