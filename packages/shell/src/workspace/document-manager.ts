import { documentKey } from "./document-key.ts";
import { resolveWorkspacePolicy, type WorkspacePolicyLevel, type WorkspacePolicyRule } from "./policy.ts";
import type { WorkspaceDocument, WorkspacePresentation, WorkspaceSecurityContext } from "./types.ts";

/** Derived from the authenticated session by the shell. Never accepted from a URL. */
export interface WorkspaceSession {
  tenantId: string;
  userId: string;
  roleId?: string;
  branchId?: string;
}

export interface OpenRequest {
  module: string;
  documentType: string;
  entityId: string;
  title: string;
  subtitle?: string;
  route?: string;
  subjectId?: string;
  interactionId?: string;
  contextId?: string;
  /** A request, not a grant: policy still decides. */
  presentation?: WorkspacePresentation;
  /** Defaults to true. False for a module dashboard or another fixed tab. */
  closable?: boolean;
}

export interface OpenResult { ok: boolean; reused?: boolean; document?: WorkspaceDocument; reason?: string }
export type SplitSide = "left" | "right";

/**
 * What a detached window is called.
 *
 * Never the document's title. §17.6: a window title reaches the OS taskbar, the
 * window switcher, screen recordings and preview thumbnails — none of which
 * anyone thinks of as part of the application, and all of which outlive the
 * session. The type and the record id say which window is which without saying
 * whose record it is.
 */
export function windowTitleFor(document: { documentType: string; entityId: string; title?: string }): string {
  /* `title` is accepted and deliberately unused. Narrowing the parameter so a
     title cannot be passed would make this true by type rather than by choice,
     and the choice is the thing worth testing — a later caller reaching for
     `document.title` here is exactly the mistake to catch. */
  return `${document.documentType} ${document.entityId}`;
}
export interface CloseResult { ok: boolean; reason?: string; dirtyDocumentIds?: string[] }
export interface ResumeResult { ok: boolean; revalidationRequired?: boolean; reason?: string }

export type WorkspaceEventType = "open" | "focus" | "close" | "suspend" | "resume";
export interface WorkspaceEvent { type: WorkspaceEventType; document: WorkspaceDocument; at: string }

/**
 * What may be written to disk between sessions.
 *
 * Keys and ids only. A title is the subject's name, and §17.6/17.7 keep those
 * out of localStorage, desktop files, window titles and OS thumbnails -- all of
 * which a persisted title reaches. The real title arrives when the document
 * loads its own data.
 */
export interface RestoreEntry {
  tenantId: string;
  userId: string;
  documentKey: string;
  module: string;
  documentType: string;
  entityId: string;
  route?: string;
  presentation: WorkspacePresentation;
}

export interface Workspace {
  openDocument(request: OpenRequest): OpenResult;
  focusDocument(documentId: string): boolean;
  closeDocument(documentId: string, options?: { discardChanges?: boolean }): CloseResult;
  /** `includeUnclosable` is for replacing the workspace, as a module switch does. */
  closeAll(options?: { discardChanges?: boolean; includeUnclosable?: boolean }): CloseResult;
  closeOthers(documentId: string, options?: { discardChanges?: boolean }): CloseResult;

  /** Session-only screen state. Never included in restore metadata. */
  getDraft<T>(documentId: string, key: string): T | undefined;
  setDraft<T>(documentId: string, key: string, value: T): void;
  markDirty(documentId: string): void;
  markClean(documentId: string): void;

  suspendDocument(documentId: string): void;
  resumeDocument(documentId: string, options?: { authorised?: boolean }): ResumeResult;

