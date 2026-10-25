import "server-only";
const NextResponse = Response;
import { ZodError } from "zod";
import { ApiError } from "./errors";

/** Wraps a route handler: JSON in, JSON out, consistent error shape. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<unknown> | unknown) {
  return async (...args: A) => {
    try {
      const result = await fn(...args);
      return NextResponse.json(result ?? { ok: true });
    } catch (err) {
      if (err instanceof ApiError) {
        return NextResponse.json({ error: { code: err.code, message: err.message, field: err.field } }, { status: err.status });
      }
      if (err instanceof ZodError) {
        const first = err.issues[0];
        return NextResponse.json(
          { error: { code: "VALIDATION_FAILED", message: first ? `${first.path.join(".") || "Request"}: ${first.message}` : "Invalid request", field: first?.path.join("."), issues: err.issues } },
          { status: 422 },
        );
      }
      const e = err as { code?: string; message?: string };
      if (e?.code === "SQLITE_CONSTRAINT_UNIQUE") {
        return NextResponse.json({ error: { code: "CONFLICT", message: "That record conflicts with an existing one." } }, { status: 409 });
      }
      if (e?.code === "SQLITE_CONSTRAINT_FOREIGNKEY") {
        return NextResponse.json({ error: { code: "CONFLICT", message: "This record is still referenced elsewhere and cannot be removed." } }, { status: 409 });
      }
      console.error("MedBand command failed", (err as Error)?.name);
      return NextResponse.json({ error: { code: "SERVER_ERROR", message: "Something went wrong on the server." } }, { status: 500 });
    }
  };
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ApiError(400, "BAD_JSON", "The request body is not valid JSON.");
  }
}
