"use client";
import { useEffect, useRef } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { cx } from "../../lib/cx";
import { TONE, humanize, useRcmFormat } from "../../lib/format";
import type { FieldDef, ListResult, RecordDto, ResourceDef } from "../../lib/types";
import { useApp } from "../shell/context";
import { Avatar } from "../ui/Avatar";
import { SourceButton, Table, TableBody, TableCell, TableContainer, TableFooter, TableHead, TableHeader, TableRow } from "../ui/controls";
import { StatusPill, dueActive } from "../ui/StatusPill";

type Variant = "queue" | "ledger" | "monitor";

/** The shared Table with the source's worklist presentation: sticky mist header, 12.5px rows, mono references, status pills, ledger totals. */
export function RecordTable({ res, variant, data, selected, onSelect, sort, dir, onSort, page, onPage, loading }: {
  res: ResourceDef; variant: Variant; data: ListResult | null; selected: number | null; onSelect: (id: number) => void;
  sort: string; dir: "asc" | "desc"; onSort: (s: string) => void; page: number; onPage: (p: number) => void; loading: boolean;
}) {
  const { user } = useApp();
  const fmt = useRcmFormat();
  const { t } = useLocalization();
  const body = useRef<HTMLDivElement>(null);
  const has = (k: string) => res.fields.some((f) => f.key === k);
  const extras = res.fields.filter((f) => f.list && !["patient", "amount", "balance", "dueDate", "assignee", res.titleField].includes(f.key)).slice(0, variant === "ledger" ? 1 : 2);
  const showAssignee = has("assignee");
  const rows = data?.rows ?? [];

  const cellText = (f: FieldDef, r: RecordDto): string => {
    const v = r.values[f.key];
    if (v === undefined || v === null || v === "") return "—";
    if (f.type === "ref") return (r.labels[f.key] ?? "").split("  ")[0];
    if (f.type === "select") return f.options?.find((o) => o.value === v)?.label ?? humanize(v);
    if (f.type === "money") return fmt.money(Number(v), r.currency);
    if (f.type === "percent") return `${fmt.pct(v)}%`;
    if (f.type === "date") return fmt.date(v);
    if (Array.isArray(v)) return v.join(", ");
    return String(v);
  };

  useEffect(() => {
    body.current?.querySelector<HTMLElement>(`[data-row="${selected}"]`)?.scrollIntoView?.({ block: "nearest" });
  }, [selected]);

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
  const cell = variant === "ledger" ? "py-1.5" : "py-2";

  return (
    <div className={cx("flex h-full min-h-0 flex-col overflow-hidden rounded-[14px] border border-line", variant === "ledger" ? "bg-ledger" : "bg-white")} data-rcm-variant={variant}>
      <TableContainer ref={body} className="min-h-0 flex-1">
        <Table className="w-full table-fixed border-separate border-spacing-0 text-[12.5px]" aria-busy={loading}>
          <colgroup>{cols.map((c) => <col key={c.key} style={{ width: c.w }} />)}</colgroup>
          <TableHeader className="sticky top-0 z-10">
            <TableRow>
              {cols.map((c) => (
                <TableHead key={c.key} scope="col" aria-sort={c.sort && sort === c.sort ? (dir === "asc" ? "ascending" : "descending") : undefined}
                  className={cx("border-b border-line bg-mist px-3 py-2 text-[11px] font-semibold text-muted", c.align === "right" ? "text-right" : "text-left")}>
                  {c.sort ? (
                    <SourceButton onClick={() => onSort(c.sort!)} className={cx("inline-flex items-center gap-1 hover:text-harbor-900", sort === c.sort && "text-harbor-900")}>
                      <LocalizedText message={c.label} />{sort === c.sort && (dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                    </SourceButton>
                  ) : <LocalizedText message={c.label} />}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody className={cx(loading && "opacity-60")}>
            {rows.map((r, i) => {
              const on = r.id === selected;
              const due = fmt.dueText(r.dueDate);
              const closed = !dueActive(res, r.status);
              const failing = variant === "monitor" && ["FAILED", "DEAD_LETTER"].includes(r.status);
              return (
                <TableRow key={r.id} data-row={r.id} tabIndex={0} aria-selected={on} onClick={() => onSelect(r.id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(r.id); } }}
                  className={cx("cursor-pointer transition-colors", on ? "bg-signal-50" : variant === "ledger" && i % 2 ? "bg-mist/60 hover:bg-harbor-50/70" : "hover:bg-harbor-50/60")}>
                  <TableCell className={cx("relative border-b border-line px-3", cell)}>
                    {on && <span className="absolute inset-y-1 left-0 w-[3px] rounded-r bg-signal-500" />}
                    <span className="flex items-center gap-1.5 whitespace-nowrap font-mono text-[12px] font-semibold text-harbor-800">
                      {failing && <span className="h-2 w-2 shrink-0 animate-pulse-soft rounded-full bg-madder-500" />}
                      {r.ref}
                    </span>
                    {variant !== "ledger" && <span className="block text-[11px] text-muted">{fmt.relative(r.updatedAt)}</span>}
                  </TableCell>
                  <TableCell className={cx("border-b border-line px-3", cell)}>
                    <span className="flex min-w-0 items-center gap-2">
                      {showAssignee && <Avatar user={user(r.assignee)} size="sm" />}
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{r.patient?.name ?? r.title ?? "—"}</span>
                        {variant !== "ledger" && <span className="block truncate text-[11px] text-muted">{r.patient ? `${r.patient.mrn}${r.title ? ` · ${r.title}` : ""}` : r.values.lastError ?? (r.priority ? t("{value0} priority", { value0: humanize(r.priority) }) : "")}</span>}
                      </span>
                    </span>
                  </TableCell>
                  {extras.map((f) => <TableCell key={f.key} className={cx("truncate border-b border-line px-3 text-[12.5px] text-harbor-800", cell)}>{cellText(f, r)}</TableCell>)}
                  {has("amount") && <TableCell className={cx("whitespace-nowrap border-b border-line px-3 text-right font-semibold tabular-nums", cell)}>{fmt.money(r.amount, r.currency)}</TableCell>}
                  {has("balance") && <TableCell className={cx("whitespace-nowrap border-b border-line px-3 text-right tabular-nums", cell, r.balance > 0 ? "font-semibold text-saffron-700" : "text-muted")}>{fmt.money(r.balance, r.currency)}</TableCell>}
                  {has("dueDate") && <TableCell className={cx("whitespace-nowrap border-b border-line px-3 text-[12px]", cell, due && !closed ? TONE[due.tone].text : "text-muted", due?.tone === "danger" && !closed && "font-semibold")}>{due ? (closed ? fmt.date(r.dueDate, false) : due.text) : "—"}</TableCell>}
                  <TableCell className={cx("border-b border-line px-3", cell)}><StatusPill res={res} status={r.status} size="sm" /></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          {variant === "ledger" && rows.length > 0 && (has("amount") || has("balance")) && (
            <TableFooter className="sticky bottom-0">
              <TableRow className="bg-harbor-50 text-[12px] font-bold">
                <TableCell className="border-t border-harbor-200 px-3 py-2" colSpan={2 + extras.length}>
                  {t(rows.length === 1 ? "Page total, {value0} document" : "Page total, {value0} documents", { value0: fmt.num(rows.length) })}{mixed && <span className="font-normal text-muted"> <LocalizedText message="(mixed currency)" /></span>}
                </TableCell>
                {has("amount") && <TableCell className="border-t border-harbor-200 px-3 text-right tabular-nums">{fmt.money(totals.amount, mixed ? null : cur)}</TableCell>}
                {has("balance") && <TableCell className="border-t border-harbor-200 px-3 text-right tabular-nums text-saffron-700">{fmt.money(totals.balance, mixed ? null : cur)}</TableCell>}
                {has("dueDate") && <TableCell className="border-t border-harbor-200" />}
                <TableCell className="border-t border-harbor-200" />
              </TableRow>
            </TableFooter>
          )}
        </Table>
        {!loading && rows.length === 0 && (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <p className="font-display text-[16px] font-semibold"><LocalizedText message="Nothing here" /></p>
            <p className="mt-1 max-w-sm text-[12.5px] text-muted">{t("No {value0} match these filters. Clear the search or pick another status.", { value0: res.label.toLowerCase() })}</p>
          </div>
        )}
      </TableContainer>
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
