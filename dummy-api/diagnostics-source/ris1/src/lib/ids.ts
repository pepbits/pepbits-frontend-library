import crypto from 'crypto';
import { get, run } from './db';

function next(name: string): number {
  run('INSERT INTO counters (name, value) VALUES (?, 1) ON CONFLICT(name) DO UPDATE SET value = value + 1', name);
  return (get<{ value: number }>('SELECT value FROM counters WHERE name = ?', name) as { value: number }).value;
}

function ymd(d = new Date()) {
  return d.toISOString().slice(2, 10).replace(/-/g, '');
}

/** Accession number, max 16 chars (DICOM SH): R + YYMMDD + 4-digit daily sequence. */
export function newAccession(d = new Date()): string {
  const day = ymd(d);
  return `R${day}${String(next(`acc-${day}`)).padStart(4, '0')}`;
}

export function newMrn(): string {
  return `MRN${String(next('mrn') + 100000).padStart(7, '0')}`;
}

export function newInvoiceNo(): string {
  return `INV-${ymd()}-${String(next('inv')).padStart(5, '0')}`;
}

export function newControlId(): string {
  return `RIS${Date.now()}${String(next('msg') % 1000).padStart(3, '0')}`;
}

/** DICOM UID from a UUID under the 2.25 root (ISO/IEC 9834-8). */
export function newUid(): string {
  const hex = crypto.randomUUID().replace(/-/g, '');
  return `2.25.${BigInt('0x' + hex).toString()}`;
}
