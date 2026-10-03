"use client";

import { Search, UserPlus } from "lucide-react";
import { ReferenceLink as Link } from "@pepbits/reference-host";
import { useMemo, useState } from "react";
import { quickMatch } from "../../lib/search";
import { useStore } from "../../lib/store";
import type { Patient } from "../../lib/types";
import { cx, fullName } from "../../lib/utils";
import { SourceButton, SourceInput } from "../controls";
import { useMaster } from "../../lib/master";
import { useMedbandFormat } from "../../lib/format";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { medbandPaths } from "../../routes";

/** Type-ahead patient search. Arrow keys move, Enter picks. */
export function PatientPicker({
  onPick,
  autoFocus,
  size = "md",
  placeholder = "Name, MRN, phone, ID or member number",
  registerHref = medbandPaths.patientNew(),
}: {
  onPick: (p: Patient) => void;
  autoFocus?: boolean;
  size?: "md" | "lg";
  placeholder?: string;
  registerHref?: string;
}) {
  const { payer } = useMaster();
  const { ageOf } = useMedbandFormat();
  const { t: tr } = useLocalization();
  const { patients } = useStore();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(false);

  const results = useMemo(() => (q.trim().length < 2 ? [] : patients.filter((p) => quickMatch(p, q)).slice(0, 7)), [patients, q]);
  const open = focused && q.trim().length >= 2;

  const pick = (p: Patient) => {
    onPick(p);
    setQ("");
    setFocused(false);
  };

  return (
    <div className="relative">
      <div
        className={cx(
          "flex items-center gap-3 rounded-xl border bg-paper transition-colors",
          size === "lg" ? "h-14 px-4" : "h-11 px-3",
          focused ? "border-scrub-500 ring-4 ring-scrub-100" : "border-line",
        )}
      >
        <Search className={cx("shrink-0 text-scrub-600", size === "lg" ? "size-5" : "size-4")} />
        <SourceInput
          autoFocus={autoFocus}
          value={q}
          role="combobox"
          aria-expanded={open}
          aria-controls="patient-picker-list"
          aria-label="Search patient"
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") (e.preventDefault(), setActive((a) => Math.min(a + 1, results.length - 1)));
            if (e.key === "ArrowUp") (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)));
            if (e.key === "Enter" && results[active]) (e.preventDefault(), pick(results[active]));
            if (e.key === "Escape") setQ("");
          }}
          placeholder={placeholder}
          className={cx("h-full flex-1 bg-transparent outline-none placeholder:text-ink-faint", size === "lg" ? "text-[17px]" : "text-sm")}
        />
      </div>

      {open && (
        <div id="patient-picker-list" role="listbox" className="animate-rise absolute z-40 mt-2 w-full overflow-hidden rounded-xl border border-line bg-paper shadow-pop">
          {results.map((p, i) => {
            const primary = p.coverages.find((c) => c.priority === "Primary");
            return (
              <SourceButton
                key={p.id}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(p)}
                className={cx("flex w-full items-center gap-3 px-4 py-2.5 text-left", i === active ? "bg-scrub-50" : "")}
              >
                <span className={cx("h-8 w-1.5 shrink-0 rounded-full", p.allergies ? "bg-rose-500" : "bg-scrub-600")} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{fullName(p)}</span>
                  <span className="block truncate text-[12.5px] text-ink-soft">
                    {p.mrn}, {ageOf(p.dob)} {p.gender[0]}, {p.phone}
                  </span>
                </span>
                <span className="shrink-0 text-right text-[12px] text-ink-faint">
                  {primary ? payer(primary.payerId)?.short : tr("Self pay")}
                  {p.coverages.length > 1 && <span className="block">+{p.coverages.length - 1} {" "}<LocalizedText message="payer" /></span>}
                </span>
              </SourceButton>
            );
          })}
          {results.length === 0 && <p className="px-4 py-3 text-[13px] text-ink-soft"><LocalizedText message={"No patient matches “{value0}”."} values={{ value0: (q) ?? "" }} /></p>}
          <Link
            href={registerHref}
            onMouseDown={(e) => e.preventDefault()}
            className="flex items-center gap-2 border-t border-line-soft bg-canvas/60 px-4 py-2.5 text-[13px] font-semibold text-scrub-700 hover:bg-scrub-50"
          >
            <UserPlus className="size-4" /> {" "}<LocalizedText message="Register a new patient" /></Link>
        </div>
      )}
    </div>
  );
}
