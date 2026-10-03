/**
 * Synthetic DICOM study generator. Produces anatomically-plausible phantoms per modality
 * so the whole RIS/PACS workflow (ingest, reconcile, view, report) can be exercised
 * without real patient data. Images are synthetic and not for diagnostic use.
 */
import crypto from 'crypto';
import { Element, writeDicom, dicomDate, dicomTime } from './writer';

export const SOP = {
  CT: '1.2.840.10008.5.1.4.1.1.2',
  MR: '1.2.840.10008.5.1.4.1.1.4',
  CR: '1.2.840.10008.5.1.4.1.1.1',
  DX: '1.2.840.10008.5.1.4.1.1.1.1',
  MG: '1.2.840.10008.5.1.4.1.1.1.2',
  US: '1.2.840.10008.5.1.4.1.1.6.1',
  NM: '1.2.840.10008.5.1.4.1.1.20',
  PT: '1.2.840.10008.5.1.4.1.1.128',
  XA: '1.2.840.10008.5.1.4.1.1.12.1',
  RF: '1.2.840.10008.5.1.4.1.1.12.2',
  SC: '1.2.840.10008.5.1.4.1.1.7',
} as const;

export type StudyRequest = {
  modality: string;
  bodyPart?: string | null;
  description: string;
  accession: string;
  patientId: string;
  patientName: string;       // DICOM PN: LAST^FIRST
  patientDob?: string | null; // YYYY-MM-DD
  patientSex?: string | null;
  referrer?: string | null;
  studyUid?: string;
  stationAe?: string | null;
  institution?: string;
  when?: Date;
};

export type GeneratedFile = { sopUid: string; seriesUid: string; buffer: Buffer };

function uid() {
  return `2.25.${BigInt('0x' + crypto.randomUUID().replace(/-/g, '')).toString()}`;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Img = { w: number; h: number; data: Uint16Array | Uint8Array; bits: 8 | 16 };

const inEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) =>
  ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

/** Smooth band-limited texture in [-1, 1]. */
function texture(x: number, y: number, s: number) {
  return (Math.sin(x * 0.11 + s) * Math.cos(y * 0.13 - s) + Math.sin((x + y) * 0.05 + s * 2) * 0.6 + Math.sin(x * 0.31 - y * 0.27 + s) * 0.25) / 1.85;
}

// ---------- CT ----------
function ctChest(z: number, n: number, r: () => number): Img {
  const w = 256, h = 256, data = new Uint16Array(w * h);
  const t = z / (n - 1); // 0 = apex, 1 = upper abdomen
  const lungR = 1 - Math.abs(t - 0.45) * 1.2;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let hu = -1000;
      if (y > 210 && y < 222 && x > 20 && x < 236) hu = 200; // table
      if (inEllipse(x, y, 128, 128, 112, 84)) {
        hu = -100; // subcutaneous fat
        if (inEllipse(x, y, 128, 128, 102, 75)) {
          hu = 40; // muscle / soft tissue
          const lungScale = Math.max(0.15, lungR);
          const inL = inEllipse(x, y, 84, 118, 36 * lungScale + 6, 52 * lungScale + 8);
          const inRl = inEllipse(x, y, 172, 118, 36 * lungScale + 6, 52 * lungScale + 8);
          if ((inL || inRl) && t < 0.85) {
            hu = -860 + texture(x, y, z) * 25;
            // pulmonary vessels
            if (Math.abs(Math.sin(x * 0.35 + y * 0.12 + z)) < 0.05 && Math.abs(Math.cos(y * 0.2)) > 0.6) hu = 20;
            // a small nodule in the right lung on a few slices
            if (inEllipse(x, y, 70, 105, 5, 5) && Math.abs(z - n * 0.4) < 2) hu = 30;
          }
          if (t > 0.3 && t < 0.8 && inEllipse(x, y, 138, 128, 34, 28)) hu = 45; // heart
          if (inEllipse(x, y, 118, 150, 10, 10)) hu = t > 0.2 ? 180 : 45; // contrast aorta
          if (t > 0.75 && inEllipse(x, y, 90, 130, 55, 45)) hu = 60 + texture(x, y, 3) * 6; // liver
          if (inEllipse(x, y, 128, 175, 18, 16)) hu = 350 + (inEllipse(x, y, 128, 175, 11, 10) ? -150 : 350); // vertebra
          if (inEllipse(x, y, 128, 196, 6, 8)) hu = 900; // spinous process
          // ribs
          const ang = Math.atan2(y - 128, x - 128), rad = Math.hypot((x - 128) / 104, (y - 128) / 77);
          if (rad > 0.93 && rad < 1.0 && Math.sin(ang * 9 + z * 0.6) > 0.55) hu = 700;
        }
      }
      hu += (r() - 0.5) * 24;
      data[y * w + x] = Math.max(0, Math.min(4095, Math.round(hu + 1024)));
    }
  return { w, h, data, bits: 16 };
}

