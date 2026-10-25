/**
 * Dependency-free DICOM Part 10 writer (Explicit VR Little Endian).
 * Enough to produce conformant single-frame images for the sample generator and tests.
 */

export type VR =
  | 'AE' | 'AS' | 'CS' | 'DA' | 'DS' | 'DT' | 'IS' | 'LO' | 'LT' | 'PN' | 'SH' | 'ST' | 'TM' | 'UI' | 'UT'
  | 'US' | 'UL' | 'SS' | 'FL' | 'FD' | 'OB' | 'OW';

export type Element = [tag: number, vr: VR, value: string | number | number[] | Buffer | undefined | null];

export const TS_EXPLICIT_LE = '1.2.840.10008.1.2.1';
const IMPLEMENTATION_UID = '1.2.826.0.1.3680043.10.1455.1';
const LONG_VRS = new Set(['OB', 'OW', 'UT', 'UN', 'SQ', 'OF']);

function encodeValue(vr: VR, value: Element[2]): Buffer {
  if (value === undefined || value === null) return Buffer.alloc(0);
  switch (vr) {
    case 'US': {
      const arr = Array.isArray(value) ? value : [Number(value)];
      const b = Buffer.alloc(arr.length * 2);
      arr.forEach((v, i) => b.writeUInt16LE(v, i * 2));
      return b;
    }
    case 'SS': {
      const arr = Array.isArray(value) ? value : [Number(value)];
      const b = Buffer.alloc(arr.length * 2);
      arr.forEach((v, i) => b.writeInt16LE(v, i * 2));
      return b;
    }
    case 'UL': {
      const b = Buffer.alloc(4);
      b.writeUInt32LE(Number(value), 0);
      return b;
    }
    case 'FL': {
      const b = Buffer.alloc(4);
      b.writeFloatLE(Number(value), 0);
      return b;
    }
    case 'FD': {
      const b = Buffer.alloc(8);
      b.writeDoubleLE(Number(value), 0);
      return b;
    }
    case 'OB':
    case 'OW': {
      const b = Buffer.isBuffer(value) ? value : Buffer.from(value as number[]);
      return b.length % 2 ? Buffer.concat([b, Buffer.alloc(1)]) : b;
    }
    default: {
      let s = Array.isArray(value) ? value.join('\\') : String(value);
      if (s.length % 2) s += vr === 'UI' ? '\0' : ' ';
      return Buffer.from(s, 'latin1');
    }
  }
}

function encodeElement([tag, vr, value]: Element): Buffer {
  const data = encodeValue(vr, value);
  const long = LONG_VRS.has(vr);
  const head = Buffer.alloc(long ? 12 : 8);
  head.writeUInt16LE(tag >>> 16, 0);
  head.writeUInt16LE(tag & 0xffff, 2);
  head.write(vr, 4, 'latin1');
  if (long) {
    head.writeUInt16LE(0, 6);
    head.writeUInt32LE(data.length, 8);
  } else {
    head.writeUInt16LE(data.length, 6);
  }
  return Buffer.concat([head, data]);
}

export function writeDicom(elements: Element[]): Buffer {
  const sopClass = String(elements.find((e) => e[0] === 0x00080016)?.[2] || '');
  const sopInstance = String(elements.find((e) => e[0] === 0x00080018)?.[2] || '');

  const meta: Element[] = [
    [0x00020001, 'OB', Buffer.from([0x00, 0x01])],
    [0x00020002, 'UI', sopClass],
    [0x00020003, 'UI', sopInstance],
    [0x00020010, 'UI', TS_EXPLICIT_LE],
    [0x00020012, 'UI', IMPLEMENTATION_UID],
    [0x00020013, 'SH', 'RADIANT_RIS_1'],
  ];
  const metaBody = Buffer.concat(meta.map(encodeElement));
  const metaLen = encodeElement([0x00020000, 'UL', metaBody.length]);

  const body = Buffer.concat(
    elements
      .filter((e) => e[2] !== undefined && e[2] !== null)
      .sort((a, b) => (a[0] >>> 0) - (b[0] >>> 0))
      .map(encodeElement),
  );

  return Buffer.concat([Buffer.alloc(128), Buffer.from('DICM', 'latin1'), metaLen, metaBody, body]);
}

export function dicomDate(d: Date) {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}
export function dicomTime(d: Date) {
  return d.toISOString().slice(11, 19).replace(/:/g, '');
}
