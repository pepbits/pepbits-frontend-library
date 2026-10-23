/**
 * Where each floating window sits.
 *
 * Geometry only. Which documents exist, which is focused and which are dirty
 * are all the workspace store's answers -- §29 is explicit that MDI consumes
 * the same core rather than introducing a second record-management system, and
 * a frame here is nothing more than a rectangle with an id on it.
 */
export interface MdiFrame {
  documentId: string;
  /** Kept so a remembered size can be looked up without touching the store. */
  documentType: string;
  x: number;
  y: number;
  width: number;
  height: number;
  minimised: boolean;
  z: number;
}

export interface FrameBounds { width: number; height: number }
export interface FrameSize { width: number; height: number }

const STEP = 28;
const MARGIN = 12;
const DEFAULT: FrameSize = { width: 760, height: 520 };
const STORAGE_KEY = "pepbits-mdi-frames";

/**
 * Where the nth window opens.
 *
 * Stepped, so a second window does not land exactly on the first and read as
 * the first one having moved. Wrapped, because the alternative is a fifth
 * window opening below the fold -- and a window nobody can see is a window
 * nobody can close.
 */
export function cascade(index: number, bounds: FrameBounds, size: FrameSize = DEFAULT): Omit<MdiFrame, "documentId" | "documentType" | "z" | "minimised"> {
  const width = Math.min(size.width, Math.max(240, bounds.width - MARGIN * 2));
  const height = Math.min(size.height, Math.max(180, bounds.height - MARGIN * 2));
  const acrossRoom = Math.max(1, Math.floor((bounds.width - width - MARGIN) / STEP));
  const downRoom = Math.max(1, Math.floor((bounds.height - height - MARGIN) / STEP));
  const slots = Math.max(1, Math.min(acrossRoom, downRoom));
  const slot = index % slots;
  return { x: MARGIN + slot * STEP, y: MARGIN + slot * STEP, width, height };
}

/** Pull a frame back inside, and shrink it if it no longer fits at all. */
export function clampFrame(frame: MdiFrame, bounds: FrameBounds): MdiFrame {
  const width = Math.min(frame.width, bounds.width);
  const height = Math.min(frame.height, bounds.height);
  const x = Math.max(0, Math.min(frame.x, bounds.width - width));
  const y = Math.max(0, Math.min(frame.y, bounds.height - height));
  /* Identity is preserved when nothing moved, so a resize that changes nothing
     does not re-render every window. */
  if (width === frame.width && height === frame.height && x === frame.x && y === frame.y) return frame;
  return { ...frame, x, y, width, height };
}

/**
 * Raise one frame above the rest.
 *
 * Only the named frame's z changes. Renumbering the whole stack would reorder
 * windows the user never touched, so clicking one thing would rearrange
 * everything behind it.
 */
export function bringToFront(frames: MdiFrame[], documentId: string): MdiFrame[] {
  const top = frames.reduce((highest, frame) => Math.max(highest, frame.z), 0);
  const target = frames.find((frame) => frame.documentId === documentId);
  if (!target || target.z === top) return frames;
  return frames.map((frame) => (frame.documentId === documentId ? { ...frame, z: top + 1 } : frame));
}

/** Minimise or restore, keeping the geometry either way. */
export function toggleMinimised(frames: MdiFrame[], documentId: string): MdiFrame[] {
  const target = frames.find((frame) => frame.documentId === documentId);
  if (!target) return frames;
  /* Restoring raises it: a window that comes back behind three others reads as
     not having come back. Minimising leaves the stack alone. */
  const next = frames.map((frame) => (frame.documentId === documentId ? { ...frame, minimised: !frame.minimised } : frame));
  return target.minimised ? bringToFront(next, documentId) : next;
}

/**
 * Make the frames match the open documents.
 *
 * New documents get a frame, closed ones lose theirs, and a frame the user has
 * moved is returned untouched -- opening a second window must not rearrange the
 * first.
 */
export function syncFrames(
  frames: MdiFrame[],
  documents: Array<{ documentId: string; documentType: string }>,
  bounds: FrameBounds,
  sizes: Record<string, FrameSize> = {},
): MdiFrame[] {
  const open = new Set(documents.map((doc) => doc.documentId));
  const kept = frames.filter((frame) => open.has(frame.documentId));
  const missing = documents.filter((doc) => !frames.some((frame) => frame.documentId === doc.documentId));
  if (kept.length === frames.length && missing.length === 0) return frames;

  let top = kept.reduce((highest, frame) => Math.max(highest, frame.z), 0);
  const added = missing.map((doc, offset) => ({
    documentId: doc.documentId,
    documentType: doc.documentType,
    minimised: false,
    z: ++top,
    ...cascade(kept.length + offset, bounds, sizes[doc.documentType] ?? DEFAULT),
  }));
  return [...kept, ...added];
}

/* Keyed by document TYPE, never by record. "How big I like an record window"
   is the memory worth keeping, and it puts no record identifier into local
   storage at all -- §17.7 asks for the minimum to be kept there, and this is
   less than the minimum. */
export function readFrameSizes(): Record<string, FrameSize> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const sizes: Record<string, FrameSize> = {};
    for (const [type, value] of Object.entries(parsed)) {
      const size = value as Partial<FrameSize>;
      /* Whatever is in storage was put there by an older build, by another tab,
         or by hand. A width of "wide" would otherwise become a CSS value of
         "widepx" and the window would render at its minimum. */
      if (typeof size?.width === "number" && typeof size?.height === "number") {
        sizes[type] = { width: size.width, height: size.height };
      }
    }
    return sizes;
  } catch {
    return {};
  }
}

export function writeFrameSizes(sizes: Record<string, FrameSize>): void {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sizes)); } catch { /* storage unavailable */ }
}
