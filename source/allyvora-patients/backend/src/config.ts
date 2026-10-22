import path from 'node:path';

const env = process.env;

export const config = {
  port: Number(env.PORT ?? 4000),
  dbPath: path.resolve(env.DB_PATH ?? './data/allyvora.db'),
  corsOrigin: (env.CORS_ORIGIN ?? 'http://localhost:3000').split(',').map((s) => s.trim()),
  seedDemo: (env.SEED_DEMO ?? 'true') !== 'false',
  isProd: env.NODE_ENV === 'production',
  tenant: env.TENANT ?? 'spectrum-health',
};
