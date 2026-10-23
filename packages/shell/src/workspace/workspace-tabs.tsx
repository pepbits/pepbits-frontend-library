"use client";
import { LocalizedText, useLocalization } from "@pepbits/i18n/react";

import { Ellipsis, ExternalLink, Plus, X } from "@pepbits/icons";
import { ActionMenu, MenuButton } from "@pepbits/components";
import { IconButton, cn } from "@pepbits/ui";
import { useShell } from "../shell-context";

import type { WorkspaceDocument } from "./index";

/**
 * The workspace tab strip.
 *
 * Moved out of apps/desktop so both shells draw the same thing, and made a
 * `tablist` rather than a row of buttons: the active tab used to be a coloured
 * underline and nothing else, so a screen reader announced several identical
 * tabs with no way to tell which one was open.
 *
 * Deliberately dumb -- it takes documents and callbacks. The store, the policy
 * and the unsaved-changes question all live above it.
 */
export function WorkspaceTabs({ documents, activeDocumentId, onActivate, onClose, onCloseOthers, onOpenCommand, onSplit, onSwap, onExitSplit, isSplit, onDetach, detachedIds }: {
  documents: WorkspaceDocument[];
  activeDocumentId: string | null;
  onActivate: (documentId: string) => void;
  onClose: (documentId: string) => void;
  onCloseOthers: (documentId: string) => void;
  onOpenCommand: () => void;
  /** Split actions. Omitted where the shell cannot split. */
  onSplit?: () => void;
  onSwap?: () => void;
  onExitSplit?: () => void;
  isSplit?: boolean;
  /** Omitted where the shell cannot open windows. */
  onDetach?: (documentId: string) => void;
  detachedIds?: string[];
}) {
  const {t: translateCopy} = useLocalization();
  const {product}=useShell();
  const {t}=useLocalization();
  const titleFor=(doc:WorkspaceDocument)=>{
    const page=product.pages[doc.documentType.toLowerCase()],base=page?.title;
    if(!page?.titleKey||!base||doc.title!==base&&!doc.title.startsWith(`${base} • `))return t(doc.title);
    const suffix=doc.title.slice(base.length).split(' • ').map(part=>part==='New'||part==='Edit'?t(part):part).join(' • ');
    return t(page.titleKey)+suffix;
  };
  const activeId = documents.some((doc) => doc.documentId === activeDocumentId) ? activeDocumentId : documents[0]?.documentId ?? null;
  return (
    <nav aria-label={translateCopy("ui.open.documents.eadd61ba")} className="no-print flex h-[var(--tabbar-height)] shrink-0 items-end border-b border-[var(--border)] bg-[var(--surface-2)] px-2">
      {/* Named, because a page can have tablists of its own — a billing record has
          six — and "tablist" on its own does not say which one holds the open
          documents. */}
      <div role="tablist" aria-label={translateCopy("ui.open.documents.eadd61ba")} className="nex-scrollbar flex min-w-0 flex-1 items-end gap-1 overflow-x-auto overflow-y-hidden pt-1.5">
        {documents.map((doc) => {
          const active = doc.documentId === activeId;
          const detached = detachedIds?.includes(doc.documentId) ?? false;
          return (
            <div key={doc.documentId} role="presentation" className={cn("focus-ring group relative flex h-9 max-w-56 shrink-0 items-center gap-2 rounded-t-[11px] border px-3 text-left transition", active ? "border-[var(--border)] border-b-[var(--surface)] bg-[var(--surface)] text-[var(--text)]" : "border-transparent bg-transparent text-[var(--text-muted)] hover:bg-[var(--surface-3)]")}>
              <button type="button" role="tab" aria-keyshortcuts={doc.closable ? "Delete" : undefined} aria-selected={active} tabIndex={active ? 0 : -1}
                aria-label={[titleFor(doc), detached ? "in its own window" : null, doc.dirty ? "unsaved changes" : null].filter(Boolean).join(" — ")}
                onClick={() => onActivate(doc.documentId)}
                onKeyDown={event => {
                  if (event.key === "Delete" && doc.closable) { event.preventDefault(); onClose(doc.documentId); return; }
                  const index = documents.findIndex(item => item.documentId === doc.documentId);
                  const next = event.key === "ArrowRight" ? (index + 1) % documents.length : event.key === "ArrowLeft" ? (index - 1 + documents.length) % documents.length : event.key === "Home" ? 0 : event.key === "End" ? documents.length - 1 : -1;
                  if (next < 0) return;
                  event.preventDefault(); onActivate(documents[next]!.documentId);
                  event.currentTarget.closest('[role="tablist"]')?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
                }}
                className="focus-ring flex min-w-0 flex-1 items-center gap-2 rounded-md text-left">
              {detached
                ? <ExternalLink aria-hidden className="size-3 shrink-0 text-[var(--text-subtle)]" />
                : <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", doc.dirty ? "bg-[var(--warning)]" : active ? "bg-[var(--primary)]" : "bg-[var(--text-subtle)]")} />}
              <span className="min-w-0 flex-1 truncate text-[length:calc(10.5px*var(--fs-scale))] font-bold">{<LocalizedText message={titleFor(doc)} />}</span>
              </button>
              {doc.closable ? (
                <span aria-hidden="true" title={t("Close {item}",{item:t(doc.title)})}
                  onClick={(event) => { event.stopPropagation(); onClose(doc.documentId); }}
                  className="flex size-5 shrink-0 items-center justify-center rounded-md opacity-0 transition hover:bg-[var(--surface-3)] group-hover:opacity-100 focus:opacity-100">
                  <X className="size-3" />
                </span>
              ) : null}
              {active ? <span aria-hidden className="absolute inset-x-2 top-0 h-0.5 rounded-full bg-[var(--primary)]" /> : null}
            </div>
          );
        })}
      </div>
      <div className="mb-1 flex shrink-0 items-center gap-0.5 border-l border-[var(--border)] pl-1.5">
        {documents.find(doc => doc.documentId === activeId)?.closable ? <IconButton label={t("Close {item}",{item:t(documents.find(doc => doc.documentId === activeId)?.title ?? "")})} className="size-8" onClick={() => { if (activeId) onClose(activeId); }}><X className="size-3.5" /></IconButton> : null}
        <IconButton label="ui.open.page.af030334" className="size-8" onClick={() => onOpenCommand()}><Plus className="size-3.5" /></IconButton>
        <ActionMenu trigger={<IconButton label="ui.tab.options.743b9c60" className="size-8"><Ellipsis className="size-3.5" /></IconButton>}>
          {(close) => <>
            {onDetach && activeId && !detachedIds?.includes(activeId) ? <MenuButton label="Open in its own window" onClick={() => { onDetach(activeId); close(); }} /> : null}
            {onSplit && !isSplit ? <MenuButton label="Split with the last document" hint="Alt+\\" onClick={() => { onSplit(); close(); }} /> : null}
            {isSplit && onSwap ? <MenuButton label="Swap the panes" onClick={() => { onSwap(); close(); }} /> : null}
            {isSplit && onExitSplit ? <MenuButton label="Make full screen" hint="Alt+Shift+\\" onClick={() => { onExitSplit(); close(); }} /> : null}
            <MenuButton label="Close other tabs" onClick={() => { if (activeId) onCloseOthers(activeId); close(); }} />
            <MenuButton label="Open command palette" onClick={() => { onOpenCommand(); close(); }} />
          </>}
        </ActionMenu>
      </div>
    </nav>
  );
}
