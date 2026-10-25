import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DatabaseSync as DatabaseSyncT } from "node:sqlite";

// Node's built-in SQLite: no native build step, so `npm ci` works on any machine with Node 22.13+.
// Its "experimental" notice is silenced; every other warning still prints.
const emitWarning = process.emitWarning.bind(process);
process.emitWarning = ((warning: string | Error, ...rest: unknown[]) => {
  if (String(warning).includes("SQLite is an experimental feature")) return;
  return (emitWarning as (...a: unknown[]) => void)(warning, ...rest);
}) as typeof process.emitWarning;
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");

const here = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH ?? path.resolve(here, "../../data/phial.db");

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Statement {
  get(...params: any[]): any;
  all(...params: any[]): any[];
  run(...params: any[]): { changes: number | bigint; lastInsertRowid: number | bigint };
}
export interface Db { prepare(sql: string): Statement; exec(sql: string): void; close(): void }

/**
 * Thin adapter over node:sqlite: caches prepared statements, maps undefined to NULL,
 * and passes only the named parameters a statement actually uses.
 */
function wrap(conn: DatabaseSyncT): Db {
  const cache = new Map<string, Statement>();
  return {
    exec: (sql) => conn.exec(sql),
    close: () => conn.close(),
    prepare(sql) {
      const hit = cache.get(sql);
      if (hit) return hit;
      const st = conn.prepare(sql);
      const names = new Set([...sql.matchAll(/[@$:]([A-Za-z_]\w*)/g)].map((m) => m[1]));
      const bind = (params: any[]) => params.map((p) => {
        if (p === undefined) return null;
        if (p && typeof p === "object" && !Array.isArray(p) && !(p instanceof Uint8Array)) {
          return Object.fromEntries(Object.entries(p).filter(([k]) => names.has(k)).map(([k, v]) => [k, v === undefined ? null : v]));
        }
        return p;
      });
      const stmt: Statement = {
        get: (...p) => st.get(...bind(p)),
        all: (...p) => st.all(...bind(p)),
        run: (...p) => st.run(...bind(p)),
      };
      if (cache.size > 500) cache.clear();
      cache.set(sql, stmt);
      return stmt;
    },
  };
}

/** Additive migrations so databases created by earlier versions keep working. */
function migrate(conn: DatabaseSyncT) {
  const add: [string, string, string][] = [
    ["bills", "refunded", "REAL NOT NULL DEFAULT 0"],
    ["bill_lines", "qty_returned", "INTEGER NOT NULL DEFAULT 0"],
    ["authorizations", "justification", "TEXT"],
    ["authorizations", "payer_ref", "TEXT"],
    ["authorizations", "decided_by", "TEXT"],
  ];
  for (const [table, col, def] of add) {
    const cols = conn.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!cols.some((c) => c.name === col)) conn.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
  }
}

export function openDb(file = dbPath): Db {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const conn = new DatabaseSync(file);
  conn.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  conn.exec(fs.readFileSync(path.join(here, "schema.sql"), "utf8"));
  migrate(conn);
  return wrap(conn);
}

export const DB_PATH = dbPath;
export let db = openDb();

/** Replace the live connection (used by the seed --reset script). */
export function resetDb() {
  db.close();
  for (const ext of ["", "-wal", "-shm"]) {
    try { fs.unlinkSync(dbPath + ext); } catch { /* not present */ }
  }
  db = openDb();
  return db;
}

let depth = 0;
/** Run fn atomically. Nested calls become savepoints, so services can compose freely. */
export function tx<T>(fn: () => T): T {
  const sp = `sp${depth}`;
  db.exec(depth === 0 ? "BEGIN IMMEDIATE" : `SAVEPOINT ${sp}`);
  depth++;
  try {
    const out = fn();
    depth--;
    db.exec(depth === 0 ? "COMMIT" : `RELEASE ${sp}`);
    return out;
  } catch (e) {
    depth--;
    db.exec(depth === 0 ? "ROLLBACK" : `ROLLBACK TO ${sp}; RELEASE ${sp}`);
    throw e;
  }
}

/** Host command and composed synchronous services share one transaction depth. */
export async function hostTransaction<T>(fn: () => Promise<T>): Promise<T> {
  const sp = `host${depth}`;
  db.exec(depth === 0 ? "BEGIN IMMEDIATE" : `SAVEPOINT ${sp}`);
  depth++;
  try { const out = await fn(); depth--; db.exec(depth === 0 ? "COMMIT" : `RELEASE ${sp}`); return out; }
  catch (e) { depth--; db.exec(depth === 0 ? "ROLLBACK" : `ROLLBACK TO ${sp}; RELEASE ${sp}`); throw e; }
}
