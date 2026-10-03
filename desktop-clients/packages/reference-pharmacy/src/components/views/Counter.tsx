"use client";
import { Banknote, CreditCard, Minus, Plus, ReceiptText, ScanBarcode, ShoppingBasket, Trash2, Wallet } from "lucide-react";
import { ReferenceLink as Link } from "@pepbits/reference-host";
import { LocalizedText } from "@pepbits/ops-ui";
import { useEffect, useRef, useState } from "react";
import { Button, EmptyState, Kbd, Panel, PanelHeader, Segmented, StatusPill, Tag } from "../ui/primitives";
import { SourceButton, SourceInput } from "../ui/controls";
import { useToast } from "../ui/toast";
import { ApiError, useApi, useApiClient, useRefreshAll } from "../../lib/api";
import { usePharmacyFormat } from "../../lib/format";
import { useHotkeys } from "../../lib/hooks";
import { cx } from "../../lib/cx";

interface Product { id: string; name: string; generic: string; strength: string; form: string; schedule: string; price_per_unit: number; dispense_unit: string; barcode: string; sku: string; tax_rate: number; available: number }
interface Sale { id: string; bill_no: string; net: number; created_at: string; lines: number; method: string; status: string }
type Method = "card" | "cash" | "wallet";

export function CounterView() {
  const toast = useToast();
  const api = useApiClient();
  const refreshAll = useRefreshAll();
  const { t, ago, money, moneyC, plural, num } = usePharmacyFormat();
  const [q, setQ] = useState("");
  const [found, setResults] = useState<Product[]>([]);
  const results = q.trim() ? found : [];
  const [cursor, setCursor] = useState(0);
  const [basket, setBasket] = useState<{ p: Product; qty: number }[]>([]);
  const [method, setMethod] = useState<Method>("card");
  const [tendered, setTendered] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastSale, setLastSale] = useState<{ id: string; bill_no: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const catalog = useApi<{ rows: (Product & { used_30d: number })[] }>("/products");
  const recent = useApi<Sale[]>("/sales/recent");

  const methodLabel = (m: string) => (m === "card" ? t("Card") : m === "cash" ? t("Cash") : m === "wallet" ? t("Wallet") : m);

  useEffect(() => {
    const term = q.trim();
    if (!term) return;
    const controller = new AbortController();
    const timer = setTimeout(() => api.get<Product[]>(`/products/lookup?q=${encodeURIComponent(term)}`, { signal: controller.signal }).then((r) => { if (!controller.signal.aborted) { setResults(r); setCursor(0); } }).catch(() => {}), 100);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [api, q]);

  const add = (p: Product, n = 1) => {
    if (p.schedule !== "otc") { toast({ tone: "info", title: t("{value0} needs a prescription", { value0: p.name }), body: "Dispense it from the Rx workbench." }); return; }
    setBasket((b) => {
      const cur = b.find((x) => x.p.id === p.id);
      const qty = Math.min((cur?.qty ?? 0) + n, p.available);
      if (qty <= 0) return b.filter((x) => x.p.id !== p.id);
      return cur ? b.map((x) => (x.p.id === p.id ? { ...x, qty } : x)) : [...b, { p, qty }];
    });
    setQ(""); input.current?.focus();
  };

  const subtotal = basket.reduce((s, l) => s + l.p.price_per_unit * l.qty, 0);
  const vat = basket.reduce((s, l) => s + l.p.price_per_unit * l.qty * l.p.tax_rate, 0);
  const total = Math.round((subtotal + vat) * 100) / 100;
  const change = method === "cash" && Number(tendered) > total ? Number(tendered) - total : 0;

  const pay = async () => {
    if (!basket.length || busy) return;
    if (method === "cash" && tendered && Number(tendered) < total) { toast({ tone: "error", title: "Cash tendered is less than the total." }); return; }
    setBusy(true);
    try {
      const bill = await api.post<{ id: string; bill_no: string; net: number }>("/sales", { items: basket.map((l) => ({ product_id: l.p.id, qty: l.qty })), payment_method: method });
      toast({
        tone: "ok", title: t("Sale {value0} paid", { value0: bill.bill_no }),
        body: change
          ? t("{value0} by {value1}. Change due {value2}", { value0: moneyC(bill.net), value1: methodLabel(method), value2: moneyC(change) })
          : t("{value0} by {value1}", { value0: moneyC(bill.net), value1: methodLabel(method) }),
      });
      setBasket([]); setTendered(""); setLastSale({ id: bill.id, bill_no: bill.bill_no });
      void refreshAll();
      input.current?.focus();
    } catch (e) { toast({ tone: "error", title: e instanceof ApiError ? e.message : "Payment failed." }); } finally { setBusy(false); }
  };
  useHotkeys({ "mod+enter": pay, "f2": () => input.current?.focus() }, [basket, method, tendered, busy], { allowInInputs: true });

  const quickPicks = (catalog.data?.rows ?? []).filter((p) => p.schedule === "otc").sort((a, b) => b.used_30d - a.used_30d).slice(0, 12);
  const units = basket.reduce((s, l) => s + l.qty, 0);

  return (
    <div className="grid h-full min-h-0 gap-4 p-4 md:p-5 lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="flex min-h-0 flex-col gap-4">
        <Panel className="shrink-0 p-4">
          <div className="relative">
            <ScanBarcode className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-ink-3" />
            <SourceInput ref={input} autoFocus value={q} onChange={(e) => setQ(e.target.value)} aria-label="Scan barcode or search product"
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); }
                if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
                if (e.key === "Enter" && results[cursor]) { e.preventDefault(); add(results[cursor]); }
              }}
              placeholder="Scan a barcode or type a product name"
              className="h-12 w-full rounded-lg border border-line-strong bg-surface pl-11 pr-24 text-[15px] placeholder:text-ink-3 focus:border-cobalt focus:outline-none focus:ring-4 focus:ring-cobalt/15" />
            <span className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1 text-xs text-ink-3"><Kbd>{"F2"}</Kbd> <LocalizedText message="focus" /></span>
          </div>
          {q && (
            <ul className="mt-2 divide-y divide-line overflow-hidden rounded-lg border border-line" role="listbox">
              {results.length === 0 && <li className="px-3 py-3 text-[13px] text-ink-3"><LocalizedText message="No product matches “{value0}”." values={{ value0: q }} /></li>}
              {results.map((p, i) => (
                <li key={p.id} role="option" aria-selected={i === cursor}>
                  <SourceButton onMouseMove={() => setCursor(i)} onClick={() => add(p)} disabled={p.available <= 0}
                    className={cx("flex w-full items-center gap-3 px-3 py-2 text-left disabled:opacity-50", i === cursor && "bg-cobalt-wash")}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium">{p.name}</p>
                      <p className="truncate text-xs text-ink-3">{p.generic} {p.strength}, {p.form.toLowerCase()}</p>
                    </div>
                    {p.schedule !== "otc" && <Tag tone={p.schedule === "controlled" ? "violet" : "warn"}><LocalizedText message="Prescription only" /></Tag>}
                    <span className={cx("num w-20 text-right text-xs", p.available < 10 ? "text-amber" : "text-ink-3")}><LocalizedText message="{value0} in stock" values={{ value0: num(p.available) }} /></span>
                    <span className="num w-24 text-right text-[13.5px] font-semibold">{moneyC(p.price_per_unit)}</span>
                  </SourceButton>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel className="min-h-0 flex-1">
          <PanelHeader title="Quick picks" sub="Most-sold counter items. Click to add one unit." />
          <div className="scroll-y grid flex-1 auto-rows-min grid-cols-2 gap-2 p-3 sm:grid-cols-3 xl:grid-cols-4">
            {quickPicks.map((p) => (
              <SourceButton key={p.id} onClick={() => add(p)} disabled={p.available <= 0}
                className="flex flex-col items-start rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-left transition-colors hover:border-cobalt hover:bg-cobalt-wash disabled:opacity-50">
                <span className="w-full truncate text-[13px] font-medium">{p.name}</span>
                <span className="w-full truncate text-xs text-ink-3">{p.generic}</span>
                <span className="mt-1.5 flex w-full items-baseline justify-between">
                  <span className="num text-[13.5px] font-semibold">{money(p.price_per_unit)}</span>
                  <span className="num text-[11px] text-ink-3"><LocalizedText message="{value0} left" values={{ value0: num(p.available) }} /></span>
                </span>
              </SourceButton>
            ))}
          </div>
          <div className="shrink-0 border-t border-line">
            <p className="px-4 pb-1 pt-2.5 text-xs font-medium text-ink-2"><LocalizedText message="Recent sales" /></p>
            <ul className="scroll-y max-h-36 px-4 pb-2">
              {recent.data?.map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-1 text-[12.5px]">
                  <ReceiptText className="size-3.5 text-ink-3" />
                  <Link href={`/sales?id=${s.id}`} className="num font-medium text-cobalt hover:underline">{s.bill_no}</Link>
                  <span className="text-ink-3">{plural(s.lines, "item")}, {methodLabel(s.method)}</span>
                  <StatusPill status={s.status} />
                  <span className="num ml-auto">{moneyC(s.net)}</span>
                  <span className="w-16 text-right text-ink-3">{ago(s.created_at)}</span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      </div>

      <Panel className="min-h-0">
        <PanelHeader title="Basket" sub={basket.length ? t("{value0} units", { value0: num(units) }) : "Empty"} actions={basket.length > 0 && <Button size="sm" variant="ghost" onClick={() => setBasket([])}><LocalizedText message="Clear" /></Button>} />
        <div className="scroll-y min-h-0 flex-1">
          {basket.length === 0 && <EmptyState icon={<ShoppingBasket className="size-5" />} title="Scan or search to start a sale" body="Prescription-only medicines are blocked here and must go through the workbench." />}
          <ul className="divide-y divide-line">
            {basket.map((l) => (
              <li key={l.p.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium">{l.p.name}</p>
                  <p className="num text-xs text-ink-3">
                    {l.p.tax_rate
                      ? <LocalizedText message="{value0} each, VAT {value1}%" values={{ value0: money(l.p.price_per_unit), value1: num(l.p.tax_rate * 100) }} />
                      : <LocalizedText message="{value0} each" values={{ value0: money(l.p.price_per_unit) }} />}
                  </p>
                </div>
                <div className="flex items-center rounded-md border border-line-strong">
                  <SourceButton aria-label="One fewer" onClick={() => add(l.p, -1)} className="px-1.5 py-1 text-ink-2 hover:text-ink"><Minus className="size-3.5" /></SourceButton>
                  <span className="num w-7 text-center text-[13px] font-medium">{l.qty}</span>
                  <SourceButton aria-label="One more" onClick={() => add(l.p, 1)} disabled={l.qty >= l.p.available} className="px-1.5 py-1 text-ink-2 hover:text-ink disabled:opacity-40"><Plus className="size-3.5" /></SourceButton>
                </div>
                <span className="num w-20 text-right text-[13.5px] font-semibold">{money(l.p.price_per_unit * l.qty)}</span>
                <SourceButton aria-label={t("Remove {value0}", { value0: l.p.name })} onClick={() => setBasket((b) => b.filter((x) => x.p.id !== l.p.id))} className="text-ink-3 hover:text-danger"><Trash2 className="size-4" /></SourceButton>
              </li>
            ))}
          </ul>
        </div>
        <div className="shrink-0 space-y-3 border-t border-line bg-surface-2 p-4">
          {lastSale && !basket.length && (
            <p className="flex items-center gap-2 rounded-md bg-ok-wash px-2.5 py-1.5 text-[12.5px] text-ok">
              <span className="flex-1"><LocalizedText message="Sale {value0} paid." values={{ value0: lastSale.bill_no }} /></span>
              <Link href={`/sales?id=${lastSale.id}`} className="font-medium underline underline-offset-2"><LocalizedText message="Receipt or return" /></Link>
            </p>
          )}
          <dl className="num space-y-1 text-[13px]">
            <div className="flex justify-between"><dt className="text-ink-2"><LocalizedText message="Subtotal" /></dt><dd>{money(subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-2"><LocalizedText message="VAT" /></dt><dd>{money(vat)}</dd></div>
            <div className="flex items-baseline justify-between pt-1 text-[20px] font-semibold"><dt><LocalizedText message="Total" /></dt><dd>{moneyC(total)}</dd></div>
          </dl>
          <Segmented<Method> className="grid w-full grid-cols-3" value={method} onChange={setMethod} items={[
            { value: "card", label: <span className="flex items-center gap-1.5"><CreditCard className="size-3.5" /><LocalizedText message="Card" /></span> },
            { value: "cash", label: <span className="flex items-center gap-1.5"><Banknote className="size-3.5" /><LocalizedText message="Cash" /></span> },
            { value: "wallet", label: <span className="flex items-center gap-1.5"><Wallet className="size-3.5" /><LocalizedText message="Wallet" /></span> },
          ]} />
          {method === "cash" && (
            <div className="flex items-center gap-3">
              <label className="flex-1"><span className="sr-only"><LocalizedText message="Cash tendered" /></span>
                <SourceInput inputMode="decimal" value={tendered} onChange={(e) => setTendered(e.target.value.replace(/[^\d.]/g, ""))} placeholder="Cash tendered"
                  className="num h-9 w-full rounded-md border border-line-strong bg-surface px-2.5 text-[14px] focus:border-cobalt focus:outline-none focus:ring-2 focus:ring-cobalt/20" />
              </label>
              <span className="num text-[13px] text-ink-2"><LocalizedText message="Change" /> <span className="font-semibold text-ink">{money(change)}</span></span>
            </div>
          )}
          <Button variant="primary" size="lg" className="h-11 w-full text-[15px]" disabled={!basket.length} loading={busy} onClick={pay} kbd="⌘↵">
            {basket.length ? <LocalizedText message="Take payment {value0}" values={{ value0: moneyC(total) }} /> : <LocalizedText message="Take payment" />}
          </Button>
        </div>
      </Panel>
    </div>
  );
}
