"use client";

import { AlertTriangle, BellRing, CheckCircle2, CreditCard, DollarSign, Landmark, Lock, Printer, Receipt, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Avatar, Badge, Button, Card, CardGrid, CardHeader, DataTable, Drawer, ErrorNote, Field, Input, Kpi, Modal, Progress, Segmented, Select, Skeleton, statusTone, Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow, Tabs, type Column, useToast } from "../ui";
import { ChildSwitcher, useActiveStudent } from "../components/shared/child-switcher";
import { useApi, useSchoolApi } from "../lib/api";
import { useLookups } from "../lib/lookups";
import { useSession } from "../lib/session";
import type { FeeStructure } from "../lib/contract";
import type { FeeInvoice } from "../lib/types";
import { cn } from "../lib/utils";
import { useFormat } from "../lib/format";
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export function FeesPage() {
  const { role } = useSession();
  return role === "student" || role === "parent" ? <MyFees /> : <FinanceFees />;
}

const bal = (i: FeeInvoice) => i.amount - i.paid;

/* ------------------------------ finance ------------------------------ */
function FinanceFees() {
 const referenceT = useReferenceLocalization().t;

  const { fmtDate, fmtMoney, currency, fmtNum } = useFormat();
  const api = useSchoolApi();
  const { cls, classes } = useLookups();
  const toast = useToast();
  const [reminding, setReminding] = useState(false);
  const remindAll = async (list: FeeInvoice[]) => {
    setReminding(true);
    try {
      await api.post("/invoices/reminders", { invoiceIds: list.map((i) => i.id) });
      toast(referenceT("Reminders sent to {value0} families by email and SMS", { value0: list.length }));
    } catch (e) { toast((e as Error).message, "error"); } finally { setReminding(false); }
  };
  const { data, error, loading, reload, setData } = useApi<FeeInvoice[]>("/invoices");
  const [tab, setTab] = useState<"invoices" | "defaulters" | "structure">("invoices");
  const [term, setTerm] = useState("");
  const [status, setStatus] = useState("");
  const [classId, setClassId] = useState("");
  const [open, setOpen] = useState<FeeInvoice | null>(null);
  const [collect, setCollect] = useState<FeeInvoice | null>(null);
  const all = data ?? [];
  const rows = useMemo(() => all.filter((i) => (!term || i.term === term) && (!status || i.status === status) && (!classId || i.classId === classId)), [all, term, status, classId]);
  const billed = all.reduce((a, i) => a + i.amount, 0), paid = all.reduce((a, i) => a + i.paid, 0);
  const overdue = all.filter((i) => i.status === "Overdue");
  const update = (inv: FeeInvoice) => { setData((d) => d?.map((x) => (x.id === inv.id ? inv : x)) ?? d); if (open?.id === inv.id) setOpen(inv); };

  const cols: Column<FeeInvoice>[] = [
    { key: "invoiceNo", header: "Invoice", className: "tabular" },
    { key: "studentName", header: "Student", cell: (i) => <span className="flex items-center gap-1.5"><Avatar name={i.studentName} size={20} />{i.studentName}</span> },
    { key: "classId", header: "Class", value: (i) => cls(i.classId)?.name, cell: (i) => cls(i.classId)?.name.replace("Grade ", "") },
    { key: "term", header: "Term" },
    { key: "amount", header: "Amount", cell: (i) => fmtMoney(i.amount), className: "tabular text-right", headerClassName: "text-right" },
    { key: "paid", header: "Paid", cell: (i) => <span className="flex w-32 items-center gap-1.5"><Progress value={i.paid} max={i.amount} /><span className="w-14 text-right text-[11px] tabular">{fmtMoney(i.paid)}</span></span> },
    { key: "balance", header: "Balance", value: (i) => bal(i), cell: (i) => <span className={cn("tabular", bal(i) > 0 && "font-semibold")}>{bal(i) ? fmtMoney(bal(i)) : "—"}</span> },
    { key: "dueDate", header: "Due", cell: (i) => fmtDate(i.dueDate, { day: "2-digit", month: "short" }) },
    { key: "status", header: "Status", cell: (i) => <Badge tone={statusTone(i.status)}>{i.status}</Badge> },
    { key: "act", header: "", sortable: false, cell: (i) => bal(i) > 0 && <Button size="xs" variant="subtle" onClick={(e) => { e.stopPropagation(); setCollect(i); }}><ReferenceText message="Collect" /></Button> },
  ];


  return (
    <div className="flex h-full min-h-[560px] flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Kpi icon={Receipt} label={referenceT("Billed this year")} value={data ? fmtMoney(billed) : "…"} sub={referenceT("{value0} invoices", {value0: all.length})} />
        <Kpi icon={Wallet} label={referenceT("Collected")} tone="ok" value={data ? fmtMoney(paid) : "…"} sub={referenceT("{value0}% collection rate", {value0: fmtNum(billed ? Math.round((paid / billed) * 100) : 0)})} />
        <Kpi icon={DollarSign} label={referenceT("Outstanding")} tone="warn" value={data ? fmtMoney(billed - paid) : "…"} sub={referenceT("{value0} partly paid", {value0: all.filter((i) => i.status === "Partial").length})} />
        <Kpi icon={AlertTriangle} label={referenceT("Overdue")} tone="bad" value={overdue.length} sub={fmtMoney(overdue.reduce((a, i) => a + bal(i), 0))} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={tab} onChange={setTab} items={[{ value: "invoices", label: "Invoices", count: all.length }, { value: "defaulters", label: "Overdue accounts", count: overdue.length }, { value: "structure", label: "Fee structure" }]} />
        {tab === "defaulters" && overdue.length > 0 && <Button variant="primary" icon={BellRing} className="ml-auto" loading={reminding} onClick={() => remindAll(overdue)}><ReferenceText message="Remind all" /></Button>}
      </div>
      {error && <ErrorNote message={error} onRetry={reload} />}
      {tab === "invoices" && (
        <DataTable className="min-h-0 flex-1" rows={loading && !data ? null : rows} loading={loading} columns={cols} pageSize={15} onRowClick={setOpen} selectedId={open?.id} exportName="invoices" searchPlaceholder="Invoice no. or student"
          toolbar={<>
            <Select value={term} onChange={(e) => setTerm(e.target.value)} className="w-28" aria-label={referenceT("Term")}><option value=""><ReferenceText message="All terms" /></option><option><ReferenceText message="Term 1" /></option><option><ReferenceText message="Term 2" /></option></Select>
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-28" aria-label={referenceT("Status")}><option value=""><ReferenceText message="Any status" /></option>{["Paid", "Partial", "Due", "Overdue"].map((s) => <option key={s}>{s}</option>)}</Select>
            <Select value={classId} onChange={(e) => setClassId(e.target.value)} className="w-32" aria-label={referenceT("Class")}><option value=""><ReferenceText message="All classes" /></option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
          </>} />
      )}
      {tab === "defaulters" && (
        <DataTable className="min-h-0 flex-1" rows={data ? overdue : null} loading={loading} columns={cols} onRowClick={setOpen} exportName="overdue-accounts" searchPlaceholder="Search overdue accounts" />
      )}
      {tab === "structure" && <FeeStructureCard />}
      {open && <InvoiceDrawer inv={open} onClose={() => setOpen(null)} onCollect={() => setCollect(open)} />}
      {collect && <CollectModal inv={collect} onClose={() => setCollect(null)} onPaid={update} />}
    </div>
  );
}

