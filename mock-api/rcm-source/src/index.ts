import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import { DB_PATH, db, migrate } from './db';
import { EFFECTS } from './effects';
import { HttpError, act, create, get, getRes, list, options, registerEffects, update } from './engine';
import { aging, approvals, auditTrail, home, pending, reports } from './insights';
import { BRANCHES, CATEGORIES, RESOURCES, TENANT, isScope, scopeBranches } from './registry';
import { seedIfEmpty } from './seed';

registerEffects(EFFECTS);

type User = { id: number; name: string; title: string; email: string; initials: string; tone: string; home_branch: string | null };
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express { interface Request { actor: User; branch?: string } }
}

/** New records go to the selected branch, else the person's home branch if it is in scope, else the first branch in scope. */
function defaultBranch(req: Request) {
  const inScope = scopeBranches(req.branch);
  return inScope.length === 1 ? inScope[0] : inScope.includes(req.actor.home_branch ?? '') ? req.actor.home_branch! : inScope[0] ?? BRANCHES[0].value;
}

export const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3100' }));
app.use(express.json({ limit: '1mb' }));

/** Demo identity and branch context. Replace with verified JWT/session validation in production. */
app.use((req, _res, next) => {
  const actor = (globalThis as any).__accessHostActor;
  if (!actor) { _res.status(403).json({error:{code:'HOST_IDENTITY_REQUIRED',message:'Use the authenticated workspace.'}}); return; }
  req.actor = db.prepare('SELECT * FROM app_user WHERE id = ?').get(actor.id) as User;
  const b = req.header('x-branch');
  req.branch = isScope(b) ? b : 'ALL:SAR';
  next();
});

const h = (fn: (req: Request, res: Response) => unknown) => (req: Request, res: Response, next: NextFunction) => {
  try { const out = fn(req, res); if (!res.headersSent) res.json(out); } catch (e) { next(e); }
};

const api = express.Router();
api.get('/health', h(() => ({ ok: true, db: 'sqlite', time: new Date().toISOString() })));
api.get('/meta', h(() => ({
  tenant: TENANT, branches: BRANCHES, categories: CATEGORIES, resources: RESOURCES,
  users: db.prepare('SELECT id, name, title, email, initials, tone, home_branch homeBranch FROM app_user ORDER BY id').all(),
})));
api.get('/dashboard/home', h((req) => home(req.branch)));
api.get('/dashboard/aging', h((req) => aging(req.branch)));
api.get('/dashboard/reports', h((req) => reports(req.branch)));
api.get('/approvals', h((req) => approvals(req.actor.id, req.branch)));
api.get('/pending', h((req) => pending(req.branch)));
api.get('/audit', h((req) => auditTrail({ resource: req.query.resource as string, limit: Number(req.query.limit) })));
api.get('/options/:source', h((req) => options(req.params.source, (req.query.q as string) || undefined, req.branch)));

api.get('/records/:resource', h((req) => list(getRes(req.params.resource), {
  search: (req.query.q as string)?.trim() || undefined, status: req.query.status as string, branch: req.branch,
  page: Number(req.query.page), pageSize: Number(req.query.pageSize), sort: req.query.sort as string, dir: req.query.dir as string,
  overdue: req.query.overdue === '1', assignee: req.query.mine === '1' ? req.actor.id : undefined,
})));
api.get('/records/:resource/:id', h((req) => get(getRes(req.params.resource), Number(req.params.id))));
api.post('/records/:resource', h((req, res) => { res.status(201); return create(getRes(req.params.resource), req.body ?? {}, req.actor.id, defaultBranch(req)); }));
api.put('/records/:resource/:id', h((req) => update(getRes(req.params.resource), Number(req.params.id), req.body ?? {}, req.actor.id)));
api.post('/records/:resource/:id/actions/:action', h((req) => act(getRes(req.params.resource), Number(req.params.id), req.params.action, req.body ?? {}, req.actor.id)));

app.use('/api', api);
app.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No such endpoint.' } }));
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) { res.status(err.status).json({ error: { code: err.code, message: err.message, fieldErrors: err.fieldErrors } }); return; }
  if (err instanceof SyntaxError) { res.status(400).json({ error: { code: 'BAD_JSON', message: 'The request body is not valid JSON.' } }); return; }
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'The server could not complete this request. Nothing was changed.' } });
});

