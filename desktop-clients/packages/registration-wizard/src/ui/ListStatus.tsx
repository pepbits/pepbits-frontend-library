import { CircleAlert, LoaderCircle, RotateCw } from "lucide-react";
import type { ListState } from "../lists";

/**
 * Inline loading and failure state for one host list. A failed list never blocks
 * the rest of the page: it shows here, next to the control that needs it, with retry.
 */
export function ListStatus<T>({ list, what }: { list: ListState<T>; what: string }) {
  if (list.status === "loading")
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-ink-500">
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading {what}
      </p>
    );
  if (list.status === "error")
    return (
      <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-signal/25 bg-[#FFF5F5] px-3 py-2 text-sm text-signal">
        <CircleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>We couldn&apos;t load {what}.</span>
        <button
          type="button"
          onClick={list.retry}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-semibold text-scrub-700 hover:bg-scrub-50"
        >
          <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
          Try again
        </button>
      </div>
    );
  return null;
}
