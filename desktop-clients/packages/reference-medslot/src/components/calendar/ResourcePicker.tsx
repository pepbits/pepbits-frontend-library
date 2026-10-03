"use client";
import {SourceButton,SourceInput,LocalizedText} from "@pepbits/ops-ui";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import type { Resource } from "../../lib/types";
import { ResourceCategoryIcon } from "../icons";
import { Button, cx } from "../ui";

/** Multi-select popover for choosing which resources appear as calendar columns. */
export function ResourcePicker({ resources, value, onChange, single }: { resources: Resource[]; value: number[]; onChange: (ids: number[]) => void; single?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const list = useMemo(() => resources.filter((r) => !q || `${r.name} ${r.type_name} ${r.department_name}`.toLowerCase().includes(q.toLowerCase())), [resources, q]);
  const groups = useMemo(() => {
    const m = new Map<string, Resource[]>();
    for (const r of list) m.set(r.department_name, [...(m.get(r.department_name) ?? []), r]);
    return Array.from(m.entries());
  }, [list]);
  const label = value.length === 0 ? (single ? "Choose a resource" : "All in view")
    : value.length === 1 ? resources.find((r) => r.id === value[0])?.name ?? "1 selected" : `${value.length} resources`;
  const toggle = (id: number) => single ? (onChange([id]), setOpen(false)) : onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <div ref={ref} className="relative">
      <SourceButton onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="inline-flex h-10 min-w-48 items-center justify-between gap-2 rounded-[var(--radius-ctl)] border border-line bg-panel px-3 text-sm hover:border-ink/30">
        <span className="truncate">{label}</span><ChevronDown className="size-4 text-mute" />
      </SourceButton>
      {open && (
        <div className="absolute left-0 top-11 z-30 w-80 overflow-hidden rounded-xl border border-line bg-panel shadow-[var(--shadow-pop)] animate-pop-in">
          <div className="relative border-b border-line-2 p-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-mute" />
            <SourceInput autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people, rooms, equipment" className="h-9 w-full rounded-md bg-paper pl-8 pr-2 text-sm focus:outline-none" />
          </div>
          <div className="max-h-80 overflow-y-auto scroll-thin py-1">
            {groups.map(([dept, rs]) => (
              <div key={dept}>
                <p className="px-3 pb-1 pt-2 text-[11px] font-medium text-mute">{dept}</p>
                {rs.map((r) => (
                  <SourceButton key={r.id} onClick={() => toggle(r.id)} className={cx("flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm hover:bg-line-2", value.includes(r.id) && "bg-scrub-soft/60")}>
                    {!single && <SourceInput type="checkbox" readOnly checked={value.includes(r.id)} className="size-4 accent-[var(--color-scrub)]" tabIndex={-1} />}
                    <ResourceCategoryIcon category={r.category} className="size-4 text-mute" />
                    <span className="min-w-0 flex-1 truncate">{r.name}</span><span className="text-[11px] text-mute">{r.type_name}</span>
                  </SourceButton>
                ))}
              </div>
            ))}
            {!list.length && <p className="px-3 py-6 text-center text-sm text-mute"><LocalizedText message="Nothing matches." /></p>}
          </div>
          {!single && (
            <div className="flex justify-between border-t border-line-2 p-2">
              <Button size="sm" variant="ghost" onClick={() => onChange([])}><LocalizedText message="Clear" /></Button>
              <Button size="sm" variant="primary" onClick={() => setOpen(false)}><LocalizedText message="Done" /></Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
