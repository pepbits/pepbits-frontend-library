import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { cn } from "./cn";

/** A titled group of fields inside a step. Uses fieldset/legend for screen readers. */
export function Section({
  title,
  description,
  aside,
  error,
  errorId,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  aside?: ReactNode;
  error?: string;
  errorId?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={cn("min-w-0", className)}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          <legend className="text-[1.05rem] font-semibold text-ink-900">{title}</legend>
          {description && <p className="mt-0.5 max-w-[68ch] text-sm leading-snug text-ink-500">{description}</p>}
        </div>
        {aside}
      </div>
      {error && (
        <p id={errorId ? `${errorId}-error` : undefined} className="mb-3 flex animate-fade-in items-center gap-1.5 text-[0.85rem] font-medium text-signal">
          <CircleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
      {children}
    </fieldset>
  );
}
