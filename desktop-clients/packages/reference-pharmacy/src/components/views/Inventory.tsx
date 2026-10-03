"use client";
import clsx from "clsx";
import { ArrowLeft, Boxes, Lock, PackageX, Search, Snowflake, Route } from "lucide-react";
import { ReferenceLink as Link } from "@pepbits/reference-host";
import { LocalizedText } from "@pepbits/ops-ui";
import { useEffect, useState } from "react";
import { Sparkline } from "../ui/charts";
import { SourceButton, Table, TableBody, TableHeader, TableRow } from "../ui/controls";
import { Dialog } from "../ui/dialog";
import { Button, EmptyState, ErrorNote, Field, Input, ListSkeleton, Panel, PanelHeader, Segmented, Select, Skeleton, Stat, StatusPill, Tag, Td, Textarea, Th } from "../ui/primitives";
import { useUserName } from "../shell/ShellContext";
import { useApi, useApiClient } from "../../lib/api";
import { daysUntil, usePharmacyFormat } from "../../lib/format";
import { useHotkeys } from "../../lib/hooks";
import { useRouter, useSearchParams } from "../../lib/navigation";
import { useAction } from "../../lib/useAction";

interface Product {
  id: string; sku: string; name: string; generic: string; strength: string; form: string; category: string; schedule: string; cold_chain: number; requires_auth: number;
  reorder_level: number; max_level: number; price_per_unit: number; cost_per_unit: number; location: string; supplier_name: string | null; dispense_unit: string;
  on_hand: number; reserved: number; unsellable: number; near_expiry: number; next_expiry: string | null; used_30d: number; available: number; days_cover: number | null;
}
interface Batch { id: string; batch_no: string; expiry: string; qty_on_hand: number; qty_reserved: number; unit_cost: number; status: string; location: string; received_at: string; supplier_name: string | null; name?: string; sku?: string; value?: number; product_id: string }
interface Movement { id: number; type: string; qty: number; batch_no: string; ref_type: string | null; ref_id: string | null; note: string | null; actor: string; at: string; name?: string }
interface ProductDetail extends Product { batches: Batch[]; movements: Movement[]; daily: { day: string; qty: number }[]; contracts: { code: string; payer_name: string; unit_price: number }[] }

type Tab = "products" | "expiry" | "movements";
type Filter = "" | "low" | "expiring" | "cold" | "controlled";
type BatchFilter = "expiring" | "expired" | "quarantined" | "recalled";
type BatchAction = { batch: Batch; kind: "quarantined" | "available" | "recalled" | "expired" | "adjust" };

const MOVE_LABEL: Record<string, { label: string }> = {
  receipt: { label: "Received" }, reserve: { label: "Reserved" }, release: { label: "Released" }, issue: { label: "Issued" }, return: { label: "Returned" }, adjust: { label: "Adjusted" },
  quarantine: { label: "Quarantined" }, unquarantine: { label: "Released to stock" }, recall: { label: "Recalled" }, expire: { label: "Marked expired" },
};
const moveLabel = (t: (m: string) => string, type: string) => (MOVE_LABEL[type] ? t(MOVE_LABEL[type].label) : type);

export function InventoryView() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = (params.get("tab") as Tab) ?? "products";
  const setTab = (t: Tab) => router.replace(`/inventory?tab=${t}`, { scroll: false });
  const [action, setAction] = useState<BatchAction | null>(null);
  const [trace, setTrace] = useState<string | null>(null);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-line bg-surface px-3 py-2 md:px-5">
        <Segmented value={tab} onChange={setTab} items={[{ value: "products", label: "Stock by product" }, { value: "expiry", label: "Expiry and quarantine" }, { value: "movements", label: "Stock ledger" }]} />
      </div>
      <div className="min-h-0 flex-1">
        {tab === "products" && <Products onAction={setAction} onTrace={setTrace} />}
        {tab === "expiry" && <ExpiryBoard onAction={setAction} onTrace={setTrace} />}
        {tab === "movements" && <Ledger />}
      </div>
      {action && <BatchActionDialog action={action} onClose={() => setAction(null)} />}
      {trace && <TraceDrawer id={trace} onClose={() => setTrace(null)} />}
    </div>
  );
}

