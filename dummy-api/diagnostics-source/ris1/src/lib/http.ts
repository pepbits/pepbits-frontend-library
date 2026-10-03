const NextResponse = Response;

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function handle(fn: () => Promise<Response> | Response) {
  return Promise.resolve()
    .then(fn)
    .catch((e: any) => {
      const status = e instanceof HttpError ? e.status : 500;
      if (status === 500) console.error(e);
      return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status });
    });
}

export function need(cond: unknown, message: string, status = 400): asserts cond {
  if (!cond) throw new HttpError(status, message);
}
