import type { Response } from 'express';
import { db } from '../db';
import { nowStr } from './time';

type Level = 'info' | 'success' | 'warning' | 'critical';
const clients = new Set<Response>();

export function addClient(res: Response) {
  clients.add(res);
  res.on('close', () => clients.delete(res));
}

export function broadcast(event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of clients) c.write(payload);
}

/** Persist a notification and push it live to every open screen. */
export function notify(level: Level, category: string, title: string, body?: string, link?: string) {
  const at = nowStr();
  const info = db.prepare('INSERT INTO notifications (created_at, level, category, title, body, link) VALUES (?,?,?,?,?,?)')
    .run(at, level, category, title, body ?? null, link ?? null);
  const n = { id: Number(info.lastInsertRowid), created_at: at, level, category, title, body, link, read: 0 };
  broadcast('notification', n);
  return n;
}

export function audit(action: string, entity: string, entityId: number | null, detail?: unknown, actor = 'scheduler') {
  db.prepare('INSERT INTO audit_log (at, actor, action, entity, entity_id, detail) VALUES (?,?,?,?,?,?)')
    .run(nowStr(), actor, action, entity, entityId, detail ? JSON.stringify(detail) : null);
}