function ctHead(z: number, n: number, r: () => number): Img {
  const w = 256, h = 256, data = new Uint16Array(w * h);
  const t = z / (n - 1);
  const s = Math.sqrt(Math.max(0.05, 1 - (t - 0.45) ** 2 * 2.2));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let hu = -1000;
      if (inEllipse(x, y, 128, 128, 92 * s, 110 * s)) {
        hu = 1200; // skull
        if (inEllipse(x, y, 128, 128, 84 * s, 102 * s)) {
          hu = 38 + texture(x, y, 1) * 3; // grey matter
          if (inEllipse(x, y, 128, 128, 62 * s, 80 * s)) hu = 28; // white matter
          if (t > 0.35 && t < 0.7) {
            if (inEllipse(x, y, 116, 120, 7, 26) || inEllipse(x, y, 140, 120, 7, 26)) hu = 6; // ventricles
          }
          if (Math.abs(x - 128) < 1.2 && hu > 20) hu = 50; // falx
        }
      } else if (inEllipse(x, y, 128, 128, 96 * s, 114 * s)) hu = 20; // scalp
      hu += (r() - 0.5) * 8;
      data[y * w + x] = Math.max(0, Math.min(4095, Math.round(hu + 1024)));
    }
  return { w, h, data, bits: 16 };
}

// ---------- MR ----------
function mrBrain(z: number, n: number, r: () => number, weighting: 'T1' | 'T2'): Img {
  const w = 256, h = 256, data = new Uint16Array(w * h);
  const t = z / (n - 1);
  const s = Math.sqrt(Math.max(0.05, 1 - (t - 0.45) ** 2 * 2.2));
  const V = weighting === 'T2'
    ? { csf: 1800, gm: 900, wm: 620, fat: 1100, bone: 60 }
    : { csf: 260, gm: 700, wm: 980, fat: 1500, bone: 60 };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let v = 0;
      if (inEllipse(x, y, 128, 128, 96 * s, 114 * s)) {
        v = V.fat;
        if (inEllipse(x, y, 128, 128, 91 * s, 109 * s)) v = V.bone;
        if (inEllipse(x, y, 128, 128, 84 * s, 102 * s)) {
          v = V.csf;
          if (inEllipse(x, y, 128, 128, 81 * s, 99 * s)) {
            v = V.gm + texture(x, y, 2) * 40;
            const gyri = Math.sin(Math.atan2(y - 128, x - 128) * 22) * 6;
            if (inEllipse(x, y, 128, 128, 66 * s + gyri, 84 * s + gyri)) v = V.wm + texture(x, y, 5) * 15;
            if (t > 0.35 && t < 0.7 && (inEllipse(x, y, 116, 120, 7, 26) || inEllipse(x, y, 140, 120, 7, 26))) v = V.csf;
            if (Math.abs(x - 128) < 1.5) v = V.csf;
            // small lesion for the teaching case
            if (inEllipse(x, y, 160, 95, 6, 6) && Math.abs(z - n * 0.55) < 2) v = weighting === 'T2' ? 1500 : 450;
          }
        }
      }
      v = Math.max(0, v + (r() - 0.5) * 40);
      data[y * w + x] = Math.round(v);
    }
  return { w, h, data, bits: 16 };
}

