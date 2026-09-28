'use client';
import { Table, TableContainer } from '@pepbits/ops-ui';
import { useEffect, useId, useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import type { ListResponse, PageDef, Row } from '../../lib/types';
import { cx, todayISO, useFormat } from '../../lib/format';
import { listUrl, useFetch, useRefOptions } from '../../lib/client';
import { Badge, Button, Empty, Input, Segmented, Skeleton, DateInput } from '../ui';
import { Card, Frame, Stat } from './shared';
import { useExport } from '../../lib/export';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


const PRESETS = { month: 'This month', q: 'Last 90 days', year: 'Last 12 months', all: 'All time' } as const;
type Preset = keyof typeof PRESETS | 'custom';
const presetRange = (p: Preset): [string, string] => {
  const t = todayISO();
  if (p === 'month') return [`${t.slice(0, 8)}01`, t];
  if (p === 'q') return [todayISO(-90), t];
  if (p === 'year') return [todayISO(-365), t];
  return ['2000-01-01', t];
};
const drcr = (fmtCurrency: (v: unknown) => string, v: number) => `${fmtCurrency(Math.abs(v))} ${v >= 0 ? 'Dr' : 'Cr'}`;

/** Statement for one party: opening balance, every entry with a running balance, closing balance. */
export default function LedgerTemplate({ def }: { def: PageDef }) {
 const referenceT = useReferenceLocalization().t;

  const { fmtCurrency, fmtDate } = useFormat();
  const partyF = def.fields.find((f) => f.type === 'ref')!;
  const options = useRefOptions(partyF.ref);
  const listId = useId();
  const [party, setParty] = useState('');
  const [preset, setPreset] = useState<Preset>('year');
  const [range, setRange] = useState<[string, string]>(presetRange('year'));
  const [q, setQ] = useState('');
  useEffect(() => { if (!party && options.length) setParty(options[0]); }, [options, party]);

  const { data, loading } = useFetch<ListResponse>(party ? listUrl(def.entity, { size: 5000, filters: { [partyF.key]: [party] }, sort: 'date', dir: 'asc' }) : null);
  const { opening, lines, debit, credit } = useMemo(() => {
    const all = data?.rows ?? [];
    const before = all.filter((r) => r.date < range[0]);
    const within = all.filter((r) => r.date >= range[0] && r.date <= range[1]);
    const opening = before.reduce((s, r) => s + r.debit - r.credit, 0);
    let bal = opening;
    const lines = within.map((r) => { bal += r.debit - r.credit; return { ...r, balance: bal } as Row; });
    return { opening, lines, debit: within.reduce((s, r) => s + r.debit, 0), credit: within.reduce((s, r) => s + r.credit, 0) };
  }, [data, range]);
  const closing = opening + debit - credit;
  const shown = q ? lines.filter((l) => `${l.code} ${l.narration} ${l.type}`.toLowerCase().includes(q.toLowerCase())) : lines;

  const exporter = useExport();
  const exportCSV = () => exporter.download(`ledger-${party.replace(/\W+/g, '-').toLowerCase()}.csv`, ['Date', 'Voucher', 'Type', 'Narration', 'Debit', 'Credit', 'Balance'], [
    [range[0], '', '', 'Opening balance', '', '', opening],
    ...lines.map((l) => [l.date, l.code, l.type, l.narration, l.debit, l.credit, Math.round(l.balance * 100) / 100]),
    [range[1], '', '', 'Closing balance', debit, credit, closing],
  ]);

  return (
    <Frame>
      <Card className="shrink-0">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
          <div className="w-full sm:w-72">
            <Input list={listId} value={party} onChange={(e) => setParty(e.target.value)} placeholder={referenceT("Choose {value0}", {value0: referenceT(partyF.label)})} aria-label={partyF.label} />
            <datalist id={listId}>{options.map((o) => <option key={o} value={o} />)}</datalist>
          </div>
          <Segmented size="sm" value={preset} onChange={(p) => { setPreset(p); if (p !== 'custom') setRange(presetRange(p)); }} options={[...Object.entries(PRESETS).map(([value, label]) => ({ value: value as Preset, label })), { value: 'custom' as Preset, label: 'Custom' }]} />
          {preset === 'custom' && (
            <div className="flex items-center gap-1.5">
              <DateInput value={range[0]} onChange={(e) => setRange([e.target.value, range[1]])} className="w-36" aria-label={referenceT("From")} />
              <span className="text-ink-3"><ReferenceText message="to" /></span>
              <DateInput value={range[1]} onChange={(e) => setRange([range[0], e.target.value])} className="w-36" aria-label={referenceT("To")} />
            </div>
          )}
          <span className="flex-1" />
          <div className="relative w-full sm:w-52">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={referenceT("Find an entry")} className="pl-8" />
          </div>
          <Button icon={Download} onClick={exportCSV} disabled={!lines.length} title={exporter.label}><ReferenceText message="Export" /></Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stat label={referenceT("Opening balance")} value={drcr(fmtCurrency, opening)} hint={referenceT("As on {value0}", {value0: fmtDate(range[0])})} />
        <Stat label={referenceT("Debits in period")} value={fmtCurrency(debit)} tone="brand" hint={referenceT("{value0} invoices", {value0: lines.filter((l) => l.debit).length})} />
        <Stat label={referenceT("Credits in period")} value={fmtCurrency(credit)} tone="ok" hint={referenceT("{value0} receipts and notes", {value0: lines.filter((l) => l.credit).length})} />
        <Stat label={referenceT("Closing balance")} value={drcr(fmtCurrency, closing)} tone={closing > 0 ? 'warn' : 'ok'} hint={closing > 0 ? 'Receivable from customer' : 'Advance held'} />
      </div>

      <Card className="min-h-[380px] flex-1">
        <TableContainer className="h-full overflow-auto">
          <Table className="w-full min-w-[760px] border-separate border-spacing-0 text-[length:calc(13px*var(--fs-scale))]">
            <thead className="sticky top-0 z-10">
              <tr className="text-[length:calc(12px*var(--fs-scale))] text-ink-2">
                {['Date', 'Voucher', 'Type', 'Narration'].map((h) => <th key={h} className="border-b border-line bg-surface-2 px-3 py-2 text-left font-medium">{h}</th>)}
                {['Debit', 'Credit', 'Balance'].map((h) => <th key={h} className="w-36 border-b border-line bg-surface-2 px-3 py-2 text-right font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr className="bg-surface-2/60 font-medium">
                <td className="border-b border-line px-3 py-2 tnum">{fmtDate(range[0])}</td>
                <td colSpan={3} className="border-b border-line px-3 py-2"><ReferenceText message="Opening balance" /></td>
                <td className="border-b border-line" /><td className="border-b border-line" />
                <td className="border-b border-line px-3 py-2 text-right tnum">{drcr(fmtCurrency, opening)}</td>
              </tr>
              {loading && Array.from({ length: 8 }, (_, i) => <tr key={i}>{Array.from({ length: 7 }, (__, j) => <td key={j} className="border-b border-line px-3 py-2.5"><Skeleton className="w-20" /></td>)}</tr>)}
              {!loading && shown.map((l) => (
                <tr key={l.id} className="hover:bg-surface-2">
                  <td className="border-b border-line px-3 py-[7px] text-ink-2 tnum">{fmtDate(l.date)}</td>
                  <td className="border-b border-line px-3 font-medium text-brand-ink tnum">{l.code}</td>
                  <td className="border-b border-line px-3"><Badge tone={l.type === 'Invoice' ? 'info' : l.type === 'Receipt' ? 'ok' : 'violet'}>{l.type}</Badge></td>
                  <td className="max-w-[320px] truncate border-b border-line px-3 text-ink-2">{l.narration}</td>
                  <td className="border-b border-line px-3 text-right tnum">{l.debit ? fmtCurrency(l.debit) : ''}</td>
                  <td className="border-b border-line px-3 text-right tnum">{l.credit ? fmtCurrency(l.credit) : ''}</td>
                  <td className={cx('border-b border-line px-3 text-right font-medium tnum', l.balance < 0 && 'text-ok')}>{drcr(fmtCurrency, l.balance)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0">
              <tr className="font-semibold">
                <td className="border-t-2 border-line-strong bg-surface-2 px-3 py-2 tnum">{fmtDate(range[1])}</td>
                <td colSpan={3} className="border-t-2 border-line-strong bg-surface-2 px-3 py-2"><ReferenceText message="Closing balance (" />{lines.length} <ReferenceText message="entries)" /></td>
                <td className="border-t-2 border-line-strong bg-surface-2 px-3 py-2 text-right tnum">{fmtCurrency(debit)}</td>
                <td className="border-t-2 border-line-strong bg-surface-2 px-3 py-2 text-right tnum">{fmtCurrency(credit)}</td>
                <td className="border-t-2 border-line-strong bg-surface-2 px-3 py-2 text-right tnum">{drcr(fmtCurrency, closing)}</td>
              </tr>
            </tfoot>
          </Table>
          {!loading && data && !lines.length && <Empty title={referenceT("No entries in this period")} body="Widen the date range or pick another customer." />}
        </TableContainer>
      </Card>
    </Frame>
  );
}
