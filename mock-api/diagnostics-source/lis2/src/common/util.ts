import { BadRequestException, NotFoundException } from '@nestjs/common';

export function must<T>(v: T, what = 'Record'): NonNullable<T> {
  if (v === undefined || v === null) throw new NotFoundException(`${what} not found`);
  return v as NonNullable<T>;
}
export function bad(msg: string): never {
  throw new BadRequestException(msg);
}
export function paging(q: any) {
  const page = Math.max(1, Number(q.page) || 1);
  const pageSize = Math.min(500, Math.max(1, Number(q.pageSize) || 25));
  return { page, pageSize, offset: (page - 1) * pageSize };
}
/** Age in given unit at a reference date. */
export function ageIn(dob: string | null | undefined, unit: string, at = new Date()): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  const days = (at.getTime() - d.getTime()) / 86400000;
  if (unit === 'DAYS') return days;
  if (unit === 'MONTHS') return days / 30.4375;
  return days / 365.25;
}
export function ageText(dob?: string | null): string {
  const y = ageIn(dob, 'YEARS');
  if (y === null) return '';
  if (y >= 2) return `${Math.floor(y)}y`;
  const m = ageIn(dob, 'MONTHS')!;
  if (m >= 1) return `${Math.floor(m)}m`;
  return `${Math.floor(ageIn(dob, 'DAYS')!)}d`;
}
export const addMinutes = (d: Date, m: number) => new Date(d.getTime() + m * 60000);
export const sqlTime = (d: Date) => d.toISOString().replace('T', ' ').slice(0, 19);
