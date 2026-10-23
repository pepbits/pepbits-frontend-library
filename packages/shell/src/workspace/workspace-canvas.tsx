"use client";
import { LocalizedText, useLocalization } from "@pepbits/i18n/react";


import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeftRight, Maximize2, X } from "@pepbits/icons";
import { IconButton, cn } from "@pepbits/ui";
import { Minus } from "@pepbits/icons";
import type {WorkspaceDocument} from "./types";
import {ShellDocumentProvider as DocumentProvider} from "../screen-host";
import type { MdiFrame } from "./mdi-frames.ts";

const MIN_PERCENT = 20;
const MAX_PERCENT = 80;
const STEP = 2;

/**
 * Where documents are drawn.
 *
 * Every warm document is mounted here at once and all but the visible ones are
 * hidden, because unmounting a screen throws away its scroll position, its
 * filters and its half-typed form — and switching tabs is the most ordinary
 * thing a user does. Suspended documents are not mounted at all; that is what
 * the warm limit is for, and why twelve open tabs are not twelve live
 * applications.
 *
 * They all live in ONE flex row, keyed by document id, with visibility and
 * order set by style. Moving a screen between two containers — a "split" tree
 * and a "single" tree, say — is a remount to React, which loses exactly the
 * state this exists to keep. So the split is CSS order on the same children,
 * not a different parent.
 */
