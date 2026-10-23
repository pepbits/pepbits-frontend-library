"use client";
import React, {useCallback, useMemo, useSyncExternalStore, type ReactNode} from "react";
import {ScreenHostProvider, type ScreenHostValue} from "@pepbits/patterns/screen-host";
import {useSession} from "@pepbits/platform";
import {DocumentProvider, useDocumentScope, useIsDocumentFocused, useOptionalWorkspace} from "./workspace";
import {useShell} from "./shell-context";
import {canProductAction} from "./products";

const DRAFTS = "shell:screen-state";
const EMPTY = Object.freeze({});
const noSubscribe = () => () => {};

/** A bridge per document: ownership never follows the focused pane while another pane saves. */
export function ShellScreenHost({children, extensions}: {children?: ReactNode; extensions?: Pick<ScreenHostValue, "renderInlineAction" | "publishSources">}) {
  const shell = useShell(), workspace = useOptionalWorkspace(), id = useDocumentScope(), focused = useIsDocumentFocused();
  const {expired, status} = useSession();
  const draftState = useSyncExternalStore(workspace?.subscribeToChanges ?? noSubscribe,
    () => id ? workspace?.getDraft<Readonly<Record<string, unknown>>>(id, DRAFTS) ?? EMPTY : EMPTY, () => EMPTY);
  const setDraftState = useCallback((key: string, value: unknown) => {
    if (id && workspace) workspace.setDraft(id, DRAFTS, {...workspace.getDraft<Record<string, unknown>>(id, DRAFTS), [key]: value});
  }, [id, workspace]);
  const reportDirty = useCallback((dirty: boolean) => {if (id && workspace) {if (dirty) workspace.markDirty(id); else workspace.markClean(id);}}, [id, workspace]);
  const subscribeClose = useCallback((listener: () => void) => workspace?.subscribe(event => {if (event.type === "close" && event.document.documentId === id) listener();}) ?? (() => {}), [id, workspace]);
  const owner = id ? workspace?.getDocument(id) : null;
  const value = useMemo<ScreenHostValue>(() => ({...extensions,
    notify: (message, {tone}) => shell.toast({title: message, type: tone}),
    can: action => status === "authenticated" && !expired && canProductAction(shell.product, action),
    scope: {module: owner?.module ?? shell.currentModule, branch: owner?.security.branchId ?? shell.branch},
    document: {id, focused, draftState, setDraftState, reportDirty, subscribeClose},
  }), [extensions, shell.toast, shell.product, shell.currentModule, shell.branch, status, expired, owner?.module, owner?.security.branchId, id, focused, draftState, setDraftState, reportDirty, subscribeClose]);
  return <ScreenHostProvider value={value}>{children}</ScreenHostProvider>;
}

/** Use for every independently mounted document, including warm/background and split panes. */
export function ShellDocumentProvider({documentId, children}: {documentId: string; children?: ReactNode}) {
  return <DocumentProvider documentId={documentId}><ShellScreenHost>{children}</ShellScreenHost></DocumentProvider>;
}
