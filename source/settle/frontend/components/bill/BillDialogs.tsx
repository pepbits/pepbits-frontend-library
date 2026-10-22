'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useMutation } from '@/lib/api';
import { billTypeLabel, money, restrictionLabel } from '@/lib/format';
import { useSession } from '@/lib/session';
import type { BillPayload } from '@/lib/types';
import { Dialog, Drawer, useErrorToast, useToast } from '../ui/overlay';
import { Badge, Button, Field, Segmented, Select, StatusBadge, Textarea } from '../ui/primitives';

export function ReasonDialog({ open, onClose, title, sub, confirmLabel, danger, codes, onConfirm, pending, children }: {
  open: boolean; onClose: () => void; title: string; sub?: string; confirmLabel: string; danger?: boolean; codes?: string[];
  onConfirm: (reason: string, code?: string) => void; pending?: boolean; children?: React.ReactNode;
}) {
  const [reason, setReason] = useState('');
  const [code, setCode] = useState('');
  useEffect(() => { if (open) { setReason(''); setCode(''); } }, [open]);
  const ok = reason.trim().length >= 3 && (!codes || code);
  return (
    <Dialog open={open} onClose={onClose} title={title} sub={sub} size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>Back</Button><Button variant={danger ? 'danger' : 'primary'} disabled={!ok} loading={pending} onClick={() => onConfirm(reason.trim(), code || undefined)}>{confirmLabel}</Button></>}>
      <div className="space-y-4">
        {children}
        {codes && (
          <div>
            <p className="label mb-2">Reason</p>
            <div className="flex flex-wrap gap-1.5">
              {codes.map((c) => (
                <button key={c} type="button" onClick={() => setCode(c)} aria-pressed={code === c}
                  className={clsx('rounded-full border px-3 py-1 text-[13px] transition-colors', code === c ? 'border-pine-600 bg-pine-600 text-white' : 'border-line hover:border-line-strong')}>{c}</button>
              ))}
            </div>
          </div>
        )}
        <Field label={codes ? 'Note' : 'Reason'} hint="Saved to the bill’s history.">
          <Textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What happened and why" />
        </Field>
      </div>
    </Dialog>
  );
}