function mrBody(z: number, n: number, r: () => number): Img {
  const w = 256, h = 256, data = new Uint16Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let v = 0;
      if (inEllipse(x, y, 128, 128, 110, 80)) {
        v = 1300; // fat
        if (inEllipse(x, y, 128, 128, 100, 71)) {
          v = 500 + texture(x, y, z) * 30;
          if (inEllipse(x, y, 90, 120, 50, 40)) v = 620; // liver
          if (inEllipse(x, y, 175, 110, 22, 30)) v = 800; // spleen
          if (inEllipse(x, y, 100, 170, 16, 22) || inEllipse(x, y, 160, 170, 16, 22)) v = 900; // kidneys
          if (inEllipse(x, y, 128, 175, 15, 14)) v = 300; // vertebra
          if (inEllipse(x, y, 104, 108, 9, 9) && Math.abs(z - n / 2) < 3) v = 1700; // hepatic cyst
        }
      }
      data[y * w + x] = Math.round(Math.max(0, v + (r() - 0.5) * 50));
    }
  return { w, h, data, bits: 16 };
}

// ---------- Projection radiography ----------
function xrChest(r: () => number, lateral = false): Img {
  const w = 512, h = 512, data = new Uint16Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let v = 300; // air (dark)
      const body = lateral ? inEllipse(x, y, 256, 280, 150, 240) : inEllipse(x, y, 256, 300, 210, 250);
      if (body) {
        v = 2000 + texture(x, y, 0) * 60;
        if (!lateral) {
          const lungL = inEllipse(x, y, 170, 250, 80, 150) && y < 390;
          const lungR = inEllipse(x, y, 342, 250, 80, 150) && y < 380;
          if (lungL || lungR) v = 900 + texture(x, y, 1) * 80 + Math.max(0, (y - 150) * 0.5);
          if (inEllipse(x, y, 285, 330, 70, 70)) v = Math.max(v, 1900); // heart
          if (Math.abs(x - 256) < 22 && y > 90) v = Math.max(v, 2300); // spine/mediastinum
          // ribs
          for (let k = 0; k < 9; k++) {
            const yy = 140 + k * 28 + Math.abs(x - 256) * 0.25;
            if (Math.abs(y - yy) < 4 && Math.abs(x - 256) > 30 && Math.abs(x - 256) < 200) v += 450;
          }
          // clavicles
          const cy = 130 + Math.abs(x - 256) * -0.12;
          if (Math.abs(y - cy) < 7 && Math.abs(x - 256) > 30 && Math.abs(x - 256) < 170) v += 600;
          if (y > 390 + Math.abs(x - 256) * 0.1) v = 2100; // diaphragm / abdomen
        } else {
          if (inEllipse(x, y, 256, 250, 110, 150) && y < 390) v = 1000 + texture(x, y, 1) * 70;
          if (inEllipse(x, y, 230, 330, 60, 60)) v = 1850;
          if (x > 350 && x < 385 && y > 80) v = 2600 + ((y % 34) < 4 ? -300 : 0); // vertebrae
        }
      }
      data[y * w + x] = Math.max(0, Math.min(4095, Math.round(v + (r() - 0.5) * 60)));
    }
  return { w, h, data, bits: 16 };
}

function xrExtremity(r: () => number, view: number): Img {
  const w = 384, h = 512, data = new Uint16Array(w * h);
  const off = view * 14;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let v = 250;
      const soft = Math.abs(x - 192 - Math.sin(y / 90) * 10) < 95 - Math.abs(y - 256) * 0.05;
      if (soft) {
        v = 1300 + texture(x, y, 2) * 40;
        const shaft = Math.abs(x - 192 - off * Math.sin(y / 120)) < 26 + (y > 380 ? (y - 380) * 0.35 : 0);
        if (shaft) {
          const cortex = Math.abs(Math.abs(x - 192 - off * Math.sin(y / 120)) - (22 + (y > 380 ? (y - 380) * 0.3 : 0))) < 6;
          v = cortex ? 3200 : 2300;
          if (Math.abs(y - 300 - view * 3) < 2 && x > 175 && x < 215) v = 1400; // hairline fracture
        }
      }
      data[y * w + x] = Math.max(0, Math.min(4095, Math.round(v + (r() - 0.5) * 60)));
    }
  return { w, h, data, bits: 16 };
}

