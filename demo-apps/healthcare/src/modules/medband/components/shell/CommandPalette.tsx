"use client";
import { CalendarPlus, Search, UserPlus, type IconComponent as LucideIcon } from "@pepbits/icons";
import { useMemo, useState } from "react";
import { LocalizedText, useLocalization } from "@pepbits/i18n/react";
import { useMedbandFormat } from "../../lib/format";
import { useRouter } from "../../lib/navigation";
import { quickMatch } from "../../lib/search";
import { useStore } from "../../lib/store";
import { cx, fullName } from "../../lib/utils";
import { medbandPaths } from "../../routes";
import { SourceButton, SourceInput } from "../controls";
import {SourceDialog} from "@pepbits/components";
import { Kbd } from "../ui/primitives";

interface Action { id: string; label: string; href: string; icon: LucideIcon }

/** The source quick search (Ctrl/Cmd+K): the patients held by this scope's store, plus jumps to the main desk actions. */
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const { patients } = useStore();
  const { ageOf } = useMedbandFormat();
  const { t: tr } = useLocalization();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);

  const actions: Action[] = [
    { id: "a-reg", label: "Register a new patient", href: medbandPaths.patientNew(), icon: UserPlus },
    { id: "a-enc", label: "Create an encounter", href: medbandPaths.encounterNew(), icon: CalendarPlus },
    { id: "a-adv", label: "Search by insurance, network, plan or TPA", href: medbandPaths.patients(), icon: Search },
  ];
  const matches = useMemo(() => (q.trim() ? patients.filter((p) => quickMatch(p, q)).slice(0, 6) : patients.slice(0, 4)), [patients, q]);
  const items = [
    ...matches.map((p) => ({ id: p.id, href: medbandPaths.patient(p.id), kind: "patient" as const, p })),
    ...actions.filter((a) => !q || tr(a.label).toLowerCase().includes(q.toLowerCase())).map((a) => ({ ...a, kind: "action" as const })),
  ];

  const go = (href: string) => {
    router.push(href);
    onClose();
  };

  return (
    <SourceDialog open onClose={onClose} title="Quick search" className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]">{panel=><>
      <div className="animate-fade absolute inset-0 bg-scrub-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div ref={panel} tabIndex={-1} className="animate-rise relative w-full max-w-xl overflow-hidden rounded-2xl bg-paper shadow-pop">
        <div className="flex items-center gap-3 border-b border-line-soft px-4">
          <Search className="size-5 text-scrub-600" />
          <SourceInput
            autoFocus
            value={q}
            onChange={(e) => (setQ(e.target.value), setActive(0))}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") (e.preventDefault(), setActive((a) => Math.min(a + 1, items.length - 1)));
              if (e.key === "ArrowUp") (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)));
              if (e.key === "Enter" && items[active]) go(items[active].href);
            }}
            placeholder="Find a patient or jump to an action"
            aria-label="Quick search"
            className="h-14 flex-1 bg-transparent text-[16px] outline-none"
          />
          <Kbd>Esc</Kbd>
        </div>
        <div className="scroll-thin max-h-[50vh] overflow-auto p-2">
          {items.length === 0 && <p className="px-3 py-4 text-sm text-ink-soft"><LocalizedText message="No patient matches. Try the MRN or the last four digits of the phone number." /></p>}
          {items.map((it, i) => (
            <SourceButton
              key={it.id}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(it.href)}
              className={cx("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left", i === active && "bg-scrub-50")}
            >
              {it.kind === "patient" ? (
                <>
                  <span className={cx("h-8 w-1.5 rounded-full", it.p.allergies ? "bg-rose-500" : "bg-scrub-600")} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{fullName(it.p)}</span>
                    <span className="block truncate text-[12.5px] text-ink-soft">
                      {it.p.mrn}, {ageOf(it.p.dob)} {tr(it.p.gender)[0]}, {it.p.phone}
                    </span>
                  </span>
                </>
              ) : (
                <>
                  <it.icon className="mx-0.5 size-4 text-scrub-600" />
                  <span className="text-sm font-medium"><LocalizedText message={it.label} /></span>
                </>
              )}
            </SourceButton>
          ))}
        </div>
      </div>
    </>}</SourceDialog>
  );
}
