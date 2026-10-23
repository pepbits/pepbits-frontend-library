import { cx } from "../../lib/cx";
import { TONE, humanize } from "../../lib/format";
import type { ResourceDef, Tone } from "../../lib/types";

/** `label` is server text (a status label) or an already translated string. */
export function TonePill({ tone, label, className, size = "md" }: { tone: Tone; label: string; className?: string; size?: "sm" | "md" }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold ring-1 ring-inset", size === "sm" ? "px-1.5 py-px text-[10.5px]" : "px-2 py-0.5 text-[11.5px]", TONE[tone].pill, className)}>
      <span className={cx("h-1.5 w-1.5 rounded-full", TONE[tone].dot)} />
      {label}
    </span>
  );
}

export function statusOf(res: ResourceDef, status: string) {
  return res.statuses.find((s) => s.key === status) ?? { key: status, label: humanize(status), tone: "muted" as Tone };
}

/** Whether a record's due date is still live in this status (from the page's overdue KPIs, else any open status). */
export function dueActive(res: ResourceDef, status: string) {
  const sts = res.kpis.filter((k) => k.overdue).flatMap((k) => k.statuses ?? []);
  if (sts.length) return sts.includes(status);
  return !["success", "muted"].includes(statusOf(res, status).tone);
}

export function StatusPill({ res, status, className, size }: { res: ResourceDef; status: string; className?: string; size?: "sm" | "md" }) {
  const s = statusOf(res, status);
  return <TonePill tone={s.tone} label={s.label} className={className} size={size} />;
}
