"use client";
import {useLocalization} from "@pepbits/ops-ui";
import {useReferenceSearchParams} from "@pepbits/reference-host";
import {LocalizedText} from "@pepbits/ops-ui";
import { SourceInput, SourceSelect, Table } from "@pepbits/ops-ui";

import { useEffect, useState } from "react";
import { useSourceApi, useApi } from "./../../../lib/api";
import { useSourceFormat} from "./../../../lib/format";
import { Badge, Button, Empty, ErrorNote, Field, Modal, Segmented, Spinner, cx, useAction } from "./../../../components/ui";
import { IconSearch } from "./../../../components/icons";

type Item = {
  id: number; sku: string; name: string; category: string; uom: string; unit_cost: number; stock_qty: number; reserved_qty: number; available: number;
  reorder_level: number; lot_no: string | null; expiry: string | null; vendor: string; sterile_status: string; is_implant: number; used_30d: number;
};

export default function InventoryPage() {
 const {t:translateSource}=useLocalization();
 const {date,money}=useSourceFormat();
 const api=useSourceApi();
  const [flag, setFlag] = useState("");
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const requestedFlag=useReferenceSearchParams().get("flag");
  useEffect(()=>{setFlag(requestedFlag??"");},[requestedFlag]);
  const { data, loading, reload } = useApi<Item[]>(`/inventory?flag=${flag}&category=${encodeURIComponent(cat)}&q=${encodeURIComponent(q)}`);
  const [recv, setRecv] = useState<Item | null>(null);
  const [form, setForm] = useState({ qty: "", lotNo: "", expiry: "" });
  const { run, busy, error } = useAction();
  const soon = new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10);
  const value = (data ?? []).reduce((a, i) => a + i.stock_qty * i.unit_cost, 0);

  return (
    <div className="flex h-full flex-col gap-3 p-3 md:p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-cond text-[24px] font-semibold"><LocalizedText message={"Inventory"}/></h1>
        <Segmented value={flag} onChange={setFlag} options={[{ value: "", label: "All items" }, { value: "low", label: "Reorder now" }, { value: "expiring", label: "Expiring in 45 days" }, { value: "cssd", label: "Trays in CSSD" }]} />
        <SourceSelect className="input w-44" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
          <option value=""><LocalizedText message={"All categories"}/></option>
          {["Consumable", "Suture", "Implant", "Instrument tray"].map((c) => <option key={c}>{c}</option>)}
        </SourceSelect>
        <div className="relative ml-auto w-full sm:w-64">
          <IconSearch size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
          <SourceInput className="input pl-8" placeholder="Name, SKU or vendor" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <section className="panel flex min-h-0 flex-1 flex-col overflow-hidden">
        {loading && !data ? <Spinner /> : (data ?? []).length === 0 ? <Empty title="Nothing to show"><LocalizedText message={"No items match these filters."}/></Empty> : (
          <div className="scroll-y scroll-x min-h-0 flex-1">
            <Table className="w-full min-w-[1080px] text-[13px]">
              <thead className="sticky top-0 bg-white text-left text-[12px] text-muted shadow-[0_1px_0_#d5dbdf]">
                <tr>
                  <th className="px-4 py-2 font-medium"><LocalizedText message={"Item"}/></th>
                  <th className="px-2 py-2 font-medium"><LocalizedText message={"Category"}/></th>
                  <th className="px-2 py-2 text-right font-medium"><LocalizedText message={"In stock"}/></th>
                  <th className="px-2 py-2 text-right font-medium"><LocalizedText message={"Reserved"}/></th>
                  <th className="px-2 py-2 text-right font-medium"><LocalizedText message={"Free"}/></th>
                  <th className="px-2 py-2 text-right font-medium"><LocalizedText message={"Reorder at"}/></th>
                  <th className="px-2 py-2 text-right font-medium"><LocalizedText message={"Used 30d"}/></th>
                  <th className="px-2 py-2 font-medium"><LocalizedText message={"Lot / expiry"}/></th>
                  <th className="px-2 py-2 font-medium"><LocalizedText message={"Status"}/></th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data!.map((i) => {
                  const low = i.available <= i.reorder_level;
                  const expiring = i.expiry && i.expiry <= soon;
                  return (
                    <tr key={i.id} className="hover:bg-steel/40">
                      <td className="px-4 py-2"><span className="font-medium">{i.name}</span><span className="block text-[12px] text-muted">{i.sku}, {i.vendor}{i.unit_cost ? `, ${money(i.unit_cost)}/${i.uom}` : ""}</span></td>
                      <td className="px-2 py-2">{i.category}</td>
                      <td className="px-2 py-2 text-right font-cond text-[15px] font-semibold">{i.stock_qty}</td>
                      <td className="px-2 py-2 text-right text-muted">{i.reserved_qty}</td>
                      <td className={cx("px-2 py-2 text-right font-cond text-[15px] font-semibold", low && "text-stop")}>{i.available}</td>
                      <td className="px-2 py-2 text-right text-muted">{i.reorder_level}</td>
                      <td className="px-2 py-2 text-right">{i.used_30d}</td>
                      <td className="px-2 py-2 text-[12px]">{i.lot_no ?? "—"}<span className={cx("block", expiring ? "font-medium text-stop" : "text-muted")}>{i.expiry ? date(i.expiry) : "No expiry"}</span></td>
                      <td className="px-2 py-2">
                        {i.category === "Instrument tray" ? (
                          <SourceSelect className="input h-7 w-32 text-[12px]" value={i.sterile_status} onChange={(e) => run(() => api(`/inventory/${i.id}`, { method: "PATCH", body: { sterile_status: e.target.value } }), "Tray status updated").then((r) => r && reload())}>
                            {["Sterile", "In CSSD", "Dirty", "Quarantined"].map((s) => <option key={s}>{s}</option>)}
                          </SourceSelect>
                        ) : low ? <Badge tone="stop"><LocalizedText message={"Reorder"}/></Badge> : expiring ? <Badge tone="amber"><LocalizedText message={"Expiring"}/></Badge> : <Badge tone="go"><LocalizedText message={"OK"}/></Badge>}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Button size="sm" onClick={() => { setForm({ qty: "", lotNo: "", expiry: "" }); setRecv(i); }}><LocalizedText message={"Receive"}/></Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        )}
        <div className="flex justify-between border-t border-line px-4 py-2 text-[12px] text-muted">
          <span><LocalizedText message={"Free stock is what's left after reservations for booked cases."}/></span>
          <span><LocalizedText message={"Stock value shown"}/>{" "}<b className="text-ink">{money(value)}</b></span>
        </div>
      </section>
      <Modal
        open={!!recv}
        onClose={() => setRecv(null)}
        title={translateSource("Receive {value0}",{value0:recv?.name ?? ""})}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRecv(null)}><LocalizedText message={"Cancel"}/></Button>
            <Button variant="primary" busy={busy} disabled={!form.qty} onClick={() => run(() => api(`/inventory/${recv!.id}/receive`, { body: { qty: Number(form.qty), lotNo: form.lotNo || undefined, expiry: form.expiry || undefined } }), "Stock received").then((r) => { if (r) { setRecv(null); reload(); } })}><LocalizedText message={"Add to stock"}/></Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={translateSource("Quantity ({value0})",{value0:recv?.uom??""})}><SourceInput className="input" type="number" min={1} value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} /></Field>
          <Field label="Lot number"><SourceInput className="input" value={form.lotNo} onChange={(e) => setForm({ ...form, lotNo: e.target.value })} /></Field>
          <Field label="Expiry"><SourceInput className="input" type="date" value={form.expiry} onChange={(e) => setForm({ ...form, expiry: e.target.value })} /></Field>
        </div>
        <ErrorNote error={error} className="mt-3" />
      </Modal>
    </div>
  );
}
