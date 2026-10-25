'use client';

import {TableRow} from '@pepbits/components';

import clsx from 'clsx';
import { CircleDashed, FlaskConical, Link2, Lock, Pencil, Plus, Search, ShieldCheck, Tag, X } from '@pepbits/icons';
import { forwardRef, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { SourceInput } from '@pepbits/ui';
import { qs, useApi, useDebounced, useMutation } from '../../lib/api';
import { GROUP_LABEL, round2, useFormat } from '../../lib/format';
import { useSession } from '../../lib/session';
import type { BillPayload, CatalogueItem, Charge } from '../../lib/types';
import { Drawer, useErrorToast, useToast } from '../ui/overlay';
import { Badge, Button, Checkbox, Empty, Field, Input, Kbd, MoneyInput, Segmented, Select, Textarea, Toggle, SettleTable } from '../ui/primitives';

export interface ChargesHandle { focusAdd: () => void }

export const ChargesPanel = forwardRef<ChargesHandle, { data: BillPayload }>(function ChargesPanel({ data }, ref) {
  const { money, dateTime } = useFormat();
  const { bill, charges } = data;
  const editable = data.actions.editCharges.allowed;
  const { can } = useSession();
  const [selected, setSelected] = useState<number[]>([]);
  const [grouped, setGrouped] = useState(charges.length > 8);
  const [showCancelled, setShowCancelled] = useState(false);
  const [editing, setEditing] = useState<Charge | null>(null);
  const addRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => ({ focusAdd: () => addRef.current?.focus() }));

  const active = charges.filter((c) => c.status === 'A' && !c.is_system);
  const cancelled = charges.filter((c) => c.status === 'X');
  const rof = charges.find((c) => c.is_system && c.status === 'A');
  useEffect(() => { setSelected((s) => s.filter((id) => active.some((c) => c.charge_id === id))); }, [charges]); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => {
    if (!grouped) return [{ key: 'all', label: '', rows: active }];
    const m = new Map<string, Charge[]>();
    for (const c of active) m.set(c.charge_group, [...(m.get(c.charge_group) || []), c]);
    return [...m.entries()].map(([key, rows]) => ({ key, label: GROUP_LABEL[key] || key, rows }));
  }, [active, grouped]);

  const allSel = active.length > 0 && selected.length === active.length;
  const patientPart = (c: Charge) => round2(c.amount - c.discount + c.vat - c.primary_claim - c.secondary_claim - c.sponsor_vat);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {editable && can('addtobill_charges') ? (
        <QuickAdd ref={addRef} billNo={bill.bill_no} restriction={bill.restriction_type} />
      ) : (
        <div className="flex items-center gap-2 border-b border-line bg-mist/60 px-4 py-2.5 text-[length:calc(13px*var(--fs-scale,1))] text-ink-soft">
          <Lock className="h-3.5 w-3.5" />
          {editable ? 'You can view charges but not add them.' : data.actions.editCharges.reasons[0] + '. Reopen it to change charges.'}
        </div>
      )}

      {selected.length > 0 && editable && <BulkDiscountBar billNo={bill.bill_no} ids={selected} onDone={() => setSelected([])} />}

      <div className="flex items-center justify-between gap-3 px-4 py-2 text-[length:calc(12.5px*var(--fs-scale,1))] text-ink-soft">
        <span>{active.length} item{active.length === 1 ? '' : 's'}{cancelled.length ? `, ${cancelled.length} cancelled` : ''}</span>
        <div className="flex items-center gap-3">
          {cancelled.length > 0 && (
            <button type="button" className="hover:text-ink" onClick={() => setShowCancelled((s) => !s)}>{showCancelled ? 'Hide cancelled' : 'Show cancelled'}</button>
          )}
          <label className="flex cursor-pointer items-center gap-2">Group by category <Toggle checked={grouped} onChange={setGrouped} label="Group by category" /></label>
        </div>
      </div>

      <div className="scroll-area min-h-0 flex-1 border-t border-line" tabIndex={0} role="region" aria-label="Charges">
        {active.length === 0 && !showCancelled ? (
          <Empty icon={<Plus className="h-5 w-5" />} title="No charges yet" body="Type an item name or code in the box above and press Enter to add it." />
        ) : (
          <SettleTable>
            <thead>
              <TableRow>
                {editable && <th className="w-9"><Checkbox aria-label="Select all charges" checked={allSel} indeterminate={selected.length > 0 && !allSel} onChange={(v) => setSelected(v ? active.map((c) => c.charge_id) : [])} /></th>}
                <th>Item</th>
                <th className="hidden lg:table-cell">Posted</th>
                <th className="num">Rate</th>
                <th className="num">Qty</th>
                <th className="num">Discount</th>
                {bill.is_tpa ? <th className="num">Sponsor</th> : null}
                <th className="num">Patient</th>
                <th className="w-10"><span className="sr-only">Edit</span></th>
              </TableRow>
            </thead>
            <tbody>
              {groups.map((g) => (
                <GroupRows key={g.key} label={g.label} rows={g.rows} tpa={!!bill.is_tpa} editable={editable} selected={selected}
                  onSelect={(id, v) => setSelected((s) => (v ? [...s, id] : s.filter((x) => x !== id)))} onEdit={setEditing} patientPart={patientPart} />
              ))}
              {rof && (
                <TableRow className="text-ink-mute">
                  {editable && <td />}
                  <td colSpan={bill.is_tpa ? 6 : 5}>Round-off to the nearest rupee</td>
                  <td className="num">{money(rof.amount)}</td>
                  <td />
                </TableRow>
              )}
              {showCancelled && cancelled.map((c) => (
                <TableRow key={c.charge_id} className="text-ink-mute">
                  {editable && <td />}
                  <td><span className="line-through">{c.description}</span> <Badge tone="rose" className="ms-1">Cancelled</Badge>{c.remarks && <span className="ms-2 text-[length:calc(12px*var(--fs-scale,1))]">{c.remarks}</span>}</td>
                  <td className="hidden lg:table-cell">{dateTime(c.posted_at)}</td>
                  <td className="num line-through">{money(c.rate)}</td>
                  <td className="num">{c.qty}</td>
                  <td className="num">—</td>
                  {bill.is_tpa ? <td className="num">—</td> : null}
                  <td className="num">—</td>
                  <td />
                </TableRow>
              ))}
            </tbody>
          </SettleTable>
        )}
      </div>

      <EditChargeDrawer charge={editing} data={data} onClose={() => setEditing(null)} />
    </div>
  );
});

