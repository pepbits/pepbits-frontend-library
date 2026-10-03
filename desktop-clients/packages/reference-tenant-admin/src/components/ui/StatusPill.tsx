"use client";
import { LocalizedText } from "@pepbits/ops-ui";
import { cx } from "../../lib/cx";
import { STATUS_LABEL } from "../../lib/format";
import type { Status } from "../../lib/types";

const STYLE: Record<Status, string> = {
  DRAFT: "bg-cobalt-50 text-cobalt-700 ring-cobalt-100",
  PENDING_APPROVAL: "bg-saffron-50 text-saffron-700 ring-saffron-100",
  APPROVED: "bg-jade-50 text-jade-700 ring-jade-100",
  ACTIVE: "bg-jade-50 text-jade-700 ring-jade-100",
  REJECTED: "bg-madder-50 text-madder-700 ring-madder-100",
  RETIRED: "bg-mist text-muted ring-line",
  SUPERSEDED: "bg-mist text-muted ring-line",
  INACTIVE: "bg-mist text-muted ring-line",
};
const DOT: Record<Status, string> = {
  DRAFT: "bg-cobalt-500", PENDING_APPROVAL: "bg-saffron-500", APPROVED: "bg-jade-500", ACTIVE: "bg-jade-500",
  REJECTED: "bg-madder-500", RETIRED: "bg-[#93A3A0]", SUPERSEDED: "bg-[#93A3A0]", INACTIVE: "bg-[#93A3A0]",
};

export function StatusPill({ status, className }: { status: Status; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold ring-1 ring-inset", STYLE[status], className)}>
      <span className={cx("h-1.5 w-1.5 rounded-full", DOT[status])} />
      <LocalizedText message={STATUS_LABEL[status]} />
    </span>
  );
}