export function BillSettingsDrawer({ open, onClose, data }: { open: boolean; onClose: () => void; data: BillPayload }) {
  const { bill, visit, siblings, claims } = data;
  const { meta, can } = useSession();
  const { run, pending } = useMutation();
  const toast = useToast();
  const fail = useErrorToast();
  const [remarks, setRemarks] = useState(bill.remarks || '');
  const [plan, setPlan] = useState<string>(String(visit.primary_plan_id || ''));
  const [plan2, setPlan2] = useState<string>(String(visit.secondary_plan_id || ''));
  useEffect(() => { if (open) { setRemarks(bill.remarks || ''); setPlan(String(visit.primary_plan_id || '')); setPlan2(String(visit.secondary_plan_id || '')); } }, [open, bill.remarks, visit]);
  const isOpen = bill.status === 'A';

  async function patch(body: Record<string, unknown>, msg: string) {
    try { await run(`/bills/${bill.bill_no}/settings`, 'PATCH', body); toast({ tone: 'success', title: msg }); } catch (e) { fail(e, 'Not changed'); }
  }

  return (
    <Drawer open={open} onClose={onClose} title="Bill settings" sub={`${bill.bill_no}, ${restrictionLabel(bill.restriction_type)} bill`}>
      <div className="space-y-6">
        <section>
          <h3 className="mb-2 text-[13px] font-semibold">Bill type</h3>
          <Segmented value={bill.bill_type} onChange={(v) => v !== bill.bill_type && patch({ billType: v }, `Changed to ${billTypeLabel(v)}`)}
            options={[{ value: 'P', label: 'Bill Now' }, { value: 'C', label: 'Bill Later' }]} />
          <p className="mt-1.5 text-[12.5px] text-ink-mute">{!can('change_billtype') ? 'You don’t have the right to change this.' : !isOpen ? 'Reopen the bill to change its type.' : 'Bill Later bills can take advances and carry insurance.'}</p>
        </section>

        <section>
          <h3 className="mb-2 text-[13px] font-semibold">Primary bill of the visit</h3>
          {bill.is_primary ? <Badge tone="pine">This is the primary bill</Badge> : (
            <Button size="sm" disabled={!can('change_billprimary') || bill.restriction_type !== 'N' || bill.status === 'X'} loading={pending}
              onClick={() => patch({ makePrimary: true }, 'This is now the primary bill')}>Make this the primary bill</Button>
          )}
          <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
            {siblings.map((s) => (
              <li key={s.bill_no} className={clsx('flex items-center justify-between gap-2 px-3 py-2 text-[13px]', s.bill_no === bill.bill_no && 'bg-pine-50/60')}>
                <span className="flex items-center gap-2">
                  {s.bill_no === bill.bill_no ? <b>{s.bill_no}</b> : <Link href={`/bills/${s.bill_no}`} className="font-medium text-pine-700 hover:underline">{s.bill_no}</Link>}
                  <span className="text-ink-mute">{billTypeLabel(s.bill_type)}{s.restriction_type !== 'N' ? `, ${restrictionLabel(s.restriction_type)}` : ''}</span>
                  {s.is_primary ? <Badge tone="pine">Primary</Badge> : null}
                </span>
                <span className="flex items-center gap-2"><StatusBadge status={s.status} />{s.patient_due > 0.004 && <span className="text-marigold-800">{money(s.patient_due)}</span>}</span>
              </li>
            ))}
          </ul>
        </section>

        {!bill.is_tpa && (
          <section>
            <h3 className="mb-2 text-[13px] font-semibold">Rate plan</h3>
            <Select value={bill.rate_plan_id ?? ''} disabled={!isOpen || !can('allow_ratechange')}
              onChange={(e) => patch({ ratePlanId: e.target.value ? Number(e.target.value) : null }, 'Rate plan changed and charges re-rated')}>
              <option value="">List rates</option>
              {meta?.ratePlans.map((r) => <option key={r.id} value={r.id}>{r.name}{r.discount_pct ? ` (${r.discount_pct}% off)` : ''}</option>)}
            </Select>
            <p className="mt-1.5 text-[12.5px] text-ink-mute">Changing the plan re-rates every charge from its list rate.</p>
          </section>
        )}

        <section>
          <h3 className="mb-2 text-[13px] font-semibold">Insurance</h3>
          {bill.is_tpa ? (
            <div className="space-y-2">
              {claims.map((c) => <p key={c.id} className="text-[13px]"><Badge tone="indigo">{c.priority === 1 ? 'Primary' : 'Secondary'}</Badge> <b className="ml-1">{c.sponsor_name}</b> — {c.plan_name}</p>)}
              <Button size="sm" variant="secondary" disabled={!isOpen || !can('connect_disconnect_tpa')} loading={pending}
                onClick={() => patch({ insurance: 'disconnect' }, 'Insurance disconnected — patient pays the full amount')}>Disconnect insurance</Button>
            </div>
          ) : (
            <div className="space-y-2.5">
              <Field label="Primary plan">
                <Select value={plan} onChange={(e) => setPlan(e.target.value)} disabled={!isOpen}>
                  <option value="">Choose a plan</option>
                  {meta?.plans.map((p) => <option key={p.id} value={p.id}>{p.sponsor_name} — {p.name}</option>)}
                </Select>
              </Field>
              <Field label="Secondary plan" optional>
                <Select value={plan2} onChange={(e) => setPlan2(e.target.value)} disabled={!isOpen || !plan}>
                  <option value="">None</option>
                  {meta?.plans.filter((p) => String(p.id) !== plan).map((p) => <option key={p.id} value={p.id}>{p.sponsor_name} — {p.name}</option>)}
                </Select>
              </Field>
              <Button size="sm" variant="primary" disabled={!plan || !isOpen || !can('connect_disconnect_tpa') || bill.bill_type === 'P'} loading={pending}
                onClick={() => patch({ insurance: 'connect', planId: Number(plan), secondaryPlanId: plan2 ? Number(plan2) : null }, 'Insurance connected')}>Connect insurance</Button>
              {bill.bill_type === 'P' && <p className="text-[12.5px] text-ink-mute">Change to Bill Later first — Bill Now bills are self-pay.</p>}
            </div>
          )}
        </section>

        <section>
          <Field label="Bill remarks" optional>
            <Textarea rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </Field>
          <Button size="sm" className="mt-2" disabled={remarks === (bill.remarks || '')} loading={pending} onClick={() => patch({ remarks }, 'Remarks saved')}>Save remarks</Button>
        </section>
      </div>
    </Drawer>
  );
}
