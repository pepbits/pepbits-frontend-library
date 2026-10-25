import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { DataSourceOptions } from 'typeorm';
import { ALL_ENTITIES } from './entities';

export function dbOptions(): DataSourceOptions {
  const database = process.env.DB_PATH || './data/lis.sqlite';
  mkdirSync(dirname(database), { recursive: true });
  return {
    type: 'better-sqlite3',
    database,
    entities: ALL_ENTITIES,
    synchronize: true, // schema is created/updated from entities; switch to migrations for production
    prepareDatabase: (db: any) => { db.pragma('journal_mode = WAL'); db.pragma('foreign_keys = ON'); },
  };
}
