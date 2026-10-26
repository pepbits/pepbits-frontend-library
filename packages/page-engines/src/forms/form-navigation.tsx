"use client";
import {LocalizedText} from "@pepbits/i18n/react";

import React from "react";
import { Check, ChevronRight } from "@pepbits/icons";
import {cn} from "@pepbits/ui";
import type {LegacyFormNavigation} from "@pepbits/preferences";
import type {FormSectionSchema} from "../types";

export function FormNavigationControl({ type, sections, activeId, onChange, completion }: { type: LegacyFormNavigation; sections: FormSectionSchema[]; activeId: string; onChange: (id: string) => void; completion: Record<string, number> }) {
  const activeIndex = sections.findIndex((section) => section.id === activeId);
  if ((type === "rail" || type === "scroll" || type === "stepper")) return (
    <aside className="hidden w-56 shrink-0 border-r border-[var(--border)] bg-[var(--surface-2)] p-3 lg:block">
      <div className="mb-3 px-2 text-[length:calc(8.5px*var(--fs-scale))] font-black uppercase tracking-[.13em] text-[var(--text-subtle)]"><LocalizedText message="ui.record.sections.6be029e5" /></div>
      <div className="space-y-1">
        {sections.map((section, index) => {
          const active = section.id === activeId;
          const complete = completion[section.id] === 100;
          return <button key={section.id} type="button" onClick={() => onChange(section.id)} className={cn("focus-ring group flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2.5 text-left transition", active ? "border-[color-mix(in_srgb,var(--primary)_25%,transparent)] bg-[var(--surface)] text-[var(--primary-strong)] shadow-sm" : "border-transparent text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]")}><span className={cn("flex size-6 shrink-0 items-center justify-center rounded-lg text-[length:calc(9px*var(--fs-scale))] font-black", complete ? "bg-[color-mix(in_srgb,var(--success)_12%,transparent)] text-[var(--success-ink)]" : active ? "bg-[var(--primary-soft)] text-[var(--primary)]" : "bg-[var(--surface-3)]")}>{complete ? <Check className="size-3.5" /> : index + 1}</span><span className="min-w-0 flex-1"><span className="block truncate text-[length:calc(10.5px*var(--fs-scale))] font-extrabold"><LocalizedText message={section.titleKey ?? section.title} /></span><span className="mt-0.5 block text-[length:calc(8.5px*var(--fs-scale))] text-[var(--text-subtle)]">{completion[section.id]}<LocalizedText message="ui.complete.fe9543cf" /></span></span><ChevronRight className={cn("size-3.5", active ? "text-[var(--primary)]" : "opacity-0 group-hover:opacity-60")} /></button>;
        })}
      </div>
    </aside>
  );

  if (type === "tabs") return (
    <div className="nex-scrollbar flex min-h-11 items-end gap-0 overflow-x-auto border-b border-[var(--border)] bg-[var(--surface-2)] px-3 pt-1">
      {sections.map((section, index) => {
        const active = section.id === activeId;
        return <button key={section.id} type="button" onClick={() => onChange(section.id)} className={cn("focus-ring relative flex h-10 shrink-0 items-center gap-2 px-3 text-[length:calc(10.5px*var(--fs-scale))] font-bold transition", active ? "text-[var(--primary)]" : "text-[var(--text-muted)] hover:text-[var(--text)]")}><span className={cn("flex size-5 items-center justify-center rounded-md text-[length:calc(8px*var(--fs-scale))] font-black", completion[section.id] === 100 ? "bg-[color-mix(in_srgb,var(--success)_12%,transparent)] text-[var(--success-ink)]" : "bg-[var(--surface-3)]")}>{completion[section.id] === 100 ? <Check className="size-3" /> : index + 1}</span><LocalizedText message={section.titleKey ?? section.title} />{active ? <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[var(--primary)]" /> : null}</button>;
      })}
    </div>
  );

  return (
    <div className="border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
      <div className="flex items-center">
        {sections.map((section, index) => {
          const active = section.id === activeId;
          const complete = index < activeIndex || completion[section.id] === 100;
          return <React.Fragment key={section.id}><button type="button" onClick={() => onChange(section.id)} className="focus-ring group flex shrink-0 flex-col items-center gap-1 rounded-lg px-1"><span className={cn("flex size-7 items-center justify-center rounded-full border text-[length:calc(9px*var(--fs-scale))] font-black transition", active ? "border-[var(--primary)] bg-[var(--primary-fill)] text-white shadow-[0_0_0_4px_var(--primary-soft)]" : complete ? "border-[var(--success)] bg-[var(--success-fill)] text-white" : "border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text-muted)]")}>{complete && !active ? <Check className="size-3.5" /> : index + 1}</span><span className={cn("hidden max-w-24 truncate text-[length:calc(8.5px*var(--fs-scale))] font-bold sm:block", active ? "text-[var(--primary)]" : "text-[var(--text-muted)]")}><LocalizedText message={section.titleKey ?? section.title} /></span></button>{index < sections.length - 1 ? <div className={cn("mx-1 h-0.5 min-w-3 flex-1 rounded-full sm:mx-2", index < activeIndex ? "bg-[var(--success)]" : "bg-[var(--border)]")} /> : null}</React.Fragment>;
        })}
      </div>
    </div>
  );
}
