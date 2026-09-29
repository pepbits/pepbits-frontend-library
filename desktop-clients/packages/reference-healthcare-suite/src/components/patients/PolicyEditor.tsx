'use client';
import {LocalizedText} from '@pepbits/ops-ui';
import clsx from 'clsx';
import { Plus, ShieldCheck, Star, Trash2 } from 'lucide-react';
import { useLookup } from '../../lib/lookups';
import { addDays, todayIso, useFormat } from '../../lib/format';
import { Row } from '../../lib/types';
import { RefSelect } from '../masters/RefSelect';
import { Button, Field, Input, Select , DateInput} from '../ui/controls';
import { Badge } from '../ui/display';

export const blankPolicy = (primary: boolean): Row => ({
  payerId: '', tpaId: '', planId: '', networkId: '', memberId: '', policyNo: '', validFrom: todayIso(), validTo: addDays(todayIso(), 364), relation: 'Self', isPrimary: primary, status: 'Active',
});

function NetworkTerms({ networkId, planId }: { networkId: string; planId: string }) {
  const { money } = useFormat();
  const { options } = useLookup('networks', planId ? { planId } : null);
  const n = options.find((o) => o.value === networkId)?.meta;
  if (!n) return <p className="text-hc-2xs text-hc-ink-faint"><LocalizedText message="Pick a network to see cost sharing" /></p>;
  return (
    <div className="hc-num flex flex-wrap gap-x-4 gap-y-1 text-hc-2xs text-hc-ink-soft">
      <span><LocalizedText message="Co-pay" /> <b className="text-hc-ink">{n.copayPct}%</b></span>
      <span><LocalizedText message="Deductible" /> <b className="text-hc-ink">{money(n.deductible)}</b></span>
      <span><LocalizedText message="Cap/visit" /> <b className="text-hc-ink">{Number(n.maxCopayPerVisit) ? money(n.maxCopayPerVisit) : <LocalizedText message="None"/>}</b></span>
      <span><LocalizedText message="Prior approval above" /> <b className="text-hc-ink">{money(n.priorAuthLimit)}</b></span>
      <span><LocalizedText message="Contract" /> <b className="text-hc-ink">{n.priceListName}</b></span>
    </div>
  );
}

/**
 * Payer, then plan (filtered by payer; TPA follows the plan), then network (filtered by plan).
 * Server errors arrive as policies.{index}.{field}.
 */
export function PolicyEditor({ value, onChange, errors = {} }: { value: Row[]; onChange: (p: Row[]) => void; errors?: Record<string, string> }) {
  const set = (i: number, patch: Row) => onChange(value.map((p, j) => (j === i ? { ...p, ...patch } : patch.isPrimary ? { ...p, isPrimary: false } : p)));
  const remove = (i: number) => {
    const next = value.filter((_, j) => j !== i);
    if (value[i].isPrimary && next.length) next[0] = { ...next[0], isPrimary: true };
    onChange(next);
  };
  const err = (i: number, f: string) => errors[`policies.${i}.${f}`];

  return (
    <div className="space-y-2">
      {value.length === 0 && (
        <div className="flex items-center justify-between rounded-md border border-dashed border-hc-selfpay-100 bg-hc-selfpay-50/60 px-3 py-2.5 text-hc-xs text-hc-selfpay-700">
          <span><LocalizedText message="No insurance on file. The patient will be treated as self-pay." /></span>
        </div>
      )}
      {value.map((p, i) => (
        <div key={p.id ?? `new-${i}`} className={clsx('rounded-md border bg-hc-surface', p.isPrimary ? 'border-hc-petrol-200' : 'border-hc-line')}>
          <div className="flex items-center justify-between gap-2 border-b border-hc-line px-3 py-1.5">
            <div className="flex items-center gap-2 text-hc-xs font-medium">
              <ShieldCheck className="h-3.5 w-3.5 text-hc-petrol-600" /><LocalizedText message="Policy {number}" values={{number:i+1}}/>
              {p.isPrimary ? <Badge tone="petrol"><LocalizedText message="Primary" /></Badge> : (
                <button type="button" onClick={() => set(i, { isPrimary: true })} className="inline-flex items-center gap-1 text-hc-2xs text-hc-ink-mute hover:text-hc-petrol-700"><Star className="h-3 w-3" /><LocalizedText message="Make primary" /></button>
              )}
              {p.id && <span className="font-mono text-hc-2xs text-hc-ink-faint">{p.id}</span>}
              {p.isExpired && <Badge tone="danger"><LocalizedText message="Expired" /></Badge>}
            </div>
            <Button size="xs" variant="ghost" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => remove(i)} aria-label="Remove policy" title="Remove policy" />
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 p-3 lg:grid-cols-4">
            <Field label="Payer" required error={err(i, 'payerId')}>
              <RefSelect entity="payers" value={p.payerId} invalid={!!err(i, 'payerId')} onChange={(v) => set(i, { payerId: v, planId: '', tpaId: '', networkId: '' })} />
            </Field>
            <Field label="Plan" required error={err(i, 'planId')}>
              <RefSelect entity="insurance-plans" params={p.payerId ? { payerId: p.payerId } : null} waitingFor="payer" value={p.planId} invalid={!!err(i, 'planId')}
                onChange={(v, o) => set(i, { planId: v, tpaId: o?.meta?.tpaId ?? '', networkId: '' })} />
            </Field>
            <Field label="TPA" hint="Set by the plan">
              <RefSelect entity="tpas" value={p.tpaId} disabled onChange={() => undefined} placeholder="Follows plan" />
            </Field>
            <Field label="Network" required error={err(i, 'networkId')}>
              <RefSelect entity="networks" params={p.planId ? { planId: p.planId } : null} waitingFor="plan" value={p.networkId} invalid={!!err(i, 'networkId')} onChange={(v) => set(i, { networkId: v })} />
            </Field>
            <Field label="Member ID" required error={err(i, 'memberId')}><Input value={p.memberId} invalid={!!err(i, 'memberId')} onChange={(e) => set(i, { memberId: e.target.value })} className="font-mono" /></Field>
            <Field label="Policy no."><Input value={p.policyNo} onChange={(e) => set(i, { policyNo: e.target.value })} className="font-mono" /></Field>
            <Field label="Valid from" required error={err(i, 'validFrom')}><DateInput value={p.validFrom} invalid={!!err(i, 'validFrom')} onChange={(e) => set(i, { validFrom: e.target.value })} /></Field>
            <Field label="Valid to" required error={err(i, 'validTo')}><DateInput value={p.validTo} invalid={!!err(i, 'validTo')} onChange={(e) => set(i, { validTo: e.target.value })} /></Field>
            <Field label="Relation to holder"><Select options={['Self', 'Spouse', 'Child', 'Parent', 'Other']} value={p.relation} onChange={(v) => set(i, { relation: v })} /></Field>
            <div className="col-span-2 flex items-end pb-1.5 lg:col-span-3"><NetworkTerms networkId={p.networkId} planId={p.planId} /></div>
          </div>
        </div>
      ))}
      <Button mutation size="sm" variant="subtle" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => onChange([...value, blankPolicy(value.length === 0)])}><LocalizedText message="Add insurance policy" /></Button>
    </div>
  );
}
