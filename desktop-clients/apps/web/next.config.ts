import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "..", ".."),
  // Pin the workspace root so Turbopack never infers it from a stray parent lockfile.
  turbopack: { root: path.join(__dirname, "..", "..") },
  /* Every @pepbits package ships RAW TypeScript (main: "./src/index.ts", no build
     step), so a missing entry here does not fail at runtime — it fails the BUILD.
     That is the good failure. The silent one is Tailwind; see globals.css. */
  transpilePackages: [
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