function Products({ onAction, onTrace }: { onAction: (a: BatchAction) => void; onTrace: (id: string) => void }) {
  const params = useSearchParams();
  const router = useRouter();
  const { t, num } = usePharmacyFormat();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [filter, setFilter] = useState<Filter>("");
  const [category, setCategory] = useState("");
  const [closed, setClosed] = useState(false);
  useEffect(() => { const timer = setTimeout(() => setDebounced(q.trim()), 160); return () => clearTimeout(timer); }, [q]);
  const { data, error, isLoading, mutate } = useApi<{ rows: Product[]; categories: { category: string; n: number }[] }>(
    `/products?filter=${filter}${category ? `&category=${encodeURIComponent(category)}` : ""}${debounced ? `&q=${encodeURIComponent(debounced)}` : ""}`,
  );
  const rows = data?.rows ?? [];
  const selected = closed ? null : params.get("product") ?? rows[0]?.id ?? null;
  const select = (id: string | null) => { setClosed(id === null); router.replace(id ? `/inventory?tab=products&product=${id}` : "/inventory?tab=products", { scroll: false }); };
  const move = (d: 1 | -1) => {
    const i = rows.findIndex((r) => r.id === selected);
    const n = rows[Math.min(Math.max(i + d, 0), rows.length - 1)];
    if (n) { select(n.id); document.querySelector(`[data-product="${n.id}"]`)?.scrollIntoView({ block: "nearest" }); }
  };
  useHotkeys({ j: () => move(1), k: () => move(-1), arrowdown: () => move(1), arrowup: () => move(-1) }, [rows, selected]);

  return (
    <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[400px_minmax(0,1fr)]">
      <aside className={clsx("flex min-h-0 flex-col border-r border-line bg-surface", selected && "hidden lg:flex")}>
        <div className="flex shrink-0 flex-col gap-2 border-b border-line p-2.5">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, generic, SKU or barcode" className="pl-8" aria-label="Search products" />
            </div>
            <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-36" aria-label="Category">
              <option value="">{t("All categories")}</option>
              {data?.categories.map((c) => <option key={c.category} value={c.category}>{c.category}</option>)}
            </Select>
          </div>
          <Segmented size="sm" value={filter} onChange={setFilter} items={[
            { value: "", label: "All" }, { value: "low", label: "Low", tone: "warn" }, { value: "expiring", label: "Expiring" },
            { value: "cold", label: <Snowflake className="size-3.5" aria-label={t("Cold chain")} /> }, { value: "controlled", label: <Lock className="size-3.5" aria-label={t("Controlled")} /> },
          ]} />
        </div>
        {error ? <ErrorNote error={error} onRetry={() => mutate()} /> : isLoading && !data ? <ListSkeleton /> : !rows.length ? (
          <EmptyState icon={<Boxes className="size-5" />} title="No products match" body="Clear the filter or search for another name." />
        ) : (
          <ul className="scroll-y min-h-0 flex-1" role="listbox" aria-label={t("Products")}>
            {rows.map((p) => {
              const low = p.available <= p.reorder_level;
              const pct = Math.min(100, (p.available / Math.max(1, p.max_level)) * 100);
              return (
                <li key={p.id} data-product={p.id} role="option" aria-selected={p.id === selected}>
                  <SourceButton onClick={() => select(p.id)} className={clsx("flex w-full flex-col gap-1 border-b border-line px-4 py-2.5 text-left", p.id === selected ? "bg-cobalt-wash" : "hover:bg-surface-2")}>
                    <span className="flex items-center gap-1.5">
                      <span className={clsx("truncate text-[13.5px] font-semibold", p.id === selected && "text-cobalt-strong")}>{p.name}</span>
                      {p.cold_chain ? <Snowflake className="size-3.5 shrink-0 text-cobalt" /> : null}
                      {p.schedule === "controlled" && <Lock className="size-3.5 shrink-0 text-violet" />}
                      <span className={clsx("num ml-auto shrink-0 text-[13px] font-semibold", low ? "text-amber" : "text-ink")}>{num(p.available)}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="h-1 flex-1 overflow-hidden rounded-full bg-surface-3" aria-hidden>
                        <span className={clsx("block h-full rounded-full", low ? "bg-amber-mark" : "bg-cobalt")} style={{ width: `${pct}%` }} />
                      </span>
                      <span className="num w-28 shrink-0 text-right text-[11.5px] text-ink-3">{p.days_cover == null ? <LocalizedText message="No recent use" /> : <LocalizedText message="{value0} days cover" values={{ value0: p.days_cover }} />}</span>
                    </span>
                    <span className="flex items-center gap-2 text-[11.5px] text-ink-3">
                      <span className="truncate">{p.generic} {p.strength}</span>
                      {p.near_expiry > 0 && <span className="ml-auto shrink-0 text-amber"><LocalizedText message="{value0} near expiry" values={{ value0: p.near_expiry }} /></span>}
                    </span>
                  </SourceButton>
                </li>
              );
            })}
          </ul>
        )}
      </aside>
      <section className={clsx("min-h-0 min-w-0", !selected && "hidden lg:block")}>
        {selected ? <ProductPane id={selected} onBack={() => select(null)} onAction={onAction} onTrace={onTrace} /> : <EmptyState title="Select a product" className="h-full" />}
      </section>
    </div>
  );
}

