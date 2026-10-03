"use client";
import { ArrowLeft, Printer, Receipt, Search, ShoppingBag, Undo2 } from "lucide-react";
import { ReferenceLink as Link } from "@pepbits/reference-host";
import { LocalizedText, PrintDocument } from "@pepbits/ops-ui";
import { useRouter, useSearchParams } from "../../lib/navigation";
import { useEffect, useState } from "react";
import { Dialog, OverlayScope } from "../ui/dialog";
import { Button, EmptyState, ErrorNote, Field, Input, ListSkeleton, Panel, PanelHeader, Segmented, Skeleton, StatusPill, Tag, Td, Th, Textarea } from "../ui/primitives";
import { SourceButton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/controls";
import { useUserName } from "../shell/ShellContext";
import { useApi, useApiClient } from "../../lib/api";
import { usePharmacyFormat } from "../../lib/format";
import { useAction } from "../../lib/useAction";
import { cx } from "../../lib/cx";

interface Sale {
  id: string; bill_no: string; kind: string; status: string; net: number; gross: number; tax: number; discount: number; patient_share: number; payer_share: number;
  patient_paid: number; refunded: number; created_at: string; patient_name: string | null; mrn: string | null; order_no: string | null; order_id: string | null;
  rx_no: string | null; prescription_id: string | null; lines: number; method: string | null; channel: "counter" | "order" | "prescription";
}
interface Line { id: string; name: string; generic: string; strength: string; qty: number; qty_returned: number; unit_price: number; gross: number; tax: number; patient_share: number; primary_share: number; secondary_share: number }
export interface SaleDetail extends Omit<Sale, "lines"> {
  lines: Line[]; settings: Record<string, string>;
  payments: { id: string; payment_ref: string; method: string; amount: number; received_at: string }[];
  returns: { id: string; return_no: string; amount: number; reason: string; method: string; created_at: string; actor: string }[];
  claims: { id: string; claim_no: string; status: string; claimed: number; approved: number; paid: number; payer_code: string }[];
  history: { id: number; entity: string; ref: string; from_status: string | null; to_status: string; note: string | null; actor: string; at: string }[];
}
interface Summary { invoices: number; gross: number; refunded: number; net: number; otc: number; rx: number; methods: { method: string; amount: number; n: number }[]; top: { name: string; qty: number; amount: number }[] }
interface ReturnRow { id: string; ref: string; type: "sale" | "prescription"; amount: number; reason: string; method: string; created_at: string; actor: string; bill_no: string; bill_id: string; patient_name: string | null; items: string; prescription_id?: string }

const PERIODS = [{ value: "1", label: "Today" }, { value: "7", label: "7 days" }, { value: "30", label: "30 days" }] as const;
const CHANNELS = [{ value: "", label: "All" }, { value: "counter", label: "Counter" }, { value: "order", label: "Orders" }, { value: "prescription", label: "Prescriptions" }] as const;
const METHOD: Record<string, { label: string }> = {
  card: { label: "Card" }, cash: { label: "Cash" }, wallet: { label: "Wallet" }, online: { label: "Paid online" }, refund: { label: "Refund" }, store_credit: { label: "Store credit" }, eft: { label: "Bank transfer" },
};
const RETURN_REASONS = ["Bought the wrong strength", "Packaging damaged", "Customer changed mind, unopened", "Adverse reaction reported"];

export function SalesView() {
  const params = useSearchParams();
  const router = useRouter();
  const { t, int, money, moneyC } = usePharmacyFormat();
  const tab = (params.get("tab") as "invoices" | "returns") ?? "invoices";
  const selected = params.get("id");
  const [days, setDays] = useState<string>(params.get("days") ?? "1");
  const [channel, setChannel] = useState<string>("");
  const [q, setQ] = useState("");
  const go = (patch: Record<string, string | null>) => {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) { if (v === null) sp.delete(k); else sp.set(k, v); }
    router.replace(`/sales?${sp.toString()}`, { scroll: false });
  };
  const summary = useApi<Summary>(`/sales/summary?days=${days}`);
  const s = summary.data;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line bg-surface px-4 py-2.5 md:px-5">
        <Segmented value={tab} onChange={(v) => go({ tab: v, id: null })} items={[{ value: "invoices", label: "Invoices" }, { value: "returns", label: "Returns" }]} />
        <Segmented size="sm" value={days} onChange={setDays} items={PERIODS.map((p) => ({ ...p }))} />
        <div className="ml-auto flex flex-wrap items-center gap-x-6 gap-y-1 text-[13px]">
          {s ? (
            <>
              <span><span className="text-ink-3"><LocalizedText message="Invoices" /></span> <span className="num font-semibold">{int(s.invoices)}</span></span>
              <span><span className="text-ink-3"><LocalizedText message="Sales" /></span> <span className="num font-semibold">{moneyC(s.gross)}</span></span>
              <span><span className="text-ink-3"><LocalizedText message="Returns" /></span> <span className={cx("num font-semibold", s.refunded > 0 && "text-amber")}>{moneyC(s.refunded)}</span></span>
              <span><span className="text-ink-3"><LocalizedText message="Net" /></span> <span className="num font-semibold">{moneyC(s.net)}</span></span>
              <span className="hidden gap-1.5 xl:flex">{s.methods.filter((m) => m.amount > 0).map((m) => <Tag key={m.method} tone="neutral"><span className="num">{METHOD[m.method] ? t(METHOD[m.method].label) : m.method} {money(m.amount)}</span></Tag>)}</span>
            </>
          ) : <Skeleton className="h-5 w-80" />}
        </div>
      </div>
      {tab === "invoices"
        ? <Invoices days={days} channel={channel} setChannel={setChannel} q={q} setQ={setQ} selected={selected} onSelect={(id) => go({ id })} />
        : <Returns days={days} />}
    </div>
  );
}

