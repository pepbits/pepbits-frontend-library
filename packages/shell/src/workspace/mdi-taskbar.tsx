"use client";
import { useLocalization } from "@pepbits/i18n/react";


import { cn } from "@pepbits/ui";
import type { WorkspaceDocument } from "./index";
import type { MdiFrame } from "./mdi-frames.ts";

/**
 * One chip per open window, along the bottom.
 *
 * It is the only way back to a minimised window, so it lists every open
 * document rather than only the visible ones — without it, minimising is a way
 * of losing a record.
 */
export function MdiTaskbar({ documents, frames, activeDocumentId, onSelect }: {
  documents: WorkspaceDocument[];
  frames: MdiFrame[];
  activeDocumentId: string | null;
  onSelect: (documentId: string) => void;
}) {
  const {t: translateCopy} = useLocalization();
  if (documents.length === 0) return null;
  return (
    <nav aria-label={translateCopy("ui.open.windows.6cbd4f67")}>
    <div
      role="toolbar"
      /* Named for the same reason the tab strip is: a page can have toolbars of
         its own, and "which row lists my open windows" should not be a question
         answered by counting. */
      aria-label={translateCopy("ui.open.windows.6cbd4f67")}
      className="no-print flex h-9 shrink-0 items-center gap-1 border-t border-[var(--border)] bg-[var(--surface-2)] px-2"
    >
      {documents.map((document) => {
        const minimised = frames.find((frame) => frame.documentId === document.documentId)?.minimised ?? false;
        const active = document.documentId === activeDocumentId;
        return (
          <button
            key={document.documentId}
            type="button"
            aria-current={active ? "true" : undefined}
            /* The state a chip is in has to be in its name. The dot and the
               dimming are not available to everyone, and "which of these am I
               looking at" is the question this row exists to answer. */
            aria-label={[document.title, minimised ? "minimised" : null, document.dirty ? "unsaved changes" : null].filter(Boolean).join(" — ")}
            onClick={() => onSelect(document.documentId)}
            className={cn(
              "focus-ring flex h-7 max-w-52 shrink-0 items-center gap-2 rounded-lg border px-2.5 text-left transition",
              active ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary-strong)]" : "border-transparent text-[var(--text-muted)] hover:bg-[var(--surface-3)]",
              minimised && "opacity-60",
            )}
          >
            <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", document.dirty ? "bg-[var(--warning)]" : active ? "bg-[var(--primary)]" : "bg-[var(--text-subtle)]")} />
            <span className="min-w-0 flex-1 truncate text-[length:calc(10px*var(--fs-scale))] font-bold">{document.title}</span>
          </button>
        );
      })}
    </div>
    </nav>
  );
}
