import {defineConfig, searchForWorkspaceRoot} from 'vite';
import react from '@vitejs/plugin-react';

/* The demo API base URL is VITE_API_URL (inlined at build time). For a same-origin build use
   VITE_API_URL=/api and set DESKTOP_API_URL to the demo API so dev/preview proxy /api to it,
   as the original deployment's reverse proxy did. Nothing here names a server. */
const target = process.env.DESKTOP_API_URL;
/* Same-origin transport like the other demos' API route: the browser's Origin header is not forwarded,
   so the API sees a server-side call. Direct cross-origin use needs the API's own origin allowlist. */
const proxy = target ? {'/api': {target, changeOrigin: true, rewrite: (path: string) => path.replace(/^\/api/, ''),
  configure: (server: {on(event: 'proxyReq', listener: (request: {removeHeader(name: string): void}) => void): void}) => server.on('proxyReq', request => request.removeHeader('origin'))}} : undefined;

export default defineConfig({
  plugins: [react()],
  resolve: {
    conditions: ['pepbits-source', 'module', 'browser', 'development|production'],
    /* Workspace packages resolve through symlinks; one React copy keeps hooks working. */
    dedupe: ['react', 'react-dom'],
  },
  clearScreen: false,
  server: {
    port: 3410,
    strictPort: true,
    watch: {ignored: ['**/src-tauri/**']},
    fs: {allow: [searchForWorkspaceRoot(process.cwd())]},
    ...(proxy ? {proxy} : {}),
  },
  preview: {port: 3410, strictPort: true, ...(proxy ? {proxy} : {})},
  build: {
    /* Tauri's webviews: WebView2 (Chromium) on Windows, WebKitGTK on Linux, WKWebView on macOS. */
    target: 'es2021',
    outDir: process.env.DESKTOP_BUILD_DIR ?? 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 4096,
    rollupOptions: {output: {manualChunks(id) {
      if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react-runtime';
    }}},
  },
});
