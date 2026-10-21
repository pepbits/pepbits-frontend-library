"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import type { StepId, StepMeta } from "@/lib/registration";

export function Stepper({
  steps,
  current,
  completed,
  reachable,
  onJump,
}: {
  steps: StepMeta[];
  current: StepId;
  completed: Set<StepId>;
  reachable: Set<StepId>;
  onJump: (id: StepId) => void;
}) {
  return (
    <nav aria-label="Registration steps">
      <ol className="space-y-1">
        {steps.map((s, i) => {
          const isCurrent = s.id === current;
          const isDone = completed.has(s.id) && !isCurrent;
          const canJump = reachable.has(s.id) && !isCurrent;
          const last = i === steps.length - 1;
          return (
            <li key={s.id} className="relative">
              {!last && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute bottom-[-12px] left-[25.5px] top-[42px] w-px transition-colors duration-300",
                    isDone ? "bg-mint/60" : "bg-white/15",
                  )}
                />
              )}
              <button
                type="button"
                disabled={!canJump}
                onClick={() => onJump(s.id)}
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "group flex w-full items-start gap-3.5 rounded-xl px-3 py-2.5 text-left transition-colors duration-150",
                  canJump && "hover:bg-white/[0.06]",
                  !canJump && !isCurrent && "cursor-default",
                  isCurrent && "bg-white/[0.08]",
                )}
              >
                <span
                  className={cn(
                    "relative grid h-7 w-7 shrink-0 place-items-center rounded-full text-[0.8rem] font-semibold tabular-nums transition-colors duration-200",
                    isDone && "bg-mint text-scrub-900",
                    isCurrent && "bg-white text-scrub-900 ring-4 ring-mint/25",
                    !isDone && !isCurrent && "border border-white/20 text-scrub-200",
                  )}
                >
                  {isDone ? <Check className="h-4 w-4 animate-pop" strokeWidth={3} aria-hidden="true" /> : i + 1}
                </span>
                <span className="min-w-0 pt-0.5">
                  <span
                    className={cn(
                      "block text-[0.92rem] font-semibold leading-tight",
                      isCurrent || isDone ? "text-white" : "text-scrub-200",
                    )}
                  >
                    {s.title}
                    {isDone && <span className="sr-only"> (completed)</span>}
                  </span>
                  <span className="mt-0.5 block text-[0.8rem] leading-snug text-scrub-300">{s.caption}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
