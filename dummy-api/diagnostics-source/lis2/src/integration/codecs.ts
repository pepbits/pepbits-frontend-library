/* ───────────────────────────── HL7 v2.x ───────────────────────────── */
export const MLLP_START = '\x0b';
export const MLLP_END = '\x1c\x0d';

export type Seg = string[];
export class Hl7Message {
  constructor(public readonly segments: Seg[]) {}
  get(name: string): Seg | undefined {
    return this.segments.find((s) => s[0] === name);
  }
  all(name: string): Seg[] {
    return this.segments.filter((s) => s[0] === name);
  }
  get type() {
    return comp(this.get('MSH')?.[9], 1);
  }
  get event() {
    return comp(this.get('MSH')?.[9], 2);
  }
  get controlId() {
    return this.get('MSH')?.[10] || '';
  }
}

/** Parses an HL7 v2 message. seg[n] === SEG-n (for MSH, MSH-1 is the field separator). */
export function parseHL7(raw: string): Hl7Message {
  const text = raw.replace(/[\x0b\x1c]/g, '').trim();
  if (!text.startsWith('MSH')) throw new Error('HL7 message must start with an MSH segment');
  const fs = text[3];
  const lines = text.split(/\r\n|\n|\r/).map((l) => l.trim()).filter(Boolean);
  const segments = lines.map((line) => {
    const parts = line.split(fs);
    return parts[0] === 'MSH' ? ['MSH', fs, ...parts.slice(1)] : parts;
  });
  return new Hl7Message(segments);
}

/** Component (1-based) of a field; repetitions: first repetition only. */
export function comp(field: string | undefined, i: number, rep = 0): string {
  if (!field) return '';
  const r = field.split('~')[rep] ?? '';
  return unescapeHL7(r.split('^')[i - 1] ?? '');
}
export function reps(field: string | undefined): string[] {
  return field ? field.split('~') : [];
}
export function escapeHL7(v: any): string {
  if (v === null || v === undefined) return '';
  return String(v).replace(/\\/g, '\\E\\').replace(/\|/g, '\\F\\').replace(/\^/g, '\\S\\').replace(/~/g, '\\R\\').replace(/&/g, '\\T\\').replace(/\r?\n/g, '\\.br\\');
}
export function unescapeHL7(v: string): string {
  return v.replace(/\\F\\/g, '|').replace(/\\S\\/g, '^').replace(/\\R\\/g, '~').replace(/\\T\\/g, '&').replace(/\\\.br\\/g, '\n').replace(/\\E\\/g, '\\');
}
/** Builds a message; for MSH pass fields starting at MSH-2 (encoding chars). */
export function buildHL7(segments: (string | number | null | undefined)[][]): string {
  return segments.map((s) => s.map((f) => (f === null || f === undefined ? '' : String(f))).join('|').replace(/\|+$/, '')).join('\r') + '\r';
}
export function hl7Ts(d: Date | string | null | undefined = new Date()): string {
  if (!d) return '';
  const x = typeof d === 'string' ? new Date(d.includes('T') || d.endsWith('Z') ? d : d.replace(' ', 'T') + 'Z') : d;
  if (Number.isNaN(x.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${x.getUTCFullYear()}${p(x.getUTCMonth() + 1)}${p(x.getUTCDate())}${p(x.getUTCHours())}${p(x.getUTCMinutes())}${p(x.getUTCSeconds())}`;
}
/** HL7 TS -> 'YYYY-MM-DD' (date) or 'YYYY-MM-DD HH:MM:SS'. */
export function fromHl7Ts(ts: string | undefined, dateOnly = false): string | null {
  if (!ts || ts.length < 8) return null;
  const d = `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`;
  if (dateOnly || ts.length < 12) return d;
  return `${d} ${ts.slice(8, 10)}:${ts.slice(10, 12)}:${ts.slice(12, 14) || '00'}`;
}
export function mshSegment(o: { sendingApp: string; sendingFacility: string; receivingApp?: string | null; receivingFacility?: string | null; type: string; controlId: string; version?: string | null }) {
  return ['MSH', '^~\\&', o.sendingApp, o.sendingFacility, o.receivingApp || '', o.receivingFacility || '', hl7Ts(), '', o.type, o.controlId, 'P', o.version || '2.5.1'];
}
export function buildAck(msg: Hl7Message | null, code: 'AA' | 'AE' | 'AR', text: string, app = 'LIS', fac = 'LAB'): string {
  const m = msg?.get('MSH');
  const ctrl = `ACK${Date.now()}`;
  return buildHL7([
    ['MSH', '^~\\&', app, fac, m?.[3] || '', m?.[4] || '', hl7Ts(), '', `ACK^${msg?.event || ''}^ACK`, ctrl, 'P', m?.[12] || '2.5.1'],
    ['MSA', code, msg?.controlId || '', escapeHL7(text.slice(0, 200))],
    ...(code !== 'AA' ? [['ERR', '', '', '', 'E', '', '', '', escapeHL7(text.slice(0, 200))]] : []),
  ]);
}
export const frameMLLP = (msg: string) => MLLP_START + msg + MLLP_END;

/* ───────────────────────────── ASTM E1394 / E1381 ───────────────────────────── */
export const STX = '\x02', ETX = '\x03', ETB = '\x17', EOT = '\x04', ENQ = '\x05', ACK = '\x06', NAK = '\x15', CR = '\r', LF = '\n';

export function astmChecksum(body: string): string {
  let sum = 0;
  for (const ch of body) sum = (sum + ch.charCodeAt(0)) % 256;
  return sum.toString(16).toUpperCase().padStart(2, '0');
}
/** Removes E1381 framing (STX, frame no., ETB/ETX, checksum) from one or more frames. */
export function unframeASTM(raw: string): string {
  if (!raw.includes(STX)) return raw;
  const frames = raw.split(STX).slice(1);
  return frames.map((f) => {
    const end = Math.max(f.indexOf(ETX), f.indexOf(ETB));
    const body = end >= 0 ? f.slice(1, end) : f.slice(1);
    return f.includes(ETB) ? body.replace(/\r$/, '') : body;
  }).join('');
}
/** Splits an ASTM message into records (arrays of fields). */
export function parseASTM(raw: string): string[][] {
  const text = unframeASTM(raw).replace(/[\x04\x05\x06]/g, '');
  return text.split(/\r\n|\r|\n/).map((l) => l.trim()).filter((l) => /^[A-Z]\|/.test(l) || /^\d[A-Z]\|/.test(l))
    .map((l) => (/^\d/.test(l) ? l.slice(1) : l).split('|'));
}
export const astmComp = (field: string | undefined, i: number) => (field || '').split('^')[i - 1] ?? '';
export function buildASTM(records: (string | number | null | undefined)[][]): string {
  return records.map((r) => r.map((f) => (f === null || f === undefined ? '' : String(f))).join('|')).join(CR) + CR;
}
/** Produces E1381 frames (max 240 chars each) for transmission after ENQ/ACK. */
export function frameASTM(message: string): string[] {
  const records = message.split(CR).filter(Boolean);
  const frames: string[] = [];
  let fn = 1;
  for (const rec of records) {
    const text = rec + CR;
    for (let i = 0; i < text.length; i += 240) {
      const chunk = text.slice(i, i + 240);
      const last = i + 240 >= text.length;
      const body = `${fn % 8}${chunk}${last ? ETX : ETB}`;
      frames.push(`${STX}${body}${astmChecksum(body)}${CR}${LF}`);
      fn++;
    }
  }
  return frames;
}
export function astmTs(d: Date | string | null | undefined = new Date()) {
  return hl7Ts(d);
}