function ProductPane({ id, onBack, onAction, onTrace }: { id: string; onBack: () => void; onAction: (a: BatchAction) => void; onTrace: (id: string) => void }) {
  const { data: p, error, mutate } = useApi<ProductDetail>(`/products/${id}`);
  const { int, money, dateShort, t, num } = usePharmacyFormat();
  const [now] = useState(() => Date.now());
  if (error) return <ErrorNote error={error} onRetry={() => mutate()} />;
  if (!p || p.id !== id) return <div className="flex flex-col gap-4 p-5"><Skeleton className="h-16 w-1/2" /><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;
  const low = p.available <= p.reorder_level;
  const series = Array.from({ length: 28 }, (_, i) => {
    const d = new Date(now - (27 - i) * 86400000).toISOString().slice(0, 10);
    return p.daily.find((x) => x.day === d)?.qty ?? 0;
  });

  return (
    <div className="scroll-y h-full">
      <div className="mx-auto flex max-w-[1300px] flex-col gap-4 p-3 md:p-5">
        <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
          <SourceButton onClick={onBack} className="mt-1 rounded-md p-1 text-ink-3 hover:bg-surface-3 lg:hidden" aria-label="Back to list"><ArrowLeft className="size-4" /></SourceButton>
          <div className="min-w-0 flex-1">
            <h2 className="text-[20px] font-semibold tracking-tight">{p.name}</h2>
            <p className="text-[13px] text-ink-2">{p.generic} {p.strength}, {p.form.toLowerCase()}, {p.category}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Tag tone={p.schedule === "otc" ? "muted" : p.schedule === "controlled" ? "violet" : "info"}>{p.schedule === "otc" ? <LocalizedText message="Over the counter" /> : p.schedule === "controlled" ? <LocalizedText message="Controlled" /> : <LocalizedText message="Prescription only" />}</Tag>
              {p.cold_chain ? <Tag tone="info"><Snowflake className="size-3" /><LocalizedText message="Store at 2–8 °C" /></Tag> : null}
              {p.requires_auth ? <Tag tone="warn"><LocalizedText message="Needs prior authorization" /></Tag> : null}
              <Tag tone="muted"><span className="num">{p.sku}</span></Tag>
              <Tag tone="muted"><LocalizedText message="Shelf {value0}" values={{ value0: p.location }} /></Tag>
            </div>
          </div>
          {low && <Link href="/purchasing?tab=suggestions" className="rounded-md border border-amber-mark/50 bg-amber-wash px-3 py-1.5 text-[13px] font-medium text-amber hover:border-amber-mark"><LocalizedText message="Below reorder level. Order from {value0}" values={{ value0: p.supplier_name ?? "" }} /></Link>}
        </div>

        <div className="grid grid-cols-2 gap-4 rounded-xl border border-line bg-surface p-4 sm:grid-cols-3 xl:grid-cols-6">
          <Stat label="Sellable" value={num(p.available)} sub={t("{value0}s", { value0: p.dispense_unit })} tone={low ? "warn" : undefined} />
          <Stat label="Reserved for supplies" value={int(p.reserved)} />
          <Stat label="Unsellable" value={int(p.unsellable)} sub="Quarantined, recalled or expired" tone={p.unsellable ? "danger" : undefined} />
          <Stat label="Reorder at / max" value={`${int(p.reorder_level)} / ${int(p.max_level)}`} />
          <Stat label="Price / cost" value={money(p.price_per_unit)} sub={t("cost {value0}", { value0: money(p.cost_per_unit) })} />
          <div className="min-w-0">
            <p className="text-xs text-ink-3"><LocalizedText message="Issued, last 28 days" /></p>
            <p className="num text-lg font-semibold leading-tight">{int(p.used_30d)}</p>
            <Sparkline values={series} height={22} className="mt-1 w-full" />
          </div>
        </div>

        <Panel>
          <PanelHeader title="Batches" sub="Issued first-expiry-first-out. Quarantined, recalled and expired batches are never sold." />
          <div className="scroll-x">
            <Table className="w-full min-w-[760px] border-separate border-spacing-0">
              <TableHeader><TableRow><Th><LocalizedText message="Batch" /></Th><Th><LocalizedText message="Expiry" /></Th><Th><LocalizedText message="Status" /></Th><Th align="right"><LocalizedText message="On hand" /></Th><Th align="right"><LocalizedText message="Reserved" /></Th><Th><LocalizedText message="Supplier" /></Th><Th><LocalizedText message="Location" /></Th><Th align="right"><LocalizedText message="Actions" /></Th></TableRow></TableHeader>
              <TableBody>
                {p.batches.map((b) => {
                  const dl = daysUntil(b.expiry);
                  return (
                    <TableRow key={b.id} className={clsx(b.status !== "available" && "bg-surface-2")}>
                      <Td className="num font-medium">{b.batch_no}</Td>
                      <Td className={clsx("num", dl <= 0 ? "text-danger" : dl <= 90 ? "text-amber" : "")}>{dateShort(b.expiry)} <span className="text-xs text-ink-3">{dl <= 0 ? <LocalizedText message="expired" /> : <LocalizedText message="{value0}d" values={{ value0: int(dl) }} />}</span></Td>
                      <Td><StatusPill status={b.status} /></Td>
                      <Td align="right">{num(b.qty_on_hand)}</Td>
                      <Td align="right" className="text-ink-2">{b.qty_reserved || "—"}</Td>
                      <Td className="truncate text-ink-2">{b.supplier_name ?? "—"}</Td>
                      <Td className="text-ink-2">{b.location}</Td>
                      <Td align="right">
                        <span className="inline-flex gap-1">
                          <Button size="sm" variant="ghost" icon={<Route className="size-3.5" />} onClick={() => onTrace(b.id)}><LocalizedText message="Trace" /></Button>
                          {b.status === "available" && <Button size="sm" variant="ghost" onClick={() => onAction({ batch: b, kind: "quarantined" })}><LocalizedText message="Quarantine" /></Button>}
                          {b.status === "quarantined" && dl > 0 && <Button size="sm" variant="ghost" onClick={() => onAction({ batch: b, kind: "available" })}><LocalizedText message="Release" /></Button>}
                          {b.status !== "recalled" && <Button size="sm" variant="ghost" onClick={() => onAction({ batch: b, kind: "recalled" })}><LocalizedText message="Recall" /></Button>}
                          {b.status === "available" && <Button size="sm" variant="ghost" onClick={() => onAction({ batch: b, kind: "adjust" })}><LocalizedText message="Count" /></Button>}
                        </span>
                      </Td>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Panel>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Panel>
            <PanelHeader title="Stock ledger" sub="Every change is a movement; balances are never edited silently." />
            <MovementTable rows={p.movements} max="max-h-80" />
          </Panel>
          <Panel>
            <PanelHeader title="Payer contract prices" sub="Expected reimbursement per unit, used to spot underpayments." />
            {p.contracts.length === 0 ? <EmptyState title="Not reimbursed" body="Over-the-counter items are paid by the patient." className="py-6" /> : (
              <ul className="divide-y divide-line">
                {p.contracts.map((c) => (
                  <li key={c.code} className="flex items-center gap-3 px-4 py-2 text-[13px]">
                    <span className="w-12 font-medium">{c.code}</span><span className="flex-1 truncate text-ink-2">{c.payer_name}</span>
                    <span className={clsx("num", c.unit_price < p.price_per_unit ? "text-amber" : "")}>{money(c.unit_price)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function MovementTable({ rows, max, showProduct }: { rows: Movement[]; max?: string; showProduct?: boolean }) {
  const who = useUserName();
  const { dateTime, t, num } = usePharmacyFormat();
  if (!rows.length) return <EmptyState title="No movements" className="py-6" />;
  return (
    <div className={clsx("scroll-y", max)}>
      <Table className="w-full min-w-[620px] border-separate border-spacing-0">
        <TableHeader><TableRow><Th><LocalizedText message="When" /></Th>{showProduct && <Th><LocalizedText message="Product" /></Th>}<Th><LocalizedText message="Movement" /></Th><Th><LocalizedText message="Batch" /></Th><Th align="right"><LocalizedText message="Qty" /></Th><Th><LocalizedText message="Reference" /></Th><Th><LocalizedText message="By" /></Th></TableRow></TableHeader>
        <TableBody>
          {rows.map((m) => (
            <TableRow key={m.id}>
              <Td className="num whitespace-nowrap text-ink-2">{dateTime(m.at)}</Td>
              {showProduct && <Td className="max-w-48 truncate">{m.name}</Td>}
              <Td>{moveLabel(t, m.type)}</Td>
              <Td className="num text-ink-2">{m.batch_no}</Td>
              <Td align="right" className={clsx(m.qty > 0 ? "text-ok" : m.qty < 0 ? "text-ink" : "text-ink-3")}>{m.qty > 0 ? `+${num(m.qty)}` : m.qty ? num(m.qty) : "—"}</Td>
              <Td className="max-w-56 truncate text-xs text-ink-3">{m.note ?? (m.ref_type ? m.ref_type.replace(/_/g, " ") : "")}</Td>
              <Td className="whitespace-nowrap text-xs text-ink-3">{who(m.actor)}</Td>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ExpiryBoard({ onAction, onTrace }: { onAction: (a: BatchAction) => void; onTrace: (id: string) => void }) {
  const [filter, setFilter] = useState<BatchFilter>("expiring");
  const { int, money, moneyC, dateShort, plural, num } = usePharmacyFormat();
  const { data, error, isLoading, mutate } = useApi<Batch[]>(`/batches?filter=${filter}`);
  const total = (data ?? []).reduce((s, b) => s + (b.value ?? 0), 0);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-3 px-3 py-2.5 md:px-5">
        <Segmented size="sm" value={filter} onChange={setFilter} items={[
          { value: "expiring", label: "Expiring within 90 days" }, { value: "expired", label: "Expired, awaiting disposal" },
          { value: "quarantined", label: "Quarantined" }, { value: "recalled", label: "Recalled" },
        ]} />
        <span className="num ml-auto text-[13px] text-ink-2"><LocalizedText message="{value0}, {value1} at cost" values={{ value0: plural(data?.length ?? 0, "batch"), value1: moneyC(total) }} /></span>
      </div>
      {error ? <ErrorNote error={error} onRetry={() => mutate()} /> : isLoading && !data ? <ListSkeleton /> : !data?.length ? (
        <EmptyState icon={<PackageX className="size-5" />} title="Nothing here" body="No batches in this state right now." />
      ) : (
        <div className="scroll-y min-h-0 flex-1 border-t border-line bg-surface">
          <Table className="w-full min-w-[860px] border-separate border-spacing-0">
            <TableHeader><TableRow><Th><LocalizedText message="Product" /></Th><Th><LocalizedText message="Batch" /></Th><Th><LocalizedText message="Expiry" /></Th><Th><LocalizedText message="Status" /></Th><Th align="right"><LocalizedText message="On hand" /></Th><Th align="right"><LocalizedText message="Value" /></Th><Th><LocalizedText message="Supplier" /></Th><Th><LocalizedText message="Location" /></Th><Th align="right"><LocalizedText message="Actions" /></Th></TableRow></TableHeader>
            <TableBody>
              {data.map((b) => {
                const dl = daysUntil(b.expiry);
                return (
                  <TableRow key={b.id} className="hover:bg-surface-2">
                    <Td className="max-w-64 truncate font-medium"><Link href={`/inventory?tab=products&product=${b.product_id}`} className="hover:text-cobalt">{b.name}</Link></Td>
                    <Td className="num">{b.batch_no}</Td>
                    <Td className={clsx("num", dl <= 0 ? "text-danger" : dl <= 30 ? "text-danger" : "text-amber")}>{dateShort(b.expiry)} <span className="text-xs text-ink-3">{dl <= 0 ? <LocalizedText message="{value0}d ago" values={{ value0: int(-dl) }} /> : <LocalizedText message="in {value0}d" values={{ value0: int(dl) }} />}</span></Td>
                    <Td><StatusPill status={dl <= 0 && b.status === "available" ? "expired" : b.status} /></Td>
                    <Td align="right">{num(b.qty_on_hand)}</Td>
                    <Td align="right">{money(b.value ?? 0)}</Td>
                    <Td className="max-w-44 truncate text-ink-2">{b.supplier_name}</Td>
                    <Td className="text-ink-2">{b.location}</Td>
                    <Td align="right">
                      <span className="inline-flex gap-1">
                        <Button size="sm" variant="ghost" icon={<Route className="size-3.5" />} onClick={() => onTrace(b.id)}><LocalizedText message="Trace" /></Button>
                        {filter === "expiring" && <Button size="sm" variant="ghost" onClick={() => onAction({ batch: b, kind: "quarantined" })}><LocalizedText message="Quarantine" /></Button>}
                        {filter === "expired" && b.status !== "expired" && <Button size="sm" variant="ghost" onClick={() => onAction({ batch: b, kind: "expired" })}><LocalizedText message="Mark expired" /></Button>}
                        {filter === "quarantined" && dl > 0 && <Button size="sm" variant="ghost" onClick={() => onAction({ batch: b, kind: "available" })}><LocalizedText message="Release" /></Button>}
                      </span>
                    </Td>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function Ledger() {
  const [type, setType] = useState("");
  const { data, error, isLoading, mutate } = useApi<Movement[]>(`/movements${type ? `?type=${type}` : ""}`);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-3 px-3 py-2.5 md:px-5">
        <Segmented size="sm" value={type} onChange={setType} items={[
          { value: "", label: "All" }, { value: "receipt", label: "Received" }, { value: "issue", label: "Issued" }, { value: "reserve", label: "Reserved" },
          { value: "return", label: "Returned" }, { value: "adjust", label: "Adjusted" }, { value: "quarantine", label: "Quarantined" },
        ]} />
        <span className="ml-auto text-[12.5px] text-ink-3"><LocalizedText message="Latest 200 movements" /></span>
      </div>
      {error ? <ErrorNote error={error} onRetry={() => mutate()} /> : isLoading && !data ? <ListSkeleton /> : (
        <div className="min-h-0 flex-1 border-t border-line bg-surface"><MovementTable rows={data ?? []} max="h-full" showProduct /></div>
      )}
    </div>
  );
}

const ACTION_COPY: Record<BatchAction["kind"], { title: string; label: string; sub: string; message: string; presets: string[]; danger?: boolean }> = {
  quarantined: { title: "Quarantine batch {value0}", label: "Quarantine", message: "{value0}: quarantine done", sub: "Stock leaves sellable inventory until released. Reserved units must be released first.", presets: ["Temperature excursion", "Damaged packaging", "Awaiting supplier confirmation"] },
  available: { title: "Release batch to stock {value0}", label: "Release to stock", message: "{value0}: release to stock done", sub: "The batch becomes sellable again.", presets: ["Temperature log reviewed, within limits", "Supplier confirmed batch is fit for use"] },
  recalled: { title: "Recall batch {value0}", label: "Recall batch", message: "{value0}: recall batch done", sub: "Blocks the batch permanently. Use Trace to see which patients received it.", presets: ["Manufacturer recall notice", "Regulator safety alert"], danger: true },
  expired: { title: "Mark batch expired {value0}", label: "Mark expired", message: "{value0}: mark expired done", sub: "Moves the batch to the disposal list.", presets: ["Past expiry date, awaiting disposal"] },
  adjust: { title: "Record a stock count {value0}", label: "Save count", message: "{value0}: save count done", sub: "Enter the counted quantity. The difference is posted to the ledger as an adjustment.", presets: ["Cycle count", "Breakage", "Found during shelf check"] },
};

function BatchActionDialog({ action, onClose }: { action: BatchAction; onClose: () => void }) {
  const api = useApiClient();
  const { t } = usePharmacyFormat();
  const { run, busy } = useAction();
  const [reason, setReason] = useState("");
  const [counted, setCounted] = useState(String(action.batch.qty_on_hand));
  const c = ACTION_COPY[action.kind];
  const delta = Number(counted) - action.batch.qty_on_hand;
  const valid = reason.trim().length >= 3 && (action.kind !== "adjust" || (counted !== "" && delta !== 0 && Number(counted) >= 0));
  const submit = () => run("save", ({ operationKey }) => action.kind === "adjust"
    ? api.post(`/batches/${action.batch.id}/adjust`, { delta, reason: reason.trim() }, { operationKey })
    : api.post(`/batches/${action.batch.id}/status`, { status: action.kind, reason: reason.trim() }, { operationKey }),
    t(c.message, { value0: action.batch.batch_no })).then((r) => { if (r) onClose(); });

  return (
    <Dialog open onClose={onClose} size="sm" title={t(c.title, { value0: action.batch.batch_no })} sub={c.sub}
      footer={<><Button variant="ghost" onClick={onClose}><LocalizedText message="Back" /></Button><Button variant={c.danger ? "danger" : "primary"} disabled={!valid} loading={busy === "save"} onClick={submit}>{t(c.label)}</Button></>}>
      {action.kind === "adjust" && (
        <div className="mb-3 grid grid-cols-2 gap-3">
          <Field label="System quantity"><Input value={action.batch.qty_on_hand} disabled className="num" /></Field>
          <Field label="Counted quantity" hint={delta ? t("{value0} adjustment", { value0: `${delta > 0 ? "+" : ""}${delta}` }) : t("No change yet")}>
            <Input type="number" min={0} autoFocus value={counted} onChange={(e) => setCounted(e.target.value)} className="num" />
          </Field>
        </div>
      )}
      <Field label="Reason"><Textarea autoFocus={action.kind !== "adjust"} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {c.presets.map((p) => <SourceButton key={p} onClick={() => setReason(t(p))} className="rounded-md border border-line px-2 py-1 text-xs text-ink-2 hover:border-cobalt hover:text-cobalt"><LocalizedText message={p} /></SourceButton>)}
      </div>
    </Dialog>
  );
}

interface Trace {
  batch: Batch & { name: string; supplier_name: string };
  movements: Movement[];
  patients: { disp_no: string; status: string; handed_over_at: string | null; qty: number; patient_id: string; name: string; mrn: string; phone: string; rx_no: string }[];
}

/** Supplier → receipt → every patient who received units from this batch. */
function TraceDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, error } = useApi<Trace>(`/batches/${id}/trace`);
  const { int, dateShort, dateTime, t, num } = usePharmacyFormat();
  const handed = data?.patients.filter((p) => p.status === "handed_over") ?? [];
  return (
    <Dialog open side onClose={onClose} title={data ? t("Trace batch {value0}", { value0: data.batch.batch_no }) : t("Trace batch")} sub={data ? t("{value0}, expires {value1}", { value0: data.batch.name, value1: dateShort(data.batch.expiry) }) : undefined}>
      {error ? <ErrorNote error={error} /> : !data ? <ListSkeleton rows={6} /> : (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-2"><StatusPill status={data.batch.status} /><span className="text-[13px] text-ink-2"><LocalizedText message="from {value0}, received {value1}" values={{ value0: data.batch.supplier_name, value1: dateShort(data.batch.received_at) }} /></span></div>
          <section>
            <h3 className="mb-2 text-[13.5px] font-semibold"><LocalizedText message="Patients who received it ({value0})" values={{ value0: int(handed.length) }} /></h3>
            {data.patients.length === 0 ? <p className="text-[13px] text-ink-3"><LocalizedText message="No units from this batch have been supplied to patients." /></p> : (
              <ul className="divide-y divide-line rounded-lg border border-line">
                {data.patients.map((p, i) => (
                  <li key={i} className="flex items-center gap-3 px-3 py-2 text-[13px]">
                    <div className="min-w-0 flex-1">
                      <Link href={`/patients?id=${p.patient_id}`} className="font-medium hover:text-cobalt">{p.name}</Link>
                      <p className="num text-xs text-ink-3">{p.mrn}, {p.phone}, {p.rx_no}</p>
                    </div>
                    <span className="num text-ink-2">×{num(p.qty)}</span>
                    <StatusPill status={p.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h3 className="mb-2 text-[13.5px] font-semibold"><LocalizedText message="Movements" /></h3>
            <ol className="relative ml-1.5 border-l border-line">
              {data.movements.map((m) => (
                <li key={m.id} className="relative pb-2.5 pl-4 text-[12.5px]">
                  <span className="absolute -left-[4.5px] top-1.5 size-2 rounded-full bg-line-strong" />
                  <span className="font-medium">{moveLabel(t, m.type)}</span> <span className="num">{m.qty > 0 ? `+${num(m.qty)}` : m.qty ? num(m.qty) : ""}</span>
                  <span className="num float-right text-ink-3">{dateTime(m.at)}</span>
                  {m.note && <p className="text-ink-3">{m.note}</p>}
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </Dialog>
  );
}
