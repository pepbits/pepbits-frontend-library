'use client';
import {DiagnosticButton,DiagnosticInput,DiagnosticSelect,DiagnosticTable,TableBody,TableRow,TableCell} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
/**
 * Browser DICOM viewer. Parses Part 10 files with dicom-parser and renders them to canvas
 * with modality LUT (rescale), VOI LUT (window/level), zoom, pan, stack scroll, cine,
 * length and ROI measurement, series thumbnails and a DICOM tag panel.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as dicomParser from 'dicom-parser';
import {
  Contrast, Move, ZoomIn, Ruler, Square, RotateCcw, Play, Pause, SunMoon, Tags, Maximize2, ChevronLeft, ChevronRight, Loader2,
} from 'lucide-react';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


// ---------------------------------------------------------------- decoding
type Img = {
  id: number;
  rows: number;
  cols: number;
  frames: number;
  pixels: Int16Array | Uint16Array | Uint8Array | Int8Array;
  slope: number;
  intercept: number;
  wc: number;
  ww: number;
  spacing: [number, number] | null; // [row, col] mm
  mono1: boolean;
  rgb: boolean;
  min: number;
  max: number;
  tags: { tag: string; name: string; value: string }[];
  meta: Record<string, string>;
  error?: string;
};

const TAG_NAMES: Record<string, string> = {
  x00020010: 'Transfer Syntax UID', x00080016: 'SOP Class UID', x00080018: 'SOP Instance UID', x00080020: 'Study Date', x00080030: 'Study Time',
  x00080050: 'Accession Number', x00080060: 'Modality', x00080070: 'Manufacturer', x00080080: 'Institution Name', x00080090: 'Referring Physician',
  x00081010: 'Station Name', x00081030: 'Study Description', x0008103e: 'Series Description', x00100010: "Patient's Name", x00100020: 'Patient ID',
  x00100030: "Patient's Birth Date", x00100040: "Patient's Sex", x00180015: 'Body Part Examined', x00180050: 'Slice Thickness', x00180060: 'KVP',
  x00181030: 'Protocol Name', x00185101: 'View Position', x0020000d: 'Study Instance UID', x0020000e: 'Series Instance UID', x00200010: 'Study ID',
  x00200011: 'Series Number', x00200013: 'Instance Number', x00200020: 'Patient Orientation', x00200032: 'Image Position (Patient)',
  x00200037: 'Image Orientation (Patient)', x00201041: 'Slice Location', x00280002: 'Samples per Pixel', x00280004: 'Photometric Interpretation',
  x00280008: 'Number of Frames', x00280010: 'Rows', x00280011: 'Columns', x00280030: 'Pixel Spacing', x00280100: 'Bits Allocated',
  x00280101: 'Bits Stored', x00280103: 'Pixel Representation', x00281050: 'Window Center', x00281051: 'Window Width', x00281052: 'Rescale Intercept',
  x00281053: 'Rescale Slope', x00321060: 'Requested Procedure Description', x00400254: 'Performed Procedure Step Description',
};
const US_TAGS = new Set(['x00280002', 'x00280010', 'x00280011', 'x00280100', 'x00280101', 'x00280103', 'x00280008']);
const NATIVE_TS = new Set(['1.2.840.10008.1.2', '1.2.840.10008.1.2.1', '1.2.840.10008.1.2.2', '']);



function num(ds: dicomParser.DataSet, tag: string, fallback: number) {
  const v = ds.string(tag);
  if (!v) return fallback;
  const n = parseFloat(v.split('\\')[0]);
  return Number.isFinite(n) ? n : fallback;
}

function decode(id: number, buf: ArrayBuffer): Img {
  const bytes = new Uint8Array(buf);
  const ds = dicomParser.parseDicom(bytes);
  const s = (t: string) => (ds.string(t) || '').trim();
  const rows = ds.uint16('x00280010') || 0;
  const cols = ds.uint16('x00280011') || 0;
  const bits = ds.uint16('x00280100') || 16;
  const signed = ds.uint16('x00280103') === 1;
  const spp = ds.uint16('x00280002') || 1;
  const frames = parseInt(s('x00280008') || '1', 10) || 1;
  const photometric = s('x00280004');
  const ts = s('x00020010');
  const tags = Object.keys(ds.elements)
    .filter((t) => TAG_NAMES[t])
    .map((t) => ({ tag: `(${t.slice(1, 5)},${t.slice(5)})`.toUpperCase(), name: TAG_NAMES[t], value: US_TAGS.has(t) ? String(ds.uint16(t) ?? '') : s(t) }));
  const meta = {
    name: s('x00100010').replace(/\^/g, ' '), pid: s('x00100020'), dob: s('x00100030'), sex: s('x00100040'), accession: s('x00080050'),
    studyDate: s('x00080020'), studyDesc: s('x00081030'), seriesDesc: s('x0008103e'), series: s('x00200011'), instance: s('x00200013'),
    institution: s('x00080080'), modality: s('x00080060'), thickness: s('x00180050'), kvp: s('x00180060'), view: s('x00185101'),
  };
  const base = { id, rows, cols, frames, tags, meta, slope: 1, intercept: 0, wc: 128, ww: 256, spacing: null, mono1: false, rgb: false, min: 0, max: 255 };
  if (!NATIVE_TS.has(ts)) return { ...base, pixels: new Uint8Array(0), error: `Compressed transfer syntax ${ts} is not displayed in the browser viewer.` };
  const el = ds.elements.x7fe00010;
  if (!el) return { ...base, pixels: new Uint8Array(0), error: 'This instance has no pixel data (for example a structured report).' };

  const count = rows * cols * spp * frames;
  let pixels: Img['pixels'];
  const off = bytes.byteOffset + el.dataOffset;
  if (bits === 16) {
    // copy to guarantee 2-byte alignment
    const copy = bytes.buffer.slice(off, off + count * 2);
    pixels = signed ? new Int16Array(copy) : new Uint16Array(copy);
  } else {
    const copy = bytes.buffer.slice(off, off + count);
    pixels = signed ? new Int8Array(copy) : new Uint8Array(copy);
  }
  let min = Infinity, max = -Infinity;
  const step = Math.max(1, Math.floor(pixels.length / 40000));
  for (let i = 0; i < pixels.length; i += step) { const v = pixels[i]; if (v < min) min = v; if (v > max) max = v; }
  const slope = num(ds, 'x00281053', 1);
  const intercept = num(ds, 'x00281052', 0);
  const mMin = min * slope + intercept, mMax = max * slope + intercept;
  const ps = s('x00280030') || s('x00181164');
  const spacing = ps ? (ps.split('\\').map(parseFloat) as [number, number]) : null;
  return {
    ...base, pixels, slope, intercept, min: mMin, max: mMax,
    wc: num(ds, 'x00281050', (mMin + mMax) / 2), ww: Math.max(1, num(ds, 'x00281051', mMax - mMin || 1)),
    spacing: spacing && spacing.length === 2 && spacing.every(Number.isFinite) ? spacing : null,
    mono1: photometric === 'MONOCHROME1', rgb: spp === 3,
  };
}

function useInstanceLoader(){
 const {fetch}=useDiagnosticClient();
 return useMemo(()=>{const cache=new Map<number,Promise<Img>>();return (id:number):Promise<Img>=>{
  if(!cache.has(id)){const pending=fetch(`/api/dicom/instances/${id}`).then(r=>{if(!r.ok)throw new Error('Image could not be retrieved');return r.arrayBuffer();}).then(b=>decode(id,b)).catch(e=>{cache.delete(id);throw e;});cache.set(id,pending);if(cache.size>128)cache.delete(cache.keys().next().value!);}
  return cache.get(id)!;
 };},[fetch]);
}

/** Paints one frame into an ImageData using the modality LUT then a linear VOI window. */
function paint(img: Img, frame: number, wc: number, ww: number, invert: boolean): ImageData {
  const n = img.rows * img.cols;
  const out = new ImageData(img.cols, img.rows);
  const d = out.data;
  if (img.rgb) {
    const o = frame * n * 3;
    for (let i = 0; i < n; i++) {
      d[i * 4] = img.pixels[o + i * 3]; d[i * 4 + 1] = img.pixels[o + i * 3 + 1]; d[i * 4 + 2] = img.pixels[o + i * 3 + 2]; d[i * 4 + 3] = 255;
    }
    return out;
  }
  const o = frame * n;
  const lo = wc - 0.5 - (ww - 1) / 2;
  const scale = 255 / Math.max(1, ww - 1);
  const flip = img.mono1 !== invert;
  const { slope, intercept, pixels } = img;
  for (let i = 0; i < n; i++) {
    let v = ((pixels[o + i] * slope + intercept) - lo) * scale;
    v = v < 0 ? 0 : v > 255 ? 255 : v;
    if (flip) v = 255 - v;
    const j = i * 4;
    d[j] = d[j + 1] = d[j + 2] = v;
    d[j + 3] = 255;
  }
  return out;
}

