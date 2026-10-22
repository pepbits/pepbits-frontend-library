import {
  DEFAULT_LAYOUT_SETTINGS,
  normalizeLayoutSettings,
  type LayoutSettings,
  type SettingsHistoryEntry,
} from '@allyvora/shared';
import { db, nowISO } from '../db';
import { HttpError } from '../http';

const KEY = 'patientForm.layout';

export function getLayoutSettings(): LayoutSettings {
  const row = db.prepare('SELECT value, updated_at, updated_by FROM settings WHERE key = ?').get(KEY) as
    | { value: string; updated_at: string; updated_by: string }
    | undefined;
  if (!row) return { ...DEFAULT_LAYOUT_SETTINGS };
  const { value } = normalizeLayoutSettings(JSON.parse(row.value));
  return { ...value, updatedAt: row.updated_at, updatedBy: row.updated_by };
}

export function saveLayoutSettings(input: unknown, actor: string): LayoutSettings {
  const { value, errors } = normalizeLayoutSettings(input);
  if (errors.length) throw new HttpError(422, errors.join('; '));
  const ts = nowISO();
  const json = JSON.stringify(value);
  db.transaction(() => {
    db.prepare(
      `INSERT INTO settings (key, value, updated_at, updated_by) VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
    ).run(KEY, json, ts, actor);
    db.prepare('INSERT INTO settings_history (key, value, changed_at, changed_by) VALUES (?, ?, ?, ?)').run(KEY, json, ts, actor);
  })();
  return { ...value, updatedAt: ts, updatedBy: actor };
}

export function layoutHistory(limit = 10): SettingsHistoryEntry[] {
  const rows = db
    .prepare('SELECT id, value, changed_at, changed_by FROM settings_history WHERE key = ? ORDER BY id DESC LIMIT ?')
    .all(KEY, limit) as { id: number; value: string; changed_at: string; changed_by: string }[];
  return rows.map((r) => ({
    id: r.id,
    changedAt: r.changed_at,
    changedBy: r.changed_by,
    value: normalizeLayoutSettings(JSON.parse(r.value)).value,
  }));
}
