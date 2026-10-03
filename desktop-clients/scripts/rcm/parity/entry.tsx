import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import { ReferenceRcmModule } from "../../../packages/reference-rcm/src/module";
import { makeHost, sessionHandler, chain, json, list, record } from "../../../packages/reference-rcm/src/test-utils";

/** Diagnostic entry (never shipped): mounts the real module with the package's fixture transport so a browser can measure it. */
let root: Root | undefined;
const handler = chain((r) => {
  if (r.method === "GET" && r.path.startsWith("/records/claims?")) return json(list([record({ id: 41, ref: "CLM-1", status: "READY", amount: 500, balance: 500 }), record({ id: 42, ref: "CLM-2", status: "DENIED", amount: 900, balance: 900 })]));
  const m = /^\/records\/(\w[\w-]*)\/(\d+)$/.exec(r.path);
  if (m && r.method === "GET") return json(record({ id: Number(m[2]), createdBy: 2, statusBy: 2, status: m[1] === "coverages" ? "PENDING_VERIFICATION" : "DRAFT" }));
}, sessionHandler());
(window as unknown as { mount: (path: string, prefs?: Record<string, unknown>) => void }).mount = (path, prefs = {}) => {
  root?.unmount();
  root = createRoot(document.getElementById("app")!);
  const { host } = makeHost(handler, { path, preferences: prefs as never });
  root.render(createElement(ReferenceRcmModule, { path, host }));
};
