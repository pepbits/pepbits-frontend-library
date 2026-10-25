import type { Request } from "express";
import { HttpError, type AuthedRequest } from "../auth.js";

export const userOf = (req: Request) => (req as AuthedRequest).user;

export function idParam(req: Request, name = "id") {
  const v = Number(req.params[name]);
  if (!Number.isInteger(v) || v <= 0) throw new HttpError(400, `Invalid ${name}.`);
  return v;
}

export function required<T>(value: T | undefined | null | "", label: string): T {
  if (value === undefined || value === null || value === "") throw new HttpError(400, `${label} is required.`);
  return value;
}

export function optNum(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  if (Number.isNaN(n)) throw new HttpError(400, `"${v}" is not a number.`);
  return n;
}

export function body(req: Request): Record<string, any> {
  return (req.body ?? {}) as Record<string, any>;
}
