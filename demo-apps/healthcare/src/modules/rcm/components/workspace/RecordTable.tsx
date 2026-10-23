"use client";
import {CollectionView,type CollectionColumn} from "@pepbits/components/collection-view";
import { ChevronLeft, ChevronRight } from "@pepbits/icons";
import { LocalizedText, useLocalization } from "@pepbits/i18n/react";
import { cx } from "../../lib/cx";
import { humanize, useRcmFormat } from "../../lib/format";
import type { FieldDef, ListResult, RecordDto, ResourceDef } from "../../lib/types";
import { useApp } from "../shell/context";
import { Avatar } from "../ui/Avatar";
import { SourceButton } from "../ui/controls";
import { StatusPill, dueActive } from "../ui/StatusPill";

type Variant = "queue" | "ledger" | "monitor";

/** Typed resource columns on CollectionView, with server paging and currency-aware page totals. */
export function RecordTable({ res, variant, data, selected, onSelect, sort, dir, onSort, page, onPage, loading }: {
  res: ResourceDef; variant: Variant; data: ListResult | null; selected: number | null; onSelect: (id: number) => void;
  sort: string; dir: "asc" | "desc"; onSort: (s: string) => void; page: number; onPage: (p: number) => void; loading: boolean;
}) {
  const { user } = useApp();
  const fmt = useRcmFormat();
  const { t } = useLocalization();

  const has = (k: string) => res.fields.some((f) => f.key === k);
  const extras = res.fields.filter((f) => f.list && !["patient", "amount", "balance", "dueDate", "assignee", res.titleField].includes(f.key)).slice(0, variant === "ledger" ? 1 : 2);
  const showAssignee = has("assignee");
  const rows = data?.rows ?? [];

  const cellText = (f: FieldDef, r: RecordDto): string => {
    const v = r.values[f.key];
    if (v === undefined || v === null || v === "") return "—";
    if (f.type === "ref") return (r.labels[f.key] ?? "").split("  ")[0]!;
    if (f.type === "select") return f.options?.find((o) => o.value === v)?.label ?? humanize(v);
    if (f.type === "money") return fmt.money(Number(v), r.currency);
    if (f.type === "percent") return `${fmt.pct(v)}%`;
    if (f.type === "date") return fmt.date(v);
    if (Array.isArray(v)) return v.join(", ");
    return String(v);
  };



  const cols: { key: string; label: string; sort?: string; align?: "right"; w?: string }[] = [
    { key: "ref", label: "Reference", sort: "ref", w: "150px" },
    { key: "subject", label: has("patient") ? "Patient" : res.fields.find((f) => f.key === res.titleField)?.label ?? "Subject" },
    ...extras.map((f) => ({ key: f.key, label: f.label })),
    ...(has("amount") ? [{ key: "amount", label: res.amountLabel ?? "Amount", sort: "amount", align: "right" as const, w: "128px" }] : []),
    ...(has("balance") ? [{ key: "balance", label: res.balanceLabel ?? "Balance", sort: "balance", align: "right" as const, w: "128px" }] : []),
    ...(has("dueDate") ? [{ key: "due", label: res.dueLabel ?? "Due", sort: "due", w: "104px" }] : []),
    { key: "status", label: "Status", sort: "status", w: "150px" },
  ];
  const totals = { amount: rows.reduce((s, r) => s + r.amount, 0), balance: rows.reduce((s, r) => s + r.balance, 0) };
  const cur = rows[0]?.currency;
  const mixed = rows.some((r) => r.currency !== cur);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const from = data && data.total ? (data.page - 1) * data.pageSize + 1 : 0;
  const to = data ? Math.min(data.page * data.pageSize, data.total) : 0;


  const columns:CollectionColumn<RecordDto>[]=cols.map(c=>({key:c.sort??c.key,header:c.label,width:c.w,align:c.align,sortable:!!c.sort,render:r=>{
   if(c.key==='ref')return <span className="font-mono font-semibold">{r.ref}{variant!=='ledger'&&<small className="block text-muted">{fmt.relative(r.updatedAt)}</small>}</span>;
   if(c.key==='subject')return <span className="flex gap-2">{showAssignee&&<Avatar user={user(r.assignee)} size="sm"/>}<span>{r.patient?.name??r.title??'—'}{variant!=='ledger'&&<small className="block text-muted">{r.patient?`${r.patient.mrn}${r.title?' · '+r.title:''}`:r.values.lastError??''}</small>}</span></span>;
   if(c.key==='amount'||c.key==='balance')return fmt.money(r[c.key],r.currency);
   if(c.key==='due'){const due=fmt.dueText(r.dueDate);return due?(dueActive(res,r.status)?due.text:fmt.date(r.dueDate,false)):'—';}
   if(c.key==='status')return <StatusPill res={res} status={r.status} size="sm"/>;
   return cellText(extras.find(f=>f.key===c.key)!,r);
  }}));
  return (
    <div className={cx("flex h-full min-h-0 flex-col overflow-hidden rounded-[14px] border border-line", variant === "ledger" ? "bg-ledger" : "bg-white")} data-rcm-variant={variant}>
      <div className="min-h-0 flex-1 overflow-auto" tabIndex={0} aria-label={res.label}>
        <CollectionView columns={columns} rows={rows} rowKey={r=>String(r.id)} selectedKey={selected===null?null:String(selected)} onRowClick={r=>onSelect(r.id)} loading={loading} sort={{key:sort,dir}} onSort={onSort} empty={<p className="p-6"><LocalizedText message="Nothing here"/></p>}/>
        {variant==='ledger'&&rows.length>0&&(has('amount')||has('balance'))&&<div className="flex gap-4 bg-mist p-3 font-semibold" role="status"><span>{t(rows.length===1?"Page total, {value0} document":"Page total, {value0} documents",{value0:fmt.num(rows.length)})}{mixed?' '+t('(mixed currency)'):''}</span>{has('amount')&&<span>{fmt.money(totals.amount,mixed?null:cur)}</span>}{has('balance')&&<span>{fmt.money(totals.balance,mixed?null:cur)}</span>}</div>}
      </div>
      <div className="flex h-9 shrink-0 items-center justify-between border-t border-line bg-white px-3 text-[11.5px] text-muted">
        <span>{data ? t("{value0}–{value1} of {value2}", { value0: fmt.num(from), value1: fmt.num(to), value2: fmt.num(data.total) }) : t("Loading…")}</span>
        <span className="flex items-center gap-1">
          <SourceButton className="rounded p-1 hover:bg-mist disabled:opacity-40" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></SourceButton>
          <span>{t("Page {value0} of {value1}", { value0: fmt.num(page), value1: fmt.num(pages) })}</span>
          <SourceButton className="rounded p-1 hover:bg-mist disabled:opacity-40" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></SourceButton>
        </span>
      </div>
    </div>
  );
}