// ---------------------------------------------------------------- types & presets
type Series = { id: number; series_number: number; description: string; modality: string; num_instances: number; instances: { id: number; instance_number: number }[] };
type Study = { id: number; series: Series[]; description?: string; accession?: string; modality?: string; patient_name?: string; study_date?: string };
type Tool = 'wl' | 'pan' | 'zoom' | 'length' | 'roi';
type Pt = { x: number; y: number };
type Measure = { kind: 'length' | 'roi'; a: Pt; b: Pt; label: string };

const PRESETS: Record<string, { label: string; wc: number; ww: number }[]> = {
  CT: [
    { label: 'Soft tissue', wc: 40, ww: 400 }, { label: 'Lung', wc: -600, ww: 1500 }, { label: 'Bone', wc: 400, ww: 1800 },
    { label: 'Brain', wc: 40, ww: 80 }, { label: 'Stroke', wc: 35, ww: 40 }, { label: 'Abdomen', wc: 60, ww: 350 }, { label: 'Liver', wc: 80, ww: 150 },
  ],
};

// ---------------------------------------------------------------- thumbnails
function Thumb({ instanceId, active, label, count, onClick }: { instanceId?: number; active: boolean; label: string; count: number; onClick: () => void }) {
  const loadInstance=useInstanceLoader();
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!instanceId) return;
    let live = true;
    loadInstance(instanceId).then((img) => {
      if (!live || img.error || !ref.current) return;
      const off = document.createElement('canvas');
      off.width = img.cols; off.height = img.rows;
      off.getContext('2d')!.putImageData(paint(img, 0, img.wc, img.ww, false), 0, 0);
      const c = ref.current, ctx = c.getContext('2d')!;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, c.width, c.height);
      const s = Math.min(c.width / img.cols, c.height / img.rows);
      ctx.drawImage(off, (c.width - img.cols * s) / 2, (c.height - img.rows * s) / 2, img.cols * s, img.rows * s);
    }).catch(() => {});
    return () => { live = false; };
  }, [instanceId]);
  return (
    <DiagnosticButton onClick={onClick} className={`w-full rounded border p-1 text-left ${active ? 'border-film-measure bg-white/5' : 'border-white/10 hover:border-white/30'}`} title={label}>
      <canvas ref={ref} width={96} height={96} className="block h-[72px] w-full bg-black object-contain" />
      <div className="mt-1 truncate text-[11px] text-white/80">{label}</div>
      <div className="text-[10px] text-white/45">{count} <ReferenceText message="image" />{count === 1 ? '' : 's'}</div>
    </DiagnosticButton>
  );
}

