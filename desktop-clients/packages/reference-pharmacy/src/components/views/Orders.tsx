"use client";
import { ArrowLeft, Bike, Check, Globe, MessageCircle, PackageCheck, Phone, Plus, Search, ShoppingBag, Store, Trash2, Truck, X } from "lucide-react";
import { ReferenceLink as Link } from "@pepbits/reference-host";
import { LocalizedText } from "@pepbits/ops-ui";
import { useRouter, useSearchParams } from "../../lib/navigation";
import { useState } from "react";
import { Dialog } from "../ui/dialog";
import { Lookup } from "../ui/lookup";
import { ReasonDialog } from "../ui/reason";
import { Button, EmptyState, ErrorNote, Field, Input, ListSkeleton, Panel, PanelHeader, Segmented, Skeleton, StatusPill, Tag, Td, Th, Textarea } from "../ui/primitives";
import { SourceButton, Table, TableBody, TableHeader, TableRow } from "../ui/controls";
import { useUserName } from "../shell/ShellContext";
import { useApi, useApiClient } from "../../lib/api";
import { usePharmacyFormat } from "../../lib/format";
import { useAction } from "../../lib/useAction";
import { cx } from "../../lib/cx";

interface Order {
  id: string; order_no: string; customer_name: string; phone: string; channel: string; fulfilment: "pickup" | "delivery"; address: string | null;
  payment: "prepaid" | "cash_on_delivery" | "pay_at_counter"; status: string; notes: string | null; total: number; bill_id: string | null; bill_no: string | null;
  patient_id: string | null; promised_at: string; created_at: string; completed_at: string | null; lines: number; item_names: string;
}
interface OrderDetail extends Order {
  items: { id: string; name: string; generic: string; strength: string; qty: number; unit_price: number; tax_rate: number; location: string; allocations: { qty: number; batch_no: string; expiry: string }[] }[];
  history: { id: number; to_status: string; note: string | null; actor: string; at: string }[];
}
type Status = "open" | "new" | "confirmed" | "ready" | "out_for_delivery" | "completed" | "cancelled";

const CHANNEL_ICON = { phone: Phone, web: Globe, whatsapp: MessageCircle, walk_in: Store } as const;
const CHANNEL: Record<string, { label: string }> = { phone: { label: "Phone" }, web: { label: "Web" }, whatsapp: { label: "WhatsApp" }, walk_in: { label: "Walk-in" } };
const PAYMENT: Record<string, { label: string }> = { prepaid: { label: "Paid online" }, cash_on_delivery: { label: "Pay on delivery" }, pay_at_counter: { label: "Pay at counter" } };

