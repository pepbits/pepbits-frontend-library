"use client";
import { ArrowUpRight } from "lucide-react";
import { LocalizedText } from "@pepbits/ops-ui";
import { ReferenceLink } from "@pepbits/reference-host";
import { cx } from "../../lib/cx";
import { humanize, useRcmFormat } from "../../lib/format";
import type { FieldDef, RecordDto } from "../../lib/types";
import { rcmPaths } from "../../routes";
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from "../ui/controls";

export const isEmpty = (v: unknown) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);

/** A reference to another workspace record, rendered as a link that opens it on its own page (`?q=<ref>&open=first`). */
export function RefLink({ source, label }: { source: string; label: string }) {
  const res = source.slice(4);
  const ref = label.split(" ")[0];
  return (
    <ReferenceLink href={rcmPaths.resource(res, { q: ref, open: "first" })} className="group inline-flex items-center gap-1 rounded-md bg-harbor-50 px-1.5 py-0.5 font-mono text-[12px] font-semibold text-harbor-800 hover:bg-signal-50 hover:text-signal-700">
      {ref}<ArrowUpRight className="h-3 w-3 opacity-50 group-hover:opacity-100" />
    </ReferenceLink>
  );
}

export function FieldValue({ field: f, rec, value }: { field: FieldDef; rec: RecordDto; value?: any }) {
  const fmt = useRcmFormat();
  const v = value !== undefined ? value : rec.values[f.key];
  if (isEmpty(v)) return <span className="text-slate-soft">—</span>;
  switch (f.type) {
    case "ref": {
      const label = rec.labels[f.key] ?? `#${v}`;
      return f.source?.startsWith("res:") ? <RefLink source={f.source} label={label} /> : <span>{label}</span>;
    }
    case "select": return <span>{f.options?.find((o) => o.value === v)?.label ?? humanize(v)}</span>;
    case "money": return <span className="tabular-nums">{fmt.money(Number(v), rec.currency)}</span>;
    case "percent": return <span>{fmt.pct(v)}%</span>;
    case "decimal": return <span className="tabular-nums">{fmt.dec(v)}</span>;
    case "date": return <span>{fmt.date(v)}</span>;
    case "boolean": return <span><LocalizedText message={v ? "Yes" : "No"} /></span>;
    case "tags": case "multiselect":
      return <span className="flex flex-wrap gap-1">{(v as string[]).map((tag) => <span key={tag} className="rounded-md bg-mist px-1.5 py-0.5 font-mono text-[11.5px] ring-1 ring-inset ring-line">{tag}</span>)}</span>;
    case "lines": return <LinesTable field={f} rows={v} currency={rec.currency} />;
    case "textarea": return <span className="whitespace-pre-line">{v}</span>;
    default: return <span className="break-words">{String(v)}</span>;
  }
}

export function LinesTable({ field, rows, currency, dense }: { field: FieldDef; rows: Record<string, any>[]; currency: string; dense?: boolean }) {
  const fmt = useRcmFormat();
  const cols = field.columns ?? [];
  const numeric = (c: FieldDef) => ["money", "number", "decimal", "percent"].includes(c.type);
  return (
    <TableContainer overflow="hidden" className="rounded-lg border border-line">
      <Table className="w-full text-[12.5px]">
        <TableHeader className="bg-mist text-[11px] font-semibold text-muted">
          <TableRow>{cols.map((c) => <TableHead key={c.key} scope="col" className={cx("px-2.5 py-1.5 text-left font-semibold", numeric(c) && "text-right")}>{c.label}</TableHead>)}</TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-line">
          {rows.map((r, i) => (
            <TableRow key={i}>
              {cols.map((c) => (
                <TableCell key={c.key} className={cx("px-2.5", dense ? "py-1" : "py-1.5", numeric(c) && "text-right tabular-nums")}>
                  {isEmpty(r[c.key]) ? <span className="text-slate-soft">—</span>
                    : c.type === "money" ? <span className="whitespace-nowrap">{fmt.money(Number(r[c.key]), dense ? null : currency)}</span>
                      : c.type === "select" ? humanize(r[c.key])
                        : c.type === "date" ? fmt.date(r[c.key])
                          : String(r[c.key])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
