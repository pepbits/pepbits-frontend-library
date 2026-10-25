/**
 * Minimal, dependency-free HL7 v2.x toolkit: parse, build ORM^O01 / ORU^R01 / ACK.
 * Separators are read from MSH so messages from any sender parse correctly.
 */

export type Hl7Message = {
  raw: string;
  segments: string[][];      // segments[i][fieldIndex]
  sep: { field: string; comp: string; rep: string; esc: string; sub: string };
};

export function parseHl7(raw: string): Hl7Message {
  const text = raw.replace(/^\x0b/, '').replace(/\x1c\r?$/, '').replace(/\r\n|\n/g, '\r').trim();
  if (!text.startsWith('MSH')) throw new Error('Message must start with an MSH segment');
  const field = text[3];
  const enc = text.slice(4, 8);
  const sep = { field, comp: enc[0] || '^', rep: enc[1] || '~', esc: enc[2] || '\\', sub: enc[3] || '&' };
  const segments = text
    .split('\r')
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(field);
      // For MSH, MSH-1 is the field separator itself, so shift indices to match the spec.
      if (parts[0] === 'MSH') return ['MSH', field, ...parts.slice(1)];
      return parts;
    });
  return { raw: text, segments, sep };
}

/** Get a value like "PID-5.1" or "OBR-4" from the first matching segment (or nth occurrence). */
export function hl7Get(msg: Hl7Message, path: string, occurrence = 0): string {
  const m = path.match(/^([A-Z0-9]{3})-(\d+)(?:\.(\d+))?(?:\.(\d+))?$/);
  if (!m) return '';
  const [, segName, f, c, s] = m;
  const segs = msg.segments.filter((x) => x[0] === segName);
  const seg = segs[occurrence];
  if (!seg) return '';
  let v = seg[Number(f)] ?? '';
  v = v.split(msg.sep.rep)[0];
  if (c) v = v.split(msg.sep.comp)[Number(c) - 1] ?? '';
  if (s) v = v.split(msg.sep.sub)[Number(s) - 1] ?? '';
  return unescape(v, msg.sep);
}

export function hl7Segments(msg: Hl7Message, name: string) {
  return msg.segments.filter((s) => s[0] === name);
}

function unescape(v: string, sep: Hl7Message['sep']) {
  const e = sep.esc;
  return v
    .split(`${e}F${e}`).join(sep.field)
    .split(`${e}S${e}`).join(sep.comp)
    .split(`${e}R${e}`).join(sep.rep)
    .split(`${e}T${e}`).join(sep.sub)
    .split(`${e}.br${e}`).join('\n')
    .split(`${e}E${e}`).join(e);
}

export function esc(v: string | null | undefined): string {
  if (v == null) return '';
  return String(v)
    .replace(/\\/g, '\\E\\')
    .replace(/\|/g, '\\F\\')
    .replace(/\^/g, '\\S\\')
    .replace(/~/g, '\\R\\')
    .replace(/&/g, '\\T\\')
    .replace(/\r?\n/g, '\\.br\\');
}