function GroupRows({ label, rows, tpa, editable, selected, onSelect, onEdit, patientPart }: {
  label: string; rows: Charge[]; tpa: boolean; editable: boolean; selected: number[];
  onSelect: (id: number, v: boolean) => void; onEdit: (c: Charge) => void; patientPart: (c: Charge) => number;
}) {
  const { money, dateTime } = useFormat();
  const subtotal = rows.reduce((s, c) => s + patientPart(c), 0);
  return (
    <>
      {label && (
        <TableRow className="bg-mist/70">
          <td colSpan={editable ? 2 : 1} className="!py-1.5 text-[length:calc(12px*var(--fs-scale,1))] font-semibold text-ink-soft">{label} <span className="font-normal text-ink-mute">({rows.length})</span></td>
          <td colSpan={tpa ? 5 : 4} className="hidden !py-1.5 lg:table-cell" />
          <td className="num !py-1.5 text-[length:calc(12px*var(--fs-scale,1))] font-semibold text-ink-soft">{money(subtotal)}</td>
          <td className="!py-1.5" />
        </TableRow>
      )}
      {rows.map((c) => {
        const sponsor = c.primary_claim + c.secondary_claim + c.sponsor_vat;
        return (
          <TableRow key={c.charge_id} className={clsx('group', editable && 'row-link', selected.includes(c.charge_id) && 'bg-pine-50/70')}
            onClick={(e) => { if (editable && !(e.target as HTMLElement).closest('button,input,label')) onEdit(c); }}>
            {editable && <td onClick={(e) => e.stopPropagation()}><Checkbox aria-label={`Select ${c.description}`} checked={selected.includes(c.charge_id)} onChange={(v) => onSelect(c.charge_id, v)} /></td>}
            <td className="min-w-[220px]">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-medium text-ink">{c.description}</span>
                {c.pending_result ? <Badge tone="marigold"><FlaskConical className="h-3 w-3" />Result pending</Badge> : null}
                {c.order_linked ? <span title="Linked to an order" className="text-ink-mute"><Link2 className="h-3.5 w-3.5" /></span> : null}
                {c.discount_status === 'pending' && <Badge tone="marigold"><CircleDashed className="h-3 w-3" />Discount awaiting approval</Badge>}
                {c.claim_override ? <Badge tone="indigo">Claim edited</Badge> : null}
                {tpa && !c.insurance_payable ? <Badge tone="gray">Not covered</Badge> : null}
              </div>
              <div className="text-[length:calc(12px*var(--fs-scale,1))] text-ink-mute">{c.code}{!label && ` · ${GROUP_LABEL[c.charge_group] || c.charge_group}`}{c.vat_rate ? ` · GST ${c.vat_rate}%` : ''}</div>
            </td>
            <td className="hidden whitespace-nowrap text-[length:calc(12.5px*var(--fs-scale,1))] text-ink-soft lg:table-cell">{dateTime(c.posted_at)}</td>
            <td className="num">
              {money(c.rate)}
              {c.rate !== c.orig_rate && c.orig_rate > 0 && <div className="text-[length:calc(11.5px*var(--fs-scale,1))] text-ink-mute line-through">{money(c.orig_rate)}</div>}
            </td>
            <td className="num">{c.qty}</td>
            <td className="num">{c.discount > 0 ? <span className="text-pine-700">−{money(c.discount)}</span> : <span className="text-ink-mute">—</span>}</td>
            {tpa ? <td className="num text-indigo-600">{sponsor > 0 ? money(sponsor) : <span className="text-ink-mute">—</span>}</td> : null}
            <td className="num font-medium">{money(patientPart(c))}</td>
            <td className="text-end">
              {editable && (
                <button type="button" aria-label={`Edit ${c.description}`} onClick={() => onEdit(c)}
                  className="rounded-md p-1.5 text-ink-mute opacity-60 transition hover:bg-panel hover:text-ink group-hover:opacity-100">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
            </td>
          </TableRow>
        );
      })}
    </>
  );
}

/* ---------------------------------------------------------------- Quick add */
const QuickAdd = forwardRef<HTMLInputElement, { billNo: string; restriction: string }>(function QuickAdd({ billNo, restriction }, ref) {
  const { money } = useFormat();
  const [q, setQ] = useState('');
  const [qty, setQty] = useState('1');
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const [group, setGroup] = useState(restriction === 'P' ? 'MED' : '');
  const dq = useDebounced(q, 120);
  const { data } = useApi<CatalogueItem[]>(open ? `/catalogue${qs({ q: dq, group })}` : null);
  const { run, pending } = useMutation();
  const toast = useToast();
  const fail = useErrorToast();
  const box = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => setIdx(0), [dq, group]);
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  async function add(item: CatalogueItem) {
    const n = Number(qty) || 1;
    try {
      await run(`/bills/${billNo}/charges`, 'POST', { items: [{ catalogueId: item.id, qty: n }] });
      toast({ tone: 'success', title: `Added ${item.name}`, body: n > 1 ? `${n} × ${money(item.rate)}` : undefined });
      setQ(''); setQty('1');
      (ref as React.RefObject<HTMLInputElement>).current?.focus();
    } catch (e) { fail(e, 'Could not add the charge'); }
  }

  const groups: [string, string][] = restriction === 'P' ? [['MED', 'Medicines']] : [['', 'All'], ['DOC', 'Consult'], ['DIA', 'Diagnostics'], ['BED', 'Room'], ['OPE', 'Surgery'], ['MED', 'Medicines'], ['ITE', 'Consumables']];

  return (
    <div ref={box} className="relative border-b border-line px-4 py-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" aria-hidden />
          <SourceInput
            ref={ref}
            role="combobox"
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-autocomplete="list"
            aria-activedescendant={open && data?.[idx] ? `${listId}-${data[idx]!.id}` : undefined}
            value={q}
            onChange={(e) => { setQ(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setIdx((i) => Math.min(i + 1, (data?.length || 1) - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
              if (e.key === 'Enter' && data?.[idx]) { e.preventDefault(); add(data[idx]); }
              if (e.key === 'Escape') setOpen(false);
            }}
            placeholder="Add a charge — type a service, test or medicine"
            aria-label="Add a charge"
            className="input h-10 ps-9 pe-16"
          />
          <Kbd className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2">A</Kbd>
        </div>
        <div className="flex w-[92px] items-center rounded-lg border border-line bg-panel ps-3 focus-within:border-pine-500 focus-within:ring-2 focus-within:ring-pine-100">
          <span className="text-[length:calc(13px*var(--fs-scale,1))] text-ink-mute" aria-hidden>Qty</span>
          <SourceInput value={qty} onChange={(e) => setQty(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" aria-label="Quantity"
            className="h-10 w-full bg-transparent px-2 text-end text-[length:calc(14px*var(--fs-scale,1))] outline-none" />
        </div>
      </div>
      {open && (
        <div className="absolute inset-x-4 top-full z-20 -mt-1 overflow-hidden rounded-xl border border-line bg-panel shadow-pop">
          <div className="flex gap-1 overflow-x-auto border-b border-line p-1.5">
            {groups.map(([g, l]) => (
              <button key={g} type="button" onClick={() => setGroup(g)}
                className={clsx('rounded-md px-2.5 py-1 text-[length:calc(12.5px*var(--fs-scale,1))] font-medium', group === g ? 'bg-pine-50 text-pine-800' : 'text-ink-soft hover:bg-mist')}>{l}</button>
            ))}
          </div>
          <ul id={listId} className="max-h-[300px] overflow-y-auto p-1" role="listbox" aria-label="Catalogue items">
            {data?.length ? data.map((it, i) => (
              <li key={it.id} role="none">
                <button id={`${listId}-${it.id}`} tabIndex={-1} type="button" role="option" aria-selected={i === idx} onMouseEnter={() => setIdx(i)} onClick={() => add(it)} disabled={pending}
                  className={clsx('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-start', i === idx && 'bg-pine-50')}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[length:calc(14px*var(--fs-scale,1))] font-medium">{it.name}</span>
                    <span className="block text-[length:calc(12px*var(--fs-scale,1))] text-ink-mute">{it.code} · {GROUP_LABEL[it.charge_group] || it.charge_group}{it.vat_rate ? ` · GST ${it.vat_rate}%` : ''}</span>
                  </span>
                  <span className="text-[length:calc(14px*var(--fs-scale,1))] font-medium tabular-nums">{money(it.rate)}</span>
                  {i === idx && <span className="hidden text-[length:calc(11.5px*var(--fs-scale,1))] text-pine-700 sm:inline">Enter to add</span>}
                </button>
              </li>
            )) : <li role="none" className="px-3 py-6 text-center text-[length:calc(13px*var(--fs-scale,1))] text-ink-soft">{data ? 'No matching items.' : 'Searching…'}</li>}
          </ul>
        </div>
      )}
    </div>
  );
});

/* ---------------------------------------------------------------- Bulk discount */
function BulkDiscountBar({ billNo, ids, onDone }: { billNo: string; ids: number[]; onDone: () => void }) {
  const { meta, can } = useSession();
  const [pct, setPct] = useState('10');
  const [auth, setAuth] = useState('');
  const { run, pending } = useMutation();
  const toast = useToast();
  const fail = useErrorToast();
  if (!can('allow_discount')) return null;
  async function apply(mode: 'replace' | 'add') {
    try {
      const { data } = await run<BillPayload>(`/bills/${billNo}/discount`, 'POST', { chargeIds: ids, percent: Number(pct), authorizer: auth, mode });
      const pend = data.approvals.some((a) => a.status === 'pending' && a.kind === 'discount');
      toast({ tone: pend ? 'info' : 'success', title: `${pct}% discount ${mode === 'add' ? 'added' : 'applied'}`, body: pend ? 'Above the approval limit — sent to the approvals inbox.' : undefined });
      onDone();
    } catch (e) { fail(e, 'Discount not applied'); }
  }
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-pine-100 bg-pine-50 px-4 py-2.5 text-[length:calc(13px*var(--fs-scale,1))]">
      <Tag className="h-4 w-4 text-pine-700" />
      <span className="font-medium text-pine-800">{ids.length} selected</span>
      <span className="text-ink-soft">Discount</span>
      <div className="relative w-[84px]">
        <Input value={pct} onChange={(e) => setPct(e.target.value.replace(/[^0-9.]/g, ''))} className="h-8 pe-6 text-end" aria-label="Discount percent" />
        <span className="absolute end-2.5 top-1/2 -translate-y-1/2 text-ink-mute">%</span>
      </div>
      <Select value={auth} onChange={(e) => setAuth(e.target.value)} className="h-8 w-auto min-w-[200px]" aria-label="Authorized by">
        <option value="">Authorized by…</option>
        {meta?.authorizers.map((a) => <option key={a}>{a}</option>)}
      </Select>
      <Button size="sm" variant="primary" disabled={!auth || !(Number(pct) >= 0)} loading={pending} onClick={() => apply('replace')}>Apply</Button>
      <Button size="sm" variant="secondary" disabled={!auth || !(Number(pct) > 0)} onClick={() => apply('add')}>Add on top</Button>
      <button type="button" onClick={onDone} className="ms-auto text-ink-soft hover:text-ink" aria-label="Clear selection"><X className="h-4 w-4" /></button>
    </div>
  );
}

/* ---------------------------------------------------------------- Edit drawer */
function EditChargeDrawer({ charge, data, onClose }: { charge: Charge | null; data: BillPayload; onClose: () => void }) {
  const { money, dateTime, currencyCode } = useFormat();
  const { meta, can } = useSession();
  const { run, pending } = useMutation();
  const toast = useToast();
  const fail = useErrorToast();
  const [f, setF] = useState({ rate: '', qty: '', discount: '', discMode: 'amt' as 'amt' | 'pct', discountBy: '', discountReason: '', postedAt: '', remarks: '', override: false, p1: '', p2: '' });
  const [cancelReason, setCancelReason] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    if (!charge) return;
    setF({
      rate: String(charge.rate), qty: String(charge.qty), discount: charge.discount ? String(charge.discount) : '', discMode: 'amt',
      discountBy: charge.discount_by || '', discountReason: '', postedAt: charge.posted_at.slice(0, 16), remarks: charge.remarks || '',
      override: !!charge.claim_override, p1: String(charge.primary_claim), p2: String(charge.secondary_claim),
    });
    setConfirmCancel(false);
    setCancelReason('');
  }, [charge]);

  if (!charge) return null;
  const amount = round2((Number(f.rate) || 0) * (Number(f.qty) || 0));
  const discount = f.discMode === 'pct' ? round2((amount * (Number(f.discount) || 0)) / 100) : Number(f.discount) || 0;
  const net = round2(amount - discount);
  const threshold = Number(meta?.prefs.discount_approval_threshold_pct ?? 10);
  const needsApproval = !data.bill.is_tpa && amount > 0 && (discount / amount) * 100 > threshold && discount !== charge.discount;
  const p2plan = data.claims.find((c) => c.priority === 2);

  async function save() {
    const body: Record<string, unknown> = {};
    if (Number(f.rate) !== charge!.rate) body.rate = Number(f.rate);
    if (Number(f.qty) !== charge!.qty) body.qty = Number(f.qty);
    if (discount !== charge!.discount) { body.discount = discount; body.discountBy = f.discountBy; body.discountReason = f.discountReason; }
    if (f.postedAt && f.postedAt !== charge!.posted_at.slice(0, 16)) body.postedAt = new Date(f.postedAt).toISOString();
    if ((f.remarks || '') !== (charge!.remarks || '')) body.remarks = f.remarks;
    if (data.bill.is_tpa && (f.override !== !!charge!.claim_override || (f.override && (Number(f.p1) !== charge!.primary_claim || Number(f.p2) !== charge!.secondary_claim)))) {
      body.claimOverride = f.override; body.primaryClaim = Number(f.p1) || 0; body.secondaryClaim = Number(f.p2) || 0;
    }
    if (!Object.keys(body).length) { onClose(); return; }
    try {
      await run(`/charges/${charge!.charge_id}`, 'PATCH', body);
      toast({ tone: needsApproval ? 'info' : 'success', title: `Updated ${charge!.description}`, body: needsApproval ? 'Discount sent for approval. The bill can’t be finalized until it’s decided.' : undefined });
      onClose();
    } catch (e) { fail(e, 'Changes not saved'); }
  }

  async function cancelCharge() {
    try {
      await run(`/charges/${charge!.charge_id}/cancel`, 'POST', { reason: cancelReason, cancelOrder: !!charge!.order_linked });
      toast({ tone: 'success', title: `Cancelled ${charge!.description}` });
      onClose();
    } catch (e) { fail(e, 'Charge not cancelled'); }
  }

  async function resultReady() {
    try { await run(`/charges/${charge!.charge_id}/result-ready`, 'POST', {}); toast({ tone: 'success', title: 'Result marked ready' }); onClose(); } catch (e) { fail(e); }
  }

  return (
    <Drawer open={!!charge} onClose={onClose} title={charge.description} sub={<span>{charge.code} · {GROUP_LABEL[charge.charge_group] || charge.charge_group} · posted {dateTime(charge.posted_at)} by {charge.posted_by}</span>}
      footer={confirmCancel ? (
        <>
          <Input autoFocus aria-label="Reason for cancelling" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Reason for cancelling" className="flex-1" />
          <Button variant="ghost" onClick={() => setConfirmCancel(false)}>Keep</Button>
          <Button variant="danger" disabled={!cancelReason.trim()} loading={pending} onClick={cancelCharge}>{charge.order_linked ? 'Cancel order and charge' : 'Cancel charge'}</Button>
        </>
      ) : (
        <>
          {can('cancel_elements_in_bill') && <Button variant="ghost" className="me-auto text-rose-600 hover:bg-rose-50" onClick={() => setConfirmCancel(true)}>Cancel charge</Button>}
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button variant="primary" loading={pending} onClick={save}>Save changes</Button>
        </>
      )}>
      <div className="space-y-5">
        {charge.pending_result ? (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-marigold-50 px-3 py-2.5 text-[length:calc(13px*var(--fs-scale,1))] text-marigold-800">
            <span className="flex items-center gap-2"><FlaskConical className="h-4 w-4" />Result pending — the bill can’t be finalized yet.</span>
            <Button size="sm" variant="secondary" onClick={resultReady}>Mark result ready</Button>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Rate" hint={!can('allow_ratechange') ? 'You don’t have the right to change rates' : charge.orig_rate !== Number(f.rate) ? `List rate ${money(charge.orig_rate)}` : undefined}>
            <MoneyInput value={f.rate} onChange={(v) => setF({ ...f, rate: v })} />
          </Field>
          <Field label="Quantity"><Input inputMode="decimal" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value.replace(/[^0-9.]/g, '') })} className="text-end" /></Field>
        </div>

        <div className="rounded-xl border border-line p-3.5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[length:calc(13px*var(--fs-scale,1))] font-semibold">Discount</span>
            <Segmented size="sm" value={f.discMode} onChange={(v) => setF({ ...f, discMode: v, discount: '' })} options={[{ value: 'amt', label: currencyCode }, { value: 'pct', label: '%' }]} aria-label="Discount as" />
          </div>
          {can('allow_discount') ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label={f.discMode === 'pct' ? 'Percent' : 'Amount'} hint={discount > 0 ? `${money(discount)} off ${money(amount)}` : undefined}>
                {f.discMode === 'pct'
                  ? <Input inputMode="decimal" value={f.discount} onChange={(e) => setF({ ...f, discount: e.target.value.replace(/[^0-9.]/g, '') })} className="text-end" placeholder="0" />
                  : <MoneyInput value={f.discount} onChange={(v) => setF({ ...f, discount: v })} />}
              </Field>
              <Field label="Authorized by">
                <Select value={f.discountBy} onChange={(e) => setF({ ...f, discountBy: e.target.value })}>
                  <option value="">Choose…</option>
                  {meta?.authorizers.map((a) => <option key={a}>{a}</option>)}
                </Select>
              </Field>
              {needsApproval && (
                <Field label="Reason for approver" className="col-span-2" hint={`Discounts above ${threshold}% on self-pay bills go to the approvals inbox.`}>
                  <Input value={f.discountReason} onChange={(e) => setF({ ...f, discountReason: e.target.value })} placeholder="e.g. Senior citizen, long-standing patient" />
                </Field>
              )}
            </div>
          ) : <p className="text-[length:calc(13px*var(--fs-scale,1))] text-ink-soft">You don’t have the right to give discounts.</p>}
        </div>

        {data.bill.is_tpa ? (
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3.5">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2 text-[length:calc(13px*var(--fs-scale,1))] font-semibold"><ShieldCheck className="h-4 w-4 text-indigo-500" />Sponsor claim</span>
              <label className="flex items-center gap-2 text-[length:calc(12.5px*var(--fs-scale,1))] text-ink-soft">Set manually <Toggle checked={f.override} onChange={(v) => setF({ ...f, override: v })} label="Set claim manually" /></label>
            </div>
            {f.override ? (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Primary sponsor"><MoneyInput value={f.p1} onChange={(v) => setF({ ...f, p1: v })} /></Field>
                <Field label="Secondary sponsor" hint={!p2plan ? 'No secondary plan' : undefined}><MoneyInput value={f.p2} onChange={(v) => setF({ ...f, p2: v })} /></Field>
                {Number(f.p1) + Number(f.p2) > net + 0.004 && <p className="col-span-2 text-[length:calc(12px*var(--fs-scale,1))] text-rose-600">Claims are more than the net amount ({money(net)}).</p>}
              </div>
            ) : (
              <p className="text-[length:calc(13px*var(--fs-scale,1))] text-ink-soft">Worked out from the plan: primary {money(charge.primary_claim)}{p2plan ? `, secondary ${money(charge.secondary_claim)}` : ''}. Patient pays the rest.</p>
            )}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Posted on"><Input type="datetime-local" value={f.postedAt} onChange={(e) => setF({ ...f, postedAt: e.target.value })} /></Field>
          <div className="flex flex-col justify-end rounded-lg bg-mist px-3 py-2 text-[length:calc(13px*var(--fs-scale,1))]">
            <span className="text-ink-mute">Net amount</span>
            <span className="text-[length:calc(16px*var(--fs-scale,1))] font-semibold">{money(net)}</span>
          </div>
        </div>
        <Field label="Remarks" optional><Textarea rows={2} value={f.remarks} onChange={(e) => setF({ ...f, remarks: e.target.value })} /></Field>
      </div>
    </Drawer>
  );
}