export function OrdersView() {
  const params = useSearchParams();
  const router = useRouter();
  const { t, ago, money, time } = usePharmacyFormat();
  const [status, setStatus] = useState<Status>("open");
  const [q, setQ] = useState("");
  const selected = params.get("id");
  const creating = params.get("new") === "1";
  const nav = (patch: Record<string, string | null>) => {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) { if (v === null) sp.delete(k); else sp.set(k, v); }
    router.replace(`/orders?${sp.toString()}`, { scroll: false });
  };
  const list = useApi<{ rows: Order[]; counts: Record<string, number> }>(`/orders?status=${status}${q ? `&q=${encodeURIComponent(q)}` : ""}`, { refreshInterval: 20_000 });
  const rows = list.data?.rows ?? [];
  const c = list.data?.counts ?? {};
  const open = (c.new ?? 0) + (c.confirmed ?? 0) + (c.ready ?? 0) + (c.out_for_delivery ?? 0);
  const current = selected ?? rows[0]?.id ?? null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line bg-surface px-4 py-2.5 md:px-5">
        <div className="scroll-x max-w-full">
          <Segmented<Status> value={status} onChange={setStatus} items={[
            { value: "open", label: "Open", count: open }, { value: "new", label: "New", count: c.new ?? 0, tone: c.new ? "info" : undefined },
            { value: "confirmed", label: "Confirmed", count: c.confirmed ?? 0 }, { value: "ready", label: "Packed", count: c.ready ?? 0 },
            { value: "out_for_delivery", label: "Out for delivery", count: c.out_for_delivery ?? 0 }, { value: "completed", label: "Completed", count: c.completed ?? 0 },
            { value: "cancelled", label: "Cancelled", count: c.cancelled ?? 0 },
          ]} />
        </div>
        <Button variant="primary" className="ml-auto" icon={<Plus className="size-4" />} onClick={() => nav({ new: "1" })}><LocalizedText message="New order" /></Button>
      </div>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[380px_minmax(0,1fr)]">
        <aside className={cx("flex min-h-0 flex-col border-r border-line bg-surface", selected && "hidden lg:flex")}>
          <div className="shrink-0 border-b border-line p-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Order number, customer or phone" className="pl-8" aria-label="Search orders" />
            </div>
          </div>
          <div className="scroll-y min-h-0 flex-1">
            {list.error && <ErrorNote error={list.error} onRetry={() => list.mutate()} />}
            {!list.data && !list.error && <ListSkeleton />}
            {list.data && !rows.length && <EmptyState icon={<ShoppingBag className="size-5" />} title="No orders here" body="Orders taken by phone, web or WhatsApp appear here until they are collected or delivered." />}
            <ul className="divide-y divide-line">
              {rows.map((o) => {
                const Icon = CHANNEL_ICON[o.channel as keyof typeof CHANNEL_ICON] ?? Globe;
                const late = !["completed", "cancelled"].includes(o.status) && o.promised_at < new Date().toISOString();
                return (
                  <li key={o.id}>
                    <SourceButton onClick={() => nav({ id: o.id })} className={cx("flex w-full flex-col gap-1 px-4 py-2.5 text-left", o.id === current ? "bg-cobalt-wash" : "hover:bg-surface-2")}>
                      <span className="flex items-center gap-2">
                        <Icon className="size-3.5 text-ink-3" aria-label={CHANNEL[o.channel] ? t(CHANNEL[o.channel].label) : o.channel} />
                        <span className="num text-[13.5px] font-semibold">{o.order_no}</span>
                        <span className="truncate text-[13px] text-ink-2">{o.customer_name}</span>
                        <span className="num ml-auto shrink-0 text-[13px] font-medium">{money(o.total)}</span>
                      </span>
                      <span className="truncate text-xs text-ink-3">{o.item_names}</span>
                      <span className="flex flex-wrap items-center gap-1">
                        <StatusPill status={o.status} />
                        <Tag tone={o.fulfilment === "delivery" ? "violet" : "neutral"}>{o.fulfilment === "delivery" ? <><Bike className="size-3" /><LocalizedText message="Delivery" /></> : <><Store className="size-3" /><LocalizedText message="Pickup" /></>}</Tag>
                        {o.payment === "prepaid" && <Tag tone="ok"><LocalizedText message="Paid" /></Tag>}
                        <span className={cx("num ml-auto text-xs", late ? "font-medium text-danger" : "text-ink-3")}>{late ? t("Due {value0}", { value0: time(o.promised_at) }) : ago(o.created_at)}</span>
                      </span>
                    </SourceButton>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>
        <section className={cx("min-h-0 min-w-0", !selected && "hidden lg:block")}>
          {current ? <OrderPane id={current} onBack={() => nav({ id: null })} onPin={() => { if (!selected) nav({ id: current }); }} /> : <EmptyState className="h-full" icon={<ShoppingBag className="size-5" />} title="Choose an order" />}
        </section>
      </div>
      {creating && <NewOrderDialog onClose={() => nav({ new: null })} onCreated={(id) => { setStatus("open"); nav({ new: null, id }); }} />}
    </div>
  );
}

const FLOW = ["new", "confirmed", "ready", "out_for_delivery", "completed"];

function OrderPane({ id, onBack, onPin }: { id: string; onBack: () => void; onPin: () => void }) {
  const { data: o, error, mutate } = useApi<OrderDetail>(`/orders/${id}`);
  const { run, busy } = useAction();
  const api = useApiClient();
  const who = useUserName();
  const { t, dateShort, dateTime, money, moneyC, plural, time } = usePharmacyFormat();
  const [method, setMethod] = useState<"cash" | "card" | "wallet">("cash");
  const [cancel, setCancel] = useState(false);
  if (error) return <ErrorNote error={error} onRetry={() => mutate()} />;
  if (!o) return <div className="space-y-3 p-5"><Skeleton className="h-16" /><Skeleton className="h-48" /></div>;

  const act = async (path: string, label: string, body?: unknown) => {
    onPin(); // keep this order open as it moves to its next status
    const r = await run(path, ({ operationKey }) => api.post<OrderDetail>(`/orders/${o.id}/${path}`, body, { operationKey }), label);
    if (r) mutate(r, { revalidate: false });
  };
  const steps = FLOW.filter((s) => o.fulfilment === "delivery" || s !== "out_for_delivery");
  const at = steps.indexOf(o.status);
  const subtotal = o.items.reduce((s, i) => s + i.unit_price * i.qty, 0);
  const delivery = o.fulfilment === "delivery";
  const channelLabel = CHANNEL[o.channel] ? t(CHANNEL[o.channel].label) : o.channel;
  const stepLabel = (s: string) => (s === "ready" ? t("Packed") : s === "out_for_delivery" ? t("On the way") : s === "completed" ? (delivery ? t("Delivered") : t("Collected")) : s === "new" ? t("Received") : t("Confirmed"));
  const completeLabel = o.payment !== "prepaid"
    ? (delivery ? t("Mark delivered and take {value0}", { value0: moneyC(o.total) }) : t("Mark collected and take {value0}", { value0: moneyC(o.total) }))
    : (delivery ? t("Mark delivered") : t("Mark collected"));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SourceButton onClick={onBack} className="flex shrink-0 items-center gap-1.5 border-b border-line bg-surface px-4 py-2 text-[13px] text-cobalt lg:hidden"><ArrowLeft className="size-4" /><LocalizedText message="Back to orders" /></SourceButton>
      <div className="scroll-y min-h-0 flex-1 space-y-4 p-4 md:p-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2"><h2 className="num text-[20px] font-semibold tracking-tight">{o.order_no}</h2><StatusPill status={o.status} /></div>
            <p className="text-[13px] text-ink-2">
              {delivery
                ? t("{value0} order, {value1}. Promised delivery by {value2} {value3}.", { value0: channelLabel, value1: dateTime(o.created_at), value2: dateShort(o.promised_at), value3: time(o.promised_at) })
                : t("{value0} order, {value1}. Promised pickup by {value2} {value3}.", { value0: channelLabel, value1: dateTime(o.created_at), value2: dateShort(o.promised_at), value3: time(o.promised_at) })}
            </p>
          </div>
          {o.bill_id && <Link href={`/sales?id=${o.bill_id}`} className="inline-flex h-8 items-center rounded-md border border-line-strong bg-surface px-3 text-[13px] font-medium hover:bg-surface-2"><LocalizedText message="Invoice {value0}" values={{ value0: o.bill_no ?? "" }} /></Link>}
        </div>

        {o.status !== "cancelled" && (
          <ol className="grid rounded-xl border border-line bg-surface" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
            {steps.map((s, i) => (
              <li key={s} className="flex items-center gap-2 px-3 py-2.5">
                <span className={cx("flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold", i < at || o.status === "completed" ? "bg-ok text-white" : i === at ? "bg-cobalt text-on-cobalt" : "bg-surface-3 text-ink-3")}>
                  {i < at || o.status === "completed" ? <Check className="size-3" /> : i + 1}
                </span>
                <span className={cx("truncate text-[12.5px]", i === at ? "font-semibold" : "text-ink-2")}>{stepLabel(s)}</span>
              </li>
            ))}
          </ol>
        )}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(260px,1fr)]">
          <Panel>
            <PanelHeader title={plural(o.items.length, "item")} sub={o.status === "new" ? "Confirm to reserve stock first-expiry-first-out." : undefined} />
            <Table className="w-full">
              <TableHeader><TableRow><Th><LocalizedText message="Item" /></Th><Th><LocalizedText message="Picked from" /></Th><Th align="right"><LocalizedText message="Qty" /></Th><Th align="right"><LocalizedText message="Total" /></Th></TableRow></TableHeader>
              <TableBody>
                {o.items.map((i) => (
                  <TableRow key={i.id}>
                    <Td><p className="font-medium">{i.name}</p><p className="text-xs text-ink-3">{t("{value0} {value1}, shelf {value2}", { value0: i.generic, value1: i.strength, value2: i.location })}</p></Td>
                    <Td className="text-xs text-ink-2">{i.allocations.length ? i.allocations.map((a) => t("{value0} from {value1} (exp {value2})", { value0: a.qty, value1: a.batch_no, value2: dateShort(a.expiry) })).join(", ") : <span className="text-ink-3"><LocalizedText message="Not reserved yet" /></span>}</Td>
                    <Td align="right">{i.qty}</Td>
                    <Td align="right">{money(i.unit_price * i.qty * (1 + i.tax_rate))}</Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="num flex justify-end gap-6 px-4 py-2.5 text-[13px]"><span className="text-ink-3"><LocalizedText message="Subtotal {value0}" values={{ value0: money(subtotal) }} /></span><span className="font-semibold"><LocalizedText message="Total {value0}" values={{ value0: moneyC(o.total) }} /></span></p>
          </Panel>
          <Panel>
            <PanelHeader title="Customer and delivery" />
            <dl className="grid gap-2.5 px-4 py-3 text-[13px]">
              <div><dt className="text-xs text-ink-3"><LocalizedText message="Customer" /></dt><dd>{o.patient_id ? <Link className="font-medium text-cobalt hover:underline" href={`/patients?id=${o.patient_id}`}>{o.customer_name}</Link> : o.customer_name}</dd></div>
              <div><dt className="text-xs text-ink-3"><LocalizedText message="Phone" /></dt><dd className="num">{o.phone}</dd></div>
              <div><dt className="text-xs text-ink-3">{delivery ? <LocalizedText message="Deliver to" /> : <LocalizedText message="Collection" />}</dt><dd>{delivery ? o.address : <LocalizedText message="At the counter" />}</dd></div>
              <div><dt className="text-xs text-ink-3"><LocalizedText message="Payment" /></dt><dd>{PAYMENT[o.payment] ? t(PAYMENT[o.payment].label) : o.payment}</dd></div>
              {o.notes && <div><dt className="text-xs text-ink-3"><LocalizedText message="Notes" /></dt><dd>{o.notes}</dd></div>}
            </dl>
          </Panel>
        </div>

        <Panel>
          <PanelHeader title="History" />
          <ul className="divide-y divide-line text-[13px]">
            {o.history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-2 px-4 py-2">
                <StatusPill status={h.to_status} /><span className="text-ink-2">{who(h.actor)}</span>{h.note && <span className="text-ink-3">{h.note}</span>}
                <span className="num ml-auto text-ink-3">{dateTime(h.at)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {!["completed", "cancelled"].includes(o.status) && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-line bg-surface-2 px-4 py-3 md:px-5">
          {o.status === "new" && <Button variant="primary" size="lg" icon={<Check className="size-4" />} loading={busy === "confirm"} onClick={() => act("confirm", t("{value0} confirmed, stock reserved", { value0: o.order_no }))}><LocalizedText message="Confirm and reserve stock" /></Button>}
          {o.status === "confirmed" && <Button variant="primary" size="lg" icon={<PackageCheck className="size-4" />} loading={busy === "ready"} onClick={() => act("ready", t("{value0} packed", { value0: o.order_no }))}><LocalizedText message="Mark packed" /></Button>}
          {o.status === "ready" && delivery && <Button variant="primary" size="lg" icon={<Truck className="size-4" />} loading={busy === "dispatch"} onClick={() => act("dispatch", t("{value0} out for delivery", { value0: o.order_no }), { rider: "Rider" })}><LocalizedText message="Hand to rider" /></Button>}
          {((o.status === "ready" && o.fulfilment === "pickup") || o.status === "out_for_delivery") && (
            <>
              {o.payment !== "prepaid" && <Segmented size="sm" value={method} onChange={setMethod} items={[{ value: "cash", label: "Cash" }, { value: "card", label: "Card" }, { value: "wallet", label: "Wallet" }]} />}
              <Button variant="primary" size="lg" icon={<Check className="size-4" />} loading={busy === "complete"}
                onClick={() => act("complete", delivery ? t("{value0} delivered, invoice raised", { value0: o.order_no }) : t("{value0} collected, invoice raised", { value0: o.order_no }), { payment_method: method })}>
                {completeLabel}
              </Button>
            </>
          )}
          <Button variant="ghost" className="ml-auto" icon={<X className="size-4" />} onClick={() => setCancel(true)}><LocalizedText message="Cancel order" /></Button>
        </div>
      )}
      <ReasonDialog open={cancel} onClose={() => setCancel(false)} title={t("Cancel {value0}", { value0: o.order_no })} sub="Any reserved stock is released back to sellable stock." label="Reason" confirm="Cancel order" danger
        presets={["Customer cancelled by phone", "Out of stock", "Address unreachable"]}
        onConfirm={async (reason) => { await act("cancel", t("{value0} cancelled", { value0: o.order_no }), { reason }); }} />
    </div>
  );
}

interface PatientHit { id: string; name: string; mrn: string; phone: string; address: string }
interface ProductHit { id: string; name: string; generic: string; strength: string; schedule: string; price_per_unit: number; tax_rate: number; available: number }

function NewOrderDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { run, busy } = useAction();
  const api = useApiClient();
  const { t, money, moneyC, num } = usePharmacyFormat();
  const [customer, setCustomer] = useState({ patient_id: null as string | null, name: "", phone: "", address: "" });
  const [channel, setChannel] = useState<"phone" | "web" | "whatsapp" | "walk_in">("phone");
  const [fulfilment, setFulfilment] = useState<"delivery" | "pickup">("delivery");
  const [payment, setPayment] = useState<"prepaid" | "cash_on_delivery" | "pay_at_counter">("cash_on_delivery");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<{ p: ProductHit; qty: number }[]>([]);
  const total = items.reduce((s, i) => s + i.p.price_per_unit * i.qty * (1 + i.p.tax_rate), 0);
  const ready = customer.name.trim().length > 1 && customer.phone.trim().length > 4 && items.length > 0 && (fulfilment === "pickup" || customer.address.trim().length > 3);
  const submit = async () => {
    const r = await run("create", ({ operationKey }) => api.post<OrderDetail>("/orders", {
      patient_id: customer.patient_id, customer_name: customer.name.trim(), phone: customer.phone.trim(), channel, fulfilment,
      address: fulfilment === "delivery" ? customer.address.trim() : undefined, payment, notes: notes.trim() || undefined,
      items: items.map((i) => ({ product_id: i.p.id, qty: i.qty })),
    }, { operationKey }), (o) => t("{value0} received", { value0: o.order_no }));
    if (r) onCreated(r.id);
  };
  return (
    <Dialog open onClose={onClose} size="lg" title="New customer order" sub="Non-prescription items only. Prescription medicines go through the Rx workbench, where you can choose home delivery."
      footer={<>
        <span className="num mr-auto text-[14px]"><LocalizedText message="Total" /> <span className="font-semibold">{moneyC(Math.round(total * 100) / 100)}</span></span>
        <Button variant="ghost" onClick={onClose}><LocalizedText message="Cancel" /></Button>
        <Button variant="primary" disabled={!ready} loading={busy === "create"} onClick={submit}><LocalizedText message="Create order" /></Button>
      </>}>
      <div className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Existing patient (optional)">
            <Lookup<PatientHit> endpoint={(q) => `/patients?q=${encodeURIComponent(q)}`} placeholder="Search by name, MRN or phone"
              onPick={(p) => setCustomer({ patient_id: p.id, name: p.name, phone: p.phone ?? "", address: p.address ?? "" })}
              render={(p) => <span className="flex gap-2 text-[13px]"><span className="font-medium">{p.name}</span><span className="text-ink-3">{p.mrn}</span><span className="ml-auto text-ink-3">{p.phone}</span></span>} />
          </Field>
          <Field label="Received by">
            <Segmented size="sm" value={channel} onChange={setChannel} items={[{ value: "phone", label: "Phone" }, { value: "web", label: "Web" }, { value: "whatsapp", label: "WhatsApp" }, { value: "walk_in", label: "Walk-in" }]} />
          </Field>
          <Field label="Customer name"><Input value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value, patient_id: null })} /></Field>
          <Field label="Phone"><Input value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} inputMode="tel" /></Field>
          <Field label="Fulfilment">
            <Segmented size="sm" value={fulfilment} onChange={(f) => { setFulfilment(f); setPayment(f === "delivery" ? "cash_on_delivery" : "pay_at_counter"); }}
              items={[{ value: "delivery", label: <span className="flex items-center gap-1"><Bike className="size-3.5" /><LocalizedText message="Delivery" /></span> }, { value: "pickup", label: <span className="flex items-center gap-1"><Store className="size-3.5" /><LocalizedText message="Pickup" /></span> }]} />
          </Field>
          <Field label="Payment">
            <Segmented size="sm" value={payment} onChange={setPayment} items={[
              { value: "prepaid", label: "Paid online" },
              fulfilment === "delivery" ? { value: "cash_on_delivery", label: "On delivery" } : { value: "pay_at_counter", label: "At counter" },
            ]} />
          </Field>
          {fulfilment === "delivery" && <Field label="Delivery address" className="sm:col-span-2"><Input value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} placeholder="Building, street, area" /></Field>}
          <Field label="Notes for the team (optional)" className="sm:col-span-2"><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Call on arrival" /></Field>
        </div>
        <div className="rounded-lg border border-line">
          <div className="flex items-center gap-3 border-b border-line bg-surface-2 px-3 py-2">
            <p className="text-[13px] font-medium"><LocalizedText message="Items" /></p>
            <Lookup<ProductHit> className="ml-auto w-72" endpoint={(q) => `/products/lookup?q=${encodeURIComponent(q)}&schedule=otc`} placeholder="Add item by name or barcode"
              onPick={(p) => setItems((xs) => xs.some((x) => x.p.id === p.id) ? xs.map((x) => (x.p.id === p.id ? { ...x, qty: x.qty + 1 } : x)) : [...xs, { p, qty: 1 }])}
              render={(p) => <span className="flex gap-2 text-[13px]"><span className="font-medium">{p.name}</span><span className="num ml-auto text-xs text-ink-3"><LocalizedText message="{value0} in stock, {value1}" values={{ value0: num(p.available), value1: money(p.price_per_unit) }} /></span></span>} />
          </div>
          {!items.length ? <p className="px-3 py-5 text-center text-[13px] text-ink-3"><LocalizedText message="Search above to add the first item." /></p> : (
            <ul className="divide-y divide-line">
              {items.map((i) => (
                <li key={i.p.id} className="flex items-center gap-3 px-3 py-2 text-[13px]">
                  <span className="min-w-0 flex-1 truncate font-medium">{i.p.name}</span>
                  <span className={cx("num text-xs", i.qty > i.p.available ? "text-danger" : "text-ink-3")}><LocalizedText message="{value0} in stock" values={{ value0: num(i.p.available) }} /></span>
                  <Input type="number" min={1} value={i.qty} aria-label={t("Quantity of {value0}", { value0: i.p.name })} className="num w-20 text-right"
                    onChange={(e) => setItems((xs) => xs.map((x) => (x.p.id === i.p.id ? { ...x, qty: Math.max(1, Number(e.target.value)) } : x)))} />
                  <span className="num w-20 text-right">{money(i.p.price_per_unit * i.qty * (1 + i.p.tax_rate))}</span>
                  <SourceButton aria-label={t("Remove {value0}", { value0: i.p.name })} onClick={() => setItems((xs) => xs.filter((x) => x.p.id !== i.p.id))} className="text-ink-3 hover:text-danger"><Trash2 className="size-4" /></SourceButton>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Dialog>
  );
}
