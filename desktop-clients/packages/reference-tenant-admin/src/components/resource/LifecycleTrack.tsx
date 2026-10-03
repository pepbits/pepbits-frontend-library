"use client";
import { Check } from "lucide-react";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { cx } from "../../lib/cx";
import { useTenantFormat } from "../../lib/format";
import type { RecordDto, User } from "../../lib/types";

const STEPS = ["Draft", "Awaiting approval", "Approved", "Retired"];

export function LifecycleTrack({ record, user }: { record: RecordDto | null; user: (id: number | null | undefined) => User | undefined }) {
  const { t } = useLocalization();
  const fmt = useTenantFormat();
  const s = record?.status ?? "DRAFT";
  const at = s === "PENDING_APPROVAL" ? 1 : s === "APPROVED" ? 2 : s === "RETIRED" || s === "SUPERSEDED" ? 3 : 0;
  const returned = s === "REJECTED";
  const who = (id: number | null | undefined) => user(id)?.name.split(" ")[0];
  const notes = [
    record ? `${who(record.createdBy) ?? "—"}, ${fmt.date(record.createdAt)}` : t("Not saved yet"),
    record?.submittedAt ? `${who(record.submittedBy)}, ${fmt.date(record.submittedAt)}` : "",
    record?.decidedAt && s !== "REJECTED" ? `${who(record.decidedBy)}, ${fmt.date(record.decidedAt)}` : "",
    s === "RETIRED" || s === "SUPERSEDED" ? t(s === "SUPERSEDED" ? "Superseded {value0}" : "Retired {value0}", { value0: fmt.date(record?.effectiveUntil) }) : "",
  ];

  return (
    <ol className="grid grid-cols-4 gap-2" aria-label={t("Lifecycle")}>
      {STEPS.map((label, i) => {
        const done = i < at;
        const current = i === at;
        return (
          <li key={label} className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={cx(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                  done && "bg-jade-600 text-white",
                  current && !returned && (i === 1 ? "bg-saffron-500 text-spruce-950" : i === 2 ? "bg-jade-600 text-white" : i === 3 ? "bg-[#93A3A0] text-white" : "bg-cobalt-600 text-white"),
                  current && returned && "bg-madder-600 text-white",
                  !done && !current && "border border-line bg-white text-muted",
                )}
                aria-current={current ? "step" : undefined}
              >
                {done ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
              </span>
              <span className={cx("h-px flex-1", i < 3 ? (done ? "bg-jade-500" : "bg-line") : "bg-transparent")} />
            </div>
            <p className={cx("mt-1.5 truncate text-[12px] font-semibold", current ? "text-spruce-950" : "text-muted")}>
              <LocalizedText message={current && returned ? "Returned for changes" : label} />
            </p>
            <p className="truncate text-[11px] text-muted">{notes[i] || " "}</p>
          </li>
        );
      })}
    </ol>
  );
}
