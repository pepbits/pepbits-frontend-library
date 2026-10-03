import { insert, now } from './db';
import type { User } from './session';

export function audit(user: Partial<User> | null, action: string, entity: string, entityId: string | number, details?: unknown) {
  insert('audit', {
    at: now(),
    user_id: user?.id ?? null,
    user_name: user?.name ?? 'System',
    action,
    entity,
    entity_id: String(entityId),
    details: details === undefined ? null : typeof details === 'string' ? details : JSON.stringify(details),
  });
}
