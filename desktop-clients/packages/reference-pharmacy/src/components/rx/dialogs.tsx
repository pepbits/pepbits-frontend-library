"use client";
import clsx from "clsx";
import { Bike, Snowflake, Store } from "lucide-react";
import { useState } from "react";
import { LocalizedText } from "@pepbits/ops-ui";
import { Dialog } from "../ui/dialog";
import { SourceButton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/controls";
import { Button, Field, Input, Segmented, Tag, Textarea } from "../ui/primitives";
export { ReasonDialog } from "../ui/reason";
import { daysUntil, usePharmacyFormat } from "../../lib/format";
import type { RxDetail } from "./types";

/** Choose quantities per line. Defaults to everything remaining that is in stock; partial supply is normal. */
export function DispenseDialog({ rx, open, onClose, onConfirm }: {
  rx: RxDetail; open: boolean; onClose: () => void; onConfirm: (items: { prescription_item_id: string; qty: number }[], collection: "pickup" | "delivery") => Promise<void>;
}) {
  const { t, dateShort, moneyC, num } = usePharmacyFormat();
  const initial = () => Object.fromEntries(rx.items.map((i) => [i.id, Math.max(0, Math.min(i.qty_remaining, i.available))]));
  const [qty, setQty] = useState<Record<string, number>>(initial);
  const [collection, setCollection] = useState<"pickup" | "delivery">("pickup");
  const [busy, setBusy] = useState(false);
  const lines = rx.items.filter((i) => i.qty_remaining > 0);
  const total = lines.reduce((s, i) => s + (qty[i.id] ?? 0) * i.price_per_unit, 0);
  const partial = lines.some((i) => (qty[i.id] ?? 0) < i.qty_remaining);
  const any = lines.some((i) => (qty[i.id] ?? 0) > 0);
  const realtime = rx.coverages.find((c) => c.priority === 1)?.workflow === "pre_adjudication";

  return (
    <Dialog open={open} onClose={onClose} size="lg" title={t("Prepare supply for {value0}", { value0: rx.rx_no })}
      sub="Stock is reserved first-expiry-first-out. A bill opens now; claims follow the payer's workflow."
      footer={<>
        <span className="mr-auto text-[13px] text-ink-2">
          {partial && any ? <Tag tone="warn"><LocalizedText message="Part supply: the balance stays owed on the prescription" /></Tag> : null}
        </span>
        <Button variant="ghost" onClick={onClose}><LocalizedText message="Cancel" /></Button>
        <Button variant="primary" disabled={!any} loading={busy} onClick={async () => {
          setBusy(true);
          try { await onConfirm(lines.map((i) => ({ prescription_item_id: i.id, qty: qty[i.id] ?? 0 })).filter((l) => l.qty > 0), collection); onClose(); }
          finally { setBusy(false); }
        }}>{realtime ? "Reserve stock and check claim" : "Reserve stock"}</Button>
      </>}>
      <Table className="w-full text-[13px]">
        <TableHeader><TableRow className="text-left text-[11.5px] text-ink-3"><TableHead className="pb-2 font-medium"><LocalizedText message="Medicine" /></TableHead><TableHead className="pb-2 font-medium"><LocalizedText message="Batches used (FEFO)" /></TableHead><TableHead className="pb-2 text-right font-medium"><LocalizedText message="Remaining" /></TableHead><TableHead className="pb-2 text-right font-medium"><LocalizedText message="In stock" /></TableHead><TableHead className="w-28 pb-2 text-right font-medium"><LocalizedText message="Supply now" /></TableHead></TableRow></TableHeader>
        <TableBody className="divide-y divide-line border-t border-line">
          {lines.map((i) => (
            <TableRow key={i.id}>
              <TableCell className="py-2.5 pr-3">
                <p className="font-medium">{i.name} {i.cold_chain ? <Snowflake className="inline size-3.5 text-cobalt" /> : null}</p>
                <p className="text-xs text-ink-3">{i.location}</p>
              </TableCell>
              <TableCell className="py-2.5 pr-3">
                <div className="flex flex-wrap gap-1">
                  {i.batches.length === 0 && <span className="text-xs text-danger"><LocalizedText message="No sellable stock" /></span>}
                  {i.batches.map((b) => {
                    const dleft = daysUntil(b.expiry);
                    return <Tag key={b.id} tone={dleft < 90 ? "warn" : "neutral"} title={t("{value0} available", { value0: num(b.available) })}><span className="num"><LocalizedText message="{value0}, exp {value1}" values={{ value0: b.batch_no, value1: dateShort(b.expiry) }} /></span></Tag>;
                  })}
                </div>
              </TableCell>
              <TableCell className="num py-2.5 text-right">{num(i.qty_remaining)}</TableCell>
              <TableCell className={clsx("num py-2.5 text-right", i.available < i.qty_remaining && "text-amber")}>{num(i.available)}</TableCell>
              <TableCell className="py-2.5 pl-3">
                <Input type="number" min={0} max={Math.min(i.qty_remaining, i.available)} value={qty[i.id] ?? 0} aria-label={t("Quantity for {value0}", { value0: i.name })}
                  onChange={(e) => setQty({ ...qty, [i.id]: Math.max(0, Math.min(Number(e.target.value), i.qty_remaining, i.available)) })} className="num text-right" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="mt-4 flex flex-wrap items-center gap-4 rounded-lg bg-surface-2 px-3 py-2.5">
        <Field label="Collection">
          <Segmented size="sm" value={collection} onChange={setCollection} items={[
            { value: "pickup", label: <span className="flex items-center gap-1"><Store className="size-3.5" /><LocalizedText message="Counter pickup" /></span> },
            { value: "delivery", label: <span className="flex items-center gap-1"><Bike className="size-3.5" /><LocalizedText message="Home delivery" /></span> },
          ]} />
        </Field>
        <div className="ml-auto text-right">
          <p className="text-[11.5px] text-ink-3"><LocalizedText message="Value at list price" /></p>
          <p className="num text-[15px] font-semibold">{moneyC(total)}</p>
        </div>
      </div>
    </Dialog>
  );
}

/** Verification: every unresolved major alert needs a documented clinical reason. */
export function VerifyDialog({ rx, open, onClose, onConfirm }: {
  rx: RxDetail; open: boolean; onClose: () => void; onConfirm: (overrides: { key: string; reason: string }[]) => Promise<void>;
}) {
  const { t, int } = usePharmacyFormat();
  const majors = rx.alerts.filter((a) => a.severity === "major" && !a.overridden);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const ready = majors.every((a) => (reasons[a.key] ?? "").trim().length >= 5);
  const presets = ["Prescriber confirmed by phone", "Benefit outweighs risk; patient counselled", "Previously tolerated; monitoring in place"];
  return (
    <Dialog open={open} onClose={onClose} size="md" title={t("Verify {value0}", { value0: rx.rx_no })}
      sub={majors.length === 1 ? t("1 major alert must be resolved with a documented reason before verification.") : t("{value0} major alerts must be resolved with a documented reason before verification.", { value0: int(majors.length) })}
      footer={<><Button variant="ghost" onClick={onClose}><LocalizedText message="Back to review" /></Button>
        <Button variant="primary" disabled={!ready} loading={busy} onClick={async () => {
          setBusy(true);
          try { await onConfirm(majors.map((a) => ({ key: a.key, reason: reasons[a.key].trim() }))); setReasons({}); onClose(); } finally { setBusy(false); }
        }}><LocalizedText message="Override and verify" /></Button></>}>
      <div className="flex flex-col gap-4">
        {majors.map((a) => (
          <div key={a.key} className="rounded-lg border border-danger/30 bg-danger-wash/40 p-3">
            <p className="text-[13px] font-semibold text-danger">{a.title}</p>
            <p className="mt-0.5 text-[13px] text-ink-2">{a.detail}</p>
            <Field label="Clinical reason" className="mt-2.5">
              <Textarea rows={2} value={reasons[a.key] ?? ""} onChange={(e) => setReasons({ ...reasons, [a.key]: e.target.value })} />
            </Field>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {presets.map((p) => <SourceButton key={p} onClick={() => setReasons({ ...reasons, [a.key]: t(p) })} className="rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink-2 hover:border-cobalt hover:text-cobalt"><LocalizedText message={p} /></SourceButton>)}
            </div>
          </div>
        ))}
      </div>
    </Dialog>
  );
}