// ---------------------------------------------------------------- viewer
export default function DicomViewer({
  studyId, onMeasure, className = '', showThumbnails = true, onExpand,
}: { studyId: number; onMeasure?: (text: string) => void; className?: string; showThumbnails?: boolean; onExpand?: () => void }) {
 const referenceT = useReferenceLocalization().t;

 const {fetch}=useDiagnosticClient();
 const loadInstance=useInstanceLoader();

  const [study, setStudy] = useState<Study | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [seriesIdx, setSeriesIdx] = useState(0);
  const [slice, setSlice] = useState(0);
  const [frame, setFrame] = useState(0);
  const [img, setImg] = useState<Img | null>(null);
  const [wl, setWl] = useState<{ wc: number; ww: number } | null>(null);
  const [invert, setInvert] = useState(false);
  const [view, setView] = useState({ zoom: 1, px: 0, py: 0 });
  const [tool, setTool] = useState<Tool>('wl');
  const [playing, setPlaying] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [measures, setMeasures] = useState<Record<string, Measure[]>>({});
  const [draft, setDraft] = useState<Measure | null>(null);
  const [loaded, setLoaded] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const offRef = useRef<HTMLCanvasElement | null>(null);
  const drag = useRef<{ x: number; y: number; button: number; start: Pt | null; wl: { wc: number; ww: number }; view: typeof view } | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const series = study?.series[seriesIdx];
  const instances = series?.instances || [];
  const inst = instances[Math.min(slice, instances.length - 1)];
  const key = `${inst?.id}:${frame}`;

  // load study
  useEffect(() => {
    let live = true;
    setStudy(null); setErr(null); setSeriesIdx(0); setSlice(0); setMeasures({});
    fetch(`/api/dicom/studies/${studyId}`, { cache: 'no-store' })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Study not found'); return j; })
      .then((s) => live && setStudy(s))
      .catch((e) => live && setErr(e.message));
    return () => { live = false; };
  }, [studyId]);

  // choose middle slice for stacks, reset view on series change
  useEffect(() => {
    if (!series) return;
    setSlice(series.instances.length > 6 ? Math.floor(series.instances.length / 2) : 0);
    setFrame(0); setWl(null); setPlaying(false);
  }, [seriesIdx, series]);

  // prefetch series
  useEffect(() => {
    if (!series) return;
    let live = true;
    setLoaded(0);
    const ids = series.instances.map((i) => i.id);
    let n = 0;
    const next = async () => {
      while (live && ids.length) {
        const id = ids.shift()!;
        try { await loadInstance(id); } catch { /* shown when viewed */ }
        n++; if (live) setLoaded(n);
      }
    };
    Promise.all([next(), next(), next(), next()]);
    return () => { live = false; };
  }, [series]);

  // load current image
  useEffect(() => {
    if (!inst) return;
    let live = true;
    loadInstance(inst.id).then((i) => { if (live) { setImg(i); setWl((w) => w || { wc: i.wc, ww: i.ww }); } }).catch((e) => live && setErr(e.message));
    return () => { live = false; };
  }, [inst]);

  // container size
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [study]);

  // repaint offscreen when image / WL changes
  useEffect(() => {
    if (!img || img.error || !wl) { offRef.current = null; return; }
    const off = offRef.current || document.createElement('canvas');
    off.width = img.cols; off.height = img.rows;
    off.getContext('2d')!.putImageData(paint(img, Math.min(frame, img.frames - 1), wl.wc, wl.ww, invert), 0, 0);
    offRef.current = off;
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img, wl, invert, frame]);

  const geometry = useCallback(() => {
    if (!img) return { s: 1, ox: 0, oy: 0 };
    const fit = Math.min(size.w / img.cols, size.h / img.rows) || 1;
    const s = fit * view.zoom;
    return { s, ox: (size.w - img.cols * s) / 2 + view.px, oy: (size.h - img.rows * s) / 2 + view.py };
  }, [img, size, view]);

  const draw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== size.w * dpr || c.height !== size.h * dpr) { c.width = size.w * dpr; c.height = size.h * dpr; }
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, size.w, size.h);
    if (!img || !offRef.current) return;
    const { s, ox, oy } = geometry();
    ctx.imageSmoothingEnabled = s < 3;
    ctx.drawImage(offRef.current, ox, oy, img.cols * s, img.rows * s);
    const list = [...(measures[key] || []), ...(draft ? [draft] : [])];
    ctx.lineWidth = 1.5;
    ctx.font = '600 12px "Atkinson Hyperlegible", system-ui, sans-serif';
    for (const m of list) {
      const ax = ox + m.a.x * s, ay = oy + m.a.y * s, bx = ox + m.b.x * s, by = oy + m.b.y * s;
      ctx.strokeStyle = '#F5A524'; ctx.fillStyle = '#F5A524';
      ctx.beginPath();
      if (m.kind === 'length') {
        ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        for (const [x, y] of [[ax, ay], [bx, by]]) { ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill(); }
      } else {
        ctx.strokeRect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay));
      }
      const tx = Math.max(ax, bx) + 6, ty = Math.min(ay, by) - 6;
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.85)';
      m.label.split('\n').forEach((line, i) => { ctx.strokeText(line, tx, ty + i * 14); ctx.fillText(line, tx, ty + i * 14); });
      ctx.lineWidth = 1.5;
    }
  }, [img, size, geometry, measures, key, draft]);

  useEffect(() => { draw(); }, [draw]);

  // cine
  useEffect(() => {
    if (!playing) return;
    const multi = img && img.frames > 1;
    const t = setInterval(() => {
      if (multi) setFrame((f) => (f + 1) % img!.frames);
      else setSlice((i) => (i + 1) % Math.max(1, instances.length));
    }, 1000 / 12);
    return () => clearInterval(t);
  }, [playing, instances.length, img]);

  const step = useCallback((d: number) => {
    if (img && img.frames > 1) setFrame((f) => Math.min(img.frames - 1, Math.max(0, f + d)));
    else setSlice((i) => Math.min(instances.length - 1, Math.max(0, i + d)));
  }, [img, instances.length]);

  // wheel with passive:false so the page does not scroll
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const h = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) setView((v) => ({ ...v, zoom: Math.min(20, Math.max(0.2, v.zoom * (e.deltaY < 0 ? 1.1 : 0.9))) }));
      else step(e.deltaY > 0 ? 1 : -1);
    };
    c.addEventListener('wheel', h, { passive: false });
    return () => c.removeEventListener('wheel', h);
  }, [step, study]);

  const toImage = (e: React.PointerEvent): Pt => {
    const r = canvasRef.current!.getBoundingClientRect();
    const { s, ox, oy } = geometry();
    return { x: (e.clientX - r.left - ox) / s, y: (e.clientY - r.top - oy) / s };
  };

  const measureLabel = (m: Omit<Measure, 'label'>): string => {
    if (!img) return '';
    const [rs, cs] = img.spacing || [0, 0];
    if (m.kind === 'length') {
      const dx = m.b.x - m.a.x, dy = m.b.y - m.a.y;
      return img.spacing ? `${Math.hypot(dx * cs, dy * rs).toFixed(1)} mm` : `${Math.hypot(dx, dy).toFixed(0)} px`;
    }
    const x0 = Math.max(0, Math.floor(Math.min(m.a.x, m.b.x))), x1 = Math.min(img.cols - 1, Math.ceil(Math.max(m.a.x, m.b.x)));
    const y0 = Math.max(0, Math.floor(Math.min(m.a.y, m.b.y))), y1 = Math.min(img.rows - 1, Math.ceil(Math.max(m.a.y, m.b.y)));
    let sum = 0, sq = 0, n = 0;
    const o = Math.min(frame, img.frames - 1) * img.rows * img.cols;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const v = img.pixels[o + y * img.cols + x] * img.slope + img.intercept; sum += v; sq += v * v; n++;
    }
    if (!n) return '';
    const mean = sum / n, sd = Math.sqrt(Math.max(0, sq / n - mean * mean));
    const unit = img.meta.modality === 'CT' ? ' HU' : '';
    const area = img.spacing ? `${((n * rs * cs) / 100).toFixed(2)} cm²` : `${n} px`;
    return `Mean ${mean.toFixed(1)}${unit} SD ${sd.toFixed(1)}\n${area}`;
  };

  const onDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    const p = toImage(e);
    drag.current = { x: e.clientX, y: e.clientY, button: e.button, start: p, wl: wl || { wc: 0, ww: 1 }, view };
    const t = e.button === 1 || e.shiftKey ? 'pan' : e.button === 2 ? 'zoom' : tool;
    if (t === 'length' || t === 'roi') setDraft({ kind: t, a: p, b: p, label: '' });
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    const t = d.button === 1 || e.shiftKey ? 'pan' : d.button === 2 ? 'zoom' : tool;
    if (t === 'wl') {
      const k = Math.max(1, d.wl.ww / 300);
      setWl({ wc: d.wl.wc + dy * k, ww: Math.max(1, d.wl.ww + dx * k * 2) });
    } else if (t === 'pan') setView({ ...d.view, px: d.view.px + dx, py: d.view.py + dy });
    else if (t === 'zoom') setView({ ...d.view, zoom: Math.min(20, Math.max(0.2, d.view.zoom * Math.exp(-dy / 200))) });
    else if (draft && d.start) {
      const b = toImage(e);
      setDraft({ ...draft, b, label: measureLabel({ kind: draft.kind, a: d.start, b }) });
    }
  };
  const onUp = () => {
    drag.current = null;
    if (draft) {
      const moved = Math.hypot(draft.b.x - draft.a.x, draft.b.y - draft.a.y) > 2;
      if (moved) {
        setMeasures((m) => ({ ...m, [key]: [...(m[key] || []), draft] }));
        if (onMeasure && series) {
          const where = `series ${series.series_number}, image ${slice + 1}`;
          onMeasure(draft.kind === 'length' ? `${draft.label} (${where})` : `ROI ${draft.label.replace('\n', ', ')} (${where})`);
        }
      }
      setDraft(null);
    }
  };

  const reset = () => { if (img) setWl({ wc: img.wc, ww: img.ww }); setView({ zoom: 1, px: 0, py: 0 }); setInvert(false); setMeasures((m) => ({ ...m, [key]: [] })); };

  // keyboard
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    else if (e.key === 'r') reset();
    else if (e.key === 'i') setInvert((v) => !v);
    else if (e.key === ' ') { e.preventDefault(); setPlaying((p) => !p); }
  };

  const presets = useMemo(() => PRESETS[img?.meta.modality || ''] || [], [img]);
  const fmtDate = (d?: string) => (d && d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}` : d || '');

  if (err) return <div className={`film flex items-center justify-center bg-black p-6 text-center text-sm text-white/70 ${className}`}>{err}</div>;
  if (!study) return <div className={`film flex items-center justify-center bg-black text-white/60 ${className}`}><Loader2 className="mr-2 animate-spin" size={18} /><ReferenceText message="Loading study" /></div>;
  if (!study.series.length) return <div className={`film flex items-center justify-center bg-black text-sm text-white/60 ${className}`}><ReferenceText message="This study has no images." /></div>;

  const toolBtn = (t: Tool, Icon: any, label: string) => (
    <DiagnosticButton key={t} onClick={() => setTool(t)} title={label} aria-label={label} aria-pressed={tool === t}
      className={`flex h-8 items-center gap-1.5 rounded px-2 text-xs font-bold ${tool === t ? 'bg-film-measure text-black' : 'text-white/80 hover:bg-white/10'}`}>
      <Icon size={15} /><span className="hidden min-[1800px]:inline">{label}</span>
    </DiagnosticButton>
  );
  const total = img && img.frames > 1 ? img.frames : instances.length;
  const pos = img && img.frames > 1 ? frame : slice;

  return (
    <div className={`film flex min-h-0 flex-col bg-film-2 text-white ${className}`}>
      <div className="flex flex-wrap items-center gap-1 border-b border-white/10 bg-film-3 px-2 py-1.5">
        {toolBtn('wl', Contrast, 'Window')}
        {toolBtn('pan', Move, 'Pan')}
        {toolBtn('zoom', ZoomIn, 'Zoom')}
        {toolBtn('length', Ruler, 'Length')}
        {toolBtn('roi', Square, 'ROI')}
        <span className="mx-1 h-5 w-px bg-white/15" />
        {presets.length > 0 && (
          <DiagnosticSelect className="h-8 w-[118px] rounded border border-white/15 bg-black px-1.5 text-xs text-white/90" aria-label={referenceT("Window preset")} value=""
            onChange={(e) => { const p = presets[Number(e.target.value)]; if (p) setWl({ wc: p.wc, ww: p.ww }); }}>
            <option value=""><ReferenceText message="Preset…" /></option>
            {presets.map((p, i) => <option key={p.label} value={i}><ReferenceText message={p.label} /> ({p.wc}/{p.ww})</option>)}
          </DiagnosticSelect>
        )}
        <DiagnosticButton onClick={() => setInvert((v) => !v)} title={referenceT("Invert (I)")} aria-pressed={invert} className={`flex h-8 items-center rounded px-2 ${invert ? 'bg-white/20' : 'hover:bg-white/10'}`}><SunMoon size={15} /></DiagnosticButton>
        {total > 1 && (
          <DiagnosticButton onClick={() => setPlaying((p) => !p)} title={referenceT("Cine (space)")} className="flex h-8 items-center rounded px-2 hover:bg-white/10">{playing ? <Pause size={15} /> : <Play size={15} />}</DiagnosticButton>
        )}
        <DiagnosticButton onClick={reset} title={referenceT("Reset (R)")} className="flex h-8 items-center rounded px-2 hover:bg-white/10"><RotateCcw size={15} /></DiagnosticButton>
        <DiagnosticButton onClick={() => setShowTags((v) => !v)} title={referenceT("DICOM tags")} aria-pressed={showTags} className={`flex h-8 items-center rounded px-2 ${showTags ? 'bg-white/20' : 'hover:bg-white/10'}`}><Tags size={15} /></DiagnosticButton>
        {onExpand && <DiagnosticButton onClick={onExpand} title={referenceT("Open full screen")} className="ml-auto flex h-8 items-center rounded px-2 hover:bg-white/10"><Maximize2 size={15} /></DiagnosticButton>}
      </div>

      <div className="flex min-h-0 flex-1">
        {showThumbnails && study.series.length > 0 && (
          <div className="scroll-thin w-[104px] shrink-0 space-y-1.5 overflow-y-auto border-r border-white/10 p-1.5">
            {study.series.map((s, i) => (
              <Thumb key={s.id} instanceId={s.instances[Math.floor(s.instances.length / 2)]?.id} active={i === seriesIdx}
                label={referenceT("{value0}: {value1}", {value0: s.series_number, value1: s.description || s.modality})} count={s.instances.length} onClick={() => setSeriesIdx(i)} />
            ))}
          </div>
        )}
        <div ref={boxRef} className="relative min-h-0 min-w-0 flex-1 select-none outline-none" tabIndex={0} onKeyDown={onKey} aria-label={referenceT("Image viewport. Scroll or use arrow keys to change image.")}>
          <canvas ref={canvasRef} className={`absolute inset-0 h-full w-full touch-none ${tool === 'pan' ? 'cursor-move' : tool === 'wl' ? 'cursor-ns-resize' : 'cursor-crosshair'}`}
            style={{ width: size.w, height: size.h }}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onContextMenu={(e) => e.preventDefault()} />
          {img?.error && <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white/70">{img.error}</div>}
          {img && !img.error && (
            <div className="pointer-events-none absolute inset-0 p-2.5 font-mono text-[11.5px] leading-[1.35] text-film-text [text-shadow:0_1px_2px_#000]">
              <div className="absolute left-2.5 top-2">
                <div className="font-bold">{img.meta.name}</div>
                <div>{img.meta.pid}</div>
                <div>{fmtDate(img.meta.dob)} {img.meta.sex}</div>
                <div><ReferenceText message="Acc" /> {img.meta.accession}</div>
              </div>
              <div className="absolute right-2.5 top-2 text-right">
                <div>{img.meta.institution}</div>
                <div>{img.meta.studyDesc}</div>
                <div>{fmtDate(img.meta.studyDate)}</div>
                {img.meta.view && <div>{img.meta.view}</div>}
              </div>
              <div className="absolute bottom-2 left-2.5">
                <div><ReferenceText message="Se" /> {img.meta.series}: {img.meta.seriesDesc}</div>
                <div><ReferenceText message="Im" /> {pos + 1}/{total}{img.frames > 1 ? ' (frames)' : ''}</div>
                {img.meta.thickness && <div><ReferenceText message="Thk" /> {parseFloat(img.meta.thickness).toFixed(1)} <ReferenceText message="mm" /></div>}
                {img.meta.kvp && <div>{img.meta.kvp} <ReferenceText message="kV" /></div>}
              </div>
              <div className="absolute bottom-2 right-2.5 text-right">
                <div><ReferenceText message="W" /> {Math.round(wl?.ww || 0)} <ReferenceText message="L" /> {Math.round(wl?.wc || 0)}</div>
                <div><ReferenceText message="Zoom" /> {(view.zoom * 100).toFixed(0)}%</div>
                <div>{img.cols}×{img.rows}{img.spacing ? ` · ${img.spacing[1].toFixed(2)} mm/px` : ''}</div>
                {loaded < instances.length && <div className="text-white/50"><ReferenceText message="Loading" /> {loaded}/{instances.length}</div>}
              </div>
            </div>
          )}
          {total > 1 && (
            <div className="absolute bottom-0 right-0 top-0 flex w-5 flex-col items-center py-12">
              <DiagnosticInput type="range" min={0} max={total - 1} value={pos} aria-label={referenceT("Image position")}
                onChange={(e) => (img && img.frames > 1 ? setFrame(Number(e.target.value)) : setSlice(Number(e.target.value)))}
                className="h-full w-4 accent-[#F5A524] [writing-mode:vertical-lr]" />
            </div>
          )}
        </div>
        {showTags && img && (
          <div className="scroll-thin w-[300px] shrink-0 overflow-y-auto border-l border-white/10 bg-film-3 p-2 text-[11.5px]">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-bold text-white/90"><ReferenceText message="DICOM header" /></span>
              <span className="text-white/45">{img.tags.length} <ReferenceText message="tags" /></span>
            </div>
            <DiagnosticTable className="w-full">
              <TableBody>
                {img.tags.map((t) => (
                  <TableRow key={t.tag} className="align-top">
                    <TableCell className="py-0.5 pr-2 font-mono text-white/40">{t.tag}</TableCell>
                    <TableCell className="py-0.5 pr-2 text-white/65">{t.name}</TableCell>
                    <TableCell className="break-all py-0.5 font-mono text-white/90">{t.value}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </DiagnosticTable>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between border-t border-white/10 bg-film-3 px-2 py-1 text-[11px] text-white/55">
        <div className="flex items-center gap-1">
          <DiagnosticButton className="rounded p-0.5 hover:bg-white/10" onClick={() => setSeriesIdx((i) => Math.max(0, i - 1))} aria-label={referenceT("Previous series")}><ChevronLeft size={14} /></DiagnosticButton><ReferenceText message="Series" />{seriesIdx + 1} <ReferenceText message="of" /> {study.series.length}
          <DiagnosticButton className="rounded p-0.5 hover:bg-white/10" onClick={() => setSeriesIdx((i) => Math.min(study.series.length - 1, i + 1))} aria-label={referenceT("Next series")}><ChevronRight size={14} /></DiagnosticButton>
        </div>
        <div className="hidden sm:block"><ReferenceText message="Wheel: scroll · Ctrl+wheel: zoom · Shift-drag: pan · Right-drag: zoom · R reset · I invert" /></div>
      </div>
    </div>
  );
}
