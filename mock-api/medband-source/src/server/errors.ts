/** A failure the client can act on. `field` points at the form field to fix. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public field?: string,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new ApiError(404, "NOT_FOUND", `${what} was not found.`);
export const invalid = (message: string, field?: string) => new ApiError(422, "VALIDATION_FAILED", message, field);
export const conflict = (message: string, field?: string) => new ApiError(409, "CONFLICT", message, field);
