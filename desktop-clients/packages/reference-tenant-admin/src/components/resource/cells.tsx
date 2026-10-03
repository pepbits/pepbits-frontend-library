"use client";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { cx } from "../../lib/cx";
import { humanize, useTenantFormat } from "../../lib/format";
import type { FieldDef, RecordDto } from "../../lib/types";

/** One list cell for a field type. Record values are shown as stored; only codes without a label are turned into words. */
export function Cell({ field: f, record }: { field: FieldDef; record: RecordDto }) {
  const { t } = useLocalization();
  const fmt = useTenantFormat();
  const v = record.data[f.key];
  if (f.type === "ref" || f.type === "refs") {
    const label = record.refLabels?.[f.key];
    return label ? <span className="truncate">{label}</span> : <Empty />;
  }
  if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) {
    return <Empty />;
  }
  switch (f.type) {
    case "boolean":
      return <BoolCell on={Boolean(v)} />;
    case "select":
      return <span className="truncate">{f.options?.find((o) => o.value === v)?.label ?? t(humanize(v))}</span>;
    case "multiselect": {
      const labels = (v as string[]).map((x) => f.options?.find((o) => o.value === x)?.label ?? t(humanize(x)));
      return <span className="truncate" title={labels.join(", ")}>{labels.slice(0, 2).join(", ")}{labels.length > 2 && <span className="text-muted"> +{fmt.int(labels.length - 2)}</span>}</span>;
    }
    case "tags":
      return <span className="truncate">{(v as string[]).join(", ")}</span>;
    case "percent":
      return <span>{fmt.dec(v)}%</span>;
    case "money":
      return <span className="tabular-nums">{fmt.amount(v)}</span>;
    case "decimal":
      return <span className="tabular-nums">{fmt.dec(v)}</span>;
    case "date":
      return <span>{fmt.date(v)}</span>;
    case "lines":
      return <span>{t("{value0} rows", { value0: fmt.int((v as unknown[]).length) })}</span>;
    default:
      return <span className="truncate">{String(v)}</span>;
  }
}

const Empty = () => <span className="text-[#A6B3B0]">—</span>;
const BoolCell = ({ on }: { on: boolean }) => (
  <span className="inline-flex items-center gap-1.5">
    <span className={cx("h-1.5 w-1.5 rounded-full", on ? "bg-jade-500" : "bg-[#B8C4C1]")} />
    <LocalizedText message={on ? "Yes" : "No"} />
  </span>
);
