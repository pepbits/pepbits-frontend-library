import type { Request, Response, NextFunction } from "express";
import { z, ZodError } from "zod";

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export const badRequest = (msg: string, details?: unknown) => new HttpError(400, msg, details);
export const notFound = (what = "Record") => new HttpError(404, `${what} not found`);
export const conflict = (msg: string, details?: unknown) => new HttpError(409, msg, details);

export function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) {
    const fields: Record<string, string> = {};
    for (const issue of r.error.issues) fields[issue.path.join(".") || "_"] = issue.message;
    throw new HttpError(422, "Some fields need attention", { fields });
  }
  return r.data;
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err instanceof ZodError) {
    return res.status(422).json({ error: "Validation failed", details: err.issues });
  }
  const e = err as { code?: string; message?: string };
  if (e?.code === "SQLITE_CONSTRAINT_UNIQUE") {
    return res.status(409).json({ error: "A record with the same unique value already exists" });
  }
  if (e?.code?.startsWith("SQLITE_CONSTRAINT")) {
    return res.status(409).json({ error: "This change conflicts with related records" });
  }
  console.error(err);
  return res.status(500).json({ error: "Unexpected server error" });
}

/** Coerce SQLite 0/1 integers to booleans for named keys. */
export function bools<T extends Record<string, unknown>>(row: T, keys: string[]): T {
  const out: Record<string, unknown> = { ...row };
  for (const k of keys) if (k in out) out[k] = !!out[k];
  return out as T;
}

export const idParam = (req: Request) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw badRequest("Invalid id");
  return id;
};
