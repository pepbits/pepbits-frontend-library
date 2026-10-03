"use client";
import clsx from "clsx";
import { ArrowLeft, CircleCheck, PackageCheck, Send, Truck, X } from "lucide-react";
import { LocalizedText } from "@pepbits/ops-ui";
import { useMemo, useState } from "react";
import { SourceButton, SourceInput, Table, TableBody, TableHeader, TableRow } from "../ui/controls";
import { Button, DateInput, EmptyState, ErrorNote, Input, ListSkeleton, Panel, PanelHeader, Segmented, Skeleton, StatusPill, Tag, Td, Th } from "../ui/primitives";
import { useShell } from "../shell/ShellContext";
import { useApi, useApiClient } from "../../lib/api";
import { usePharmacyFormat } from "../../lib/format";
import { useRouter, useSearchParams } from "../../lib/navigation";
import { useAction } from "../../lib/useAction";

interface PO { id: string; po_no: string; supplier_id: string; supplier_name: string; status: string; total: number; created_at: string; expected_at: string | null; lines: number; received_ratio: number | null }
interface POItem { id: string; product_id: string; name: string; sku: string; dispense_unit: string; qty_ordered: number; qty_received: number; unit_cost: number }
interface PODetail extends PO { lead_time_days: number; items: POItem[]; history: { id: number; from_status: string | null; to_status: string; note: string | null; actor: string; at: string }[] }
interface Suggestion { product_id: string; name: string; sku: string; reorder_level: number; max_level: number; cost_per_unit: number; supplier_id: string; supplier_name: string; available: number; on_order: number; suggested: number }

type Tab = "orders" | "suggestions";

export function PurchasingView() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = (params.get("tab") as Tab) ?? "orders";
  const { data: sugg } = useApi<Suggestion[]>("/reorder-suggestions");
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-line bg-surface px-3 py-2 md:px-5">
        <Segmented value={tab} onChange={(t) => router.replace(`/purchasing?tab=${t}`, { scroll: false })}
          items={[{ value: "orders", label: "Purchase orders" }, { value: "suggestions", label: "Reorder suggestions", count: sugg?.length ?? 0, tone: "warn" }]} />
      </div>
      <div className="min-h-0 flex-1">{tab === "orders" ? <Orders /> : <Suggestions onCreated={(id) => router.replace(`/purchasing?tab=orders&po=${id}`, { scroll: false })} />}</div>
    </div>
  );
}

function Orders() {
  const params = useSearchParams();
  const router = useRouter();
  const { money, dateShort, plural } = usePharmacyFormat();
  const [status, setStatus] = useState("");
  const [closed, setClosed] = useState(false);
  const { data, error, isLoading, mutate } = useApi<PO[]>(`/purchase-orders${status ? `?status=${status}` : ""}`);
  const selected = closed ? null : params.get("po") ?? data?.[0]?.id ?? null;
  const select = (id: string | null) => { setClosed(id === null); router.replace(id ? `/purchasing?tab=orders&po=${id}` : "/purchasing?tab=orders", { scroll: false }); };

  return (
    <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)]">
      <aside className={clsx("flex min-h-0 flex-col border-r border-line bg-surface", selected && "hidden lg:flex")}>
        <div className="shrink-0 border-b border-line p-2.5">
          <Segmented size="sm" value={status} onChange={setStatus} items={[
            { value: "", label: "All" }, { value: "draft", label: "Draft" }, { value: "approved", label: "Approved" }, { value: "sent", label: "Sent" }, { value: "partially_received", label: "Part received" },
          ]} />
        </div>
        {error ? <ErrorNote error={error} onRetry={() => mutate()} /> : isLoading && !data ? <ListSkeleton /> : !data?.length ? (
          <EmptyState icon={<Truck className="size-5" />} title="No orders here" body="Create orders from reorder suggestions." />
        ) : (
          <ul className="scroll-y min-h-0 flex-1" role="listbox">
            {data.map((po) => (
              <li key={po.id} role="option" aria-selected={po.id === selected}>
                <SourceButton onClick={() => select(po.id)} className={clsx("flex w-full flex-col gap-0.5 border-b border-line px-4 py-2.5 text-left", po.id === selected ? "bg-cobalt-wash" : "hover:bg-surface-2")}>
                  <span className="flex items-center gap-2">
                    <span className="num text-[13px] font-semibold">{po.po_no}</span><StatusPill status={po.status} />
                    <span className="num ml-auto text-[13px] font-medium">{money(po.total)}</span>
                  </span>
                  <span className="flex items-center gap-2 text-xs text-ink-3">
                    <span className="truncate">{po.supplier_name}</span>
                    <span className="num ml-auto shrink-0"><LocalizedText message="{value0}, {value1}" values={{ value0: plural(po.lines, "line"), value1: dateShort(po.created_at) }} /></span>
                  </span>
                  {po.received_ratio != null && po.received_ratio > 0 && po.received_ratio < 1 && (
                    <span className="mt-1 h-1 overflow-hidden rounded-full bg-surface-3"><span className="block h-full bg-amber-mark" style={{ width: `${po.received_ratio * 100}%` }} /></span>
                  )}
                </SourceButton>
              </li>
            ))}
          </ul>
        )}
      </aside>
      <section className={clsx("min-h-0 min-w-0", !selected && "hidden lg:block")}>
        {selected ? <OrderPane id={selected} onBack={() => select(null)} /> : <EmptyState title="Select an order" className="h-full" />}
      </section>
    </div>
  );
}