/** Tariff and fee policy from the API (the source hardcoded the rates in the page). */
function FeeStructureCard() {
 const referenceT = useReferenceLocalization().t;

  const { fmtMoney, currency } = useFormat();
  const { profile } = useLookups();
  const api = useSchoolApi();
  const [fees, setFees] = useState<FeeStructure | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setError(null);
    api.get<FeeStructure>("/fee-structure").then((r) => { if (alive) setFees(r); }).catch((e: Error) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [api, tick]);
  if (error) return <ErrorNote message={error} onRetry={() => setTick((t) => t + 1)} />;
  if (!fees) return <Skeleton className="h-60" />;
  return (
    <Card className="overflow-x-auto">
      <CardHeader title={referenceT("Fee structure · AY {value0}", {value0: profile.year})} sub={referenceT("Per term, in {value0}. Transport is billed only to students using a school route.", {value0: currency})} />
      <Table className="w-full text-xs">
        <TableHeader className="bg-subtle text-[11px] text-muted"><TableRow>{["Grade", "Tuition", "Laboratory", "Library & digital", "Activities & sports", "Transport (optional)", "Total without transport"].map((h) => <TableHead key={h} className="px-3 py-1.5 text-left font-semibold">{h}</TableHead>)}</TableRow></TableHeader>
        <TableBody>
          {fees.data.map((r) => (
            <TableRow key={r.g} className="border-t border-line/60 tabular">
              <TableCell className="px-3 py-1.5 font-medium"><ReferenceText message="Grade" /> {r.g}</TableCell><TableCell className="px-3">{fmtMoney(r.tuition)}</TableCell><TableCell className="px-3">{fmtMoney(r.lab)}</TableCell><TableCell className="px-3">{fmtMoney(r.library)}</TableCell><TableCell className="px-3">{fmtMoney(r.activities)}</TableCell><TableCell className="px-3">{fmtMoney(r.transport)}</TableCell>
              <TableCell className="px-3 font-semibold">{fmtMoney(r.tuition + r.lab + r.library + r.activities)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="border-t border-line px-3 py-2 text-[11px] text-muted"><ReferenceText message="Sibling discount of" /> {fees.policy.siblingDiscountPct}<ReferenceText message="% applies to the second child's tuition. Late payment attracts a" /> {fmtMoney(fees.policy.lateFee)} <ReferenceText message="fee after" /> {fees.policy.lateAfterDays} <ReferenceText message="days." /></p>
    </Card>
  );
}

function InvoiceDrawer({ inv, onClose, onCollect }: { inv: FeeInvoice; onClose: () => void; onCollect?: () => void }) {
 const referenceT = useReferenceLocalization().t;

  const { cls } = useLookups();
  return (
    <Drawer open onClose={onClose} title={inv.invoiceNo} titleAddon={<Badge tone={statusTone(inv.status)}>{inv.status}</Badge>} sub={referenceT("{value0} · {value1} · {value2}", {value0: inv.studentName, value1: cls(inv.classId)?.name ?? "", value2: inv.term})}
      footer={<><Button icon={Printer} onClick={() => window.print()}><ReferenceText message="Print" /></Button>{onCollect && bal(inv) > 0 && <Button variant="primary" icon={Wallet} onClick={onCollect}><ReferenceText message="Collect payment" /></Button>}</>}>
      <InvoiceBody inv={inv} />
    </Drawer>
  );
}

function InvoiceBody({ inv }: { inv: FeeInvoice }) {
  const referenceT = useReferenceLocalization().t;
  const { profile: SCHOOL } = useLookups();
  const { fmtDate, fmtMoney } = useFormat();
  return (
    <div className="print-full p-4 text-xs">
      <div className="mb-3 flex justify-between">
        <div><p className="text-sm font-semibold">{SCHOOL.name}</p><p className="text-muted"><ReferenceText message="Finance office · AY" /> {SCHOOL.year}</p></div>
        <div className="text-right"><p className="font-semibold">{inv.invoiceNo}</p><p className="text-muted"><ReferenceText message="Due" /> {fmtDate(inv.dueDate)}</p></div>
      </div>
      <Table className="w-full">
        <TableHeader className="border-b border-line text-[11px] text-muted"><TableRow><TableHead className="py-1 text-left"><ReferenceText message="Item" /></TableHead><TableHead className="py-1 text-right"><ReferenceText message="Amount" /></TableHead></TableRow></TableHeader>
        <TableBody>{inv.items.map((it) => <TableRow key={it.label} className="border-b border-line/50"><TableCell className="py-1.5"><ReferenceText message={it.label} /></TableCell><TableCell className="text-right tabular">{fmtMoney(it.amount)}</TableCell></TableRow>)}</TableBody>
        <TableFooter className="font-semibold tabular">
          <TableRow><TableCell className="pt-2"><ReferenceText message="Total" /></TableCell><TableCell className="pt-2 text-right">{fmtMoney(inv.amount)}</TableCell></TableRow>
          <TableRow className="text-ok"><TableCell><ReferenceText message="Paid" />{inv.lastPaymentOn && referenceT(" (last {value0}, {value1})", { value0: fmtDate(inv.lastPaymentOn), value1: inv.method ?? "" })}</TableCell><TableCell className="text-right">−{fmtMoney(inv.paid)}</TableCell></TableRow>
          <TableRow className={bal(inv) ? "text-bad" : "text-ok"}><TableCell className="border-t border-line pt-1"><ReferenceText message="Balance due" /></TableCell><TableCell className="border-t border-line pt-1 text-right">{fmtMoney(bal(inv))}</TableCell></TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}

function CollectModal({ inv, onClose, onPaid }: { inv: FeeInvoice; onClose: () => void; onPaid: (i: FeeInvoice) => void }) {
 const referenceT = useReferenceLocalization().t;

  const { fmtMoney, currency } = useFormat();
  const api = useSchoolApi();
  const toast = useToast();
  const [amount, setAmount] = useState(String(bal(inv)));
  const [method, setMethod] = useState("Bank transfer");
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  const n = Number(amount);
  const invalid = !(n > 0) || n > bal(inv);
  const save = async () => {
    setBusy(true);
    try {
      const { data } = await api.patch<{ data: FeeInvoice }>(`/invoices/${inv.id}`, { payAmount: n, method });
      onPaid(data); toast(data.receiptNo
        ? referenceT(data.receiptSent ? "{value0} received from {value1} · receipt {value2} · emailed to the guardian" : "{value0} received from {value1} · receipt {value2}", { value0: fmtMoney(n), value1: inv.studentName, value2: data.receiptNo })
        : referenceT("{value0} received from {value1}", { value0: fmtMoney(n), value1: inv.studentName })); onClose();
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={referenceT("Record payment")} sub={referenceT("{value0} · {value1} · balance {value2}", {value0: inv.invoiceNo, value1: inv.studentName, value2: fmtMoney(bal(inv))})}
      footer={<><Button variant="ghost" onClick={onClose}><ReferenceText message="Cancel" /></Button><Button variant="primary" disabled={invalid} loading={busy} onClick={save}><ReferenceText message="Record" /> {n > 0 ? fmtMoney(n) : ""}</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label={referenceT("Amount ({value0})", {value0: currency})} error={n > bal(inv) ? "More than the balance" : undefined}><Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus /></Field>
        <Field label={referenceT("Method")}><Select value={method} onChange={(e) => setMethod(e.target.value)}>{["Bank transfer", "Card", "Cash", "Cheque"].map((m) => <option key={m}>{m}</option>)}</Select></Field>
        <Field label={referenceT("Reference")} hint={referenceT("Transaction or cheque number")} className="col-span-2"><Input value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
        <div className="col-span-2 flex gap-1.5">{[0.25, 0.5, 1].map((p) => <Button key={p} size="xs" onClick={() => setAmount(String(Math.round(bal(inv) * p)))}>{p === 1 ? referenceT("Full balance") : `${p * 100}%`}</Button>)}</div>
      </div>
    </Modal>
  );
}

/* ------------------------------ student / parent ------------------------------ */
function MyFees() {
 const referenceT = useReferenceLocalization().t;

  const { fmtDate, fmtMoney } = useFormat();
  const { studentId } = useActiveStudent();
  const { data, error, reload, setData } = useApi<FeeInvoice[]>(studentId ? `/invoices?studentId=${encodeURIComponent(studentId)}` : null);
  const [paying, setPaying] = useState<FeeInvoice | null>(null);
  const [view, setView] = useState<FeeInvoice | null>(null);
  const list = (data ?? []).filter((i) => i.studentId === studentId);
  const due = list.reduce((a, i) => a + bal(i), 0);
  return (
    <CardGrid className="grid gap-2.5">
      <div className="flex flex-wrap items-center gap-2"><ChildSwitcher /></div>
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
        <Kpi icon={Wallet} label={referenceT("Balance due")} tone={due ? "warn" : "ok"} value={data ? fmtMoney(due) : "…"} sub={due ? "across all invoices" : "You're all paid up"} />
        <Kpi icon={CheckCircle2} label={referenceT("Paid this year")} tone="ok" value={data ? fmtMoney(list.reduce((a, i) => a + i.paid, 0)) : "…"} />
        <Kpi icon={Receipt} label={referenceT("Invoices")} value={list.length} sub={list.some((i) => i.status === "Overdue") ? "one is overdue" : "none overdue"} />
      </div>
      {error && <ErrorNote message={error} onRetry={reload} />}
      {!data ? <Skeleton className="h-60" /> : (
        <CardGrid className="grid gap-2.5 lg:grid-cols-2">
          {list.map((i) => (
            <Card key={i.id}>
              <CardHeader title={referenceT("{value0} fees", {value0: i.term})} sub={referenceT("{value0} · due {value1}", {value0: i.invoiceNo, value1: fmtDate(i.dueDate)})} action={<Badge tone={statusTone(i.status)}>{i.status}</Badge>} />
              <ul className="divide-y divide-line/50 px-3 text-xs">
                {i.items.map((it) => <li key={it.label} className="flex justify-between py-1.5"><span className="text-muted"><ReferenceText message={it.label} /></span><span className="tabular">{fmtMoney(it.amount)}</span></li>)}
              </ul>
              <div className="flex items-center gap-2 border-t border-line px-3 py-2 text-xs">
                <Progress value={i.paid} max={i.amount} className="w-24" />
                <span className="tabular">{fmtMoney(i.paid)} <ReferenceText message="of" /> {fmtMoney(i.amount)}</span>
                <div className="ml-auto flex gap-1.5">
                  <Button size="xs" icon={Receipt} onClick={() => setView(i)}><ReferenceText message="View" /></Button>
                  {bal(i) > 0 && <Button size="xs" variant="primary" icon={CreditCard} onClick={() => setPaying(i)}><ReferenceText message="Pay" /> {fmtMoney(bal(i))}</Button>}
                </div>
              </div>
            </Card>
          ))}
        </CardGrid>
      )}
      {view && <InvoiceDrawer inv={view} onClose={() => setView(null)} />}
      {paying && <PayModal inv={paying} onClose={() => setPaying(null)} onPaid={(inv) => setData((d) => d?.map((x) => (x.id === inv.id ? inv : x)) ?? d)} />}
    </CardGrid>
  );
}

const luhn = (n: string) => { const d = n.replace(/\D/g, ""); let s = 0; for (let i = 0; i < d.length; i++) { let x = Number(d[d.length - 1 - i]); if (i % 2) { x *= 2; if (x > 9) x -= 9; } s += x; } return d.length >= 13 && s % 10 === 0; };

function PayModal({ inv, onClose, onPaid }: { inv: FeeInvoice; onClose: () => void; onPaid: (i: FeeInvoice) => void }) {
 const referenceT = useReferenceLocalization().t;

  const { profile } = useLookups();
  const { fmtMoney } = useFormat();
  const api = useSchoolApi();
  const toast = useToast();
  const [method, setMethod] = useState<"card" | "bank">("card");
  const [card, setCard] = useState({ name: "", number: "", exp: "", cvc: "" });
  const [stage, setStage] = useState<"form" | "processing" | "done">("form");
  const [touched, setTouched] = useState(false);
  const [paid, setPaid] = useState(0);
  /* The invoice the server returned for this payment: its receipt, if any, is the only one shown. */
  const [accepted, setAccepted] = useState<FeeInvoice | null>(null);
  const errs = {
    name: !card.name.trim() ? "Name on card is required" : "",
    number: !luhn(card.number) ? "Enter a valid card number (try 4242 4242 4242 4242)" : "",
    exp: !/^(0[1-9]|1[0-2])\/\d{2}$/.test(card.exp) ? "MM/YY" : "",
    cvc: !/^\d{3,4}$/.test(card.cvc) ? "3–4 digits" : "",
  };
  const ok = method === "bank" || Object.values(errs).every((e) => !e);
  const pay = async () => {
    setTouched(true);
    if (!ok) return;
    setStage("processing");
    try {
      const { data } = await api.patch<{ data: FeeInvoice }>(`/invoices/${inv.id}`, { payAmount: bal(inv), method: method === "card" ? "Card" : "Bank transfer" });
      setPaid(bal(inv)); setAccepted(data); onPaid(data); setStage("done");
    } catch (e) {
      // Nothing was recorded: keep the entered details and let the payer try again.
      setStage("form"); toast((e as Error).message, "error");
    }
  };
  const fmtCard = (v: string) => v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
  return (
    <Modal open onClose={onClose} title={stage === "done" ? "Payment successful" : referenceT("Pay {value0}", { value0: fmtMoney(bal(inv)) })} sub={referenceT("{value0} · {value1} · {value2}", {value0: inv.invoiceNo, value1: inv.studentName, value2: inv.term})}
      footer={stage === "done" ? <Button variant="primary" onClick={onClose}><ReferenceText message="Done" /></Button> : <><Button variant="ghost" onClick={onClose} disabled={stage === "processing"}><ReferenceText message="Cancel" /></Button><Button variant="primary" icon={Lock} loading={stage === "processing"} onClick={pay}><ReferenceText message="Pay" /> {fmtMoney(bal(inv))}</Button></>}>
      {stage === "done" ? (
        <div className="py-4 text-center">
          <CheckCircle2 className="mx-auto size-12 text-ok" />
          <p className="mt-2 text-sm font-semibold">{fmtMoney(paid)} <ReferenceText message="paid" /></p>
          <p className="text-xs text-muted">{accepted?.receiptNo ? referenceT("Receipt {value0}{value1}. ", { value0: accepted.receiptNo, value1: accepted.receiptSent ? " has been emailed to the guardian" : "" }) : ""}<ReferenceText message="Thank you!" /></p>
        </div>
      ) : (
        <div className="grid gap-3">
          <Segmented label={referenceT("Payment method")} value={method} onChange={(v) => setMethod(v as "card" | "bank")} options={[{ value: "card", label: "Card", icon: <CreditCard className="size-3.5" /> }, { value: "bank", label: "Bank transfer", icon: <Landmark className="size-3.5" /> }]} />
          {method === "card" ? (
            <div className="grid grid-cols-4 gap-3">
              <Field label={referenceT("Name on card")} className="col-span-4" error={touched ? errs.name : undefined}><Input value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} autoComplete="cc-name" /></Field>
              <Field label={referenceT("Card number")} className="col-span-4" error={touched ? errs.number : undefined}><Input inputMode="numeric" value={card.number} onChange={(e) => setCard({ ...card, number: fmtCard(e.target.value) })} placeholder="4242 4242 4242 4242" autoComplete="cc-number" className="tabular" /></Field>
              <Field label={referenceT("Expiry")} className="col-span-2" error={touched ? errs.exp : undefined}><Input value={card.exp} onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 4); setCard({ ...card, exp: d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d }); }} placeholder={referenceT("MM/YY")} autoComplete="cc-exp" /></Field>
              <Field label={referenceT("CVC")} className="col-span-2" error={touched ? errs.cvc : undefined}><Input inputMode="numeric" value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value.replace(/\D/g, "").slice(0, 4) })} autoComplete="cc-csc" /></Field>
            </div>
          ) : (
            <div className="rounded-md bg-subtle p-3 text-xs">
              <p className="font-semibold"><ReferenceText message="Transfer to" /></p>
              <p>{profile.name}{profile.bankTransfer ? referenceT(" · Account {value0} · Routing {value1}", { value0: profile.bankTransfer.account, value1: profile.bankTransfer.routing }) : referenceT(" · use the bank details printed on your invoice")}</p>
              <p className="mt-1"><ReferenceText message="Reference:" /> <b>{inv.invoiceNo}</b></p>
              <p className="mt-1 text-muted"><ReferenceText message="Click Pay to confirm you've made the transfer. It's marked paid once the bank confirms (demo: instant)." /></p>
            </div>
          )}
          <p className="flex items-center gap-1.5 text-[11px] text-muted"><Lock className="size-3" /><ReferenceText message="Payments are processed securely. This is a demo — no real charge is made." /></p>
        </div>
      )}
    </Modal>
  );
}
