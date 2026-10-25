
import { get } from './db';

export type User = { id: number; username: string; name: string; role: string; title?: string; signature?: string };

export function currentUser(): User {const user=(globalThis as any).__diagnosticActor;if(!user)throw new Error('Authenticated host identity is required');return user;}

export function can(user: User, action: 'sign' | 'prelim' | 'bill' | 'tech' | 'admin' | 'order'): boolean {
  const r = user.role;
  if (r === 'ADMIN') return true;
  switch (action) {
    case 'sign': return r === 'RADIOLOGIST';
    case 'prelim': return r === 'RADIOLOGIST' || r === 'RESIDENT';
    case 'bill': return r === 'BILLING' || r === 'FRONT_DESK';
    case 'tech': return r === 'TECHNOLOGIST';
    case 'order': return r === 'FRONT_DESK' || r === 'RADIOLOGIST';
    default: return false;
  }
}