/** HL7 TS: YYYYMMDDHHMMSS */
export function hl7Ts(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export function parseHl7Ts(ts: string): string | null {
  const m = ts.match(/^(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/);
  if (!m) return null;
  const [, y, mo, d, h = '00', mi = '00', s = '00'] = m;
  return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}`).toISOString();
}

export function parseHl7Date(ts: string): string | null {
  const m = ts.match(/^(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

type Header = { type: string; controlId: string; sendingApp?: string; sendingFacility?: string; receivingApp?: string; receivingFacility?: string };

function msh(h: Header) {
  return [
    'MSH', '^~\\&',
    h.sendingApp || 'RADIANT_RIS', h.sendingFacility || 'RADIOLOGY',
    h.receivingApp || '', h.receivingFacility || '',
    hl7Ts(new Date().toISOString()), '', h.type, h.controlId, 'P', '2.5.1',
  ].join('|');
}

export type OrderPayload = {
  accession: string;
  placerOrderNo?: string | null;
  control: 'NW' | 'XO' | 'CA' | 'SC';
  orderStatus?: string;
  priority: string;
  orderedAt: string;
  scheduledAt?: string | null;
  procedureCode: string;
  procedureName: string;
  modality: string;
  clinicalHistory?: string | null;
  referrer?: { code?: string | null; name?: string | null } | null;
  patient: PatientPayload;
  studyUid?: string | null;
};

export type PatientPayload = { mrn: string; firstName: string; lastName: string; dob?: string | null; sex?: string | null; phone?: string | null; address?: string | null };

function pid(p: PatientPayload) {
  return ['PID', '1', '', `${esc(p.mrn)}^^^RIS^MR`, '', `${esc(p.lastName)}^${esc(p.firstName)}`, '', (p.dob || '').replace(/-/g, ''), p.sex || 'U', '', '', esc(p.address), '', esc(p.phone)].join('|');
}

const PRIORITY_TO_HL7: Record<string, string> = { STAT: 'S', URGENT: 'A', ROUTINE: 'R' };

function referrerField(r?: OrderPayload['referrer']) {
  if (!r?.name) return '';
  const [first, ...rest] = r.name.replace(/^Dr\.?\s*/i, '').split(' ');
  return `${esc(r.code || '')}^${esc(rest.join(' ') || first)}^${esc(rest.length ? first : '')}`;
}

export function buildOrm(o: OrderPayload, h: Omit<Header, 'type'>): string {
  const pri = PRIORITY_TO_HL7[o.priority] || 'R';
  const tq = `^^^${hl7Ts(o.scheduledAt || o.orderedAt)}^^${pri}`;
  const segs = [
    msh({ ...h, type: 'ORM^O01^ORM_O01' }),
    pid(o.patient),
    ['PV1', '1', 'O'].join('|'),
    ['ORC', o.control, esc(o.placerOrderNo || o.accession), esc(o.accession), '', o.orderStatus || '', '', tq, '', hl7Ts(new Date().toISOString()), '', '', referrerField(o.referrer)].join('|'),
    ['OBR', '1', esc(o.placerOrderNo || o.accession), esc(o.accession), `${esc(o.procedureCode)}^${esc(o.procedureName)}^RIS`, pri, hl7Ts(o.orderedAt), '', '', '', '', '', '', esc(o.clinicalHistory), '', '', referrerField(o.referrer), '', esc(o.accession), esc(o.accession), esc(o.procedureCode), '', '', '', o.modality, '', '', tq].join('|'),
  ];
  if (o.studyUid) segs.push(['ZDS', `${o.studyUid}^RIS^Application^DICOM`].join('|'));
  return segs.join('\r');
}

export type ResultPayload = OrderPayload & {
  resultStatus: 'P' | 'F' | 'C';
  observedAt: string;
  radiologist?: string | null;
  sections: { id: string; label: string; text: string }[];
};

export function buildOru(r: ResultPayload, h: Omit<Header, 'type'>): string {
  const segs = [
    msh({ ...h, type: 'ORU^R01^ORU_R01' }),
    pid(r.patient),
    ['PV1', '1', 'O'].join('|'),
    ['ORC', 'RE', esc(r.placerOrderNo || r.accession), esc(r.accession), '', 'CM'].join('|'),
    ['OBR', '1', esc(r.placerOrderNo || r.accession), esc(r.accession), `${esc(r.procedureCode)}^${esc(r.procedureName)}^RIS`, PRIORITY_TO_HL7[r.priority] || 'R', hl7Ts(r.orderedAt), hl7Ts(r.observedAt), '', '', '', '', '', '', '', '', referrerField(r.referrer), '', esc(r.accession), '', '', '', hl7Ts(r.observedAt), '', r.modality, r.resultStatus, '', '', '', '', '', '', esc(r.radiologist || '')].join('|'),
  ];
  let i = 1;
  for (const s of r.sections) {
    const lines = (s.text || '').split(/\r?\n/);
    for (const line of lines) {
      segs.push(['OBX', String(i++), 'TX', `${s.id}^${esc(s.label)}^RIS`, '', esc(line), '', '', '', '', '', r.resultStatus, '', '', hl7Ts(r.observedAt)].join('|'));
    }
  }
  if (r.studyUid) segs.push(['OBX', String(i++), 'RP', '113014^DICOM Study^DCM', '', `${r.studyUid}^RIS^Application^DICOM`, '', '', '', '', '', r.resultStatus].join('|'));
  return segs.join('\r');
}

export function buildAck(incoming: Hl7Message | null, code: 'AA' | 'AE' | 'AR', controlId: string, text = ''): string {
  const inCtrl = incoming ? hl7Get(incoming, 'MSH-10') : '';
  const trig = incoming ? hl7Get(incoming, 'MSH-9.2') : '';
  const sendingApp = incoming ? hl7Get(incoming, 'MSH-3') : '';
  const sendingFac = incoming ? hl7Get(incoming, 'MSH-4') : '';
  return [
    msh({ type: `ACK^${trig}^ACK`, controlId, receivingApp: sendingApp, receivingFacility: sendingFac }),
    ['MSA', code, inCtrl, esc(text)].join('|'),
    ...(code !== 'AA' ? [['ERR', '', '', '207^Application internal error^HL70357', 'E', '', '', '', esc(text)].join('|')] : []),
  ].join('\r');
}

export const MLLP_START = '\x0b';
export const MLLP_END = '\x1c\x0d';
