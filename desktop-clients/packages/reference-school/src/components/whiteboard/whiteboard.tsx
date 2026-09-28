"use client";

import {
  ArrowUpRight, ChevronLeft, ChevronRight, Circle, Download, Eraser, FilePlus2, Grid3x3, Highlighter, Minus, Pencil, Redo2,
  Square, Trash2, Type, Undo2, X, type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { useShortcutsEnabled } from "../../lib/format";
import { Textarea } from "../../ui";
import { cn } from "../../lib/utils";
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


type Tool = "pen" | "highlighter" | "eraser" | "line" | "arrow" | "rect" | "ellipse" | "text";
type Pt = [number, number];
type Shape =
  | { kind: "free"; tool: "pen" | "highlighter" | "eraser"; points: Pt[]; color: string; width: number }
  | { kind: "geo"; tool: "line" | "arrow" | "rect" | "ellipse"; a: Pt; b: Pt; color: string; width: number; fill: boolean }
  | { kind: "text"; at: Pt; text: string; color: string; size: number };
interface Page { history: Shape[][]; at: number }

const TOOLS: { id: Tool; icon: LucideIcon; label: string; key: string }[] = [
  { id: "pen", icon: Pencil, label: "Pen", key: "p" }, { id: "highlighter", icon: Highlighter, label: "Highlighter", key: "h" },
  { id: "eraser", icon: Eraser, label: "Eraser", key: "e" }, { id: "line", icon: Minus, label: "Line", key: "l" },
  { id: "arrow", icon: ArrowUpRight, label: "Arrow", key: "a" }, { id: "rect", icon: Square, label: "Rectangle", key: "r" },
  { id: "ellipse", icon: Circle, label: "Ellipse", key: "o" }, { id: "text", icon: Type, label: "Text", key: "t" },
];
const COLORS = ["#111827", "#ffffff", "#dc2626", "#ea580c", "#ca8a04", "#16a34a", "#2563eb", "#7c3aed"];
const SIZES = [2, 4, 8, 14];
const newPage = (): Page => ({ history: [[]], at: 0 });

const FALLBACK_FONT = "ui-sans-serif, system-ui, sans-serif";

/** `fontFamily` is the canvas element's computed family, i.e. the host's selected UI font. */
function drawShape(ctx: CanvasRenderingContext2D, s: Shape, fontFamily = FALLBACK_FONT) {
  ctx.save();
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  if (s.kind === "text") {
    ctx.fillStyle = s.color; ctx.font = `500 ${s.size}px ${fontFamily}`; ctx.textBaseline = "top";
    s.text.split("\n").forEach((line, i) => ctx.fillText(line, s.at[0], s.at[1] + i * s.size * 1.25));
  } else if (s.kind === "free") {
    ctx.strokeStyle = s.color; ctx.lineWidth = s.tool === "highlighter" ? s.width * 3 : s.tool === "eraser" ? s.width * 4 : s.width;
    if (s.tool === "highlighter") ctx.globalAlpha = 0.35;
    if (s.tool === "eraser") ctx.globalCompositeOperation = "destination-out";
    const p = s.points;
    ctx.beginPath();
    ctx.moveTo(p[0]![0], p[0]![1]);
    if (p.length === 1) ctx.lineTo(p[0]![0] + 0.01, p[0]![1]);
    for (let i = 1; i < p.length - 1; i++) {
      const mx = (p[i]![0] + p[i + 1]![0]) / 2, my = (p[i]![1] + p[i + 1]![1]) / 2;
      ctx.quadraticCurveTo(p[i]![0], p[i]![1], mx, my);
    }
    if (p.length > 1) ctx.lineTo(p.at(-1)![0], p.at(-1)![1]);
    ctx.stroke();
  } else {
    const [x1, y1] = s.a, [x2, y2] = s.b;
    ctx.strokeStyle = s.color; ctx.fillStyle = s.color; ctx.lineWidth = s.width;
    ctx.beginPath();
    if (s.tool === "rect") ctx.rect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
    else if (s.tool === "ellipse") ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2, 0, 0, Math.PI * 2);
    else { ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); }
    if (s.fill && (s.tool === "rect" || s.tool === "ellipse")) { ctx.globalAlpha = 0.18; ctx.fill(); ctx.globalAlpha = 1; }
    ctx.stroke();
    if (s.tool === "arrow") {
      const ang = Math.atan2(y2 - y1, x2 - x1), h = 8 + s.width * 2.5;
      ctx.beginPath(); ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - h * Math.cos(ang - Math.PI / 7), y2 - h * Math.sin(ang - Math.PI / 7));
      ctx.lineTo(x2 - h * Math.cos(ang + Math.PI / 7), y2 - h * Math.sin(ang + Math.PI / 7));
      ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
}

