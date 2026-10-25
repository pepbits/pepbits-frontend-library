import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".woff2": "font/woff2", ".woff": "font/woff", ".webp": "image/webp", ".jpg": "image/jpeg" };

/** Serve the packaged SPA without Vite or dependencies on the working tree. */
export async function createDesktopServer(directory) {
  const root = await realpath(directory);
  return createServer(async (req, res) => {
    const fail = (status) => { res.writeHead(status, { "Cache-Control": "no-store" }); res.end(); };
    if (!["GET", "HEAD"].includes(req.method)) { res.setHeader("Allow", "GET, HEAD"); return fail(405); }
    try {
      const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      if (pathname.includes("\0") || pathname.includes("\\") || pathname.split("/").some((part) => part.startsWith("."))) return fail(404);
      let file = resolve(root, `.${pathname}`);
      let info = await stat(file).catch(() => null);
      if (!info?.isFile()) {
        if (extname(pathname)) return fail(404);
        file = resolve(root, "index.html");
        info = await stat(file);
      }
      const rel = relative(root, await realpath(file));
      if (isAbsolute(rel) || rel === ".." || rel.startsWith(`..${sep}`)) return fail(404);
      res.writeHead(200, {
        "Content-Type": MIME[extname(file)] ?? "application/octet-stream",
        "Content-Length": info.size,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": pathname.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache",
      });
      if (req.method === "HEAD") return res.end();
      const stream = createReadStream(file);
      stream.on("error", () => res.destroy());
      res.on("close", () => stream.destroy());
      stream.pipe(res);
    } catch (error) { fail(error instanceof URIError ? 400 : 404); }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = await createDesktopServer(process.argv[2]);
  server.listen(Number(process.env.PORT ?? 3101), process.env.HOSTNAME ?? "127.0.0.1");
  for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => { server.close(); server.closeAllConnections(); });
}
