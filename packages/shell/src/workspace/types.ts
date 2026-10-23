/**
 * The vocabulary of the workspace, shared by both shells.
 *
 * The framework's central claim is that a record is the unit of work and a tab,
 * split pane, page or window is only how it is shown -- so everything here is
 * about the DOCUMENT, and `presentation` is one field on it rather than the
 * thing being modelled.
 */

/** How a document is shown. Chosen by policy, not by the document. */
export type WorkspacePresentation = "SINGLE" | "TAB" | "SPLIT" | "WINDOW";

/**
 * What a document is currently costing.
 *
 * ACTIVE may hold subscriptions, polling and timers. BACKGROUND keeps its state
 * and unsaved edits but stops paying for liveness. SUSPENDED has released its
 * heavy resources and must revalidate both data and authorisation before it can
 * be shown again -- permissions change while a record sits open.
 */
export type WorkspaceDocumentState = "ACTIVE" | "BACKGROUND" | "SUSPENDED" | "MINIMIZED" | "CLOSED";

/**
 * Everything a document needs to know about who is looking at it.
 *
 * Carried per document and never read from a shared mutable "current subject".
 * With two subjects open, one global variable is a wrong-subject action waiting
 * for a race between a click and a fetch.
 */
export interface WorkspaceSecurityContext {
  tenantId: string;
  branchId?: string;
  userId: string;
  roleId?: string;
  subjectId?: string;
  interactionId?: string;
  contextId?: string;
  documentId: string;
  documentKey: string;
}

export interface WorkspaceDocument {
  documentId: string;
  documentKey: string;

  module: string;
  documentType: string;
  entityId: string;

  /** Display only. Never persisted -- see `restoreMetadata`. */
  title: string;
  subtitle?: string;
  route?: string;

  presentation: WorkspacePresentation;
  state: WorkspaceDocumentState;
  dirty: boolean;
  /**
   * Every shell has a tab that must stay -- the module dashboard you return to
   * when everything else is gone. Held here rather than filtered out by each
   * shell's own close paths, because one of those shells eventually forgets.
   */
  closable: boolean;

  security: WorkspaceSecurityContext;

  openedAt: string;
  lastActivatedAt: string;
}

export interface WorkspaceLimits {
  maxOpenDocuments: number;
  maxActiveDocuments: number;
  maxSplitPanes: number;
  maxDetachedWindows: number;
  /**
   * How many off-screen documents stay mounted.
   *
   * The nearby ones stay warm so switching back is instant and nothing typed
   * into them is lost; everything past that is suspended and released. Unset
   * means no limit, so a workspace built before this existed does not silently
   * start dropping screens.
   */
  maxWarmDocuments: number;
}
