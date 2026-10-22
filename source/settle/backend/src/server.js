import cors from 'cors';
import express from 'express';
import { db, migrate } from './db.js';
import { authMiddleware } from './lib/auth.js';
import { HttpError } from './lib/util.js';
import admin from './routes/admin.js';
import approvals from './routes/approvals.js';
import bills from './routes/bills.js';
import patients from './routes/patients.js';
import receipts from './routes/receipts.js';
import reports from './routes/reports.js';
import { seed } from './seed.js';

migrate();
if (!db.prepare('SELECT COUNT(*) AS n FROM users').get().n) {
  console.log('Empty database — loading demo data…');
  seed();
}

const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || true }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));
app.use('/api', authMiddleware);
app.use('/api', admin, bills, patients, receipts, approvals, reports);

app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'not_found', message: 'No such endpoint' } }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: { code: 'bad_json', message: 'Request body is not valid JSON' } });
  console.error(err);
  res.status(500).json({ error: { code: 'server_error', message: 'Something went wrong on the server. The change was not saved.' } });
});

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => console.log(`Settle API listening on http://localhost:${PORT}`));
