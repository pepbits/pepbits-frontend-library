import { defineConfig, searchForWorkspaceRoot } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
    /* The @pepbits/* packages resolve via symlink to ../../packages/*. Dedupe React
       so the app and the packages share ONE copy — two copies make every hook throw
       "Cannot read properties of null (reading 'useState')", which reads like a
       broken component rather than a resolution problem. */
    dedupe: ["react", "react-dom"],
  },
  clearScreen: false,
  server: {
    /* 0.0.0.0, not the default localhost: the dev server is reached from other
       machines on the network by the host's IP. Tauri's devUrl stays
       http://localhost:3101, which still resolves — this adds interfaces, it does
       not move the one Tauri points at. */
    host: true,
    port: 3101,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**"] },
    fs: { allow: [searchForWorkspaceRoot(process.cwd())] },
  },
  /* `vite preview` serves the built dist/ -- what nginx proxies in production,
     and the reason the desktop shell needs no Node app server of its own.

     allowedHosts is REQUIRED, not a nicety: Vite rejects any request whose Host
     header it does not recognise (DNS-rebinding protection) with a bare
     "Blocked request. This host is not allowed." Behind a reverse proxy that
     reads as a broken app rather than a missing config line. */
  preview: {
    host: true,
    port: 3101,
    strictPort: true,
    allowedHosts: ["desktop.front-design.pepbits.com"],
  },
  build: {
    target: "es2021", outDir: "dist",
    rollupOptions: { output: { manualChunks(id) {
      // Cache canonical locale fallbacks independently as translated page catalogs grow.
      const locale = id.match(/\/erp-config\/src\/locales\/(en|ar|hi|ml)\.ts$/)?.[1];
      if (locale) return `locale-fallback-${locale}`;
      // Standalone control labels share a separately cached canonical fallback.
      if (/\/ops-ui\/src\/messages\.en\.ts$/.test(id)) return "ui-english-fallback";
      // Share the React runtime without growing the main shell chunk for each imported workspace.
      if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) return "react-runtime";
    }, onlyExplicitManualChunks: true } },
  },
});
