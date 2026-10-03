/** Minimal, dependency-free HL7 v2.5.1 / ASTM E1394 helpers for instrument and HIS interfaces. */

const ts = (d: Date | string | null = new Date()) => {
  if (!d) return '';
  const x = new Date(d);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${x.getFullYear()}${p(x.getMonth() + 1)}${p(x.getDate())}${p(x.getHours())}${p(x.getMinutes())}${p(x.getSeconds())}`;
};
const esc = (v: any) => String(v ?? '').replace(/[|^~\\&\r\n]/g, ' ');

export interface Hl7OrderInput {
  sendingApp: string; receivingApp: string; receivingFacility: string; controlId: string;
  patient: { mrn: string; firstName: string; lastName?: string; dob?: string; gender?: string };
  sampleNo: string; priority: string; collectedAt?: Date; sampleType?: string;
  tests: { code: string; name: string }[];
}

/** ORM^O01 new order to middleware / analyzer. */
export function buildOrm(i: Hl7OrderInput): string {
  const segs = [
    `MSH|^~\\&|${esc(i.sendingApp)}|LAB|${esc(i.receivingApp)}|${esc(i.receivingFacility)}|${ts()}||ORM^O01|${esc(i.controlId)}|P|2.5.1`,
    `PID|1||${esc(i.patient.mrn)}||${esc(i.patient.lastName)}^${esc(i.patient.firstName)}||${(i.patient.dob || '').replace(/-/g, '')}|${esc(i.patient.gender)}`,
    `ORC|NW|${esc(i.sampleNo)}|||||^^^^^${i.priority === 'STAT' ? 'S' : 'R'}`,
    ...i.tests.map((t, n) => `OBR|${n + 1}|${esc(i.sampleNo)}|${esc(i.sampleNo)}|${esc(t.code)}^${esc(t.name)}|${i.priority === 'STAT' ? 'S' : 'R'}||${ts(i.collectedAt)}|||||||||${esc(i.sampleType)}`),
  ];
  return segs.join('\r');
}

export interface Hl7ResultInput {
  controlId: string; receivingApp: string;
  patient: { mrn: string; firstName: string; lastName?: string; dob?: string; gender?: string };
  orderNo: string; externalOrderNo?: string;
  tests: { code: string; name: string; status: string; signedAt?: Date; rows: { code: string; name: string; loinc?: string; value: string; unit: string; flag: string; referenceText: string; resultType?: string }[] }[];
}

/** ORU^R01 result message to HIS / EMR. */
export function buildOru(i: Hl7ResultInput): string {
  const segs = [
    `MSH|^~\\&|LIS|LAB|${esc(i.receivingApp)}||${ts()}||ORU^R01|${esc(i.controlId)}|P|2.5.1`,
    `PID|1||${esc(i.patient.mrn)}||${esc(i.patient.lastName)}^${esc(i.patient.firstName)}||${(i.patient.dob || '').replace(/-/g, '')}|${esc(i.patient.gender)}`,
  ];
  i.tests.forEach((t, n) => {
    segs.push(`OBR|${n + 1}|${esc(i.externalOrderNo)}|${esc(i.orderNo)}|${esc(t.code)}^${esc(t.name)}|||||||||||||||||||${ts(t.signedAt)}|||${t.status === 'SIGNED' ? 'F' : 'P'}`);
    t.rows.forEach((r, k) => {
      const vt = r.resultType === 'NUMERIC' || r.resultType === 'CALCULATED' ? 'NM' : 'ST';
      segs.push(`OBX|${k + 1}|${vt}|${esc(r.loinc || r.code)}^${esc(r.name)}^${r.loinc ? 'LN' : 'L'}||${esc(r.value)}|${esc(r.unit)}|${esc(r.referenceText)}|${esc(r.flag)}|||F`);
    });
  });
  return segs.join('\r');
}

export interface ParsedResultMessage {
  analyzerCode: string | null;
  samples: { sampleNo: string; results: { code: string; value: string; unit?: string; flag?: string }[] }[];
}

const lines = (raw: string) => raw.split(/\r\n|\r|\n/).map((l) => l.trim()).filter(Boolean);

/** Parses an HL7 ORU^R01 from middleware. MSH-3 = analyzer code, OBR-3 (or OBR-2) = sample barcode, OBX-3.1 = assay code. */
export function parseOru(raw: string): ParsedResultMessage {
  const out: ParsedResultMessage = { analyzerCode: null, samples: [] };
  let current: ParsedResultMessage['samples'][0] | null = null;
  for (const line of lines(raw)) {
    const f = line.split('|');
    if (f[0] === 'MSH') out.analyzerCode = (f[2] || '').split('^')[0] || null;
    else if (f[0] === 'OBR' || f[0] === 'SPM') {
      const no = f[0] === 'OBR' ? ((f[3] || f[2] || '').split('^')[0]) : (f[2] || '').split('^')[0];
      if (!no) continue;
      current = out.samples.find((s) => s.sampleNo === no) || null;
      if (!current) { current = { sampleNo: no, results: [] }; out.samples.push(current); }
    } else if (f[0] === 'OBX' && current) {
      const code = (f[3] || '').split('^')[0];
      if (code) current.results.push({ code, value: f[5] ?? '', unit: (f[6] || '').split('^')[0], flag: f[8] });
    }
  }
  return out;
}

/** Parses ASTM E1394 records (H/P/O/R/L). H-5.1 = analyzer name/code, O-3 = specimen id, R-3 = ^^^assay. */
export function parseAstm(raw: string): ParsedResultMessage {
  const out: ParsedResultMessage = { analyzerCode: null, samples: [] };
  let current: ParsedResultMessage['samples'][0] | null = null;
  for (let line of lines(raw)) {
    line = line.replace(/^\d(?=[HPORCLQM]\|)/, ''); // strip frame number if present
    const f = line.split('|');
    const type = f[0];
    if (type === 'H') out.analyzerCode = (f[4] || '').split('^')[0] || null;
    else if (type === 'O') {
      const no = (f[2] || f[3] || '').split('^')[0];
      current = { sampleNo: no, results: [] };
      out.samples.push(current);
    } else if (type === 'R' && current) {
      const code = (f[2] || '').split('^').filter(Boolean).pop() || '';
      if (code) current.results.push({ code, value: f[3] ?? '', unit: f[4], flag: f[6] });
    }
  }
  return out;
}