  /** The documents on screen side by side, ordered left to right. Empty when not split. */
  getSplit(): string[];
  /** Open a document beside the focused one. */
  openInSplit(request: OpenRequest, side?: SplitSide): OpenResult;
  /** Bring a document that is already open into the split. */
  moveToSplit(documentId: string, side?: SplitSide): OpenResult;
  /**
   * Split the focused document against the one used before it.
   *
   * What a shortcut and a menu item both mean by "split": show me this beside
   * what I was just looking at. One open document returns ok:false with no
   * reason — nothing to compare against is a workspace with one thing in it,
   * not a failure to report.
   */
  splitWithPrevious(side?: SplitSide): OpenResult;
  /** Document ids currently shown in windows of their own. */
  getDetached(): string[];
  /**
   * Move a document out into its own window.
   *
   * The document stays open here — the tab remains, so it can be brought back —
   * but it is not drawn here and is never suspended, because it is live on
   * someone's other monitor and releasing it would tear down a screen they are
   * looking at.
   */
  detachDocument(documentId: string): OpenResult;
  /** Bring it back into this window. */
  attachDocument(documentId: string): OpenResult;

  /** Reverse the panes. The focused document stays focused. */
  swapSplit(): void;
  /** Back to one document. The other stays open as a tab. */
  exitSplit(): void;

  isAlreadyOpen(what: { documentType: string; entityId: string }): boolean;
  getDocument(documentId: string): WorkspaceDocument | null;
  getOpenDocuments(): WorkspaceDocument[];
  getActiveDocument(): WorkspaceDocument | null;

  switchTenant(tenantId: string): void;
  logout(): void;

  restoreMetadata(): RestoreEntry[];
  restore(entries: RestoreEntry[], options?: { authorise?: (entry: RestoreEntry) => boolean }): { restored: number; skipped: number };

  /** Access events, for audit. Focus and open are events; typing is not. */
  subscribe(listener: (event: WorkspaceEvent) => void): () => void;
  /** Snapshot invalidation, for rendering. Fires for every change, audit-worthy or not. */
  subscribeToChanges(listener: () => void): () => void;

  /**
   * Replace the policy in place.
   *
   * The shell resolves policy from preferences, and preferences live below the
   * point where the workspace is created; rebuilding the store on every toggle
   * would drop every open tab. Applies from the next open onwards -- a tab does
   * not change shape under the user because a setting moved.
   */
  setPolicy(rules: Partial<Record<WorkspacePolicyLevel, WorkspacePolicyRule>>): void;
}