function Invoices({ days, channel, setChannel, q, setQ, selected, onSelect }: {
  days: string; channel: string; setChannel: (c: string) => void; q: string; setQ: (q: string) => void; selected: string | null; onSelect: (id: string | null) => void;
}) {
  const { t, dateTime, money, plural } = usePharmacyFormat();
  const list = useApi<Sale[]>(`/sales?days=${days}${channel ? `&channel=${channel}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`);
  const rows = list.data ?? [];
  const current = selected ?? rows[0]?.id ?? null;
  return (
    <div className="grid min-h-0 flex-1 lg:grid-cols-[400px_minmax(0,1fr)]">
      <aside className={cx("flex min-h-0 flex-col border-r border-line bg-surface", selected && "hidden lg:flex")}>
        <div className="flex shrink-0 flex-col gap-2 border-b border-line p-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Invoice, customer, order or RX number" className="pl-8" aria-label="Search invoices" />
          </div>
          <Segmented size="sm" value={channel} onChange={setChannel} items={CHANNELS.map((c) => ({ ...c }))} />
        </div>
        <div className="scroll-y min-h-0 flex-1">
          {list.error && <ErrorNote error={list.error} onRetry={() => list.mutate()} />}
          {!list.data && !list.error && <ListSkeleton />}
          {list.data && !rows.length && <EmptyState icon={<Receipt className="size-5" />} title="No invoices in this period" body="Try a longer period or another channel." />}
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.id}>
                <SourceButton onClick={() => onSelect(r.id)} className={cx("flex w-full flex-col gap-0.5 px-4 py-2.5 text-left", r.id === current ? "bg-cobalt-wash" : "hover:bg-surface-2")}>
                  <span className="flex items-center gap-2">
                    <span className="num text-[13.5px] font-semibold">{r.bill_no}</span>
                    <Tag tone={r.channel === "prescription" ? "info" : r.channel === "order" ? "violet" : "neutral"}>{r.channel === "prescription" ? t("Prescription") : r.channel === "order" ? t("Order") : t("Counter")}</Tag>
                    {r.refunded > 0 && r.status !== "reversed" && <Tag tone="warn"><LocalizedText message="Part returned" /></Tag>}
                    <span className="num ml-auto text-[13.5px] font-semibold">{money(r.net)}</span>
                  </span>
                  <span className="flex items-center gap-2 text-xs text-ink-3">
                    <span className="truncate">{r.patient_name ?? t("Walk-in customer")}, {plural(r.lines, "item")}{r.method ? <>, {METHOD[r.method] ? t(METHOD[r.method].label) : r.method}</> : null}</span>
                    <span className="ml-auto shrink-0">{dateTime(r.created_at)}</span>
                  </span>
                  {r.status === "reversed" && <span><StatusPill status="reversed" label="Fully returned" /></span>}
                </SourceButton>
              </li>
            ))}
          </ul>
        </div>
      </aside>
      <section className={cx("min-h-0 min-w-0", !selected && "hidden lg:block")}>
        {current ? <InvoicePane id={current} onBack={() => onSelect(null)} /> : <EmptyState className="h-full" icon={<Receipt className="size-5" />} title="Choose an invoice" />}
      </section>
    </div>
  );
}

function InvoicePane({ id, onBack }: { id: string; onBack: () => void }) {
  const { data, error, mutate } = useApi<SaleDetail>(`/sales/${id}`);
  const who = useUserName();
  const { t, dateTime, money } = usePharmacyFormat();
  const [dialog, setDialog] = useState<null | "return" | "receipt">(null);
  if (error) return <ErrorNote error={error} onRetry={() => mutate()} />;
  if (!data) return <div className="space-y-3 p-5"><Skeleton className="h-16" /><Skeleton className="h-48" /></div>;
  const returnable = data.kind !== "rx" && data.status === "finalized" && data.lines.some((l) => l.qty_returned < l.qty);
  const paid = data.payments.filter((p) => p.amount > 0).reduce((s, p) => s + p.amount, 0);
  const methodLabel = (m: string) => (METHOD[m] ? t(METHOD[m].label) : m);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SourceButton onClick={onBack} className="flex shrink-0 items-center gap-1.5 border-b border-line bg-surface px-4 py-2 text-[13px] text-cobalt lg:hidden"><ArrowLeft className="size-4" /><LocalizedText message="Back to invoices" /></SourceButton>
      <div className="scroll-y min-h-0 flex-1 space-y-4 p-4 md:p-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="num text-[20px] font-semibold tracking-tight">{data.bill_no}</h2>
              <StatusPill status={data.status} label={data.status === "reversed" && data.refunded > 0 ? "Fully returned" : undefined} />
            </div>
            <p className="text-[13px] text-ink-2">
              {data.patient_name ?? t("Walk-in customer")}{data.mrn ? `, ${data.mrn}` : ""}, {dateTime(data.created_at)}
              {data.order_no && <>{" "}<Link className="font-medium text-cobalt hover:underline" href={`/orders?id=${data.order_id}`}><LocalizedText message="from order {value0}" values={{ value0: data.order_no }} /></Link></>}
              {data.rx_no && <>{" "}<Link className="font-medium text-cobalt hover:underline" href={`/workbench?rx=${data.prescription_id}`}><LocalizedText message="for {value0}" values={{ value0: data.rx_no }} /></Link></>}
            </p>
          </div>
          <Button icon={<Printer className="size-4" />} onClick={() => setDialog("receipt")}><LocalizedText message="Receipt" /></Button>
          {returnable && <Button variant="primary" icon={<Undo2 className="size-4" />} onClick={() => setDialog("return")}><LocalizedText message="Return items" /></Button>}
          {data.kind === "rx" && data.status === "finalized" && (
            <Link href={`/workbench?rx=${data.prescription_id}`} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-3 text-[13px] font-medium hover:bg-surface-2">
              <Undo2 className="size-4" /><LocalizedText message="Return on prescription" />
            </Link>
          )}
        </div>

        <Panel>
          <div className="scroll-x">
            <Table className="w-full min-w-[620px]">
              <TableHeader><TableRow><Th><LocalizedText message="Item" /></Th><Th align="right"><LocalizedText message="Qty" /></Th><Th align="right"><LocalizedText message="Returned" /></Th><Th align="right"><LocalizedText message="Unit" /></Th><Th align="right"><LocalizedText message="VAT" /></Th>{data.kind === "rx" && <Th align="right"><LocalizedText message="Payers" /></Th>}<Th align="right"><LocalizedText message="Total" /></Th></TableRow></TableHeader>
              <TableBody>
                {data.lines.map((l) => (
                  <TableRow key={l.id}>
                    <Td><p className="font-medium">{l.name}</p><p className="text-xs text-ink-3">{l.generic} {l.strength}</p></Td>
                    <Td align="right">{l.qty}</Td>
                    <Td align="right" className={l.qty_returned ? "font-medium text-amber" : "text-ink-3"}>{l.qty_returned || "—"}</Td>
                    <Td align="right">{money(l.unit_price)}</Td>
                    <Td align="right">{money(l.tax)}</Td>
                    {data.kind === "rx" && <Td align="right">{money(l.primary_share + l.secondary_share)}</Td>}
                    <Td align="right" className="font-medium">{money(l.gross + l.tax)}</Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <dl className="num ml-auto grid w-full max-w-xs grid-cols-2 gap-y-1 px-4 py-3 text-[13px]">
            <dt className="text-ink-3"><LocalizedText message="Subtotal" /></dt><dd className="text-right">{money(data.gross)}</dd>
            <dt className="text-ink-3"><LocalizedText message="VAT" /></dt><dd className="text-right">{money(data.tax)}</dd>
            {data.discount > 0 && <><dt className="text-ink-3"><LocalizedText message="Discount" /></dt><dd className="text-right">−{money(data.discount)}</dd></>}
            {data.payer_share > 0 && <><dt className="text-ink-3"><LocalizedText message="Billed to payers" /></dt><dd className="text-right">{money(data.payer_share)}</dd></>}
            <dt className="font-semibold"><LocalizedText message="Customer paid" /></dt><dd className="text-right font-semibold">{money(paid)}</dd>
            {data.refunded > 0 && <><dt className="text-amber"><LocalizedText message="Refunded" /></dt><dd className="text-right text-amber">−{money(data.refunded)}</dd></>}
          </dl>
        </Panel>

        <div className="grid gap-4 xl:grid-cols-2">
          <Panel>
            <PanelHeader title="Payments and refunds" />
            <ul className="divide-y divide-line text-[13px]">
              {data.payments.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-2">
                  <span className="num font-medium">{p.payment_ref}</span>
                  <span className="text-ink-3">{methodLabel(p.method)}, {dateTime(p.received_at)}</span>
                  <span className={cx("num ml-auto font-medium", p.amount < 0 && "text-amber")}>{p.amount < 0 ? "−" : ""}{money(Math.abs(p.amount))}</span>
                </li>
              ))}
              {data.claims.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-4 py-2">
                  <Link href={`/claims?claim=${c.id}`} className="num font-medium text-cobalt hover:underline">{c.claim_no}</Link>
                  <span className="text-ink-3"><LocalizedText message="{value0} claim" values={{ value0: c.payer_code }} /></span><StatusPill status={c.status} />
                  <span className="num ml-auto">{money(c.claimed)}</span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel>
            <PanelHeader title="Credit notes" sub={data.returns.length ? undefined : "Nothing returned on this invoice"} />
            <ul className="divide-y divide-line text-[13px]">
              {data.returns.map((r) => (
                <li key={r.id} className="px-4 py-2">
                  <p className="flex items-center gap-2"><span className="num font-medium">{r.return_no}</span><StatusPill status="refunded" /><span className="num ml-auto font-medium text-amber">−{money(r.amount)}</span></p>
                  <p className="text-xs text-ink-3">{t("{value0}. {value1} by {value2}, {value3}", { value0: r.reason, value1: methodLabel(r.method), value2: who(r.actor), value3: dateTime(r.created_at) })}</p>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <Panel>
          <PanelHeader title="History" />
          <ul className="divide-y divide-line text-[13px]">
            {data.history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-2 px-4 py-2">
                <StatusPill status={h.to_status} /><span className="text-ink-2">{who(h.actor)}</span>{h.note && <span className="text-ink-3">{h.note}</span>}
                <span className="num ml-auto text-ink-3">{dateTime(h.at)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      {dialog === "return" && <ReturnDialog sale={data} onClose={() => setDialog(null)} onDone={() => mutate()} />}
      {dialog === "receipt" && <ReceiptDialog sale={data} onClose={() => setDialog(null)} />}
    </div>
  );
}

function ReturnDialog({ sale, onClose, onDone }: { sale: SaleDetail; onClose: () => void; onDone: () => void }) {
  const { run, busy } = useAction();
  const api = useApiClient();
  const { t, moneyC, money } = usePharmacyFormat();
  const [qty, setQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState<"cash" | "card" | "wallet" | "store_credit">(sale.method === "card" ? "card" : sale.method === "wallet" ? "wallet" : "cash");
  const factor = sale.gross + sale.tax > 0 ? 1 - sale.discount / (sale.gross + sale.tax) : 1;
  const refund = sale.lines.reduce((s, l) => s + ((l.gross + l.tax) / l.qty) * (qty[l.id] ?? 0) * factor, 0);
  const any = Object.values(qty).some((n) => n > 0);
  const submit = async () => {
    const r = await run("return", ({ operationKey }) => api.post<{ return_no: string; amount: number }>(`/sales/${sale.id}/returns`, {
      lines: Object.entries(qty).filter(([, n]) => n > 0).map(([bill_line_id, n]) => ({ bill_line_id, qty: n })), reason: reason.trim(), method,
    }, { operationKey }), (x) => t("{value0} issued, {value1} refunded", { value0: x.return_no, value1: moneyC(x.amount) }), "Returned stock is in quarantine until a pharmacist inspects it.");
    if (r) { onDone(); onClose(); }
  };
  return (
    <Dialog open onClose={onClose} size="lg" title={t("Return items from {value0}", { value0: sale.bill_no })} sub="Returned medicine goes to quarantine, never straight back on the shelf. Counter sales can be returned within 30 days."
      footer={<>
        <span className="num mr-auto text-[14px]"><LocalizedText message="Refund" /> <span className="font-semibold">{moneyC(Math.round(refund * 100) / 100)}</span></span>
        <Button variant="ghost" onClick={onClose}><LocalizedText message="Cancel" /></Button>
        <Button variant="primary" disabled={!any || reason.trim().length < 3} loading={busy === "return"} onClick={submit}><LocalizedText message="Refund and issue credit note" /></Button>
      </>}>
      <Table className="w-full text-[13px]">
        <TableHeader><TableRow className="text-left text-[11.5px] text-ink-3"><TableHead className="pb-2 font-medium"><LocalizedText message="Item" /></TableHead><TableHead className="pb-2 text-right font-medium"><LocalizedText message="Sold" /></TableHead><TableHead className="pb-2 text-right font-medium"><LocalizedText message="Already returned" /></TableHead><TableHead className="w-36 pb-2 text-right font-medium"><LocalizedText message="Return now" /></TableHead></TableRow></TableHeader>
        <TableBody className="divide-y divide-line border-t border-line">
          {sale.lines.map((l) => {
            const max = l.qty - l.qty_returned;
            return (
              <TableRow key={l.id}>
                <TableCell className="py-2.5"><p className="font-medium">{l.name}</p><p className="num text-xs text-ink-3"><LocalizedText message="{value0} each incl. VAT" values={{ value0: money((l.gross + l.tax) / l.qty) }} /></p></TableCell>
                <TableCell className="num py-2.5 text-right">{l.qty}</TableCell>
                <TableCell className="num py-2.5 text-right text-ink-3">{l.qty_returned || "—"}</TableCell>
                <TableCell className="py-2.5 pl-3">
                  <div className="flex items-center justify-end gap-2">
                    <Input type="number" min={0} max={max} disabled={!max} value={qty[l.id] ?? 0} aria-label={t("Return quantity for {value0}", { value0: l.name })} className="num w-20 text-right"
                      onChange={(e) => setQty({ ...qty, [l.id]: Math.max(0, Math.min(Number(e.target.value), max)) })} />
                    <SourceButton className="text-xs text-cobalt hover:underline disabled:text-ink-3" disabled={!max} onClick={() => setQty({ ...qty, [l.id]: max })}><LocalizedText message="All" /></SourceButton>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <Field label="Reason">
          <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Bought the wrong strength" />
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {RETURN_REASONS.map((p) => (
              <SourceButton key={p} onClick={() => setReason(t(p))} className="rounded-md border border-line px-2 py-1 text-xs text-ink-2 hover:border-cobalt hover:text-cobalt"><LocalizedText message={p} /></SourceButton>
            ))}
          </div>
        </Field>
        <Field label="Refund to">
          <Segmented size="sm" value={method} onChange={setMethod} items={[{ value: "cash", label: "Cash" }, { value: "card", label: "Card" }, { value: "wallet", label: "Wallet" }, { value: "store_credit", label: "Store credit" }]} />
        </Field>
      </div>
    </Dialog>
  );
}

/** The thermal-width receipt, shared by the on-screen preview and the print copy. */
function ReceiptBody({ sale }: { sale: SaleDetail }) {
  const { t, dateTime, money } = usePharmacyFormat();
  const paid = sale.payments.filter((p) => p.amount > 0);
  const cur = sale.settings.currency ?? "";
  return (
    <div className="print-area mx-auto w-full max-w-[300px] rounded-md border border-dashed border-line-strong bg-white p-4 font-mono text-[11.5px] leading-snug text-[#111]">
      <p className="text-center text-[13px] font-bold">{sale.settings.pharmacy_name}</p>
      <p className="text-center">{sale.settings.branch_name}</p>
      <p className="text-center"><LocalizedText message="Licence {value0}" values={{ value0: sale.settings.license_no }} /></p>
      <p className="my-2 border-t border-dashed border-[#999]" />
      <p><LocalizedText message="Invoice {value0}" values={{ value0: sale.bill_no }} /></p>
      <p>{dateTime(sale.created_at)}</p>
      {sale.patient_name && <p><LocalizedText message="Customer {value0}" values={{ value0: sale.patient_name }} /></p>}
      {sale.rx_no && <p><LocalizedText message="Prescription {value0}" values={{ value0: sale.rx_no }} /></p>}
      {sale.order_no && <p><LocalizedText message="Order {value0}" values={{ value0: sale.order_no }} /></p>}
      <p className="my-2 border-t border-dashed border-[#999]" />
      {sale.lines.map((l) => (
        <div key={l.id} className="mb-1">
          <p>{l.name}</p>
          <p className="flex justify-between"><span><LocalizedText message="{value0} x {value1}" values={{ value0: l.qty, value1: money(l.unit_price) }} /></span><span>{money(l.gross + l.tax)}</span></p>
          {l.qty_returned > 0 && <p className="flex justify-between"><span><LocalizedText message="  returned {value0}" values={{ value0: l.qty_returned }} /></span><span /></p>}
        </div>
      ))}
      <p className="my-2 border-t border-dashed border-[#999]" />
      <p className="flex justify-between"><span><LocalizedText message="Subtotal" /></span><span>{money(sale.gross)}</span></p>
      <p className="flex justify-between"><span><LocalizedText message="VAT" /></span><span>{money(sale.tax)}</span></p>
      {sale.discount > 0 && <p className="flex justify-between"><span><LocalizedText message="Discount" /></span><span>-{money(sale.discount)}</span></p>}
      {sale.payer_share > 0 && <p className="flex justify-between"><span><LocalizedText message="Insurance" /></span><span>-{money(sale.payer_share)}</span></p>}
      <p className="flex justify-between text-[13px] font-bold"><span><LocalizedText message="Paid {value0}" values={{ value0: cur }} /></span><span>{money(paid.reduce((s, p) => s + p.amount, 0))}</span></p>
      {paid.map((p) => <p key={p.id} className="flex justify-between"><span>{METHOD[p.method] ? t(METHOD[p.method].label) : p.method}</span><span>{money(p.amount)}</span></p>)}
      {sale.refunded > 0 && <p className="flex justify-between"><span><LocalizedText message="Refunded" /></span><span>-{money(sale.refunded)}</span></p>}
      <p className="my-2 border-t border-dashed border-[#999]" />
      <p className="text-center"><LocalizedText message="Keep medicines out of reach of children." /></p>
      <p className="text-center"><LocalizedText message="Unopened items can be returned within 30 days with this receipt." /></p>
    </div>
  );
}

/** Thermal-width receipt. Print mounts the same receipt on the shared print surface, so only it is on paper. */
export function ReceiptDialog({ sale, onClose }: { sale: SaleDetail; onClose: () => void }) {
  const { t } = usePharmacyFormat();
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener("afterprint", done);
    const timer = setTimeout(() => window.print(), 50);
    // A host that never reports afterprint must not leave Print dead: release the print surface after a minute.
    const release = setTimeout(done, 60_000);
    return () => { clearTimeout(timer); clearTimeout(release); window.removeEventListener("afterprint", done); };
  }, [printing]);
  return (
    <Dialog open onClose={onClose} size="sm" title={t("Receipt {value0}", { value0: sale.bill_no })}
      footer={<><Button variant="ghost" onClick={onClose}><LocalizedText message="Close" /></Button><Button variant="primary" icon={<Printer className="size-4" />} onClick={() => setPrinting(true)}><LocalizedText message="Print" /></Button></>}>
      <ReceiptBody sale={sale} />
      {printing && <PrintDocument><OverlayScope><ReceiptBody sale={sale} /></OverlayScope></PrintDocument>}
    </Dialog>
  );
}

function Returns({ days }: { days: string }) {
  const { data, error, mutate } = useApi<ReturnRow[]>(`/sales/returns?days=${Math.max(Number(days), 30)}`);
  const who = useUserName();
  const { t, dateTime, money, plural } = usePharmacyFormat();
  if (error) return <ErrorNote error={error} onRetry={() => mutate()} />;
  if (!data) return <ListSkeleton />;
  return (
    <div className="scroll-y min-h-0 flex-1 p-4 md:p-5">
      <Panel>
        <PanelHeader title="Returns and refunds" sub={t("{value0} in the last {value1} days. Counter and order returns get a credit note; prescription returns also reverse their claims.", { value0: plural(data.length, "return"), value1: Math.max(Number(days), 30) })} />
        {!data.length ? <EmptyState icon={<Undo2 className="size-5" />} title="No returns" body="Open an invoice and choose Return items to refund a sale." /> : (
          <div className="scroll-x">
            <Table className="w-full min-w-[860px]">
              <TableHeader><TableRow><Th><LocalizedText message="Return" /></Th><Th><LocalizedText message="Type" /></Th><Th><LocalizedText message="Invoice" /></Th><Th><LocalizedText message="Customer" /></Th><Th><LocalizedText message="Items" /></Th><Th><LocalizedText message="Reason" /></Th><Th align="right"><LocalizedText message="Refunded" /></Th><Th><LocalizedText message="When" /></Th></TableRow></TableHeader>
              <TableBody>
                {data.map((r) => (
                  <TableRow key={r.id} className="hover:bg-surface-2">
                    <Td className="num font-medium">{r.ref}</Td>
                    <Td><Tag tone={r.type === "prescription" ? "info" : "neutral"}>{r.type === "prescription" ? t("Prescription") : t("Sale")}</Tag></Td>
                    <Td><Link href={`/sales?id=${r.bill_id}`} className="num font-medium text-cobalt hover:underline">{r.bill_no}</Link></Td>
                    <Td>{r.patient_name ?? t("Walk-in")}</Td>
                    <Td className="max-w-56 truncate text-ink-2" >{r.items}</Td>
                    <Td className="max-w-56 truncate text-ink-2">{r.reason}</Td>
                    <Td align="right" className="text-amber">{money(r.amount)}</Td>
                    <Td className="whitespace-nowrap text-xs text-ink-3">{dateTime(r.created_at)}<br />{who(r.actor)}</Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-3"><ShoppingBag className="size-3.5" /><LocalizedText message="Returned stock is listed under Inventory, Expiry and quarantine, until it is inspected." /></p>
    </div>
  );
}
