import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

/** Wraps a handler so thrown errors (sync or async) reach the error middleware. */
export const handle =
  (fn: (req: Request, res: Response, next: NextFunction) => unknown): RequestHandler =>
  (req, res, next) => {
    try {
      const out = fn(req, res, next);
      if (out instanceof Promise) out.catch(next);
    } catch (err) {
      next(err);
    }
  };

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message, ...err.details });
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ message: 'Request body is not valid JSON' });
    return;
  }
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ message: 'Request is too large' });
    return;
  }
  console.error(`[${req.method} ${req.originalUrl}]`, err);
  res.status(500).json({ message: 'Something went wrong on the server. Try again.' });
};

export function intParam(v: unknown, name = 'id'): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `${name} must be a positive whole number`);
  return n;
}

export function optionalInt(v: unknown): number | undefined {
  if (v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isInteger(n) ? n : undefined;
}

export function optionalString(v: unknown, max = 120): string | undefined {
  return typeof v === 'string' && v.trim() !== '' ? v.trim().slice(0, max) : undefined;
}