function mammo(r: () => number, side: 'L' | 'R', mlo: boolean): Img {
  const w = 384, h = 512, data = new Uint16Array(w * h);
  for (let y = 0; y < h; y++)
    for (let xx = 0; xx < w; xx++) {
      const x = side === 'R' ? xx : w - 1 - xx;
      let v = 200;
      const inside = inEllipse(x, y, 0, 256, 300, 230) ;
      if (inside) {
        const depth = 1 - Math.hypot(x / 300, (y - 256) / 230);
        v = 1200 + depth * 700 + texture(x * 1.6, y * 1.6, side === 'L' ? 1 : 2) * 250 * depth;
        if (mlo && x < 60 && y < 200) v = 2100; // pectoral muscle
        if (inEllipse(x, y, 150, 220, 9, 9)) v = 2600; // small mass
        if (((x * 7 + y * 13) % 997) < 1 && depth > 0.2) v = 3500; // microcalcification
      }
      data[y * w + xx] = Math.max(0, Math.min(4095, Math.round(v + (r() - 0.5) * 50)));
    }
  return { w, h, data, bits: 16 };
}

// ---------- Ultrasound ----------
function ultrasound(r: () => number, frame: number): Img {
  const w = 512, h = 400, data = new Uint8Array(w * h);
  const apexX = 256, apexY = 10;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const ang = Math.atan2(x - apexX, y - apexY);
      const dist = Math.hypot(x - apexX, y - apexY);
      let v = 0;
      if (Math.abs(ang) < 0.62 && dist > 30 && dist < 380) {
        const speckle = r() * r();
        v = 40 + speckle * 170 * (1 - dist / 520);
        if (Math.abs(dist - 70) < 5) v += 60; // capsule line
        if (inEllipse(x, y, 250 + frame * 6, 210, 55, 34)) v = r() * 18; // anechoic cyst/gallbladder
        if (inEllipse(x, y, 250 + frame * 6, 250, 60, 8) && !inEllipse(x, y, 250 + frame * 6, 210, 55, 34)) v += 60; // posterior enhancement
      }
      data[y * w + x] = Math.max(0, Math.min(255, Math.round(v)));
    }
  return { w, h, data, bits: 8 };
}

// ---------- Nuclear / PET / Angio ----------
function blobs(r: () => number, n: number, z: number, hot: boolean): Img {
  const w = 128, h = 128, data = new Uint16Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let v = 0;
      if (inEllipse(x, y, 64, 64, 50, 38)) v = 200 + r() * 80;
      if (inEllipse(x, y, 64, 30, 18, 14) && z < n * 0.4) v = 1400; // brain uptake
      if (inEllipse(x, y, 45, 70, 18, 14)) v = 700; // liver
      if (inEllipse(x, y, 58, 92, 7, 9) || inEllipse(x, y, 72, 92, 7, 9)) v = 1800; // kidneys/bladder
      if (hot && inEllipse(x, y, 82, 55, 5, 5) && Math.abs(z - n / 2) < 3) v = 3200; // hot lesion
      data[y * w + x] = Math.round(v * (0.8 + r() * 0.4));
    }
  return { w, h, data, bits: 16 };
}

function angio(r: () => number, frame: number): Img {
  const w = 512, h = 512, data = new Uint16Array(w * h);
  const fill = Math.min(1, (frame + 1) / 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let v = 2600 + texture(x, y, 4) * 150;
      const trunkX = 256 + Math.sin(y / 60) * 30;
      const trunk = Math.abs(x - trunkX) < 9 && y < h * fill;
      const b1 = Math.abs(y - (180 + (x - trunkX) * 0.6)) < 5 && x > trunkX && x < trunkX + 160 * fill;
      const b2 = Math.abs(y - (300 - (x - trunkX) * 0.5)) < 4 && x < trunkX && x > trunkX - 150 * fill;
      if (trunk || b1 || b2) v = 700;
      data[y * w + x] = Math.max(0, Math.round(v + (r() - 0.5) * 80));
    }
  return { w, h, data, bits: 16 };
}

type SeriesSpec = {
  description: string;
  modality: string;
  sop: string;
  images: (r: () => number) => Img[];
  spacing: number;
  thickness?: number;
  wc: number;
  ww: number;
  rescale?: { slope: number; intercept: number };
  bodyPart?: string;
  photometric?: string;
  labels?: string[];
};

