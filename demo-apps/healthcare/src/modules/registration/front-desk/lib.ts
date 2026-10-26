"use client";

// Copied from the AllyVora clinical workspace: lib/api.ts (api, ApiError), lib/format.ts (clock,
// initials), lib/types.ts (PatientLite), lib/services.ts and lib/identity-documents.ts (types used here).
// The only change: the API origin is configurable (NEXT_PUBLIC_ALLYVORA_FRONT_DESK_API_URL, default
// the source's same-origin `/api`), because the front desk backend is provided separately.
import { useEffect, useState } from "react";

export class ApiError extends Error {
  constructor(public status: number, message: string, public body: Record<string, unknown> = {}) { super(message); }
}

function csrfToken(): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(/(?:^|;\s*)av_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]!) : "";
}

export const frontDeskApiBase = () => (process.env.NEXT_PUBLIC_ALLYVORA_FRONT_DESK_API_URL || "/api").replace(/\/+$/, "");

export async function api<T>(path: string, init: RequestInit & { json?: unknown; confirmNew?: boolean } = {}): Promise<T> {
  const { json, confirmNew, ...rest } = init;
  const method = (rest.method ?? (json !== undefined ? "POST" : "GET")).toUpperCase();
  const headers = new Headers(rest.headers);
  headers.set("accept", "application/json");
  if (json !== undefined) headers.set("content-type", "application/json");
  if (method !== "GET") headers.set("x-csrf-token", csrfToken());
  if (confirmNew) headers.set("x-confirm-new", "true");
  let res: Response;
  try {
    res = await fetch(`${frontDeskApiBase()}${path}`, { ...rest, method, headers, credentials: "same-origin", cache: "no-store",
      body: json !== undefined ? JSON.stringify(json) : rest.body });
  } catch { throw new ApiError(0, "Can’t reach the front desk service. Check your connection and try again."); }
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new ApiError(res.status, String(body.error ?? `Request failed (${res.status}).`), body);
  return body as T;
}

export const clock = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—");
export const initials = (name: string) => name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w) && !["Al", "Dr"].includes(w)).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

export interface PatientLite { id: string; mrn: string; name: string; nameAr?: string; age?: number; sex?: string; restricted: boolean; primaryId?: string; primaryIdLabel?: string; deceasedAt?: string | null; identityStatus?: "verified" | "unverified" | "unknown" | "merged" | null }

/** GET /api/services (mirrors Codesets.services): the configured specialties, departments and clinics. */
export interface Department { code: string; name: string; services: string[]; specialties: string[] }
export interface Session { day: string; start: string; end: string; clinicianIds: string[] }
export interface Clinic { code: string; name: string; department: string; departmentCode: string; specialty: string; location?: string; durationMinutes?: number; sessions: Session[] }
export interface Ward { code: string; name: string; kind: string; sex: string; location?: string; departments: string[]; departmentCodes: string[] }
export interface Services { specialties: string[]; departments: Department[]; clinics: Clinic[]; wards: Ward[] }

let cache: Promise<Services> | null = null;
export function useServices() {
  const [services, setServices] = useState<Services | null>(null);
  useEffect(() => { (cache ??= api<Services>("/services")).then(setServices).catch(() => { cache = null; }); }, []);
  return services;
}
/** Departments that run a service (outpatient, emergency, inpatient, day-care, community). */
export const departmentsFor = (s: Services | null, service: string) => (s?.departments ?? []).filter((d) => d.services.includes(service));

export interface IdentityLibrary { types: unknown[]; countries: { code: string; label: string }[] }
