import { Check } from "lucide-react";
import { cn } from "../../lib/utils";

export function Stepper({ steps, current, onStep }: { steps: string[]; current: number; onStep?: (i: number) => void }) {
  return (
    <ol className="flex flex-wrap items-center gap-1">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s} className="flex items-center gap-1">
            <button type="button" disabled={!onStep || i > current} onClick={() => onStep?.(i)}
              className={cn("flex h-8 items-center gap-2 rounded-md px-2 text-xs font-medium transition", active ? "bg-brand/10 text-brand" : done ? "text-fg hover:bg-subtle" : "text-faint")}>
              <span className={cn("grid size-5 place-items-center rounded-full text-[10px] tabular", active ? "bg-brand text-brand-fg" : done ? "bg-ok text-white" : "border border-line")}>
                {done ? <Check className="size-3" /> : i + 1}
              </span>
              {s}
            </button>
            {i < steps.length - 1 && <span className={cn("h-px w-6", done ? "bg-ok" : "bg-line")} />}
          </li>
        );
      })}
    </ol>
  );
}
