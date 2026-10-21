/**
 * Mock tenant directory. Swap these functions for calls to your tenant
 * service (e.g. GET /api/tenants/:slug). Everything is async-shaped already.
 */
import { BRAND } from "./brand";

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

export const DIRECTORY: WorkspaceRecord[] = [
  { slug: "stmarys", name: "St. Mary's Medical Center", kind: "Hospital network", region: "United States (Virginia)", facilities: 6, sso: true, status: "active", domains: ["stmarys.org"] },
  { slug: "alnoor", name: "Al Noor Healthcare Group", kind: "Multi-facility network", region: "United Arab Emirates (Dubai)", facilities: 14, sso: true, status: "active", domains: ["alnoorhealth.ae"] },
  { slug: "cityrx", name: "CityRx Pharmacies", kind: "Pharmacy chain", region: "United Kingdom (London)", facilities: 22, sso: false, status: "active", domains: ["cityrx.co.uk"] },
  { slug: "apexdx", name: "Apex Diagnostics", kind: "Laboratory and imaging", region: "India (Mumbai)", facilities: 9, sso: false, status: "active", domains: ["apexdx.in"] },
  { slug: "demo", name: "Orvia Demo Hospital", kind: "Hospital", region: "European Union (Frankfurt)", facilities: 1, sso: false, status: "active", domains: ["demo.orvia.health"] },
];

const REGISTERED_KEY = "orvia.registered";
const RECENT_KEY = "orvia.recent";
const RESERVED = new Set(["www", "app", "api", "admin", "login", "auth", "help", "status", "mail", "support"]);

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: ignore */
  }
}

export function getRegistered(): WorkspaceRecord[] {
  if (typeof window === "undefined") return [];
  return read<WorkspaceRecord[]>(REGISTERED_KEY, []);
}

export function addRegistered(record: WorkspaceRecord) {
  const list = getRegistered().filter((r) => r.slug !== record.slug);
  write(REGISTERED_KEY, [record, ...list]);
}

function allWorkspaces(): WorkspaceRecord[] {
  return [...getRegistered(), ...DIRECTORY];
}

export function getWorkspace(slug: string): WorkspaceRecord | null {
  const s = normalizeSlug(slug);
  return allWorkspaces().find((w) => w.slug === s) ?? null;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function lookupWorkspace(slug: string): Promise<WorkspaceRecord | null> {
  await wait(450);
  return getWorkspace(slug);
}

export async function lookupByEmail(email: string): Promise<WorkspaceRecord[]> {
  await wait(700);
  const domain = email.split("@")[1]?.toLowerCase().trim();
  if (!domain) return [];
  return allWorkspaces().filter((w) => w.domains.some((d) => d === domain || domain.endsWith(`.${d}`)));
}

export function isSlugTaken(slug: string): boolean {
  return RESERVED.has(slug) || allWorkspaces().some((w) => w.slug === slug);
}

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
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['\u2019]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)
    .replace(/-+$/g, "");
}

export function getRecent(): string[] {
  if (typeof window === "undefined") return [];
  return read<string[]>(RECENT_KEY, []);
}

export function pushRecent(slug: string) {
  write(RECENT_KEY, [slug, ...getRecent().filter((s) => s !== slug)].slice(0, 4));
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