export function createWorkspace(options: {
  session: WorkspaceSession;
  policy?: Partial<Record<WorkspacePolicyLevel, WorkspacePolicyRule>>;
  now?: () => string;
}): Workspace {
  let session = options.session;
  let resolved = resolveWorkspacePolicy(options.policy ?? {});
  const now = options.now ?? (() => new Date().toISOString());

  /**
   * Documents are REPLACED, never mutated.
   *
   * React reads this store through useSyncExternalStore and compares snapshots
   * by identity: a document edited in place is a change React cannot see, and a
   * getter that builds a fresh array on every call is an infinite render loop.
   * So `documents` is the snapshot -- it keeps its identity until something
   * actually changes, and a change replaces only the documents it touched, so
   * marking one form dirty does not hand every other tab a new object.
   */
  const drafts = new Map<string, Map<string, unknown>>();
  let documents: WorkspaceDocument[] = [];
  let activeId: string | null = null;
  /* The split is an arrangement over documents, not a property of one. Ordered
     left to right; empty means a single document is on screen. */
  let split: string[] = [];
  /* Documents living in windows of their own. Held here rather than inferred
     from presentation, because the shell has to know which windows it owns in
     order to close them on logout. */
  let detached: string[] = [];
  /**
   * Document ids, most recently focused first.
   *
   * Not derived from `lastActivatedAt`. That is an ISO string with millisecond
   * resolution, and three documents opened in one tick carry the same one, so
   * sorting by it returns an arbitrary order — "the document I was just looking
   * at" resolved to whichever the sort happened to prefer. The timestamp stays
   * on the document for display and audit; ordering lives here.
   */
  let recent: string[] = [];
  let counter = 0;
  const listeners = new Set<(event: WorkspaceEvent) => void>();
  const changeListeners = new Set<() => void>();

  /* Two subscriptions, deliberately. An audit trail and a render trigger are
     not the same thing: focusing a tab is both, typing in a form is only the
     second, and an audit log that records keystrokes is the noise §17.8 warns
     against. */
  const emit = (type: WorkspaceEventType, document: WorkspaceDocument) => {
    const event: WorkspaceEvent = { type, document, at: now() };
    for (const listener of listeners) listener(event);
  };

  const commit = (next: WorkspaceDocument[]) => {
    documents = next;
    for (const listener of changeListeners) listener();
  };

  const find = (documentId: string) => documents.find((doc) => doc.documentId === documentId) ?? null;

  /* Position in `recent`, with never-focused documents last. */
  const rank = (documentId: string) => {
    const at = recent.indexOf(documentId);
    return at < 0 ? Number.MAX_SAFE_INTEGER : at;
  };

  /* The mode a document falls back to when it leaves the split. */
  const singleMode = (): WorkspacePresentation =>
    resolved.modes.find((mode) => mode !== "SPLIT") ?? resolved.modes[0] ?? "SINGLE";

  /**
   * One pass that makes the document list agree with the arrangement.
   *
   * Everything on screen is ACTIVE -- the focused document, and both panes when
   * split, which is where maxActiveDocuments finally binds. Documents it does
   * not need to change are returned unchanged, so an unrelated tab keeps its
   * identity and does not re-render.
   */
  const reconcile = (list: WorkspaceDocument[], focusedId: string | null, splitIds: string[], touched: Set<string>, at: string): WorkspaceDocument[] => {
    const onScreen = new Set<string>([...(focusedId ? [focusedId] : []), ...splitIds]);

    /* Which off-screen documents stay mounted, ordered by when they were last
       used so that switching away and straight back is always instant.

       Dirty documents are exempt and do not spend a slot. Suspending releases
       what the screen was holding, and what a screen holds is the half-typed
       form nobody saved -- a cap on warm documents must never be the reason
       someone's work disappears. */
    const budget = Math.max(0, resolved.limits.maxWarmDocuments);
    const warm = new Set(
      list
        .filter((doc) => !onScreen.has(doc.documentId) && !doc.dirty && !detached.includes(doc.documentId))
        .sort((a, b) => rank(a.documentId) - rank(b.documentId))
        .slice(0, budget)
        .map((doc) => doc.documentId),
    );

    return list.map((doc) => {
      const inSplit = splitIds.includes(doc.documentId);
      const visible = onScreen.has(doc.documentId);
      const isDetached = detached.includes(doc.documentId);
      const presentation = isDetached ? "WINDOW" as const
        : inSplit ? "SPLIT" as const
        : doc.presentation === "SPLIT" || doc.presentation === "WINDOW" ? singleMode() : doc.presentation;
      const state = visible
        ? "ACTIVE" as const
        /* Detached documents are never released: they are on screen, just not
           on this one. */
        : isDetached || doc.dirty || warm.has(doc.documentId) ? "BACKGROUND" as const : "SUSPENDED" as const;
      const lastActivatedAt = touched.has(doc.documentId) ? at : doc.lastActivatedAt;
      if (presentation === doc.presentation && state === doc.state && lastActivatedAt === doc.lastActivatedAt) return doc;
      return { ...doc, presentation, state, lastActivatedAt };
    });
  };

  /**
   * Everything on screen is ACTIVE and nothing else is: one document when
   * single, both panes when split. maxActiveDocuments is what stops a third
   * pane, and it binds from here — in a tab-only workspace nothing could reach
   * it, which is why Phase 1 left it unenforced rather than pretending.
   */
  /* Focusing something outside the split leaves the split. Clicking a tab shows
     that tab; replacing whichever pane happened to be focused would make one
     click do two different things depending on state the user cannot see. */
  const activate = (documentId: string) => {
    split = split.includes(documentId) ? split : [];
    activeId = documentId;
    recent = [documentId, ...recent.filter((id) => id !== documentId)];
    commit(reconcile(documents, documentId, split, new Set([documentId]), now()));
  };

  const presentationFor = (requested?: WorkspacePresentation): { mode?: WorkspacePresentation; reason?: string } => {
    if (resolved.modes.length === 0) {
      return { reason: "No presentation mode is permitted here. Check the platform and shell workspace policy." };
    }
    if (requested && !resolved.modes.includes(requested)) {
      const level = resolved.deniedBy[requested];
      return { reason: `${requested} is not available${level ? ` — removed at the ${level} level` : ""}.` };
    }
    return { mode: requested ?? resolved.modes[0] };
  };

  const removeDocument = (document: WorkspaceDocument, announce: boolean) => {
    drafts.delete(document.documentId);
    let next = documents.filter((doc) => doc.documentId !== document.documentId);
    /* A split of one is not a split. Closing a pane collapses onto the other
       rather than leaving a divider with nothing on the far side. */
    detached = detached.filter((id) => id !== document.documentId);
    const remaining = split.filter((id) => id !== document.documentId);
    split = remaining.length >= 2 ? remaining : [];
    if (split.length === 1) split = [];
    recent = recent.filter((id) => id !== document.documentId);
    if (activeId === document.documentId) {
      activeId = null;
      /* Whatever was used most recently takes over. Deliberately silent: this
         is a consequence of the close, not a second access event, and an audit
         trail full of implicit focus records is the noise §17.8 warns about. */
      const successor = split.length > 0
        ? next.find((doc) => doc.documentId === split[0])
        : next.find((doc) => doc.documentId === recent[0]) ?? next[next.length - 1];
      if (successor) activeId = successor.documentId;
    }
    commit(reconcile(next, activeId, split, new Set(), now()));
    if (announce) emit("close", document);
  };

  const setDirty = (documentId: string, dirty: boolean) => {
    const doc = find(documentId);
    if (!doc || doc.dirty === dirty) return;
    /* Through reconcile, not a plain map: saving a document makes it eligible
       to cool, and marking one dirty exempts it. The dirty flag is an input to
       the lifecycle, not only a badge on a tab. */
    const next = documents.map((each) => (each.documentId === documentId ? { ...each, dirty } : each));
    commit(reconcile(next, activeId, split, new Set(), now()));
  };

  const closeMany = (candidates: WorkspaceDocument[], discardChanges: boolean, includeUnclosable = false): CloseResult => {
    const targets = includeUnclosable ? candidates : candidates.filter((doc) => doc.closable);
    const dirty = targets.filter((doc) => doc.dirty);
    if (dirty.length > 0 && !discardChanges) {
      return { ok: false, reason: `${dirty.length} document(s) have unsaved changes.`, dirtyDocumentIds: dirty.map((doc) => doc.documentId) };
    }
    for (const doc of targets) removeDocument(doc, true);
    return { ok: true };
  };

  const clear = () => {
    /* Unconditional, dirty or not. A tenant switch or a logout is not a moment
       to ask whether to keep another tenant's record on screen. */
    const closing = documents;
    drafts.clear();
    split = [];
    detached = [];
    recent = [];
    activeId = null;
    commit([]);
    for (const doc of closing) emit("close", doc);
  };

    /** Why this workspace cannot split right now, or undefined if it can. */
  const splitRefusal = (): string | undefined => {
  if (!resolved.modes.includes("SPLIT")) {
    const level = resolved.deniedBy.SPLIT;
    return `Split view is not available${level ? ` — removed at the ${level} level` : ""}.`;
  }
  /* Both panes are on screen and both are live, so a workspace that allows
     one active document cannot show two. */
  if (resolved.limits.maxActiveDocuments < 2) {
    return `This workspace shows one document at a time (maxActiveDocuments is ${resolved.limits.maxActiveDocuments}).`;
  }
  if (split.length >= resolved.limits.maxSplitPanes) {
    return `The split holds ${resolved.limits.maxSplitPanes} panes. Close one first.`;
  }
  return undefined;
  };

  const joinSplit = (documentId: string, side: SplitSide, baseId: string): OpenResult => {
  const document = find(documentId);
  if (!document) return { ok: false, reason: "That document is not open." };
  split = side === "left" ? [documentId, baseId] : [baseId, documentId];
  activeId = documentId;
  commit(reconcile(documents, activeId, split, new Set([documentId]), now()));
  return { ok: true, document: find(documentId)! };
  };


  return {
    openDocument(request) {
      const key = documentKey({ tenantId: session.tenantId, documentType: request.documentType, entityId: request.entityId });

      /* Before the limit check, deliberately. A full workspace must still be
         navigable -- refusing to focus something already open would mean the
         twelfth document locks you out of the first eleven. */
      const existing = documents.find((doc) => doc.documentKey === key);
      if (existing) {
        if (existing.documentId !== activeId) {
          activate(existing.documentId);
          emit("focus", find(existing.documentId)!);
        }
        /* Re-read: activate replaced the object, and handing back the stale one
           would give the caller a document whose state says BACKGROUND. */
        return { ok: true, reused: true, document: find(existing.documentId)! };
      }

      const { mode, reason } = presentationFor(request.presentation);
      if (!mode) return { ok: false, reason };

      if (documents.length >= resolved.limits.maxOpenDocuments) {
        return { ok: false, reason: `The workspace limit of ${resolved.limits.maxOpenDocuments} open documents has been reached. Close one first.` };
      }

      const documentId = `w${++counter}`;
      const security: WorkspaceSecurityContext = {
        tenantId: session.tenantId,
        branchId: session.branchId,
        userId: session.userId,
        roleId: session.roleId,
        subjectId: request.subjectId,
        interactionId: request.interactionId,
        contextId: request.contextId,
        documentId,
        documentKey: key,
      };

      const document: WorkspaceDocument = {
        documentId,
        documentKey: key,
        module: request.module,
        documentType: request.documentType.toUpperCase(),
        entityId: request.entityId,
        title: request.title,
        subtitle: request.subtitle,
        route: request.route,
        presentation: mode,
        state: "ACTIVE",
        dirty: false,
        closable: request.closable ?? true,
        security,
        openedAt: now(),
        lastActivatedAt: now(),
      };

      /* One commit, not two. Appending and then activating would move the
         snapshot twice for a single user action, and every subscriber would
         render an intermediate state that never existed on screen. */
      split = [];
      activeId = documentId;
      recent = [documentId, ...recent.filter((id) => id !== documentId)];
      commit(reconcile([...documents, document], documentId, split, new Set([documentId]), document.lastActivatedAt));
      const opened = find(documentId)!;
      emit("open", opened);
      return { ok: true, document: opened };
    },

    focusDocument(documentId) {
      const document = find(documentId);
      if (!document) return false;
      /* Coming back to a suspended tab is a resume, not a focus: it holds no
         data, and its authorisation is however old the tab is. Callers that
         need to check that authorisation call resumeDocument directly. */
      if (document.state === "SUSPENDED") return this.resumeDocument(documentId).ok;
      /* Focusing what is already focused is not an access event. */
      if (document.documentId === activeId) return true;
      activate(documentId);
      emit("focus", find(documentId)!);
      return true;
    },

    closeDocument(documentId, closeOptions) {
      const document = find(documentId);
      if (!document) return { ok: false, reason: "That document is not open." };
      /* Checked before the dirty guard: discardChanges answers "may I lose this
         work", which is a different question from "may this tab go away". */
      if (!document.closable) return { ok: false, reason: `${document.title} cannot be closed.` };
      if (document.dirty && !closeOptions?.discardChanges) {
        return { ok: false, reason: "This document has unsaved changes.", dirtyDocumentIds: [documentId] };
      }
      removeDocument(document, true);
      return { ok: true };
    },

    closeAll(closeOptions) {
      return closeMany([...documents], closeOptions?.discardChanges ?? false, closeOptions?.includeUnclosable ?? false);
    },

    closeOthers(documentId, closeOptions) {
      return closeMany(documents.filter((doc) => doc.documentId !== documentId), closeOptions?.discardChanges ?? false);
    },

    /* A no-op does not commit. Otherwise every keystroke in an already-dirty
       form invalidates the snapshot and re-renders the whole tab bar. */
    getDraft<T>(documentId: string, key: string) { return drafts.get(documentId)?.get(key) as T | undefined; },
    setDraft<T>(documentId: string, key: string, value: T) {
      if (!find(documentId)) return;
      const fields = drafts.get(documentId) ?? new Map<string, unknown>();
      if (Object.is(fields.get(key), value)) return;
      fields.set(key, value);
      drafts.set(documentId, fields);
      for (const listener of changeListeners) listener();
    },
    markDirty(documentId) { setDirty(documentId, true); },
    markClean(documentId) { setDirty(documentId, false); },

    suspendDocument(documentId) {
      const document = find(documentId);
      if (!document) return;
      if (document.state === "SUSPENDED") return;
      if (activeId === documentId) activeId = null;
      commit(documents.map((doc) => (doc.documentId === documentId ? { ...doc, state: "SUSPENDED" as const } : doc)));
      emit("suspend", find(documentId)!);
    },

    /**
     * Coming back from suspended is not a UI transition. The document released
     * its data, and permissions change while a record sits open, so this is a
     * point where authorisation is asked again — and a document the user may no
     * longer see is closed rather than shown.
     */
    resumeDocument(documentId, resumeOptions) {
      const document = find(documentId);
      if (!document) return { ok: false, reason: "That document is not open." };
      if (resumeOptions?.authorised === false) {
        removeDocument(document, true);
        return { ok: false, reason: "No longer authorised for this record." };
      }
      activate(documentId);
      emit("resume", find(documentId)!);
      return { ok: true, revalidationRequired: true };
    },

    getSplit() { return split; },

    /**
     * Open a document beside the focused one.
     *
     * With nothing open there is nothing to sit beside, so this is an ordinary
     * open. With something already open, the record is opened (or found, if it
     * is open elsewhere) and moved into the pane -- splitting a record against
     * itself, or opening a second copy of it, is what the duplicate guard
     * exists to prevent.
     */
    openInSplit(request, side = "right") {
      const base = activeId;
      if (!base) return this.openDocument(request);

      const refusal = splitRefusal();
      if (refusal) return { ok: false, reason: refusal };

      const key = documentKey({ tenantId: session.tenantId, documentType: request.documentType, entityId: request.entityId });
      const existing = documents.find((doc) => doc.documentKey === key);
      if (existing) return joinSplit(existing.documentId, side, base);

      const opened = this.openDocument(request);
      if (!opened.ok || !opened.document) return opened;
      /* openDocument leaves the split, so the pane is rebuilt around the two
         documents rather than added to whatever was there before. */
      return joinSplit(opened.document.documentId, side, base);
    },

    moveToSplit(documentId, side = "right") {
      const base = activeId;
      if (!base || base === documentId) return { ok: false, reason: "Nothing to split against." };
      const refusal = splitRefusal();
      if (refusal) return { ok: false, reason: refusal };
      return joinSplit(documentId, side, base);
    },

    splitWithPrevious(side = "right") {
      const current = activeId ? find(activeId) : null;
      if (!current || documents.length < 2) return { ok: false };
      const previousId = recent.find((id) => id !== current.documentId);
      const previous = previousId ? find(previousId) : null;
      if (!previous) return { ok: false };
      const refusal = splitRefusal();
      if (refusal) return { ok: false, reason: refusal };
      /* The previous document is the base and the current one joins beside it,
         so the document the user is looking at keeps the focus. */
      return joinSplit(current.documentId, side, previous.documentId);
    },

    getDetached() { return detached; },

    detachDocument(documentId) {
      const document = find(documentId);
      if (!document) return { ok: false, reason: "That document is not open." };
      if (detached.includes(documentId)) return { ok: true, document };
      if (!resolved.allowDetach) return { ok: false, reason: "Detaching to a window is not allowed here." };
      if (!resolved.modes.includes("WINDOW")) {
        const level = resolved.deniedBy.WINDOW;
        return { ok: false, reason: `A separate window is not available${level ? ` — removed at the ${level} level` : ""}.` };
      }
      if (detached.length >= resolved.limits.maxDetachedWindows) {
        return { ok: false, reason: `${resolved.limits.maxDetachedWindows} window(s) are already open. Close one first.` };
      }

      detached = [...detached, documentId];
      /* It leaves the split and gives up focus here — it is not on this screen
         any more, and leaving it marked active would draw it twice. */
      split = split.includes(documentId) ? [] : split;
      if (activeId === documentId) {
        activeId = recent.find((id) => id !== documentId && !detached.includes(id)) ?? null;
      }
      commit(reconcile(documents, activeId, split, new Set(), now()));
      return { ok: true, document: find(documentId)! };
    },

    attachDocument(documentId) {
      const document = find(documentId);
      if (!document) return { ok: false, reason: "That document is not open." };
      detached = detached.filter((id) => id !== documentId);
      activate(documentId);
      return { ok: true, document: find(documentId)! };
    },

    swapSplit() {
      if (split.length < 2) return;
      split = [...split].reverse();
      commit(reconcile(documents, activeId, split, new Set(), now()));
    },

    exitSplit() {
      if (split.length === 0) return;
      split = [];
      commit(reconcile(documents, activeId, split, new Set(), now()));
    },

    isAlreadyOpen({ documentType, entityId }) {
      const key = documentKey({ tenantId: session.tenantId, documentType, entityId });
      return documents.some((doc) => doc.documentKey === key);
    },

    getDocument(documentId) { return find(documentId); },
    /* The array itself, not a copy: it is the snapshot React compares by
       identity, and a copy would differ on every call. Treat it as read-only —
       nothing here mutates it, and neither should a caller. */
    getOpenDocuments() { return documents; },
    getActiveDocument() { return activeId ? find(activeId) : null; },

    switchTenant(tenantId) { clear(); session = { ...session, tenantId }; },
    logout() { clear(); },

    restoreMetadata() {
      return documents.map((doc) => ({
        tenantId: doc.security.tenantId,
        userId: doc.security.userId,
        documentKey: doc.documentKey,
        module: doc.module,
        documentType: doc.documentType,
        entityId: doc.entityId,
        route: doc.route,
        presentation: doc.presentation,
      }));
    },

    restore(entries, restoreOptions) {
      let restored = 0;
      let skipped = 0;
      const pending: WorkspaceDocument[] = [];
      for (const entry of entries) {
        /* Rebound to the live session, never trusted as written. A restore blob
           is a file on a shared machine; the tenant and user in it are a claim. */
        if (entry.tenantId !== session.tenantId || entry.userId !== session.userId) { skipped += 1; continue; }
        if (restoreOptions?.authorise && !restoreOptions.authorise(entry)) { skipped += 1; continue; }
        if (documents.length + pending.length >= resolved.limits.maxOpenDocuments) { skipped += 1; continue; }

        /* The saved mode may not be permitted on this device -- a window saved
           on the desktop restoring into the web shell. Fall back rather than
           drop the document. */
        const mode = resolved.modes.includes(entry.presentation) ? entry.presentation : resolved.modes[0];
        if (!mode) { skipped += 1; continue; }

        const documentId = `w${++counter}`;
        restored += 1;
        pending.push({
          documentId,
          documentKey: entry.documentKey,
          module: entry.module,
          documentType: entry.documentType,
          entityId: entry.entityId,
          /* Not the subject's name: nothing carrying one survived the save. The
             document replaces this when it loads its own data. */
          title: `${entry.documentType} ${entry.entityId}`,
          route: entry.route,
          presentation: mode,
          closable: true,
          /* Suspended, not active. Mounting five live screens at login is the
             performance problem this lifecycle exists to avoid, and none of
             them has any data yet. */
          state: "SUSPENDED",
          dirty: false,
          security: {
            tenantId: session.tenantId,
            branchId: session.branchId,
            userId: session.userId,
            roleId: session.roleId,
            documentId,
            documentKey: entry.documentKey,
          },
          openedAt: now(),
          lastActivatedAt: now(),
        });
      }
      /* One commit for the batch. Restoring eight documents on login should
         move the snapshot once, not eight times. */
      if (pending.length) commit([...documents, ...pending]);
      return { restored, skipped };
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },

    subscribeToChanges(listener) {
      changeListeners.add(listener);
      return () => { changeListeners.delete(listener); };
    },

    setPolicy(rules) { resolved = resolveWorkspacePolicy(rules); },
  };
}
