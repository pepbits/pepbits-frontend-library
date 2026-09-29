'use client';
import {LocalizedText} from '@pepbits/ops-ui';
import { AlertTriangle, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { useFormat } from '../../lib/format';
import { Quote } from '../../lib/types';
import { Button, Field, Input, Select } from '../ui/controls';
import { Badge } from '../ui/display';

const FREQ = ['Once daily', 'Twice daily', 'Three times daily', 'Four times daily', 'At night', 'As needed', 'Every 2 weeks', 'Once'];
const ROUTES = ['Oral', 'Subcutaneous', 'Intramuscular', 'Intravenous', 'Topical', 'Inhaled'];
// Simple cross-sensitivity hints for the demo; a real system would use a drug knowledge base.
const CROSS: Record<string, string[]> = { penicillin: ['amox', 'augmentin', 'ampicillin', 'penicillin', 'cloxacillin'], nsaid: ['ibuprofen', 'brufen', 'diclofenac', 'voltaren', 'naproxen'], sulfa: ['sulfameth', 'septrin'] };

export function allergyHit(allergies: string, name: string) {
  const a = allergies.toLowerCase(); const n = name.toLowerCase();
  if (!a.trim()) return null;
  for (const [k, drugs] of Object.entries(CROSS)) if (a.includes(k) && drugs.some((d) => n.includes(d))) return k;
  return a.split(/[,;]/).map((s) => s.trim()).find((s) => s && n.includes(s)) ?? null;
}

export interface Dosing { qty: number; dosage: string; frequency: string; durationDays: number; route: string; instructions: string }

export function DrugDosing({ quote, allergies, onAdd, onCancel, adding }: { quote: Quote; allergies: string; onAdd: (d: Dosing) => void; onCancel: () => void; adding: boolean }) {
  const { money } = useFormat();
  const inj = /pen|injection|syringe/i.test(quote.name);
  const [d, setD] = useState<Dosing>({ qty: 1, dosage: inj ? '1 pen' : '1 tablet', frequency: inj ? 'Every 2 weeks' : 'Twice daily', durationDays: inj ? 28 : 5, route: inj ? 'Subcutaneous' : 'Oral', instructions: '' });
  const hit = allergyHit(allergies, quote.name);
  const set = (p: Partial<Dosing>) => setD({ ...d, ...p });
  return (
    <div className="border-b border-hc-line bg-hc-info-50/40 px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-hc-sm font-medium">{quote.name}
          {quote.erxRequired && <Badge tone="info"><LocalizedText message="eRx required" /></Badge>}
          <span className="hc-num text-hc-xs font-normal text-hc-ink-mute">{money(quote.unitPrice)} <LocalizedText message="per" /> {quote.uom.toLowerCase()} · {quote.stockQty} <LocalizedText message="in stock" /></span>
        </p>
        <Button size="xs" variant="ghost" icon={<X className="h-3.5 w-3.5" />} onClick={onCancel} aria-label="Cancel" />
      </div>
      {hit && <p className="mb-2 flex items-center gap-1.5 rounded bg-hc-danger-50 px-2.5 py-1.5 text-hc-xs font-medium text-hc-danger-700"><AlertTriangle className="h-3.5 w-3.5" /><LocalizedText message="Allergy alert: patient is allergic to {allergies}. Confirm before adding." values={{allergies}} /></p>}
      <div className="grid grid-cols-3 gap-2 lg:grid-cols-7" onKeyDown={(e) => e.key === 'Enter' && onAdd(d)}>
        <Field label="Qty"><Input type="number" min={1} value={d.qty} onChange={(e) => set({ qty: Number(e.target.value) })} className="hc-num" autoFocus /></Field>
        <Field label="Dose" required><Input value={d.dosage} onChange={(e) => set({ dosage: e.target.value })} /></Field>
        <Field label="Frequency" required><Select options={FREQ} value={d.frequency} onChange={(v) => set({ frequency: v })} /></Field>
        <Field label="Days"><Input type="number" min={0} value={d.durationDays} onChange={(e) => set({ durationDays: Number(e.target.value) })} className="hc-num" /></Field>
        <Field label="Route"><Select options={ROUTES} value={d.route} onChange={(v) => set({ route: v })} /></Field>
        <Field label="Instructions"><Input value={d.instructions} onChange={(e) => set({ instructions: e.target.value })} placeholder="e.g. after food" /></Field>
        <div className="flex items-end"><Button variant={hit ? 'danger' : 'primary'} className="w-full" icon={<Plus className="h-3.5 w-3.5" />} loading={adding} disabled={!d.dosage || !d.frequency || d.qty < 1} onClick={() => onAdd(d)}>{hit ? <LocalizedText message="Add anyway"/> : <LocalizedText message="Add"/>}</Button></div>
      </div>
    </div>
  );
}