function isHead(bp?: string | null) {
  return /head|brain|skull|orbit|sinus|neuro/i.test(bp || '');
}

function planFor(modality: string, bodyPart: string | null | undefined, description: string): SeriesSpec[] {
  const m = modality.toUpperCase();
  const bp = (bodyPart || '').toUpperCase();
  switch (m) {
    case 'CT': {
      const head = isHead(bodyPart) || /head|brain/i.test(description);
      const n = head ? 22 : 28;
      return [
        {
          description: head ? 'Head axial 5mm' : 'Axial 5mm soft tissue', modality: 'CT', sop: SOP.CT, spacing: head ? 0.9 : 1.5, thickness: 5,
          wc: head ? 40 : 40, ww: head ? 80 : 400, rescale: { slope: 1, intercept: -1024 }, bodyPart: bp || (head ? 'HEAD' : 'CHEST'),
          images: (r) => Array.from({ length: n }, (_, z) => (head ? ctHead(z, n, r) : ctChest(z, n, r))),
        },
      ];
    }
    case 'MR': {
      const head = isHead(bodyPart) || /head|brain/i.test(description);
      if (head)
        return (['T2', 'T1'] as const).map((wt) => ({
          description: `${wt} axial brain`, modality: 'MR', sop: SOP.MR, spacing: 0.9, thickness: 5,
          wc: wt === 'T2' ? 900 : 700, ww: wt === 'T2' ? 1800 : 1400, bodyPart: 'BRAIN',
          images: (r: () => number) => Array.from({ length: 20 }, (_, z) => mrBrain(z, 20, r, wt)),
        }));
      return [{ description: 'T2 axial', modality: 'MR', sop: SOP.MR, spacing: 1.4, thickness: 6, wc: 800, ww: 1600, bodyPart: bp || 'ABDOMEN',
        images: (r) => Array.from({ length: 18 }, (_, z) => mrBody(z, 18, r)) }];
    }
    case 'CR':
    case 'DX': {
      const chest = !bp || /CHEST|THORAX|LUNG/.test(bp) || /chest/i.test(description);
      if (chest)
        return [{ description: 'Chest PA / Lateral', modality: m, sop: m === 'CR' ? SOP.CR : SOP.DX, spacing: 0.7, wc: 1800, ww: 3200, bodyPart: 'CHEST',
          labels: ['PA', 'LAT'], images: (r) => [xrChest(r, false), xrChest(r, true)] }];
      return [{ description: `${bp || 'Extremity'} AP / Lateral`, modality: m, sop: m === 'CR' ? SOP.CR : SOP.DX, spacing: 0.3, wc: 1900, ww: 3400, bodyPart: bp,
        labels: ['AP', 'LAT', 'OBL'], images: (r) => [0, 1, 2].map((v) => xrExtremity(r, v)) }];
    }
    case 'MG':
      return [{ description: 'Screening mammography', modality: 'MG', sop: SOP.MG, spacing: 0.2, wc: 1900, ww: 2800, bodyPart: 'BREAST',
        labels: ['R CC', 'L CC', 'R MLO', 'L MLO'],
        images: (r) => [mammo(r, 'R', false), mammo(r, 'L', false), mammo(r, 'R', true), mammo(r, 'L', true)] }];
    case 'US':
      return [{ description: `${bp || 'Abdomen'} ultrasound`, modality: 'US', sop: SOP.US, spacing: 0.3, wc: 128, ww: 256, bodyPart: bp || 'ABDOMEN',
        images: (r) => Array.from({ length: 6 }, (_, i) => ultrasound(r, i)) }];
    case 'NM':
    case 'PT':
      return [{ description: m === 'PT' ? 'PET WB AC' : 'NM whole body', modality: m, sop: m === 'PT' ? SOP.PT : SOP.NM, spacing: 4, thickness: 4, wc: 1600, ww: 3200, bodyPart: 'WHOLEBODY',
        images: (r) => Array.from({ length: 16 }, (_, z) => blobs(r, 16, z, true)) }];
    case 'XA':
    case 'RF':
      return [{ description: m === 'XA' ? 'Angiography run' : 'Fluoroscopy run', modality: m, sop: m === 'XA' ? SOP.XA : SOP.RF, spacing: 0.3, wc: 1800, ww: 3000, bodyPart: bp,
        images: (r) => Array.from({ length: 8 }, (_, i) => angio(r, i)) }];
    default:
      return [{ description: 'Secondary capture', modality: m || 'OT', sop: SOP.SC, spacing: 1, wc: 1800, ww: 3200, bodyPart: bp,
        images: (r) => [xrChest(r)] }];
  }
}

