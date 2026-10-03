import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodType } from "zod";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}
export const notFound = (what: string) => new ApiError(404, "not_found", `${what} was not found.`);
export const conflict = (message: string, details?: unknown) => new ApiError(409, "invalid_state", message, details);
export const badRequest = (message: string, details?: unknown) => new ApiError(400, "bad_request", message, details);

export function parse<T>(schema: ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) throw new ApiError(422, "validation_failed", "Some fields are missing or invalid.", r.error.issues);
  return r.data;
}

/** Actor header lets the UI attribute actions to the signed-in user (mock auth). */
export const actorOf = (_req: Request): string => {
  const actor=(globalThis as typeof globalThis & {__pharmacyHostActor?: string}).__pharmacyHostActor;
  if (!actor) throw new ApiError(403,"host_identity_required","Authenticated workspace identity is required.");
  return actor;
};

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err instanceof ZodError) {
    return res.status(422).json({ error: { code: "validation_failed", message: "Invalid input.", details: err.issues } });
  }
  console.error("Pharmacy service failed", err instanceof Error ? err.name : "UnknownError");
  return res.status(500).json({ error: { code: "internal", message: "Unexpected server error. Check the API logs." } });
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
export const paging = (q: Record<string, unknown>) => {
  const limit = Math.min(Math.max(Number(q.limit ?? 50) || 50, 1), 500);
  const offset = Math.max(Number(q.offset ?? 0) || 0, 0);
  return { limit, offset };
};
