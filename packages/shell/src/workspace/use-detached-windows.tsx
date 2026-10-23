"use client";

import { useEffect, useRef } from "react";
import { useWindowPort, type WindowPort } from "@pepbits/platform";
import { windowTitleFor, type Workspace } from "./index";

// Serialize each native window's operations, including across Strict Mode remounts.
const queues = new WeakMap<WindowPort, Map<string, Promise<unknown>>>();
function enqueue<T>(port: WindowPort, id: string, operation: () => Promise<T>): Promise<T> {
  const queue = queues.get(port) ?? new Map<string, Promise<unknown>>();
  queues.set(port, queue);
  const result = (queue.get(id) ?? Promise.resolve()).catch(() => undefined).then(operation);
  queue.set(id, result);
  void result.finally(() => { if (queue.get(id) === result) queue.delete(id); }).catch(() => undefined);
  return result;
}

/**
 * Keeps the real windows matching what the store says is detached.
 *
 * Two directions, and both are needed. The store detaches a document and a
 * window opens; the user closes that window with its own close button and the
 * document has to come home, or the tab strip goes on claiming the record is on
 * a monitor that no longer shows it.
 *
 * Reconciled from the store rather than driven by the detach action, because
 * documents also leave the detached set by being closed, by a tenant switch and
 * by logging out — three paths that must not each remember to close a window.
 */
export function useDetachedWindows(workspace: Workspace): void {
  const port = useWindowPort();
  /* Which windows this hook believes are open. Not derived from the store: the
     store is the intent, this is what was actually done about it. */
  const open = useRef(new Set<string>());

  /* Subscribed directly rather than through a snapshot hook, because this
     reconciles a side effect and does not render anything. */
  useEffect(() => {
    if (!port.available) return;
    let disposed = false;
    const opened = open.current;
    const close = (id: string) => { void enqueue(port, id, () => port.close(id)).catch(() => undefined); };

    const sync = () => {
      const wanted = new Set(workspace.getDetached());

      for (const documentId of wanted) {
        if (open.current.has(documentId)) continue;
        const document = workspace.getDocument(documentId);
        if (!document) continue;
        open.current.add(documentId);
        void enqueue(port, documentId, () => port.open({
          documentId,
          documentKey: document.documentKey,
          /* Sanitised at the boundary, not by the caller. Every path to a window
             goes through here, so there is one place a title can leak from. */
          title: windowTitleFor(document),
        })).then((ok) => {
          if (!ok && !disposed) { opened.delete(documentId); workspace.attachDocument(documentId); }
        }).catch(() => {
          if (!disposed) { close(documentId); opened.delete(documentId); workspace.attachDocument(documentId); }
        });
      }

      for (const documentId of [...open.current]) {
        if (wanted.has(documentId)) continue;
        open.current.delete(documentId);
        close(documentId);
      }
    };

    sync();
    const stopWatching = workspace.subscribeToChanges(sync);
    const stopListening = port.onClosed((documentId) => {
      /* The window is already gone, so forget it before telling the store —
         otherwise the sync that follows tries to close it a second time. */
      open.current.delete(documentId);
      if (workspace.getDetached().includes(documentId)) workspace.attachDocument(documentId);
    });

    return () => {
      disposed = true;
      stopWatching();
      stopListening();
      for (const id of opened) close(id);
      opened.clear();
    };
  }, [port, workspace]);
}
