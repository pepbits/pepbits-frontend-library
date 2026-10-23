"use client";

import React, { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import type { Workspace } from "./document-manager.ts";
import type { WorkspaceDocument, WorkspaceDocumentState } from "./types.ts";

const WorkspaceContext = createContext<Workspace | null>(null);

export function WorkspaceProvider({ workspace, children }: { workspace: Workspace; children: React.ReactNode }) {
  return <WorkspaceContext.Provider value={workspace}>{children}</WorkspaceContext.Provider>;
}

/**
 * Throws when unprovided, deliberately -- the same choice as `useNavigation`.
 * A silent fallback to an empty workspace produces a shell that renders
 * correctly, opens nothing, and reports no error anywhere.
 */
export function useWorkspace(): Workspace {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) throw new Error("useWorkspace must be used within a WorkspaceProvider");
  return workspace;
}

/**
 * The workspace if there is one, null if there is not.
 *
 * Shared screens render in both shells, and only one of them has a workspace
 * today. A screen that reached for `useWorkspace()` would work on the desktop
 * and take out every page on the web.
 */
export function useOptionalWorkspace(): Workspace | null {
  return useContext(WorkspaceContext);
}

/** Report against the owning document, including when it saves in the background.
 * Screens without a DocumentProvider retain the single-document fallback.
 * Unmounting does not clear unsaved work.
 */
export function useReportDirty(dirty: boolean): void {
  const workspace = useOptionalWorkspace();
  const documentId = useContext(DocumentContext);
  const ownerId = documentId ?? workspace?.getActiveDocument()?.documentId;
  useEffect(() => {
    if (!workspace || !ownerId) return;
    if (dirty) workspace.markDirty(ownerId);
    else workspace.markClean(ownerId);
  }, [workspace, ownerId, dirty]);
}

/**
 * The open documents, kept in step with the store.
 *
 * useSyncExternalStore rather than an effect subscribing into state: the store
 * changes from outside React -- a keyboard shortcut, a restore on login, a
 * second window -- and an effect-based subscription would miss anything that
 * happened between render and effect. It also compares snapshots by identity,
 * which is why the store replaces documents instead of mutating them.
 */
/**
 * The explicit form, for code that HOLDS a workspace rather than finding one.
 *
 * The shells build their navigation port from a workspace and then feed that
 * port to the providers, so that code runs ABOVE WorkspaceProvider and has no
 * context to read. Reaching for `useWorkspace()` there throws at runtime while
 * every test that wrapped it in a provider stays green — which is exactly what
 * happened, and is why both forms exist.
 */
export function useDocumentsIn(workspace: Workspace): WorkspaceDocument[] {
  return useSyncExternalStore(
    workspace.subscribeToChanges,
    workspace.getOpenDocuments,
    /* Server render: the same getter. The store is empty until the shell opens
       something on the client, so this is the honest answer rather than a
       second code path that could disagree with it. */
    workspace.getOpenDocuments,
  );
}

export function useActiveDocumentIn(workspace: Workspace): WorkspaceDocument | null {
  return useSyncExternalStore(
    workspace.subscribeToChanges,
    workspace.getActiveDocument,
    workspace.getActiveDocument,
  );
}

const DocumentContext = createContext<string | null>(null);

/**
 * Names the document a subtree belongs to.
 *
 * The shell mounts several documents at once and shows one; without this a
 * screen has no way to know whether it is the one being looked at, and every
 * mounted copy behaves as though it were.
 */
export function DocumentProvider({ documentId, children }: { documentId: string; children: React.ReactNode }) {
  return <DocumentContext.Provider value={documentId}>{children}</DocumentContext.Provider>;
}

/**
 * Whether this screen is on screen, warm in the background, or suspended.
 *
 * ACTIVE where there is no workspace or no declared document, because the same
 * screens render in the web shell and a screen that decided it was BACKGROUND
 * there would switch itself off on every page.
 */
export function useDocumentState(): WorkspaceDocumentState {
  const workspace = useOptionalWorkspace();
  const documentId = useContext(DocumentContext);
  const documents = useSyncExternalStore(
    workspace?.subscribeToChanges ?? noSubscribe,
    workspace?.getOpenDocuments ?? noDocuments,
    workspace?.getOpenDocuments ?? noDocuments,
  );
  if (!workspace || !documentId) return "ACTIVE";
  return documents.find((doc) => doc.documentId === documentId)?.state ?? "ACTIVE";
}

/** True while this screen is the one being looked at. */
export function useIsDocumentVisible(): boolean {
  return useDocumentState() === "ACTIVE";
}

/* Stable identities, or useSyncExternalStore re-subscribes and re-reads on
   every render and never settles. */
const EMPTY: WorkspaceDocument[] = [];
const noSubscribe = () => () => undefined;
const noDocuments = () => EMPTY;

/** The documents living in windows of their own, kept in step with the store. */
export function useDetachedIn(workspace: Workspace): string[] {
  return useSyncExternalStore(workspace.subscribeToChanges, workspace.getDetached, workspace.getDetached);
}

/** The split arrangement, kept in step with the store. */
export function useSplitIn(workspace: Workspace): string[] {
  return useSyncExternalStore(workspace.subscribeToChanges, workspace.getSplit, workspace.getSplit);
}

/** The context forms, for components rendered inside the provider. */
export function useWorkspaceDocuments(): WorkspaceDocument[] {
  return useDocumentsIn(useWorkspace());
}

export function useActiveDocument(): WorkspaceDocument | null {
  return useActiveDocumentIn(useWorkspace());
}

export function useSplit(): string[] {
  return useSplitIn(useWorkspace());
}

/** The explicit owner, distinct from focus (both split panes may be visible). */
export function useDocumentId(): string | null { return useContext(DocumentContext); }

/** The focused document for commands, or the declared owner for scoped readers. */
export function useDocumentScope(): string | null {
  const workspace = useOptionalWorkspace();
  const owner = useDocumentId();
  const active = useSyncExternalStore(
    workspace?.subscribeToChanges ?? noSubscribe,
    workspace?.getActiveDocument ?? noActiveDocument,
    workspace?.getActiveDocument ?? noActiveDocument,
  );
  return owner ?? active?.documentId ?? null;
}
const noActiveDocument = () => null;

/** Draft values survive screen suspension inside this workspace session.
 * Closing/discarding the document clears them; web screens keep ordinary local state.
 */
export function useDocumentDraftState<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const workspace = useOptionalWorkspace();
  const owner = useDocumentId();
  const [local, setLocal] = useState(initial);
  const stored = useSyncExternalStore(
    workspace?.subscribeToChanges ?? noSubscribe,
    () => owner ? workspace?.getDraft<T>(owner, key) : undefined,
    () => undefined,
  );
  const value = stored ?? initial;
  const setValue: React.Dispatch<React.SetStateAction<T>> = (next) => {
    if (!workspace || !owner) { setLocal(next); return; }
    const previous = workspace.getDraft<T>(owner, key) ?? initial;
    workspace.setDraft(owner, key, typeof next === "function" ? (next as (previous: T) => T)(previous) : next);
  };
  return workspace && owner ? [value, setValue] : [local, setLocal];
}

/** Only one document owns global keyboard commands, including in split view. */
export function useIsDocumentFocused(): boolean {
  const workspace = useOptionalWorkspace();
  const owner = useDocumentId();
  const active = useSyncExternalStore(workspace?.subscribeToChanges ?? noSubscribe,
    workspace?.getActiveDocument ?? noActiveDocument, workspace?.getActiveDocument ?? noActiveDocument);
  return !workspace || !owner || active?.documentId === owner;
}
