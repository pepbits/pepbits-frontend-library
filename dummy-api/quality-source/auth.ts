import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { db, nowIso, appendAudit } from "./db.js";

export type Role =
  | "admin"
  | "quality_manager"
  | "verifier"
  | "approver"
  | "data_steward"
  | "viewer";

export const ROLES: { id: Role; label: string; description: string }[] = [
  { id: "admin", label: "Administrator", description: "Full access, including users and authorities" },
  { id: "quality_manager", label: "Quality manager", description: "Indicators, reports, schedules and submissions" },
  { id: "verifier", label: "Verifier", description: "Verifies submitted indicator results" },
  { id: "approver", label: "Approver", description: "Approves verified results and submissions" },
  { id: "data_steward", label: "Data steward", description: "Data entry, validation issues and event ingestion" },
  { id: "viewer", label: "Viewer", description: "Read-only access to dashboards and reports" },
];

export const PERMISSIONS = {
  "indicators.manage": ["admin", "quality_manager"],
  "results.edit": ["admin", "quality_manager", "data_steward"],
  "results.submit": ["admin", "quality_manager", "data_steward"],
  "results.verify": ["admin", "verifier"],
  "results.approve": ["admin", "approver"],
  "validation.run": ["admin", "quality_manager", "data_steward"],
  "validation.resolve": ["admin", "quality_manager", "data_steward"],
  "validation.waive": ["admin", "approver"],
  "validation.rules": ["admin", "quality_manager"],
  "reports.design": ["admin", "quality_manager"],
  "reports.run": ["admin", "quality_manager", "verifier", "approver", "data_steward", "viewer"],
  "schedules.manage": ["admin", "quality_manager"],
  "submissions.manage": ["admin", "quality_manager", "approver"],
  "submissions.approve": ["admin", "approver"],
  "events.ingest": ["admin", "data_steward"],
  "users.manage": ["admin"],
  "authorities.manage": ["admin"],
  "audit.view": ["admin", "quality_manager", "approver"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function permissionsFor(role: Role): Permission[] {
  return (Object.keys(PERMISSIONS) as Permission[]).filter((p) =>
    (PERMISSIONS[p] as readonly Role[]).includes(role),
  );
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  title: string | null;
  facility_id: number | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return expected.length === candidate.length && crypto.timingSafeEqual(candidate, expected);
}

const SESSION_HOURS = 12;

export function createSession(userId: number): { token: string; expires_at: string } {
  const token = crypto.randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_HOURS * 3600_000).toISOString();
  db.prepare("INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?,?,?,?)").run(
    token,
    userId,
    nowIso(),
    expires,
  );
  return { token, expires_at: expires };
}

export function destroySession(token: string) {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

function tokenFrom(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return null;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const actor = (globalThis as unknown as { __qualityHostActor?: AuthUser }).__qualityHostActor;
  if (!actor) return res.status(401).json({ error: "unauthenticated", message: "Sign in to continue." });
  req.user = actor;
  next();
}

export function can(user: AuthUser | undefined, permission: Permission): boolean {
  return !!user && (PERMISSIONS[permission] as readonly Role[]).includes(user.role);
}

export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!can(req.user, permission)) {
      return res.status(403).json({
        error: "forbidden",
        message: `Your role does not allow this action (${permission}).`,
      });
    }
    next();
  };
}

export function audit(
  req: Request | null,
  action: string,
  entityType: string,
  entityId: string | number | null,
  summary: string,
  details: Record<string, unknown> = {},
) {
  appendAudit({
    ts: nowIso(),
    user_id: req?.user?.id ?? null,
    user_name: req?.user?.name ?? "System scheduler",
    action,
    entity_type: entityType,
    entity_id: entityId === null ? null : String(entityId),
    summary,
    details: JSON.stringify(details),
    ip: req ? ((req.headers["x-forwarded-for"] as string) ?? req.socket.remoteAddress ?? null) : null,
  });
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
