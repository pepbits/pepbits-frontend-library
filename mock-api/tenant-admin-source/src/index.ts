import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import { DB_PATH, db, migrate } from './db';
import { approvals, overview, pendingSummary, recentAudit, testRoute } from './insights';
import { act, create, discard, get, list, options, update } from './records';
import { BRANCHES, CATEGORIES, CURRENCIES, LEGAL_ENTITIES, RESOURCES, TENANT } from './registry';
import { seedIfEmpty } from './seed';
import { HttpError, getResource } from './validation';

migrate();
seedIfEmpty();

type User = { id: number; name: string; title: string; email: string; initials: string; tone: string };
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express { interface Request { actor: User } }
}

export const app = express();
const resForbidden=(res: Response)=>res.status(403).json({error:{code:'HOST_IDENTITY_REQUIRED',message:'Authenticated host identity required.'}});
app.disable('x-powered-by');
app.use(cors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000' }));
app.use(express.json({ limit: '1mb' }));

/**
 * Demo identity. Production deployments replace this with verified JWT
 * validation — a request header must never establish identity on its own.
 */
app.use((req, _res, next) => {
  if (!globalThis.__accessHostActor) return resForbidden(_res);
  req.actor = globalThis.__accessHostActor;
  next();
});

const h = (fn: (req: Request, res: Response) => unknown) => (req: Request, res: Response, next: NextFunction) => {
  try {
    const out = fn(req, res);
    if (!res.headersSent) res.json(out);
  } catch (e) {
    next(e);
  }
};

const api = express.Router();

api.get('/health', h(() => ({ ok: true, db: 'sqlite', time: new Date().toISOString() })));

api.get('/meta', h(() => ({
  tenant: TENANT,
  legalEntities: LEGAL_ENTITIES,
  branches: BRANCHES,
  currencies: CURRENCIES,
  categories: CATEGORIES,
  resources: RESOURCES.map(({ check, ...r }) => r),
  users: db.prepare('SELECT * FROM app_user ORDER BY id').all(),
})));

api.get('/overview', h(() => overview()));
api.get('/pending', h(() => pendingSummary()));
api.get('/approvals', h(() => approvals()));
api.get('/audit', h((req) => recentAudit(Number(req.query.limit) || 100, {
  resource: (req.query.resource as string) || undefined,
  recordCode: (req.query.code as string) || undefined,
  actorId: Number(req.query.actor) || undefined,
  action: (req.query.action as string) || undefined,
})));
api.post('/tools/route-test', h((req) => testRoute(req.body ?? {})));

api.get('/resources/:resource', h((req) => list(getResource(req.params.resource), {
  search: (req.query.q as string)?.trim() || undefined,
  status: req.query.status as string,
  page: Number(req.query.page),
  pageSize: Number(req.query.pageSize),
  sort: req.query.sort as string,
  dir: req.query.dir as string,
})));
api.get('/resources/:resource/options', h((req) => options(getResource(req.params.resource))));
api.get('/resources/:resource/:id', h((req) => get(getResource(req.params.resource), Number(req.params.id))));
api.post('/resources/:resource', h((req, res) => { res.status(201); return create(getResource(req.params.resource), req.body ?? {}, req.actor.id); }));
api.put('/resources/:resource/:id', h((req) => update(getResource(req.params.resource), Number(req.params.id), req.body ?? {}, req.actor.id)));
api.delete('/resources/:resource/:id', h((req) => discard(getResource(req.params.resource), Number(req.params.id), { rowVersion: req.query.rowVersion }, req.actor.id)));
api.post('/resources/:resource/:id/:action', h((req) => act(getResource(req.params.resource), Number(req.params.id), req.params.action, req.body ?? {}, req.actor.id)));

app.use('/api', api);

app.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No such endpoint.' } }));

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, fieldErrors: err.fieldErrors } });
    return;
  }
  if (err instanceof SyntaxError) {
    res.status(400).json({ error: { code: 'BAD_JSON', message: 'The request body is not valid JSON.' } });
    return;
  }
  console.error('Tenant Admin command failed', (err as Error)?.name);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'The server could not complete this request. Nothing was saved.' } });
});

