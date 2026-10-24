import { afterEach, beforeEach, expect, test, vi } from "vitest";
const windows = vi.hoisted(() => [] as Array<{ label: string; options: {url: string; title: string}; events: Map<string, () => void>; onClose?: (event: {preventDefault:()=>void}) => void; destroy: ReturnType<typeof vi.fn> }>);
vi.mock("@tauri-apps/api/webviewWindow", () => ({
  WebviewWindow: class {
    events = new Map<string, () => void>();
    onClose?: (event: {preventDefault:()=>void}) => void;
    destroy = vi.fn(async () => {});
    constructor(public label: string, public options: {url: string; title: string}) { windows.push(this); }
    async once(name: string, fn: () => void) { this.events.set(name, fn); return () => {}; }
    async onCloseRequested(fn: (event: {preventDefault:()=>void}) => void) { this.onClose = fn; return () => {}; }
    async setFocus() {}
  },
}));
import { createTauriWindowPort } from "./tauri-windows";
beforeEach(() => { windows.length = 0; Object.assign(window, { __TAURI_INTERNALS__: {} }); });
afterEach(() => { delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__; });
const request = { documentId: "w1", documentKey: "t:C:1", title: "Customer 1" };
test("opening resolves only when the native window has been created", async () => {
  const port = createTauriWindowPort();
  let resolved = false;
  const pending = port.open(request).then(ok => { resolved = true; return ok; });
  await Promise.resolve();
  expect(resolved).toBe(false);
  windows[0]!.events.get("tauri://created")!();
  expect(await pending).toBe(true);
  const closed = vi.fn(); port.onClosed(closed);
  await port.close(request.documentId);
  expect(windows[0]!.destroy).toHaveBeenCalledOnce();
  expect(closed).not.toHaveBeenCalled();
});
test("creation failure permits another attempt", async () => {
  const port = createTauriWindowPort();
  const failed = port.open(request);
  windows[0]!.events.get("tauri://error")!();
  expect(await failed).toBe(false);
  const retry = port.open(request);
  windows[1]!.events.get("tauri://created")!();
  expect(await retry).toBe(true);
});

test("a stale close listener cannot destroy a reopened window with the same label", async () => {
  const port = createTauriWindowPort();
  const first = port.open(request); windows[0]!.events.get("tauri://created")!(); await first;
  const oldHandler = windows[0]!.onClose!;
  const closed = vi.fn(); port.onClosed(closed);
  const preventDefault = vi.fn(); oldHandler({preventDefault});
  expect(preventDefault).toHaveBeenCalledOnce();
  expect(windows[0]!.destroy).toHaveBeenCalledOnce();
  expect(closed).toHaveBeenCalledOnce();
  const second = port.open(request); windows[1]!.events.get("tauri://created")!(); await second;
  oldHandler({preventDefault});
  expect(windows[0]!.destroy).toHaveBeenCalledOnce();
  expect(windows[1]!.destroy).not.toHaveBeenCalled();
  expect(closed).toHaveBeenCalledOnce();
  await port.close(request.documentId);
  expect(windows[1]!.destroy).toHaveBeenCalledOnce();
});

/* Additions for the demo host: browser mode, focus, the child URL and the main-window key. */
import { NULL_WINDOW_PORT } from "@pepbits/platform/windows";
import { DOCUMENT_PARAM, detachedDocumentKey, inTauri } from "./tauri-windows";
test("a browser without the Tauri runtime gets the unavailable null port", () => {
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  expect(inTauri()).toBe(false);
  expect(createTauriWindowPort()).toBe(NULL_WINDOW_PORT);
  expect(windows).toHaveLength(0);
});
test("an already open document is focused instead of creating a second window", async () => {
  const port = createTauriWindowPort();
  const first = port.open(request); windows[0]!.events.get("tauri://created")!(); await first;
  const focus = vi.spyOn(windows[0] as unknown as { setFocus: () => Promise<void> }, "setFocus");
  expect(await port.open(request)).toBe(true);
  expect(windows).toHaveLength(1);
  expect(focus).toHaveBeenCalledOnce();
  await port.focus(request.documentId);
  expect(focus).toHaveBeenCalledTimes(2);
});
test("the child window receives only the encoded document key and the main window has none", async () => {
  const port = createTauriWindowPort();
  const pending = port.open(request); windows[0]!.events.get("tauri://created")!(); await pending;
  expect(windows[0]!.label).toBe('doc-w1');
  expect(windows[0]!.options).toMatchObject({url: `index.html?${DOCUMENT_PARAM}=${encodeURIComponent(request.documentKey)}`, title: request.title});
  history.replaceState(null, "", `/index.html?${DOCUMENT_PARAM}=${encodeURIComponent("t:C:view~1")}`);
  expect(detachedDocumentKey()).toBe("t:C:view~1");
  history.replaceState(null, "", "/");
  expect(detachedDocumentKey()).toBeNull();
});
