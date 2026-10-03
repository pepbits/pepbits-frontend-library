"use client";
import {useReferenceHost} from "@pepbits/reference-host";
import {SourceInput,SourceButton,LocalizedText} from "@pepbits/ops-ui";

import {ReferenceLink as Link} from "@pepbits/reference-host";
import { useRouter } from "../../navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, Search, CalendarPlus, UserRound, Hash } from "lucide-react";
import {useSourceApi, qs } from "../../lib/api";
import { useDebounced } from "../../lib/hooks";
import {useMedslotFormat} from "../../lib/format";
import type { Appointment, Patient } from "../../lib/types";
import { Button, IconButton, cx, StatusBadge } from "../ui";
import { useAuth } from "./auth";

export function Header({ onMenu }: { onMenu: () => void }) {
  const { settings, can } = useAuth();
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-paper/85 px-4 backdrop-blur lg:px-6">
      <IconButton label="Open menu" className="lg:hidden" onClick={onMenu}><Menu className="size-5" /></IconButton>
      <GlobalSearch />
      <div className="ml-auto flex items-center gap-3">
        <FacilityClock start={settings.facility_now} name={settings.facility_name} />
        {can("admin", "scheduler") && (
          <Link href="/book"><Button variant="primary" icon={<CalendarPlus className="size-4" />}><span className="hidden sm:inline"><LocalizedText message="Book" /></span></Button></Link>
        )}
      </div>
    </header>
  );
}

/** Shows facility wall-clock time (not the browser's), so staff in other zones see the right "now". */
function FacilityClock({ start, name }: { start: string; name: string }) {
  const { fmtLongDay, fmtTime } = useMedslotFormat();
  const [now, setNow] = useState(start);
  useEffect(() => {
    const base = Date.parse(start + ":00Z"), t0 = Date.now();
    const tick = () => setNow(new Date(base + (Date.now() - t0)).toISOString().slice(0, 16));
    const i = setInterval(tick, 15_000);
    return () => clearInterval(i);
  }, [start]);
  return (
    <div className="hidden text-right leading-tight md:block" title={name}>
      <p className="tabular text-sm font-semibold">{fmtTime(now)}</p>
      <p className="text-xs text-mute">{fmtLongDay(now.slice(0, 10))}</p>
    </div>
  );
}

function GlobalSearch() {
  const {preferences}=useReferenceHost();
  const api = useSourceApi();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [res, setRes] = useState<{ patients: Patient[]; appts: Appointment[] }>({ patients: [], appts: [] });
  const [active, setActive] = useState(0);
  const dq = useDebounced(q.trim(), 200);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (preferences.keyboardShortcuts && ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) { e.preventDefault(); input.current?.focus(); } };
    const d = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("keydown", k); document.addEventListener("mousedown", d);
    return () => { window.removeEventListener("keydown", k); document.removeEventListener("mousedown", d); };
  }, [preferences.keyboardShortcuts]);

  useEffect(() => {
    if (dq.length < 2) { setRes({ patients: [], appts: [] }); return; }
    let live = true;
    Promise.all([
      api<Patient[]>(`/patients${qs({ q: dq, limit: 5 })}`),
      api<{ items: Appointment[] }>(`/appointments${qs({ q: dq, limit: 5, order: "desc" })}`),
    ]).then(([p, a]) => { if (live) { setRes({ patients: p, appts: a.items }); setActive(0); } }).catch(() => {});
    return () => { live = false; };
  }, [dq]);

  const items = [
    ...res.patients.map((p) => ({ key: `p${p.id}`, href: `/patients/${p.id}`, node: <PatientRow p={p} /> })),
    ...res.appts.map((a) => ({ key: `a${a.id}`, href: `/appointments?open=${a.id}`, node: <ApptRow a={a} /> })),
  ];
  const go = (href: string) => { setOpen(false); setQ(""); router.push(href); };

  return (
    <div ref={box} className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mute" aria-hidden />
      <SourceInput ref={input} value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === "Enter" && items[active]) go(items[active].href);
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Find a patient, MRN, phone or booking ref" aria-label="Search patients and appointments"
        className="h-10 w-full rounded-full border border-line bg-panel pl-9 pr-14 text-sm placeholder:text-mute/80 focus:border-scrub focus:outline-none focus:ring-2 focus:ring-scrub/15" />
      <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-line px-1.5 text-[11px] text-mute sm:block"><LocalizedText message="Ctrl K" /></kbd>
      {open && dq.length >= 2 && (
        <div className="absolute left-0 right-0 top-12 z-30 overflow-hidden rounded-xl border border-line bg-panel shadow-[var(--shadow-pop)] animate-pop-in">
          {items.length === 0 ? <p className="px-4 py-6 text-center text-sm text-mute"><LocalizedText message={"No patients or bookings match “{value0}”."} values={{ value0: (dq) ?? "" }} /></p> : (
            <ul role="listbox" className="max-h-96 overflow-y-auto py-1.5">
              {items.map((it, i) => (
                <li key={it.key} role="option" aria-selected={i === active}>
                  <SourceButton onMouseEnter={() => setActive(i)} onClick={() => go(it.href)} className={cx("flex w-full items-center gap-3 px-3 py-2 text-left", i === active && "bg-line-2")}>{it.node}</SourceButton>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

const PatientRow = ({ p }: { p: Patient }) => (
  <>
    <span className="flex size-8 items-center justify-center rounded-full bg-scrub-soft text-scrub"><UserRound className="size-4" /></span>
    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{p.first_name} {p.last_name}</span>
      <span className="tabular text-xs text-mute">{p.mrn} {"\u00a0"}{p.phone_masked}</span></span>
  </>
);
const ApptRow = ({ a }: { a: Appointment }) => {
  const { fmtDateTime } = useMedslotFormat(); return (
  <>
    <span className="flex size-8 items-center justify-center rounded-full bg-slot-soft text-slot"><Hash className="size-4" /></span>
    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{a.ref_code} {"\u00a0"}{a.first_name} {a.last_name}</span>
      <span className="text-xs text-mute">{fmtDateTime(a.start_at)}, {a.service_name}</span></span>
    <StatusBadge status={a.status} />
  </>
); };
