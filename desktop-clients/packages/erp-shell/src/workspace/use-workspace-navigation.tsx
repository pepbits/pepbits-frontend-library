"use client";

import { useProduct } from "../product-context";
import { useCallback, useMemo, useRef, useState } from "react";
import { MODULES, PAGE_REGISTRY, moduleLandingPage, productNavigationTarget } from "@pepbits/erp-config";
import type { ModuleKey } from "@pepbits/erp-config";
import type { NavigationPort, NavigationTarget } from "@pepbits/platform-ports";
import { useActiveDocumentIn, useDetachedIn, useDocumentsIn, useSplitIn, type OpenResult, type SplitSide, type Workspace, type WorkspaceDocument } from "@pepbits/workspace-core";
import { documentFromTarget, targetFromDocument } from "./target-document.ts";

/** What the shell must ask about before it can proceed. */
export interface PendingWorkspaceAction {
  label: string;
  message: string;
  confirmLabel: string;
}

export interface WorkspaceNavigation {
  workspace: Workspace;
  port: NavigationPort;
  documents: WorkspaceDocument[];
  activeDocument: WorkspaceDocument | null;
  focusDocument(documentId: string): void;
  closeDocument(documentId: string): void;
  closeOthers(documentId: string): void;

  /** The panes, left to right. Empty when a single document is on screen. */
  splitPanes: WorkspaceDocument[];
  /** The same, as ids. A stable array, so passing it as a prop does not re-render. */
  splitIds: string[];

  /** Documents shown in windows of their own. */
  detachedIds: string[];
  /** Everything this window is responsible for drawing — the detached are not. */
  localDocuments: WorkspaceDocument[];
  detach(documentId: string): OpenResult;
  reattach(documentId: string): OpenResult;
  /** Put the focused document beside the one used before it. */
  splitCurrent(side?: SplitSide): OpenResult;
  /** Bring a document that is already open into the split. */
  splitWith(documentId: string, side?: SplitSide): OpenResult;
  swapSplit(): void;
  exitSplit(): void;
  /** Marks the active document dirty. The shell calls this from a form. */
  dirtyActive(): void;
  pending: PendingWorkspaceAction | null;
  confirmPending(): void;
  cancelPending(): void;
}

function moduleOf(pageId: string, fallback: ModuleKey, pages = PAGE_REGISTRY): ModuleKey {
  const page = pages[pageId];
  return page && page.module !== "shared" ? (page.module as ModuleKey) : fallback;
}

/**
 * The shell's navigation, backed by the workspace store.
 *
 * Replaces a `useState<Tab[]>` that knew nothing about unsaved work: crossing
 * from Finance to HR rebuilt the tab set and threw away every half-filled form
 * in it, silently, because an array of `{id, title, target}` has no idea what
 * dirty means. Everything destructive now goes through `pending`, and the shell
 * renders the question.
 */
