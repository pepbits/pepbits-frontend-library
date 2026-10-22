import type { ThemeKey } from "./types.ts";

export const THEME_OPTIONS: Array<{
  id: ThemeKey;
  name: string;
  description: string;
  swatches: [string, string, string];
}> = [
  { id: "nexora", name: "Blue", description: "Bright enterprise workspace", swatches: ["#3156d9", "#0ea5a4", "#f4f7fb"] },
  { id: "midnight", name: "Midnight Ops", description: "Low-glare control room", swatches: ["#6d8cff", "#2dd4bf", "#070d18"] },
  { id: "emerald", name: "Emerald Ledger", description: "Calm finance-focused palette", swatches: ["#167a55", "#d97706", "#f2f8f5"] },
  { id: "sand", name: "Executive Sand", description: "Warm boardroom neutral", swatches: ["#8a5b28", "#416a75", "#f7f3ea"] },
  { id: "rose", name: "Rose Quartz", description: "Soft modern workspace", swatches: ["#ad3f6b", "#6b5bd2", "#fbf5f7"] },
  { id: "slate", name: "Industrial Slate", description: "Dense operations neutral", swatches: ["#3f566b", "#3d7b80", "#eef1f4"] },
  { id: "contrast", name: "High Contrast", description: "Maximum visual separation", swatches: ["#0037ff", "#007d42", "#ffffff"] },
  { id: "indigo", name: "Indigo Studio", description: "Deep violet product workspace", swatches: ["#4f46e5", "#db2777", "#f5f4fd"] },
  { id: "lagoon", name: "Lagoon", description: "Cool teal, long-session friendly", swatches: ["#0e7490", "#b45309", "#eff8f9"] },
  { id: "sunset", name: "Sunset Terracotta", description: "Warm amber and clay", swatches: ["#c2410c", "#7c3aed", "#fdf6f2"] },
  { id: "graphite", name: "Graphite", description: "Neutral near-black, no colour cast", swatches: ["#5b6472", "#4f8fd0", "#0b0b0d"] },
  { id: "plum", name: "Plum Nocturne", description: "Dark violet with magenta accent", swatches: ["#7c3aed", "#db2777", "#120c1a"] },
  { id: "nord", name: "Nord Frost", description: "Muted arctic blue-grey", swatches: ["#55759c", "#8fbcbb", "#2e3440"] },
  { id: "solarized", name: "Solarized Light", description: "Warm paper, low-glare accents", swatches: ["#2076b2", "#2aa198", "#fdf6e3"] },
];
