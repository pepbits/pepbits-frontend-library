import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

export function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(pw, salt, 64).toString('hex')}`;
}
export function verifyPassword(pw: string, stored?: string | null): boolean {
  if (!stored) return false;
  const [salt, hash] = stored.split(':');
  const test = scryptSync(pw, salt, 64);
  return timingSafeEqual(test, Buffer.from(hash, 'hex'));
}
export const newToken = () => randomBytes(32).toString('hex');