export function useWorkspaceNavigation(workspace: Workspace, options: { initialModule?: ModuleKey } = {}): WorkspaceNavigation {
  const product = useProduct();
  const initialModule = options.initialModule && product.modules[options.initialModule] ? options.initialModule : product.defaultModule;
  const documents = useDocumentsIn(workspace);
  const [pending, setPending] = useState<PendingWorkspaceAction | null>(null);
  /* The action itself is a ref, not state. It is a closure the dialog runs on
     confirm; putting it in state would make every render compare functions. */
  const pendingAction = useRef<(() => void) | null>(null);

  const openHome = useCallback((module: ModuleKey) => {
    const pageId=moduleLandingPage(product,module);
    if(!pageId)return;
    const target: NavigationTarget = productNavigationTarget(product,pageId,module);
    workspace.openDocument(documentFromTarget(target, { closable: false }));
  }, [workspace, product]);

  /* One home tab, opened on first render rather than in an effect: an effect
     would leave the very first paint with an empty workspace and no current
     page, and PageRenderer would have nothing to draw. */
  const started = useRef(false);
  if (!started.current) {
    started.current = true;
    if (documents.length === 0) openHome(initialModule);
  }

  const activeDocument = useActiveDocumentIn(workspace);
  const splitIds = useSplitIn(workspace);
  const detachedIds = useDetachedIn(workspace);
  /* A detached document is drawn by the window that owns it. Mounting a second
     copy here would be two live screens on one record, each with its own
     unsaved draft — the thing the duplicate guard exists to prevent, arrived at
     from the other direction. */
  const localDocuments = useMemo(
    () => (detachedIds.length === 0 ? documents : documents.filter((doc) => !detachedIds.includes(doc.documentId))),
    [documents, detachedIds],
  );
  const splitPanes = useMemo(
    () => splitIds.map((id) => documents.find((doc) => doc.documentId === id)).filter(Boolean) as WorkspaceDocument[],
    [splitIds, documents],
  );

  const ask = useCallback((action: PendingWorkspaceAction, run: () => void) => {
    pendingAction.current = run;
    setPending(action);
  }, []);

  const currentModule = useCallback(
    () => {const home=workspace.getOpenDocuments().find(doc=>!doc.closable);return home?.module ?? initialModule;},
    [workspace, initialModule, product],
  );

  const closeOthers = useCallback((documentId: string) => {
    const result = workspace.closeOthers(documentId);
    if (result.ok || !result.dirtyDocumentIds) return;
    const count = result.dirtyDocumentIds.length;
    ask({
      label: "Discard changes?",
      message: `${count} other ${count === 1 ? "document has" : "documents have"} unsaved changes.`,
      confirmLabel: "Discard and close",
    }, () => { workspace.closeOthers(documentId, { discardChanges: true }); });
  }, [ask, workspace]);

  const open = useCallback((target: NavigationTarget) => {
    const here = currentModule();
    const next = target.moduleId ?? moduleOf(target.pageId, here, product.pages);

    if (next !== here) {
      /* Crossing modules replaces the whole tab set, so the guard is over
         everything at once rather than one tab at a time. */
      const cross = () => {
        workspace.closeAll({ discardChanges: true, includeUnclosable: true });
        openHome(next);
        if (target.pageId !== moduleLandingPage(product,next)) workspace.openDocument(documentFromTarget(target));
      };
      const dirty = workspace.getOpenDocuments().filter((doc) => doc.dirty);
      if (dirty.length > 0) {
        ask({
          label: `Leave ${MODULES[here]?.label ?? here}?`,
          message: `${dirty.length} open ${dirty.length === 1 ? "document has" : "documents have"} unsaved changes. Moving to another module closes ${dirty.length === 1 ? "it" : "them"}.`,
          confirmLabel: "Discard and continue",
        }, cross);
        return;
      }
      cross();
      return;
    }

    const result = workspace.openDocument(documentFromTarget(target));

    /* SINGLE means one document at a time, so the one just opened replaces
       whatever was there. Done here rather than in the store: what a mode means
       on screen is the shell's decision, and the store only says which modes
       are permitted.

       The new document opens first and the old ones are closed after, so the
       unsaved-changes question is asked with the destination already visible
       rather than against a blank workspace. */
    if (result.ok && result.document?.presentation === "SINGLE") {
      closeOthers(result.document.documentId);
    }
  }, [ask, closeOthers, currentModule, openHome, workspace, product]);

  const closeDocument = useCallback((documentId: string) => {
    const result = workspace.closeDocument(documentId);
    if (result.ok || !result.dirtyDocumentIds) return;
    const document = workspace.getDocument(documentId);
    ask({
      label: "Discard changes?",
      message: `${document?.title ?? "This document"} has unsaved changes.`,
      confirmLabel: "Discard and close",
    }, () => { workspace.closeDocument(documentId, { discardChanges: true }); });
  }, [ask, workspace]);

  const port: NavigationPort = useMemo(() => ({
    current: activeDocument ? targetFromDocument(activeDocument) : productNavigationTarget(product,moduleLandingPage(product,initialModule) ?? "",initialModule),
    open,
    /* Focuses rather than duplicates. A second tab of one encounter is two
       unsaved drafts of the same record, which is what the duplicate guard
       exists to prevent; duplicates return when the policy's allowDuplicate is
       enforced and a page opts in. */
    openInNewContext: open,
    /* No URL to copy on desktop, and a real-looking one would put a dead link
       in the status bar. */
    hrefFor: () => "#",
  }), [activeDocument, open, initialModule, product]);

  return {
    workspace,
    port,
    splitPanes,
    splitIds,
    detachedIds,
    localDocuments,
    detach: (documentId) => workspace.detachDocument(documentId),
    reattach: (documentId) => workspace.attachDocument(documentId),
    splitCurrent: (side) => workspace.splitWithPrevious(side),
    splitWith: (documentId, side) => workspace.moveToSplit(documentId, side),
    swapSplit: () => { workspace.swapSplit(); },
    exitSplit: () => { workspace.exitSplit(); },
    documents,
    activeDocument,
    focusDocument: (documentId) => { workspace.focusDocument(documentId); },
    closeDocument,
    closeOthers,
    dirtyActive: () => { const active = workspace.getActiveDocument(); if (active) workspace.markDirty(active.documentId); },
    pending,
    confirmPending: () => { const run = pendingAction.current; pendingAction.current = null; setPending(null); run?.(); },
    cancelPending: () => { pendingAction.current = null; setPending(null); },
  };
}
