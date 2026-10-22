import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DB_FILE = process.env.DB_FILE || path.resolve(__dirname, '../../data/caregrid.db');

export function sqlDir(): string {
  return __dirname; // schema.sql and reference.sql live next to this file (copied to dist on build)
}

export function openDb(file = DB_FILE): Database.Database {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

export const db = openDb();

export function dbIsSeeded(): boolean {
  try {
    const r = db.prepare("SELECT COUNT(*) c FROM sqlite_master WHERE type='table' AND name='appointments'").get() as { c: number };
    return r.c > 0;
  } catch { return false; }
}