function OrderPane({ id, onBack }: { id: string; onBack: () => void }) {
  const api = useApiClient();
  const { data: po, error, mutate } = useApi<PODetail>(`/purchase-orders/${id}`);
  const { meta } = useShell();
  const { money, moneyC, dateShort, dateTime, plural, t, num } = usePharmacyFormat();
  const { run, busy } = useAction();
  const [receiving, setReceiving] = useState<Record<string, { qty: string; batch: string; expiry: string }> | null>(null);
  if (error) return <ErrorNote error={error} onRetry={() => mutate()} />;
  if (!po || po.id !== id) return <div className="flex flex-col gap-4 p-5"><Skeleton className="h-14 w-1/2" /><Skeleton className="h-64" /></div>;

  const advance = (a: "approve" | "send" | "cancel", done: string) =>
    run(a, async ({ operationKey }) => { const r = await api.post<PODetail>(`/purchase-orders/${id}/${a}`, undefined, { operationKey }); await mutate(r, { revalidate: false }); return r; }, done);
  const startReceiving = () => setReceiving(Object.fromEntries(po.items.filter((i) => i.qty_received < i.qty_ordered)
    .map((i) => [i.id, { qty: String(i.qty_ordered - i.qty_received), batch: "", expiry: "" }])));
  const lines = receiving ? Object.entries(receiving).filter(([, v]) => Number(v.qty) > 0) : [];
  const canReceive = lines.length > 0 && lines.every(([, v]) => v.batch.trim().length >= 2 && /^\d{4}-\d{2}-\d{2}$/.test(v.expiry));
  const receive = () => run("receive", async ({ operationKey }) => {
    const r = await api.post<PODetail>(`/purchase-orders/${id}/receive`, { lines: lines.map(([k, v]) => ({ po_item_id: k, qty: Number(v.qty), batch_no: v.batch.trim(), expiry: v.expiry })) }, { operationKey });
    await mutate(r, { revalidate: false }); setReceiving(null); return r;
  }, t("Goods received on {value0}", { value0: po.po_no }), t("Batches are now sellable stock."));
  const who = (a: string) => meta?.users.find((u) => u.id === a)?.name ?? a;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="scroll-y min-h-0 flex-1">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-4 p-3 md:p-5">
          <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
            <SourceButton onClick={onBack} className="mt-1 rounded-md p-1 text-ink-3 hover:bg-surface-3 lg:hidden" aria-label="Back"><ArrowLeft className="size-4" /></SourceButton>
            <div className="min-w-0 flex-1">
              <h2 className="flex items-center gap-2 text-[20px] font-semibold tracking-tight"><span className="num">{po.po_no}</span><StatusPill status={po.status} /></h2>
              <p className="text-[13px] text-ink-2"><LocalizedText message="{value0}, lead time {value1}" values={{ value0: po.supplier_name, value1: plural(po.lead_time_days, "day") }} /></p>
            </div>
            <dl className="grid grid-cols-3 gap-x-6 text-[12.5px]">
              <div><dt className="text-ink-3"><LocalizedText message="Raised" /></dt><dd className="num">{dateShort(po.created_at)}</dd></div>
              <div><dt className="text-ink-3"><LocalizedText message="Expected" /></dt><dd className="num">{dateShort(po.expected_at)}</dd></div>
              <div><dt className="text-ink-3"><LocalizedText message="Value" /></dt><dd className="num font-semibold">{moneyC(po.total)}</dd></div>
            </dl>
          </div>

          <Panel>
            <PanelHeader title={receiving ? "Receive goods" : "Lines"} sub={receiving ? "Record the batch and expiry printed on each pack. Batches expiring within 60 days are refused." : undefined} />
            <div className="scroll-x">
              <Table className="w-full min-w-[720px] border-separate border-spacing-0">
                <TableHeader><TableRow><Th><LocalizedText message="Product" /></Th><Th align="right"><LocalizedText message="Ordered" /></Th><Th align="right"><LocalizedText message="Received" /></Th><Th align="right"><LocalizedText message="Unit cost" /></Th>
                  {receiving ? <><Th className="w-28"><LocalizedText message="Receive now" /></Th><Th className="w-36"><LocalizedText message="Batch" /></Th><Th className="w-40"><LocalizedText message="Expiry" /></Th></> : <Th align="right"><LocalizedText message="Line total" /></Th>}</TableRow></TableHeader>
                <TableBody>
                  {po.items.map((i) => {
                    const r = receiving?.[i.id];
                    const set = (patch: Partial<NonNullable<typeof r>>) => setReceiving((s) => s && r ? { ...s, [i.id]: { ...r, ...patch } } : s);
                    return (
                      <TableRow key={i.id}>
                        <Td><p className="font-medium">{i.name}</p><p className="num text-xs text-ink-3">{i.sku}</p></Td>
                        <Td align="right">{num(i.qty_ordered)}</Td>
                        <Td align="right" className={i.qty_received >= i.qty_ordered ? "text-ok" : i.qty_received ? "text-amber" : "text-ink-3"}>{num(i.qty_received)}</Td>
                        <Td align="right">{money(i.unit_cost)}</Td>
                        {receiving ? (r ? <>
                          <Td><Input type="number" min={0} max={i.qty_ordered - i.qty_received} value={r.qty} onChange={(e) => set({ qty: e.target.value })} className="num text-right" aria-label={t("Quantity for {value0}", { value0: i.name })} /></Td>
                          <Td><Input value={r.batch} onChange={(e) => set({ batch: e.target.value.toUpperCase() })} placeholder="Batch no" aria-label={t("Batch for {value0}", { value0: i.name })} /></Td>
                          <Td><DateInput value={r.expiry} onChange={(e) => set({ expiry: e.target.value })} aria-label={t("Expiry for {value0}", { value0: i.name })} /></Td>
                        </> : <Td colSpan={3} className="text-xs text-ok"><LocalizedText message="Fully received" /></Td>) : <Td align="right">{money(i.qty_ordered * i.unit_cost)}</Td>}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="History" />
            <ol className="flex flex-col gap-1.5 px-4 py-3">
              {po.history.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center gap-2 text-[12.5px]">
                  <StatusPill status={h.to_status} /><span className="text-ink-2">{who(h.actor)}</span>{h.note && <span className="text-ink-3">{h.note}</span>}
                  <span className="num ml-auto text-ink-3">{dateTime(h.at)}</span>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>

      <div className="shrink-0 border-t border-line bg-surface px-3 py-2.5 md:px-5">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-end gap-2">
          {receiving ? <>
            <p className="mr-auto text-[12.5px] text-ink-2"><LocalizedText message="{value0} to receive. Each needs a batch number and expiry." values={{ value0: plural(lines.length, "line") }} /></p>
            <Button variant="ghost" icon={<X className="size-4" />} onClick={() => setReceiving(null)}><LocalizedText message="Stop receiving" /></Button>
            <Button variant="primary" icon={<PackageCheck className="size-4" />} disabled={!canReceive} loading={busy === "receive"} onClick={receive}><LocalizedText message="Receive into stock" /></Button>
          </> : <>
            {["draft", "approved", "sent"].includes(po.status) && <Button variant="ghost" loading={busy === "cancel"} onClick={() => advance("cancel", t("{value0} cancelled", { value0: po.po_no }))}><LocalizedText message="Cancel order" /></Button>}
            {po.status === "draft" && <Button variant="primary" icon={<CircleCheck className="size-4" />} loading={busy === "approve"} onClick={() => advance("approve", t("{value0} approved", { value0: po.po_no }))}><LocalizedText message="Approve" /></Button>}
            {po.status === "approved" && <Button variant="primary" icon={<Send className="size-4" />} loading={busy === "send"} onClick={() => advance("send", t("{value0} sent to supplier", { value0: po.po_no }))}><LocalizedText message="Send to supplier" /></Button>}
            {["sent", "partially_received"].includes(po.status) && <Button variant="primary" icon={<PackageCheck className="size-4" />} onClick={startReceiving}><LocalizedText message="Receive goods" /></Button>}
            {["received", "cancelled"].includes(po.status) && <p className="text-[12.5px] text-ink-3"><LocalizedText message="This order is closed." /></p>}
          </>}
        </div>
      </div>
    </div>
  );
}

function Suggestions({ onCreated }: { onCreated: (id: string) => void }) {
  const api = useApiClient();
  const { int, money, moneyC, plural, t, num } = usePharmacyFormat();
  const { data, error, isLoading, mutate } = useApi<Suggestion[]>("/reorder-suggestions");
  const { run, busy } = useAction();
  const [qty, setQty] = useState<Record<string, number>>({});
  const [skip, setSkip] = useState<Record<string, boolean>>({});
  const groups = useMemo(() => {
    const m = new Map<string, { name: string; rows: Suggestion[] }>();
    for (const s of data ?? []) { const g = m.get(s.supplier_id) ?? { name: s.supplier_name, rows: [] }; g.rows.push(s); m.set(s.supplier_id, g); }
    return [...m.entries()];
  }, [data]);
  const q = (s: Suggestion) => qty[s.product_id] ?? s.suggested;

  const create = (supplierId: string, rows: Suggestion[]) => run(`po-${supplierId}`, async ({ operationKey }) => {
    const items = rows.filter((r) => !skip[r.product_id] && q(r) > 0).map((r) => ({ product_id: r.product_id, qty: q(r) }));
    const po = await api.post<PODetail>("/purchase-orders", { supplier_id: supplierId, items }, { operationKey });
    await mutate();
    return po;
  }, (po) => t("{value0} drafted for {value1}", { value0: po.po_no, value1: po.supplier_name })).then((po) => { if (po) onCreated(po.id); });

  if (error) return <ErrorNote error={error} onRetry={() => mutate()} />;
  if (isLoading && !data) return <ListSkeleton />;
  if (!groups.length) return <EmptyState icon={<CircleCheck className="size-5" />} title="Stock is above reorder levels" body="Products appear here when sellable stock plus open orders falls to the reorder level." className="h-full" />;

  return (
    <div className="scroll-y h-full">
      <div className="mx-auto grid max-w-[1300px] gap-4 p-3 md:p-5 xl:grid-cols-2">
        {groups.map(([sid, g]) => {
          const value = g.rows.filter((r) => !skip[r.product_id]).reduce((s, r) => s + q(r) * r.cost_per_unit, 0);
          return (
            <Panel key={sid}>
              <PanelHeader title={g.name} sub={t("{value0} at or below reorder level", { value0: plural(g.rows.length, "product") })}
                actions={<Button variant="primary" size="sm" loading={busy === `po-${sid}`} disabled={value <= 0} onClick={() => create(sid, g.rows)}><LocalizedText message="Draft order, {value0}" values={{ value0: moneyC(value) }} /></Button>} />
              <Table className="w-full border-separate border-spacing-0">
                <TableHeader><TableRow><Th className="w-8" /><Th><LocalizedText message="Product" /></Th><Th align="right"><LocalizedText message="Sellable" /></Th><Th align="right"><LocalizedText message="On order" /></Th><Th align="right"><LocalizedText message="Reorder / max" /></Th><Th className="w-28" align="right"><LocalizedText message="Order qty" /></Th></TableRow></TableHeader>
                <TableBody>
                  {g.rows.map((r) => (
                    <TableRow key={r.product_id} className={clsx(skip[r.product_id] && "opacity-50")}>
                      <Td><SourceInput type="checkbox" checked={!skip[r.product_id]} onChange={(e) => setSkip({ ...skip, [r.product_id]: !e.target.checked })} aria-label={t("Include {value0}", { value0: r.name })} className="size-4 accent-[var(--cobalt)]" /></Td>
                      <Td><p className="font-medium">{r.name}</p><p className="num text-xs text-ink-3"><LocalizedText message="{value0}, {value1} each" values={{ value0: r.sku, value1: money(r.cost_per_unit) }} /></p></Td>
                      <Td align="right" className={r.available === 0 ? "font-semibold text-danger" : "text-amber"}>{num(r.available)}</Td>
                      <Td align="right" className="text-ink-2">{r.on_order ? int(r.on_order) : "—"}</Td>
                      <Td align="right" className="text-ink-3">{r.reorder_level} / {r.max_level}</Td>
                      <Td><Input type="number" min={0} value={q(r)} onChange={(e) => setQty({ ...qty, [r.product_id]: Math.max(0, Number(e.target.value)) })} className="num text-right" aria-label={t("Order quantity for {value0}", { value0: r.name })} /></Td>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {g.rows.some((r) => r.available === 0) && <p className="px-4 py-2 text-xs text-ink-3"><Tag tone="danger"><LocalizedText message="Out of stock" /></Tag> <LocalizedText message="Items with this tag may be holding prescriptions in the Fill queue." /></p>}
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
