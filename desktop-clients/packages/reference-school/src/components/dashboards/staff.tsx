"use client";

import { AlertCircle, BookCopy, BookMarked, Coins, Library, Percent, Receipt, Wallet } from "lucide-react";
import { Link } from "../../lib/router";
import { Badge, BarChart, Button, Card, CardGrid, CardHeader, DataTable, Donut, ErrorNote, HBars, Kpi, LineChart } from "../../ui";
import { useApi } from "../../lib/api";
import { useLookups } from "../../lib/lookups";
import type { AccStats, LibStats } from "../../lib/contract";
import { DashSkeleton } from "./admin";
import { useFormat } from "../../lib/format";
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';



export function LibrarianDashboard() {
 const referenceT = useReferenceLocalization().t;

  const { fmtShort, fmtMoney, fmtNum } = useFormat();
  const { data: s, error, reload } = useApi<LibStats>("/stats?role=librarian");
  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (!s) return <DashSkeleton />;
  return (
    <CardGrid className="grid gap-2.5">
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
        <Kpi icon={Library} label={referenceT("Titles")} value={s.titles} sub={referenceT("{value0} copies", {value0: fmtNum(s.copies)})} />
        <Kpi icon={BookCopy} label={referenceT("On the shelf")} value={s.available} sub={referenceT("{value0}% of stock", {value0: fmtNum(Math.round((s.available / s.copies) * 100))})} tone="ok" />
        <Kpi icon={BookMarked} label={referenceT("On loan")} value={s.issued + s.overdue.length} tone="info" />
        <Kpi icon={AlertCircle} label={referenceT("Overdue")} value={s.overdue.length} sub={referenceT("past due date")} tone="bad" />
        <Kpi icon={Coins} label={referenceT("Fines accrued")} value={fmtMoney(s.fines)} tone="warn" />
      </div>
      <CardGrid className="grid gap-2.5 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <CardHeader title={referenceT("Circulation, last 14 school days")} />
          <div className="p-3">
            <LineChart height={150} min={0} labels={s.trend.map((d) => fmtShort(d.date))} series={[{ name: "Issued", values: s.trend.map((d) => d.issued) }, { name: "Returned", values: s.trend.map((d) => d.returned), color: "var(--ok)", fill: false }]} />
          </div>
        </Card>
        <Card className="lg:col-span-4">
          <CardHeader title={referenceT("Stock by category")} />
          <div className="p-3"><HBars data={s.categories.slice(0, 8)} /></div>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader title={referenceT("Most borrowed")} />
          <ul className="divide-y divide-line/70">
            {s.popular.map((b) => (
              <li key={b.id} className="flex items-center gap-2 px-3 py-1.5">
                <span className="h-8 w-6 shrink-0 rounded-sm" style={{ background: b.cover }} />
                <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{b.title}</p><p className="truncate text-[11px] text-muted">{b.author}</p></div>
                <span className="text-[11px] tabular text-muted">{b.copies - b.available}/{b.copies}</span>
              </li>
            ))}
          </ul>
        </Card>
      </CardGrid>
      <DataTable
        rows={s.overdue} pageSize={6} exportName="overdue-books"
        toolbar={<span className="text-xs font-semibold"><ReferenceText message="Overdue loans" /></span>}
        columns={[
          { key: "bookTitle", header: "Book", cell: (r) => <span className="font-medium">{r.bookTitle}</span> },
          { key: "memberName", header: "Borrower" },
          { key: "memberType", header: "Type" },
          { key: "dueOn", header: "Due", cell: (r) => fmtShort(r.dueOn) },
          { key: "fine", header: "Fine", cell: (r) => <Badge tone="bad">{fmtMoney(r.fine)}</Badge> },
          { key: "act", header: "", sortable: false, cell: () => <Link href="/library"><Button size="xs"><ReferenceText message="Resolve" /></Button></Link> },
        ]}
      />
    </CardGrid>
  );
}

const METHOD_COLORS = ["#4d6a14", "#2b4c9b", "#8a3563", "#b45309", "#0f6e8c"];

export function AccountantDashboard() {
 const referenceT = useReferenceLocalization().t;

  const { fmtShort, fmtMoney, fmtMonth, fmtPct } = useFormat();
  const { data: s, error, reload } = useApi<AccStats>("/stats?role=accountant");
  const { cls } = useLookups();
  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (!s) return <DashSkeleton />;
  return (
    <CardGrid className="grid gap-2.5">
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
        <Kpi icon={Receipt} label={referenceT("Billed this year")} value={fmtMoney(s.billed)} />
        <Kpi icon={Wallet} label={referenceT("Collected")} value={fmtMoney(s.collected)} tone="ok" trend={s.trends?.collected} />
        <Kpi icon={Percent} label={referenceT("Collection rate")} value={fmtPct(Math.round((s.collected / s.billed) * 100))} tone="info" />
        <Kpi icon={Coins} label={referenceT("Outstanding")} value={fmtMoney(s.outstanding)} sub={referenceT("{value0} part-paid", {value0: s.partial})} tone="warn" />
        <Kpi icon={AlertCircle} label={referenceT("Overdue invoices")} value={s.overdue.length} tone="bad" />
      </div>
      <CardGrid className="grid gap-2.5 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <CardHeader title={referenceT("Collections by month")} sub={referenceT("Thousands")} />
          <div className="p-3"><BarChart height={150} suffix="k" data={s.byMonth.map((m) => ({ label: fmtMonth(m.month + "-01"), value: Math.round(m.amount / 1000) }))} /></div>
        </Card>
        <Card className="lg:col-span-4">
          <CardHeader title={referenceT("Collection rate by class")} />
          <div className="p-3"><BarChart height={150} max={100} suffix="%" data={s.byClass} /></div>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader title={referenceT("Payment methods")} />
          <div className="p-3"><Donut size={100} thickness={14} data={s.methods.map((m, i) => ({ label: m.label, value: Math.round(m.value / 1000), color: METHOD_COLORS[i % 5]! }))} center={`${Math.round(s.collected / 1000)}k`} sub={referenceT("collected")} /></div>
        </Card>
      </CardGrid>
      <div className="grid gap-2.5 lg:grid-cols-2">
        <DataTable rows={s.overdue} pageSize={6} exportName="overdue-invoices" toolbar={<span className="text-xs font-semibold"><ReferenceText message="Overdue invoices" /></span>}
          columns={[
            { key: "invoiceNo", header: "Invoice" }, { key: "studentName", header: "Student", cell: (r) => <span className="font-medium">{r.studentName}</span> },
            { key: "classId", header: "Class", value: (r) => cls(r.classId)?.name.replace("Grade ", "") },
            { key: "due", header: "Balance", value: (r) => r.amount - r.paid, cell: (r) => <span className="tabular text-bad">{fmtMoney(r.amount - r.paid)}</span> },
          ]} />
        <DataTable rows={s.recent} pageSize={6} toolbar={<span className="text-xs font-semibold"><ReferenceText message="Latest payments" /></span>}
          columns={[
            { key: "studentName", header: "Student" }, { key: "term", header: "Term" },
            { key: "paid", header: "Amount", cell: (r) => <span className="tabular">{fmtMoney(r.paid)}</span> },
            { key: "method", header: "Method" }, { key: "lastPaymentOn", header: "Date", cell: (r) => fmtShort(r.lastPaymentOn!) },
          ]} />
      </div>
    </CardGrid>
  );
}
