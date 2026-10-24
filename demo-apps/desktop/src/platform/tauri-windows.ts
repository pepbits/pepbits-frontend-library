import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { NULL_WINDOW_PORT, type DetachedWindowRequest, type WindowPort } from "@pepbits/platform/windows";

/** The query key a child window is told which record to open through. */
export const DOCUMENT_PARAM = "document";

/**
 * True inside a Tauri webview, false in a browser.
 *
 * The same bundle serves both — `npm run dev -w @pepbits-demo/desktop` opens it at :3410 in a
 * normal browser — so this is a runtime question, not a build-time one. When it
 * is false the null port is used and the detach action is never offered, rather
 * than being offered and doing nothing.
 */
export function inTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** A label Tauri accepts: letters, numbers, dash, underscore. */
function labelFor(documentId: string): string {
  return `doc-${documentId.replace(/[^A-Za-z0-9_-]/g, "-")}`;
}

/**
 * Detached windows, backed by Tauri.
 *
 * The child is given the document KEY and nothing else. It carries the tenant,
 * the record type and the record id — the same minimal identifier §17.6 allows
 * in a window title — and no name, because a URL is as visible as a title and
 * lives in more places.
 */
export function createTauriWindowPort(): WindowPort {
  if (!inTauri()) return NULL_WINDOW_PORT;

  const windows = new Map<string, WebviewWindow>();
  const subscriptions = new Map<WebviewWindow, () => void>();
  const listeners = new Set<(documentId: string) => void>();
  const release = (child: WebviewWindow) => {
    subscriptions.get(child)?.();
    subscriptions.delete(child);
  };

  return {
    available: true,

    async open(request: DetachedWindowRequest) {
      if (windows.has(request.documentId)) {
        await windows.get(request.documentId)?.setFocus();
        return true;
      }
      const child = new WebviewWindow(labelFor(request.documentId), {
        url: `index.html?${DOCUMENT_PARAM}=${encodeURIComponent(request.documentKey)}`,
        title: request.title,
        width: 1100,
        height: 800,
        /* Not centred: a second window centred on top of the first is a second
           window the user has to move before they can compare anything. */
        center: false,
      });
      windows.set(request.documentId, child);

      // The constructor starts creation; it does not mean a window exists yet.
      // Lifecycle cleanup must wait for this result before trying to close it.
      const created = await new Promise<boolean>((resolve, reject) => {
        void child.once("tauri://created", () => resolve(true)).catch(reject);
        void child.once("tauri://error", () => {
          if (windows.get(request.documentId) === child) windows.delete(request.documentId);
          resolve(false);
        }).catch(reject);
      });
      if (!created) return false;
      /* The user closing the window with its own button. Without this the tab
         strip goes on claiming the record is on a monitor that no longer shows
         it. */
      const unsubscribe = await child.onCloseRequested((event) => {
        // The SDK otherwise destroys after this callback, even for a stale
        // listener whose label has since been reused by a new window.
        event.preventDefault();
        if (windows.get(request.documentId) !== child) return;
        windows.delete(request.documentId);
        release(child);
        void child.destroy().catch(() => undefined);
        for (const listener of listeners) listener(request.documentId);
      });
      subscriptions.set(child, unsubscribe);
      return true;
    },

    async close(documentId: string) {
      const child = windows.get(documentId);
      windows.delete(documentId);
      if (child) {
        release(child);
        // Logout owns the teardown; do not enqueue another close-request event.
        await child.destroy().catch(() => undefined);
      }
    },

    async focus(documentId: string) {
      await windows.get(documentId)?.setFocus().catch(() => undefined);
    },

    onClosed(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

/** The document key this window was told to open, or null for the main window. */
export function detachedDocumentKey(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(DOCUMENT_PARAM);
}
