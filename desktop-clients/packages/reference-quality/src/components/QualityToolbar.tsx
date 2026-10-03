"use client";
import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { ReferenceLink as Link } from "@pepbits/reference-host";
import { SourceButton } from "./controls";
import { useApi } from "../lib/hooks";
import { usePathname } from "../lib/navigation";

interface Tasks { tasks: { key: string; label: string; count: number; href: string }[]; total: number }

/**
 * The only piece of the source header kept: the "work waiting for you" menu and the demonstration-data notice.
 * The host owns the enterprise header, sidebar, user menu and sign-out, so none of those are rendered here.
 * Refreshes on navigation and every minute.
 */
export function QualityToolbar() {
  const pathname = usePathname();
  const { t } = useLocalization();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data, reload } = useApi<Tasks>("/me/tasks");
  useEffect(() => { void reload(); }, [pathname, reload]);
  useEffect(() => {
    const timer = setInterval(() => void reload(), 60000);
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => { clearInterval(timer); document.removeEventListener("mousedown", close); };
  }, [reload]);
  const total = data?.total ?? 0;
  return (
    <div className="no-print mb-4 flex items-center justify-end gap-3" data-quality-toolbar="true">
      <span className="rounded border border-warn/30 bg-warn-soft px-2 py-0.5 text-xs text-warn"><LocalizedText message="Demonstration data" /></span>
      <div className="relative" ref={ref}>
        <SourceButton
          onClick={() => setOpen((v) => !v)}
          className="relative rounded-md p-2 text-ink-2 hover:bg-surface"
          aria-label={total ? t("{value0} items waiting for you", { value0: total }) : "Nothing waiting for you"}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <Bell className="size-[18px]" />
          {total > 0 && <span className="num absolute top-1 right-0.5 min-w-4 rounded-full bg-bad px-1 text-center text-[10px] leading-4 font-semibold text-white">{total > 99 ? "99+" : total}</span>}
        </SourceButton>
        {open && (
          <div role="menu" className="absolute right-0 z-40 mt-1 w-80 rounded-md border border-line bg-panel py-1 shadow-lg">
            <div className="border-b border-line px-3 py-2 text-sm font-medium"><LocalizedText message="Waiting for you" /></div>
            {!data?.tasks.length && <p className="px-3 py-4 text-sm text-ink-3"><LocalizedText message="Nothing needs your attention right now." /></p>}
            {data?.tasks.map((task) => (
              <Link key={task.key} role="menuitem" href={task.href} onClick={() => setOpen(false)} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm text-ink-2 hover:bg-surface">
                <LocalizedText message={task.label} />
                <span className="num rounded bg-ink/[0.06] px-1.5 text-xs font-medium text-ink">{task.count}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
