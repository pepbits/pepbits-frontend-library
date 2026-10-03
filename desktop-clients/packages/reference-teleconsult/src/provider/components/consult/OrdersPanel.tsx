"use client";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { SourceButton, SourceInput } from "../../../shared/controls";
import { useMemo, useState } from "react";
import { Layers, Plus, Search, X } from "lucide-react";
import type { OrderKind } from "../../../shared/types";
import { useConsult } from "./context";
import { Badge, Button, Empty, Segmented, Select, cx } from "../ui";

type Cat = OrderKind | "sets";
const CATS: { value: Cat; label: string }[] = [
  { value: "sets", label: "Order sets" },
  { value: "lab", label: "Labs" },
  { value: "imaging", label: "Imaging" },
  { value: "procedure", label: "Diagnostics" },
  { value: "referral", label: "Referrals" },
  { value: "nursing", label: "Nursing" },
];
const NURSE_ALLOWED: OrderKind[] = ["nursing", "lab", "procedure"];

export function OrdersPanel() {
  const { t } = useLocalization();
  const { enc, update, catalog, actions, role, locked } = useConsult();
  const [cat, setCat] = useState<Cat>("sets");
  const [q, setQ] = useState("");
  const ordered = new Set(enc.orders.map((o) => o.code));
  const blocked = (k: OrderKind) => role === "nurse" && !NURSE_ALLOWED.includes(k);

  const grouped = useMemo(() => {
    if (cat === "sets") return {};
    const m: Record<string, typeof catalog.orderables> = {};
    catalog.orderables
      .filter((o) => o.kind === cat && (!q || `${o.name} ${o.code} ${o.group}`.toLowerCase().includes(q.toLowerCase())))
      .forEach((o) => (m[o.group] ??= []).push(o));
    return m;
  }, [cat, q, catalog]);

  return (
    <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
      <div className="min-w-0">
        <div className="mb-2 overflow-x-auto scroll-thin">
          <Segmented size="sm" value={cat} onChange={setCat} options={CATS.map((c) => ({ ...c, disabled: c.value !== "sets" && blocked(c.value as OrderKind) }))} />
        </div>
        {cat !== "sets" && (
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-ink-400" />
            <SourceInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter" className="h-9 w-full rounded-md border border-line pl-8 pr-2 text-sm focus:border-pulse-500 focus:outline-none" />
          </div>
        )}
        <div className="max-h-[440px] overflow-y-auto rounded-md border border-line scroll-thin">
          {cat === "sets" ? (
            <ul className="divide-y divide-line">
              {catalog.orderSets.map((s) => (
                <li key={s.id} className="flex items-start gap-3 px-3 py-2.5">
                  <Layers className="mt-0.5 h-4 w-4 shrink-0 text-pulse-600" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-ink">{s.name}</p>
                    <p className="text-2xs text-ink-400">{s.description} · {t("{value0} orders", { value0: s.orders.length })}{s.drugs.length ? `, ${t("{value0} Rx", { value0: s.drugs.length })}` : ""}{s.scores.length ? `, ${t("{value0} score", { value0: s.scores.length })}` : ""}</p>
                  </div>
                  <Button size="sm" disabled={locked} onClick={() => actions.applyOrderSet(s.id)}><LocalizedText message={"Apply"} /></Button>
                </li>
              ))}
            </ul>
          ) : (
            Object.entries(grouped).map(([group, items]) => (
              <div key={group}>
                <p className="sticky top-0 bg-canvas px-3 py-1 text-2xs font-semibold text-ink-600">{group}</p>
                <ul className="divide-y divide-line">
                  {items.map((o) => (
                    <li key={o.code}>
                      <SourceButton
                        disabled={ordered.has(o.code) || locked || blocked(o.kind)}
                        onClick={() => actions.addOrder(o.code)}
                        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-canvas disabled:opacity-50"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] text-ink">{o.name}</span>
                          <span className="block text-2xs text-ink-400">{o.code} · {o.detail}</span>
                        </span>
                        {ordered.has(o.code) ? <span className="text-2xs text-pulse-600"><LocalizedText message={"In basket"} /></span> : <Plus className="h-4 w-4 text-ink-400" />}
                      </SourceButton>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-ink-700">{t("Order basket · {value0}", { value0: enc.orders.length })}</p>
        {!enc.orders.length ? (
          <Empty title="Nothing ordered yet"><LocalizedText message={"Order sets add a whole workup in one tap."} /></Empty>
        ) : (
          <ul className="space-y-1.5">
            {enc.orders.map((o) => (
              <li key={o.id} className="rounded-md border border-line p-2">
                <div className="flex items-start gap-2">
                  <Badge className="mt-0.5 bg-ink/5 text-ink-600">{t(o.kind[0].toUpperCase() + o.kind.slice(1))}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-ink">{o.name}</p>
                    {o.orderedByRole === "nurse" && <p className="text-2xs text-caution-600"><LocalizedText message={"Nurse-initiated · co-signed when the doctor signs"} /></p>}
                  </div>
                  <Select
                    aria-label="Priority"
                    disabled={locked}
                    value={o.priority}
                    onChange={(e) => update((x) => ({ ...x, orders: x.orders.map((y) => (y.id === o.id ? { ...y, priority: e.target.value as typeof o.priority } : y)) }))}
                    className={cx("h-7 w-24 text-xs", o.priority !== "routine" && "border-alarm-500 text-alarm-600")}
                  >
                    <option value="routine">{t("Routine")}</option>
                    <option value="urgent">{t("Urgent")}</option>
                    <option value="stat">{t("Stat")}</option>
                  </Select>
                  <SourceButton disabled={locked} onClick={() => update((x) => ({ ...x, orders: x.orders.filter((y) => y.id !== o.id) }))} className="rounded p-1 text-ink-400 hover:text-alarm-500" aria-label={t("Remove {value0}", { value0: o.name })}>
                    <X className="h-4 w-4" />
                  </SourceButton>
                </div>
                <SourceInput
                  value={o.notes}
                  disabled={locked}
                  onChange={(e) => update((x) => ({ ...x, orders: x.orders.map((y) => (y.id === o.id ? { ...y, notes: e.target.value } : y)) }))}
                  placeholder="Clinical details for the lab or specialist"
                  className="mt-1.5 h-7 w-full rounded border border-transparent bg-canvas px-2 text-xs focus:border-pulse-500 focus:outline-none"
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
