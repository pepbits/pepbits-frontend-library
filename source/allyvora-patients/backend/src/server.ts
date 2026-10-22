import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import { db, migrate } from './db';
import { errorHandler } from './http';
import { api } from './routes';
import { seedDemoPatients, seedReferenceData } from './seed';

migrate();
seedReferenceData();
if (config.seedDemo) {
  const n = seedDemoPatients();
  if (n) console.log(`Seeded ${n} demo patients`);
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(morgan(config.isProd ? 'combined' : 'dev'));

app.use('/api', api);
app.use((_req, res) => res.status(404).json({ message: 'Not found' }));
app.use(errorHandler);

const server = app.listen(config.port, () => {
  console.log(`AllyVora API listening on http://localhost:${config.port} (db: ${config.dbPath})`);
});

function shutdown(signal: string) {
  console.log(`${signal} received, closing`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 8000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
