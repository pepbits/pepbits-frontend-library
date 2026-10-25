import Database from '../../reference-sqlite.mjs';
import {fileURLToPath} from 'node:url';
const __dirname = fileURLToPath(new URL('.', import.meta.url));
import fs from 'node:fs';
import path from 'node:path';
import { RESOURCES, tableName } from './registry';

const dataDir = path.resolve(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

export const DB_PATH = process.env.DB_PATH ?? path.join(dataDir, 'tenant-admin.db');
export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_user (
      id        INTEGER PRIMARY KEY,
      name      TEXT NOT NULL,
      title     TEXT NOT NULL,
      email     TEXT NOT NULL UNIQUE,
      initials  TEXT NOT NULL,
      tone      TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit_event (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      at          TEXT NOT NULL,
      actor_id    INTEGER NOT NULL REFERENCES app_user(id),
      resource    TEXT NOT NULL,
      record_id   INTEGER,
      record_code TEXT,
      action      TEXT NOT NULL,
      summary     TEXT NOT NULL,
      reason      TEXT
    );
    CREATE INDEX IF NOT EXISTS ix_audit_record ON audit_event(resource, record_id);
    CREATE INDEX IF NOT EXISTS ix_audit_at ON audit_event(at DESC);
  `);

  for (const r of RESOURCES) {
    const t = tableName(r.key);
    db.exec(`
      CREATE TABLE IF NOT EXISTS ${t} (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        code             TEXT NOT NULL,
        name             TEXT NOT NULL,
        status           TEXT NOT NULL,
        row_version      INTEGER NOT NULL DEFAULT 1,
        revision         INTEGER NOT NULL DEFAULT 1,
        parent_id        INTEGER REFERENCES ${t}(id),
        effective_from   TEXT,
        effective_until  TEXT,
        data             TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(data)),
        change_reason    TEXT,
        decision_reason  TEXT,
        created_by       INTEGER NOT NULL REFERENCES app_user(id),
        created_at       TEXT NOT NULL,
        updated_by       INTEGER NOT NULL REFERENCES app_user(id),
        updated_at       TEXT NOT NULL,
        submitted_by     INTEGER REFERENCES app_user(id),
        submitted_at     TEXT,
        decided_by       INTEGER REFERENCES app_user(id),
        decided_at       TEXT,
        UNIQUE (code, revision)
      );
      CREATE INDEX IF NOT EXISTS ix_${t}_status ON ${t}(status);
      CREATE INDEX IF NOT EXISTS ix_${t}_code ON ${t}(code);
    `);
  }
}

export const nowIso = () => new Date().toISOString();
export const todayUtc = () => new Date().toISOString().slice(0, 10);

export function audit(e: {
  actorId: number; resource: string; recordId?: number | null; recordCode?: string | null;
  action: string; summary: string; reason?: string | null; at?: string;
}) {
  db.prepare(
    `INSERT INTO audit_event (at, actor_id, resource, record_id, record_code, action, summary, reason)
     VALUES (@at, @actorId, @resource, @recordId, @recordCode, @action, @summary, @reason)`,
  ).run({ at: e.at ?? nowIso(), recordId: null, recordCode: null, reason: null, ...e });
}
