/** Workspace (tenant) address helpers from the source `lib/workspaces.ts`. The fictional directory lives in the demo adapter. */
import {BRAND} from "./brand";

export interface WorkspaceRecord {
  slug: string;
  name: string;
  kind: string;
  region: string;
  facilities: number;
  sso: boolean;
  status: "active" | "pending";
  domains: string[];
}

export const RESERVED_SLUGS: ReadonlySet<string> = new Set(["www", "app", "api", "admin", "login", "auth", "help", "status", "mail", "support"]);
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/;

/** Accepts "stmarys", "stmarys.orvia.health" or a full URL. */
export function normalizeSlug(input: string): string {
  let s = input.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, "").split("/")[0] ?? "";
  if (s.endsWith(`.${BRAND.domain}`)) s = s.slice(0, -(BRAND.domain.length + 1));
  return s.replace(/[^a-z0-9-]/g, "");
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)
    .replace(/-+$/g, "");
}

export function initials(name: string): string {
  return name
    .replace(/[^A-Za-z\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

/** Email-domain match used by the work-email lookup. */
export function matchesDomain(record: WorkspaceRecord, email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase().trim();
  return !!domain && record.domains.some((d) => d === domain || domain.endsWith(`.${d}`));
}
