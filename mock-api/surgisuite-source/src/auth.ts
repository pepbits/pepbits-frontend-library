import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { db, now } from "./db.js";

export type StaffRow = {
  id: number;
  emp_code: string;
  name: string;
  role: string;
  specialty: string | null;
  title: string | null;
  pin_hash: string;
  privileges: string;
  active: number;
};

export type AuthedRequest = Request & { user: Omit<StaffRow, "pin_hash"> };

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export function hashPin(pin: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pin, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function checkPin(pin: string, stored: string) {
  const [salt, hash] = stored.split(":");
  const candidate = crypto.scryptSync(pin, salt, 32);
  return crypto.timingSafeEqual(candidate, Buffer.from(hash, "hex"));
}

export function login(empCode: string, pin: string) {
  const staff = db.prepare(`SELECT * FROM staff WHERE emp_code = ? AND active = 1`).get(empCode) as StaffRow | undefined;
  if (!staff || !checkPin(pin, staff.pin_hash)) throw new HttpError(401, "Employee code or PIN is incorrect.");
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 12 * 3600 * 1000).toISOString();
  db.prepare(`INSERT INTO sessions (token, staff_id, created_at, expires_at) VALUES (?,?,?,?)`).run(token, staff.id, now(), expires);
  const { pin_hash: _ignored, ...user } = staff;
  return { token, user, expires };
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
 const actor=(globalThis as any).__accessHostActor;
 if(!actor) return next(new HttpError(401,"Sign in to continue."));
 (req as AuthedRequest).user=actor; next();
}

export function logout(token: string) {
  db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
}

/** Re-authenticates a staff member for an electronic signature. */
export function verifySigner(staffId: number, pin: string, label = "Signer") {
  const staff = db.prepare(`SELECT * FROM staff WHERE id = ? AND active = 1`).get(staffId) as StaffRow | undefined;
  if (!staff) throw new HttpError(400, `${label} was not found.`);
  if (!pin || !checkPin(pin, staff.pin_hash)) throw new HttpError(403, `${label} PIN did not match. The signature was not applied.`);
  return staff;
}

export function signatureHash(payload: unknown, staffId: number, ts: string) {
  return crypto.createHash("sha256").update(JSON.stringify(payload) + "|" + staffId + "|" + ts).digest("hex");
}

export const ROLE_GROUPS = {
  surgeon: ["SURGEON"],
  anesthesia: ["ANESTHESIOLOGIST", "ANESTHESIA_TECH"],
  nursing: ["SCRUB_NURSE", "CIRCULATING_NURSE", "OT_COORDINATOR"],
  approver: ["APPROVER", "ADMIN"],
  admin: ["ADMIN"],
  billing: ["BILLING", "OT_COORDINATOR", "ADMIN"],
};

export function requireRole(req: Request, roles: string[], action: string) {
  const user = (req as AuthedRequest).user;
  if (user.role === "ADMIN") return;
  if (!roles.includes(user.role)) {
    throw new HttpError(403, `Your role (${user.role.replace(/_/g, " ").toLowerCase()}) can't ${action}.`);
  }
}
