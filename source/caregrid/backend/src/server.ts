import express from 'express';
import cors from 'cors';
import { api } from './routes/api';
import { db, dbIsSeeded } from './db';
import { seed } from './db/seed';

const PORT = Number(process.env.PORT || 4000);

function hasData() {
  if (!dbIsSeeded()) return false;
  return ((db.prepare('SELECT COUNT(*) c FROM appointment_types').get() as any).c ?? 0) > 0;
}

if (!hasData() || process.env.RESEED === '1') {
  console.log('Seeding database with reference data and mock activity...');
  seed({ verbose: false });
}

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? true }));
app.use(express.json({ limit: '1mb' }));
app.use('/api', api);
app.get('/', (_req, res) => res.json({ name: 'CareGrid API', docs: '/api/health' }));

app.listen(PORT, () => console.log(`CareGrid API listening on http://localhost:${PORT}`));
