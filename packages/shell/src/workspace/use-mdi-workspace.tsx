"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDocumentsIn, type Workspace } from "./index";
import { bringToFront, clampFrame, readFrameSizes, syncFrames, toggleMinimised, writeFrameSizes, type FrameBounds, type MdiFrame } from "./mdi-frames.ts";

export interface MdiWorkspace {
  frames: MdiFrame[];
  onMove(documentId: string, x: number, y: number): void;
  onResize(documentId: string, width: number, height: number): void;
  onRaise(documentId: string): void;
  onMinimise(documentId: string): void;
  /** From the taskbar: restore if minimised, and focus either way. */
  onSelect(documentId: string): void;
  /** Told to the canvas so frames can be clamped when the shell resizes. */
  setBounds(bounds: FrameBounds): void;
}

const START_BOUNDS: FrameBounds = { width: 1280, height: 800 };

/**
 * The floating-window arrangement, when the user has asked for one.
 *
 * Returns null when disabled, and does nothing at all in that case — no state,
 * no storage, no subscription. The framework marks this whole phase optional
 * and its own authors stopped using theirs, so the workspace it layers over has
 * to behave exactly as before for everyone who never turns it on. `enabled` is
 * the only thing standing between the two, which is why it is the first thing
 * every effect here checks.
 *
 * It owns geometry and nothing else. Which documents exist, which is focused
 * and which are dirty remain the store's answers.
 */
export function useMdiWorkspace(workspace: Workspace, enabled: boolean): MdiWorkspace | null {
  const documents = useDocumentsIn(workspace);
  const [frames, setFrames] = useState<MdiFrame[]>([]);
  const [bounds, setBoundsState] = useState<FrameBounds>(START_BOUNDS);
  const sizes = useRef<Record<string, { width: number; height: number }> | null>(null);

  /* Read once, and only if MDI is on. Reading it eagerly would touch storage
     for every user of the shell, including the ones who never enabled this. */
  if (enabled && sizes.current === null) sizes.current = readFrameSizes();

  const open = useMemo(
    () => documents.filter((doc) => doc.state !== "SUSPENDED").map((doc) => ({ documentId: doc.documentId, documentType: doc.documentType })),
    [documents],
  );

  useEffect(() => {
    if (!enabled) { setFrames((current) => (current.length === 0 ? current : [])); return; }
    setFrames((current) => syncFrames(current, open, bounds, sizes.current ?? {}));
  }, [enabled, open, bounds]);

  const update = useCallback((next: (frames: MdiFrame[]) => MdiFrame[]) => {
    setFrames((current) => next(current));
  }, []);

  const onResize = useCallback((documentId: string, width: number, height: number) => {
    update((current) => current.map((frame) => {
      if (frame.documentId !== documentId) return frame;
      /* Remembered by TYPE, so the next record window opens the size the last
         one was left at. Keyed by record it would be a per-record preference
         nobody asked for, and a record id in local storage. */
      const remembered = { ...(sizes.current ?? {}), [frame.documentType]: { width, height } };
      sizes.current = remembered;
      writeFrameSizes(remembered);
      return { ...frame, width, height };
    }));
  }, [update]);

  const value = useMemo<MdiWorkspace | null>(() => {
    if (!enabled) return null;
    return {
      frames,
      onMove: (documentId, x, y) => update((current) => current.map((frame) => (
        frame.documentId === documentId ? clampFrame({ ...frame, x, y }, bounds) : frame
      ))),
      onResize,
      onRaise: (documentId) => {
        update((current) => bringToFront(current, documentId));
        workspace.focusDocument(documentId);
      },
      onMinimise: (documentId) => update((current) => toggleMinimised(current, documentId)),
      onSelect: (documentId) => {
        update((current) => {
          const frame = current.find((each) => each.documentId === documentId);
          /* Restore first: focusing a window that is still minimised looks like
             the click did nothing. */
          return bringToFront(frame?.minimised ? toggleMinimised(current, documentId) : current, documentId);
        });
        workspace.focusDocument(documentId);
      },
      setBounds: (next) => setBoundsState((current) => (
        current.width === next.width && current.height === next.height ? current : next
      )),
    };
  }, [enabled, frames, bounds, onResize, update, workspace]);

  /* Frames follow the shell when it shrinks, or a window dragged to the right
     edge is stranded outside it after the sidebar opens. */
  useEffect(() => {
    if (!enabled) return;
    setFrames((current) => {
      const next = current.map((frame) => clampFrame(frame, bounds));
      return next.every((frame, index) => frame === current[index]) ? current : next;
    });
  }, [enabled, bounds]);

  return value;
}
