import { Injectable, Logger } from '@nestjs/common';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { SCHEMA_SQL } from './schema';
import { seedMasters } from './seed';

@Injectable()
export class Db {
  private readonly log = new Logger('Database');
  readonly conn: Database.Database;

  constructor() {
    const file = process.env.DB_PATH || 'data/lis.db';
    fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
    this.conn = new Database(file);
    this.conn.pragma('journal_mode = WAL');
    this.conn.pragma('foreign_keys = ON');
    this.conn.exec(SCHEMA_SQL);
    const users = this.get<{ c: number }>('SELECT COUNT(*) c FROM users')!.c;
    if (users === 0) {
      this.log.log('Empty database – loading master data catalogue');
      this.tx(() => seedMasters(this));
    }
    this.log.log(`SQLite ready at ${path.resolve(file)}`);
  }

  all<T = any>(sql: string, ...params: any[]): T[] {
    return this.conn.prepare(sql).all(...params) as T[];
  }
  get<T = any>(sql: string, ...params: any[]): T | undefined {
    return this.conn.prepare(sql).get(...params) as T | undefined;
  }
  run(sql: string, ...params: any[]) {
    return this.conn.prepare(sql).run(...params);
  }
  insert(table: string, row: Record<string, any>): number {
    const keys = Object.keys(row).filter((k) => row[k] !== undefined);
    const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`;
    return Number(this.run(sql, ...keys.map((k) => normalize(row[k]))).lastInsertRowid);
  }
  update(table: string, id: number, row: Record<string, any>) {
    const keys = Object.keys(row).filter((k) => row[k] !== undefined);
    if (!keys.length) return;
    this.run(`UPDATE ${table} SET ${keys.map((k) => `${k}=?`).join(',')} WHERE id=?`, ...keys.map((k) => normalize(row[k])), id);
  }
  tx<T>(fn: () => T): T {
    return this.conn.transaction(fn)();
  }

  /** Sequential document numbers, e.g. ORD26000123, reset yearly. */
  nextNo(prefix: string, pad = 6): string {
    const yy = String(new Date().getFullYear()).slice(-2);
    const key = `${prefix}${yy}`;
    this.run('INSERT INTO counters(name,value) VALUES(?,1) ON CONFLICT(name) DO UPDATE SET value=value+1', key);
    const v = this.get<{ value: number }>('SELECT value FROM counters WHERE name=?', key)!.value;
    return `${key}${String(v).padStart(pad, '0')}`;
  }

  audit(userId: number | null | undefined, action: string, entity: string, entityId?: number | null, details?: any) {
    this.insert('audit_log', {
      user_id: userId ?? null, action, entity, entity_id: entityId ?? null,
      details: details === undefined ? null : typeof details === 'string' ? details : JSON.stringify(details),
    });
  }

  setting(key: string, fallback = ''): string {
    return this.get<{ value: string }>('SELECT value FROM settings WHERE key=?', key)?.value ?? fallback;
  }
}

function normalize(v: any) {
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v === '') return null;
  return v;
}

export const nowIso = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