export function generateStudy(req: StudyRequest): { studyUid: string; files: GeneratedFile[] } {
  const when = req.when || new Date();
  const studyUid = req.studyUid || uid();
  const frameOfRef = uid();
  const plan = planFor(req.modality, req.bodyPart, req.description);
  const files: GeneratedFile[] = [];
  const seed = parseInt(crypto.createHash('md5').update(req.accession).digest('hex').slice(0, 8), 16);

  plan.forEach((spec, sIdx) => {
    const r = rng(seed + sIdx * 7919);
    const seriesUid = uid();
    const imgs = spec.images(r);
    imgs.forEach((img, i) => {
      const sopUid = uid();
      const z = i * (spec.thickness || 1);
      const els: Element[] = [
        [0x00080005, 'CS', 'ISO_IR 100'],
        [0x00080008, 'CS', 'ORIGINAL\\PRIMARY\\AXIAL'],
        [0x00080016, 'UI', spec.sop],
        [0x00080018, 'UI', sopUid],
        [0x00080020, 'DA', dicomDate(when)],
        [0x00080021, 'DA', dicomDate(when)],
        [0x00080030, 'TM', dicomTime(when)],
        [0x00080031, 'TM', dicomTime(when)],
        [0x00080050, 'SH', req.accession],
        [0x00080060, 'CS', spec.modality],
        [0x00080070, 'LO', 'Radiant Synthetic Imaging'],
        [0x00080080, 'LO', req.institution || 'Radiant Imaging Center'],
        [0x00080090, 'PN', req.referrer || ''],
        [0x00081010, 'SH', req.stationAe || `${spec.modality}01`],
        [0x00081030, 'LO', req.description],
        [0x0008103e, 'LO', spec.labels?.[i] ? `${spec.description} ${spec.labels[i]}` : spec.description],
        [0x00100010, 'PN', req.patientName],
        [0x00100020, 'LO', req.patientId],
        [0x00100030, 'DA', (req.patientDob || '').replace(/-/g, '')],
        [0x00100040, 'CS', req.patientSex || 'O'],
        [0x00180015, 'CS', spec.bodyPart || ''],
        [0x00180050, 'DS', spec.thickness ? String(spec.thickness) : undefined],
        [0x0020000d, 'UI', studyUid],
        [0x0020000e, 'UI', seriesUid],
        [0x00200010, 'SH', req.accession.slice(-8)],
        [0x00200011, 'IS', String(sIdx + 1)],
        [0x00200013, 'IS', String(i + 1)],
        [0x00200032, 'DS', `-192\\-192\\${z}`],
        [0x00200037, 'DS', '1\\0\\0\\0\\1\\0'],
        [0x00200052, 'UI', frameOfRef],
        [0x00201041, 'DS', spec.thickness ? String(z) : undefined],
        [0x00280002, 'US', 1],
        [0x00280004, 'CS', spec.photometric || 'MONOCHROME2'],
        [0x00280010, 'US', img.h],
        [0x00280011, 'US', img.w],
        [0x00280030, 'DS', `${spec.spacing}\\${spec.spacing}`],
        [0x00280100, 'US', img.bits],
        [0x00280101, 'US', img.bits === 8 ? 8 : 12],
        [0x00280102, 'US', img.bits === 8 ? 7 : 11],
        [0x00280103, 'US', 0],
        [0x00281050, 'DS', String(spec.wc)],
        [0x00281051, 'DS', String(spec.ww)],
        [0x00281052, 'DS', spec.rescale ? String(spec.rescale.intercept) : undefined],
        [0x00281053, 'DS', spec.rescale ? String(spec.rescale.slope) : undefined],
        [0x7fe00010, img.bits === 8 ? 'OB' : 'OW', Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength)],
      ];
      files.push({ sopUid, seriesUid, buffer: writeDicom(els) });
    });
  });
  return { studyUid, files };
}