export function WorkspaceCanvas({ documents, splitIds, activeDocumentId, onFocusPane, onClosePane, onSwap, onExitSplit, renderDocument, mdi }: {
  documents: WorkspaceDocument[];
  splitIds: string[];
  activeDocumentId: string | null;
  onFocusPane: (documentId: string) => void;
  onClosePane: (documentId: string) => void;
  onSwap: () => void;
  onExitSplit: () => void;
  renderDocument: (document: WorkspaceDocument) => React.ReactNode;
  /**
   * Phase 6. Present only when the workspace is arranged as floating frames.
   *
   * The store still owns which documents exist, which is focused and which are
   * dirty — §29 is explicit that MDI consumes the same core rather than
   * introducing a second record-management system. All that arrives here is a
   * rectangle per document.
   */
  mdi?: {
    frames: MdiFrame[];
    onMove: (documentId: string, x: number, y: number) => void;
    onResize: (documentId: string, width: number, height: number) => void;
    onRaise: (documentId: string) => void;
    onMinimise: (documentId: string) => void;
    setBounds: (bounds: { width: number; height: number }) => void;
  };
}) {
  const {t: translateCopy} = useLocalization();
  const [percent, setPercent] = useState(50);
  const rowRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const clamp = (value: number) => Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, value));

  /* Bound to the window, not the divider: once the pointer is down the user is
     allowed to move faster than a 4px handle, and a listener on the handle
     alone drops the drag the moment the cursor outruns it. */
  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (!dragging.current || !rowRef.current) return;
      const box = rowRef.current.getBoundingClientRect();
      if (box.width === 0) return;
      setPercent(clamp(((event.clientX - box.left) / box.width) * 100));
    };
    const up = () => { dragging.current = false; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, []);

  /**
   * Tell the arrangement how much room it actually has.
   *
   * Without this the frames are laid out against a guessed size, and a window
   * cascaded for a taller shell hangs below the taskbar with its own title bar
   * unreachable underneath it. A ResizeObserver rather than a window resize
   * listener, because the space also changes when the sidebar pins or the split
   * toolbar appears, and neither of those resizes the window.
   */
  const setBounds = mdi?.setBounds;
  useEffect(() => {
    const row = rowRef.current;
    if (!setBounds || !row) return;
    const report = () => setBounds({ width: row.clientWidth, height: row.clientHeight });
    report();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(report);
    observer.observe(row);
    return () => observer.disconnect();
  }, [setBounds]);

  /* Dragging a frame.
     
     Bound to the window once the pointer is down, for the same reason the split
     divider is: the pointer is allowed to move faster than the 32px title bar,
     and a listener on the bar alone drops the drag the moment it outruns it.
     The offset is captured at press time so the window does not jump its own
     corner under the cursor. */
  const dragFrame = useRef<{ documentId: string; dx: number; dy: number } | null>(null);

  const startDrag = useCallback((event: React.PointerEvent, documentId: string) => {
    const frame = mdi?.frames.find((each) => each.documentId === documentId);
    const box = rowRef.current?.getBoundingClientRect();
    if (!frame || !box) return;
    dragFrame.current = { documentId, dx: event.clientX - box.left - frame.x, dy: event.clientY - box.top - frame.y };
    event.preventDefault();
  }, [mdi]);

  useEffect(() => {
    if (!mdi) return;
    const move = (event: PointerEvent) => {
      const drag = dragFrame.current;
      const box = rowRef.current?.getBoundingClientRect();
      if (!drag || !box) return;
      mdi.onMove(drag.documentId, Math.round(event.clientX - box.left - drag.dx), Math.round(event.clientY - box.top - drag.dy));
    };
    const up = () => { dragFrame.current = null; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [mdi]);

  const onDividerKey = useCallback((event: React.KeyboardEvent) => {
    if (event.key === "ArrowLeft") { event.preventDefault(); setPercent((p) => clamp(p - STEP)); }
    else if (event.key === "ArrowRight") { event.preventDefault(); setPercent((p) => clamp(p + STEP)); }
    else if (event.key === "Home") { event.preventDefault(); setPercent(50); }
  }, []);

  const floating = Boolean(mdi);
  const split = !floating && splitIds.length >= 2;
  const mounted = documents.filter((doc) => doc.state !== "SUSPENDED");
  /* In MDI every document is on screen at once, so "visible" is every frame
     that is not minimised rather than the one being looked at. */
  const visible = floating
    ? mdi!.frames.filter((frame) => !frame.minimised).map((frame) => frame.documentId)
    : split ? splitIds : activeDocumentId ? [activeDocumentId] : [];
  const frameOf = (documentId: string) => mdi?.frames.find((frame) => frame.documentId === documentId);
  /* Chrome — a title bar with the close button — belongs to any arrangement
     where more than one document is on screen. In a single view the page header
     and the tab strip already say what this is. */
  const chrome = split || floating;

  return (
    /* h-full only when floating. The shell's <main> is a block, not a flex
       container, so flex-1 here resolves to nothing and the height comes from
       the content — which in MDI is entirely absolutely positioned, leaving the
       row zero pixels tall. Every frame then opened at the minimum size, in the
       same corner, because cascade had no room to step into. */
    <div className={cn("flex min-h-0 flex-1 flex-col", floating && "h-full")}>
      {split ? (
        /* Once for the arrangement, not once per pane: swapping and collapsing
           are operations on the split, and offering them twice invites the
           question of which one you pressed. */
        <div className="flex h-8 shrink-0 items-center justify-end gap-1 border-b border-[var(--border)] bg-[var(--surface-2)] px-2">
          <span className="mr-auto text-[length:calc(9px*var(--fs-scale))] font-bold uppercase tracking-[.06em] text-[var(--text-subtle)]"><LocalizedText message="ui.split.view.915c438b" /></span>
          <IconButton label="ui.swap.the.panes.55e75080" className="size-7" onClick={onSwap}><ArrowLeftRight className="size-3.5" /></IconButton>
          <IconButton label="ui.make.full.screen.f5c45f1e" className="size-7" onClick={onExitSplit}><Maximize2 className="size-3.5" /></IconButton>
        </div>
      ) : null}

      <div ref={rowRef} className={cn("min-h-0 flex-1", floating ? "relative overflow-hidden bg-[var(--surface-2)]" : "flex")}>
        {mounted.map((document) => {
          const at = visible.indexOf(document.documentId);
          const shown = at >= 0;
          const focused = document.documentId === activeDocumentId;
          const frame = frameOf(document.documentId);
          const width = !shown ? undefined : floating ? `${frame?.width ?? 0}px` : !split ? "100%" : at === 0 ? `${percent}%` : `${100 - percent}%`;
          const placement: React.CSSProperties = floating && frame
            ? { position: "absolute", left: `${frame.x}px`, top: `${frame.y}px`, height: `${frame.height}px`, zIndex: frame.z }
            : { order: shown ? at * 2 : 99 };
          return (
            <div
              key={document.documentId}
              /* inert, not just hidden: display:none already takes it out of
                 the tab order, but a screen reader or a stray programmatic
                 focus should not reach a document nobody is looking at. */
              inert={!shown}
              aria-hidden={!shown || undefined}
              style={{ display: shown ? "flex" : "none", width, ...placement }}
              onMouseDownCapture={floating ? () => mdi!.onRaise(document.documentId) : undefined}
              className={cn("min-w-0 flex-col overflow-hidden bg-[var(--surface)]", floating && "rounded-lg border border-[var(--border)] shadow-[var(--shadow-lg)]")}
            >
              {/* The SAME tree whether split or not — only attributes change.
                  Wrapping the document in a <section> just for the split moved
                  it a level deeper, which React reconciles as a remount, and
                  entering a split lost the very form the split was opened to
                  compare. The header renders as null rather than being absent,
                  so the content keeps its position among its siblings. */}
              <section
                role={chrome ? "region" : undefined}
                aria-label={chrome ? (document.dirty ? `${document.title} — unsaved changes` : document.title) : undefined}
                aria-current={chrome && focused ? "true" : undefined}
                onFocusCapture={() => onFocusPane(document.documentId)}
                onMouseDown={() => onFocusPane(document.documentId)}
                className="flex min-h-0 flex-1 flex-col"
              >
                {chrome ? (
                  <header
                    /* The title bar is the drag handle, which is what every
                       window manager has taught people to expect. */
                    onPointerDown={floating ? (event) => startDrag(event, document.documentId) : undefined}
                    className={cn("flex h-8 shrink-0 items-center gap-2 border-b px-3 transition", floating && "cursor-move select-none", focused ? "border-[var(--primary)] bg-[var(--primary-soft)]" : "border-[var(--border)] bg-[var(--surface-2)]")}
                  >
                    {document.dirty ? <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-[var(--warning)]" /> : null}
                    <span className={cn("min-w-0 flex-1 truncate text-[length:calc(10px*var(--fs-scale))] font-bold", focused ? "text-[var(--primary-strong)]" : "text-[var(--text-muted)]")}>{document.title}</span>
                    {floating ? <IconButton label={translateCopy("Minimise {item}",{item:translateCopy(document.title)})} className="size-6" onClick={() => mdi!.onMinimise(document.documentId)}><Minus className="size-3" /></IconButton> : null}
                    {document.closable ? <IconButton label={translateCopy("Close {item}",{item:translateCopy(document.title)})} className="size-6" onClick={() => onClosePane(document.documentId)}><X className="size-3" /></IconButton> : null}
                  </header>
                ) : null}
                <div className={cn("min-h-0 flex-1", chrome ? "nex-scrollbar overflow-auto" : "flex flex-col")}>
                  <DocumentProvider documentId={document.documentId}>{renderDocument(document)}</DocumentProvider>
                </div>
              </section>
            </div>
          );
        })}

        {split ? (
          <div
            role="separator"
            tabIndex={0}
            aria-orientation="vertical"
            aria-label={translateCopy("ui.resize.the.split.206f7291")}
            aria-valuenow={Math.round(percent)}
            aria-valuemin={MIN_PERCENT}
            aria-valuemax={MAX_PERCENT}
            style={{ order: 1 }}
            onPointerDown={(event) => { dragging.current = true; event.preventDefault(); }}
            onKeyDown={onDividerKey}
            className="focus-ring relative w-1 shrink-0 cursor-col-resize bg-[var(--border)] transition hover:bg-[var(--primary)]"
          >
            <span aria-hidden className="absolute inset-y-0 -left-1 -right-1" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
