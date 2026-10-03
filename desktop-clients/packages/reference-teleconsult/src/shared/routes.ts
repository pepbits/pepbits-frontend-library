import type { ReferenceRoute } from "@pepbits/reference-host";

/** Path segments written `[name]` capture a decoded value. Everything else must match literally. */
export function matchRoute<T extends ReferenceRoute>(routes: readonly T[], path: string): { route: T; params: Record<string, string> } | null {
  const pathname = path.split(/[?#]/)[0];
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return null;
  let segments: string[];
  try { segments = pathname.split("/").filter(Boolean).map(decodeURIComponent); } catch { return null; }
  if (segments.some((s) => s === "." || s === ".." || s.includes("/") || s.includes("\\") || /[\u0000-\u001f]/.test(s))) return null;
  // Literal routes win over dynamic ones, then longer paths over shorter.
  const ordered = [...routes].sort((a, b) => Number(a.path.includes("[")) - Number(b.path.includes("[")) || b.path.length - a.path.length);
  for (const route of ordered) {
    const parts = route.path.split("/").filter(Boolean);
    if (parts.length !== segments.length) continue;
    const params: Record<string, string> = {};
    let matches = true;
    parts.forEach((part, i) => {
      if (part.startsWith("[")) { if (!segments[i]) matches = false; else params[part.slice(1, -1)] = segments[i]; }
      else if (part !== segments[i]) matches = false;
    });
    if (matches) return { route, params };
  }
  return null;
}
