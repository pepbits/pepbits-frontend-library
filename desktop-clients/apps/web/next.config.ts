import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "..", ".."),
  webpack: (config, { dev, isServer }) => {
    // Keep canonical fallbacks independently cached, matching Vite. Inline
    // here so Next's TypeScript config loader needs no local ESM helper.
    if (!dev && !isServer && config.optimization?.splitChunks && typeof config.optimization.splitChunks === "object") {
      const groups = { ...config.optimization.splitChunks.cacheGroups };
      for (const language of ["en", "ar", "hi", "ml"]) {
        groups[`pepbitsLocale_${language}`] = {
          test: new RegExp(String.raw`[\\/]erp-config[\\/]src[\\/]locales[\\/]${language}\.ts$`),
          name: `locale-fallback-${language}`, chunks: "all", enforce: true,
          priority: 60, reuseExistingChunk: true,
        };
      }
      groups.pepbitsControlEnglish = {
        test: /[\\/]ops-ui[\\/]src[\\/]messages\.en\.ts$/,
        name: "ui-english-fallback", chunks: "all", enforce: true,
        priority: 60, reuseExistingChunk: true,
      };
      config.optimization.splitChunks.cacheGroups = groups;
    }
    return config;
  },
  // Pin the workspace root so Turbopack never infers it from a stray parent lockfile.
  turbopack: { root: path.join(__dirname, "..", "..") },
  /* Every @pepbits package ships RAW TypeScript (main: "./src/index.ts", no build
     step), so a missing entry here does not fail at runtime — it fails the BUILD.
     That is the good failure. The silent one is Tailwind; see globals.css. */
  transpilePackages: [
    "@pepbits/reference-medslot", "@pepbits/reference-surgisuite", "@pepbits/reference-rcm", "@pepbits/reference-tenant-admin", "@pepbits/reference-medband",
    "@pepbits/reference-quality", "@pepbits/reference-pharmacy",
    "@pepbits/reference-teleconsult",
    "@pepbits/reference-diagnostics",
    "@pepbits/reference-lis1",
    "@pepbits/reference-lis2",
    "@pepbits/reference-ris1",

    "@pepbits/ops-ui",
    "@pepbits/auth",
    "@pepbits/erp-config",
    "@pepbits/erp-data",
    "@pepbits/erp-shell",
    "@pepbits/erp-screens",
    "@pepbits/platform-ports",
    "@pepbits/reference-host",
    "@pepbits/reference-keystone-core",
    "@pepbits/reference-reports",
    "@pepbits/reference-erp1",
    "@pepbits/reference-erp2",
    "@pepbits/reference-school",
    "@pepbits/reference-healthcare-suite",
  ],
};

export default nextConfig;
