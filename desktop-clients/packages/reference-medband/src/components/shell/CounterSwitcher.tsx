"use client";
import { Check, ChevronDown, MonitorSmartphone } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { LocalizedText } from "@pepbits/ops-ui";
import { encounterType } from "../../lib/encounter-config";
import { useMaster } from "../../lib/master";
import { useCounter, useStore } from "../../lib/store";
import { cx } from "../../lib/utils";
import { SourceButton } from "../controls";

/**
 * The registration desk this workstation works at. It decides which encounter types can be opened. The desks and the encounter
 * types each serves come from the backend master data; the choice is a workstation setting, remembered per authenticated scope.
 */
export function CounterSwitcher() {
  const { counterId, setCounterId } = useStore();
  const { COUNTERS } = useMaster();
  const current = useCounter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative ml-1 md:ml-2 md:border-l md:border-line md:pl-3" data-medband-counter="true">
      <SourceButton
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Counter"
        className="flex h-11 items-center gap-2.5 rounded-lg px-2 text-left hover:bg-canvas"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-band text-ink">
          <MonitorSmartphone className="size-4" />
        </span>
        <span className="hidden leading-tight lg:block">
          <span className="block text-[13px] font-semibold">{current?.name ?? <LocalizedText message="Choose counter" />}</span>
          <span className="block text-[11.5px] text-ink-faint">{current?.location}</span>
        </span>
        <ChevronDown className="size-4 text-ink-faint" />
      </SourceButton>
      {open && (
        <div role="listbox" aria-label="Counter" className="animate-rise absolute top-full right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl bg-paper shadow-pop ring-1 ring-line">
          <p className="border-b border-line-soft px-4 py-2.5 text-[12.5px] text-ink-soft"><LocalizedText message="Each counter opens only the visit types it serves." /></p>
          {COUNTERS.map((c) => {
            const on = c.id === counterId;
            return (
              <SourceButton
                key={c.id}
                role="option"
                aria-selected={on}
                onClick={() => {
                  setCounterId(c.id);
                  setOpen(false);
                }}
                className={cx("flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-canvas", on && "bg-scrub-50")}
              >
                <span className="mt-0.5 grid size-4 shrink-0 place-items-center">{on && <Check className="size-4 text-scrub-700" />}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-semibold">{c.name}</span>
                  <span className="block text-[12px] text-ink-faint">{c.location}</span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {c.encounterTypes.map((t) => {
                      const et = encounterType(t);
                      return (
                        <span key={t} className={cx("rounded px-1.5 py-px text-[11px] font-semibold", et.tone.soft, et.tone.text)}>
                          <LocalizedText message={et.label} />
                        </span>
                      );
                    })}
                  </span>
                </span>
              </SourceButton>
            );
          })}
        </div>
      )}
    </div>
  );
}