/**
 * Canvas whiteboard with pens, shapes, text, undo/redo, multiple pages and PNG export.
 * Works with mouse, touch and stylus through pointer events, and stays sharp on high-DPI screens.
 * Text is drawn in the host's selected font (the canvas's computed font family). Stroke widths and text sizes are
 * drawing geometry chosen by the author, so they do not follow the UI font-scale preferences.
 * "Download PNG" saves the author's own raster drawing. It is not a tabular export, so the CSV/XLSX exportFormat
 * preference and its policy do not apply to it; it is kept as in the source.
 * Specialized editor markup (no shared canvas primitive exists). Pages are transient component state: nothing is
 * written to storage, and leaving the page discards them unless downloaded. Tool keys follow the shortcut preference.
 */
export function Whiteboard({ className, dark = false, compact = false, title = "Whiteboard" }: { className?: string; dark?: boolean; compact?: boolean; title?: string }) {
 const referenceT = useReferenceLocalization().t;

  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const size = useRef({ w: 0, h: 0 });
  const drawing = useRef<Shape | null>(null);
  const [pages, setPages] = useState<Page[]>([newPage()]);
  const [pi, setPi] = useState(0);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(dark ? "#ffffff" : "#111827");
  const [width, setWidth] = useState(4);
  const [fill, setFill] = useState(false);
  const [grid, setGrid] = useState(true);
  const [text, setText] = useState<{ at: Pt; value: string } | null>(null);
  const shortcuts = useShortcutsEnabled();

  const page = pages[pi]!;
  const shapes = page.history[page.at]!;

  const render = useCallback(() => {
    const c = canvas.current; if (!c) return;
    const ctx = c.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.current.w, size.current.h);
    const family = getComputedStyle(c).fontFamily || FALLBACK_FONT;
    for (const s of shapes) drawShape(ctx, s, family);
    if (drawing.current) drawShape(ctx, drawing.current, family);
  }, [shapes]);

  useEffect(() => {
    const el = wrap.current, c = canvas.current; if (!el || !c) return;
    const ro = new ResizeObserver(() => {
      const { width: w, height: h } = el.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      size.current = { w, h };
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      c.style.width = `${w}px`; c.style.height = `${h}px`;
      render();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [render]);
  useEffect(render, [render]);

  const commit = useCallback((s: Shape) => {
    setPages((ps) => ps.map((p, k) => (k !== pi ? p : { history: [...p.history.slice(0, p.at + 1), [...p.history[p.at]!, s]], at: p.at + 1 })));
  }, [pi]);
  const undo = useCallback(() => setPages((ps) => ps.map((p, k) => (k === pi ? { ...p, at: Math.max(0, p.at - 1) } : p))), [pi]);
  const redo = useCallback(() => setPages((ps) => ps.map((p, k) => (k === pi ? { ...p, at: Math.min(p.history.length - 1, p.at + 1) } : p))), [pi]);
  const clear = () => setPages((ps) => ps.map((p, k) => (k !== pi || !p.history[p.at]!.length ? p : { history: [...p.history.slice(0, p.at + 1), []], at: p.at + 1 })));

  const pos = (e: RPointerEvent): Pt => { const r = canvas.current!.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const onDown = (e: RPointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const p = pos(e);
    if (tool === "text") { if (text?.value.trim()) commitText(); setText({ at: p, value: "" }); return; }
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = tool === "pen" || tool === "highlighter" || tool === "eraser"
      ? { kind: "free", tool, points: [p], color, width }
      : { kind: "geo", tool, a: p, b: p, color, width, fill };
    render();
  };
  const onMove = (e: RPointerEvent<HTMLCanvasElement>) => {
    const d = drawing.current; if (!d) return;
    const p = pos(e);
    if (d.kind === "free") d.points.push(p);
    else if (d.kind === "geo") {
      // Shift constrains lines to 45° steps and shapes to squares/circles.
      if (e.shiftKey) {
        const dx = p[0] - d.a[0], dy = p[1] - d.a[1];
        if (d.tool === "line" || d.tool === "arrow") { const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4); const len = Math.hypot(dx, dy); d.b = [d.a[0] + Math.cos(ang) * len, d.a[1] + Math.sin(ang) * len]; }
        else { const m = Math.max(Math.abs(dx), Math.abs(dy)); d.b = [d.a[0] + Math.sign(dx || 1) * m, d.a[1] + Math.sign(dy || 1) * m]; }
      } else d.b = p;
    }
    requestAnimationFrame(render);
  };
  const onUp = () => {
    const d = drawing.current; if (!d) return;
    drawing.current = null;
    if (d.kind === "geo" && Math.hypot(d.b[0] - d.a[0], d.b[1] - d.a[1]) < 3) return render();
    commit(d);
  };
  const commitText = () => {
    if (text && text.value.trim()) commit({ kind: "text", at: text.at, text: text.value, color, size: 12 + width * 2 });
    setText(null);
  };

  useEffect(() => {
    if (!shortcuts) return;
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || !wrap.current?.isConnected) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) { redo(); } else { undo(); } return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tl = TOOLS.find((x) => x.key === e.key.toLowerCase()); if (tl) setTool(tl.id);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [undo, redo, shortcuts]);

  const exportPng = () => {
    const { w, h } = size.current;
    const out = document.createElement("canvas");
    const dpr = window.devicePixelRatio || 1;
    out.width = w * dpr; out.height = h * dpr;
    const ctx = out.getContext("2d")!;
    ctx.fillStyle = dark ? "#0f172a" : "#ffffff"; ctx.fillRect(0, 0, out.width, out.height);
    if (grid) {
      ctx.scale(dpr, dpr); ctx.strokeStyle = dark ? "rgba(255,255,255,.07)" : "rgba(15,23,42,.07)"; ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y < h; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    ctx.drawImage(canvas.current!, 0, 0);
    const a = document.createElement("a");
    a.href = out.toDataURL("image/png"); a.download = `${title.toLowerCase().replace(/\W+/g, "-")}-page-${pi + 1}.png`; a.click();
  };

  const btn = (active: boolean) => cn("grid size-7 place-items-center rounded-md transition", active ? "bg-brand text-brand-fg" : dark ? "text-slate-300 hover:bg-white/10" : "text-muted hover:bg-subtle hover:text-fg");
  const sep = <span className={cn("mx-0.5 h-5 w-px", dark ? "bg-white/15" : "bg-line")} />;
  const cursor = tool === "text" ? "text" : tool === "eraser" ? "cell" : "crosshair";

  return (
    <div className={cn("flex min-h-0 flex-col overflow-hidden rounded-lg border", dark ? "border-white/10 bg-slate-900" : "border-line bg-surface", className)}>
      <div className={cn("flex flex-wrap items-center gap-0.5 border-b px-1.5 py-1", dark ? "border-white/10" : "border-line")} role="toolbar" aria-label={referenceT("Whiteboard tools")}>
        {TOOLS.map((t) => <button type="button" key={t.id} className={btn(tool === t.id)} onClick={() => setTool(t.id)} title={shortcuts ? `${t.label} (${t.key.toUpperCase()})` : t.label} aria-label={t.label} aria-pressed={tool === t.id}><t.icon className="size-4" /></button>)}
        {sep}
        {COLORS.map((c) => (
          <button type="button" key={c} onClick={() => setColor(c)} aria-label={referenceT("Colour {value0}", {value0: c})} title={c}
            className={cn("size-5 rounded-full border transition", color === c ? "scale-110 ring-2 ring-brand ring-offset-1" : "", dark ? "border-white/30 ring-offset-slate-900" : "border-black/15 ring-offset-surface")} style={{ background: c }} />
        ))}
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label={referenceT("Custom colour")} className="ml-0.5 size-5 cursor-pointer rounded border-0 bg-transparent p-0" />
        {sep}
        {SIZES.map((s) => <button type="button" key={s} className={btn(width === s)} onClick={() => setWidth(s)} aria-label={referenceT("Stroke {value0}", {value0: s})}><span className="rounded-full bg-current" style={{ width: Math.min(14, s + 2), height: Math.min(14, s + 2) }} /></button>)}
        {!compact && <button type="button" className={cn(btn(fill), "w-auto px-2 text-[11px] font-medium")} onClick={() => setFill((f) => !f)} title={referenceT("Fill rectangles and ellipses")}><ReferenceText message="Fill" /></button>}
        {sep}
        <button type="button" className={btn(false)} onClick={undo} disabled={page.at === 0} title={shortcuts ? "Undo (Ctrl+Z)" : "Undo"} aria-label={referenceT("Undo")}><Undo2 className="size-4" /></button>
        <button type="button" className={btn(false)} onClick={redo} disabled={page.at === page.history.length - 1} title={shortcuts ? "Redo (Ctrl+Y)" : "Redo"} aria-label={referenceT("Redo")}><Redo2 className="size-4" /></button>
        <button type="button" className={btn(false)} onClick={clear} title={referenceT("Clear page")} aria-label={referenceT("Clear page")}><Trash2 className="size-4" /></button>
        <button type="button" className={btn(grid)} onClick={() => setGrid((g) => !g)} title={referenceT("Grid")} aria-label={referenceT("Toggle grid")}><Grid3x3 className="size-4" /></button>
        <div className="ml-auto flex items-center gap-0.5">
          <button type="button" className={btn(false)} disabled={pi === 0} onClick={() => { commitText(); setPi(pi - 1); }} aria-label={referenceT("Previous page")}><ChevronLeft className="size-4" /></button>
          <span className={cn("px-1 text-[11px] tabular", dark ? "text-slate-300" : "text-muted")}>{pi + 1}/{pages.length}</span>
          <button type="button" className={btn(false)} disabled={pi === pages.length - 1} onClick={() => { commitText(); setPi(pi + 1); }} aria-label={referenceT("Next page")}><ChevronRight className="size-4" /></button>
          <button type="button" className={btn(false)} onClick={() => { commitText(); setPages((p) => [...p.slice(0, pi + 1), newPage(), ...p.slice(pi + 1)]); setPi(pi + 1); }} title={referenceT("New page")} aria-label={referenceT("New page")}><FilePlus2 className="size-4" /></button>
          {pages.length > 1 && <button type="button" className={btn(false)} onClick={() => { setPages((p) => p.filter((_, k) => k !== pi)); setPi(Math.max(0, pi - 1)); }} title={referenceT("Delete page")} aria-label={referenceT("Delete page")}><X className="size-4" /></button>}
          {sep}
          <button type="button" className={btn(false)} onClick={exportPng} title={referenceT("Download PNG")} aria-label={referenceT("Download PNG")}><Download className="size-4" /></button>
        </div>
      </div>
      <div ref={wrap} className="relative min-h-0 flex-1 touch-none select-none"
        style={grid ? { backgroundImage: `linear-gradient(${dark ? "rgba(255,255,255,.06)" : "rgba(15,23,42,.06)"} 1px, transparent 1px), linear-gradient(90deg, ${dark ? "rgba(255,255,255,.06)" : "rgba(15,23,42,.06)"} 1px, transparent 1px)`, backgroundSize: "24px 24px" } : undefined}>
        <canvas ref={canvas} className="absolute inset-0" style={{ cursor }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} aria-label={referenceT("Drawing canvas")} />
        {text && (
          /* Shared Textarea placed at the click point; inline style keeps the source's transparent dashed overlay. */
          <div className="absolute min-w-40" style={{ left: text.at[0], top: text.at[1] }}>
            <Textarea autoFocus value={text.value} onChange={(e) => setText({ ...text, value: e.target.value })} onBlur={commitText}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitText(); } if (e.key === "Escape") setText(null); }}
              placeholder={referenceT("Type, Enter to place")} rows={1} aria-label={referenceT("Text to place on the board")}
              style={{ color, fontSize: 12 + width * 2, lineHeight: 1.25, fontFamily: "inherit", minHeight: 0, height: "auto", padding: 0, resize: "none", background: "transparent", border: "1px dashed var(--brand)", borderRadius: "calc(var(--radius) * 0.3)", boxShadow: "none" }} />
          </div>
        )}
        {shapes.length === 0 && !text && (
          <p className={cn("pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-xs", dark ? "text-slate-500" : "text-faint")}><ReferenceText message="Draw with mouse, touch or stylus · hold Shift for straight lines" />{shortcuts ? referenceT(" · P H E L A R O T switch tools") : ""}
          </p>
        )}
      </div>
    </div>
  );
}
