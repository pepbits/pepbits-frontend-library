import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import { ReferenceMedbandModule } from "../../../packages/reference-medband/src/module";
import { makeHost, sessionHandler } from "../../../packages/reference-medband/src/test-utils";

/** Diagnostic entry (never shipped): mounts the real module with the test transport so a browser can measure it. */
let root: Root | undefined;
(window as unknown as { mount: (path: string, prefs?: Record<string, unknown>) => void }).mount = (path, prefs = {}) => {
  root?.unmount();
  const host = document.getElementById("app")!;
  root = createRoot(host);
  const { host: h } = makeHost(sessionHandler("A"), { path, preferences: prefs as never });
  root.render(createElement(ReferenceMedbandModule, { path, host: h }));
};
