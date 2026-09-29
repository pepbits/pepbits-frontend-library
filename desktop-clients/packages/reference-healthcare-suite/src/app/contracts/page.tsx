'use client';
import {useLocalization as useHealthcareLocalization} from '@pepbits/ops-ui';
import {useLocalization} from '@pepbits/ops-ui';
import {LocalizedText} from '@pepbits/ops-ui';
import {Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableContainer} from '@pepbits/ops-ui';
import clsx from 'clsx';
import { FileSignature, RotateCcw, Save } from 'lucide-react';
import { ReferenceLink as Link } from '@pepbits/reference-host';
import { useReferenceRouter, useReferenceSearchParams } from '@pepbits/reference-host';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { RefSelect } from '../../components/masters/RefSelect';
import { Button, Checkbox, FilterChips, SearchInput, Segmented, Input } from '../../components/ui/controls';
import { Badge, EmptyState, ErrorBanner, Spinner } from '../../components/ui/display';
import { useToast } from '../../components/ui/Toast';
import { useApiClient, errorMessage, qs } from '../../lib/api';
import { useFormat } from '../../lib/format';
import { useApi } from '../../lib/hooks';
import { usePageHeader } from '../../lib/session';
import { Row } from '../../lib/types';

interface Line { code: string; name: string; kind: 'item' | 'service'; category: string; basePrice: number; defaultPrice: number; hasContractLine: boolean; price: number | null; covered: boolean; priorAuth: boolean }
type Edit = { price: string; covered: boolean; priorAuth: boolean };

function Contracts() {
 const {t:healthcareT}=useHealthcareLocalization();
 const {t}=useLocalization();
  const api = useApiClient();
  const { fmtDate, money } = useFormat();
  usePageHeader(healthcareT("Contract pricing"), healthcareT("Per-contract prices, coverage and prior approval rules for every item and service"));
  const sp = useReferenceSearchParams();
  const router = useReferenceRouter();
  const toast = useToast();
  const [priceListId, setPriceListId] = useState(sp.get('priceListId') ?? 'PL-GSI');
  const [kind, setKind] = useState<'all' | 'item' | 'service'>('all');
  const [search, setSearch] = useState('');
  const [show, setShow] = useState<'All' | 'Contracted' | 'Excluded' | 'PA'>('All');
  const { data, loading, error, reload } = useApi<{ priceList: Row; rows: Line[] }>(priceListId ? `/contracts/${priceListId}/lines${qs({ kind })}` : null);
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => setEdits({}), [priceListId]);

  const cur = (l: Line): Edit => edits[l.code] ?? { price: l.price === null ? '' : String(l.price), covered: l.covered, priorAuth: l.priorAuth };
  const changed = (l: Line) => { const e = edits[l.code]; return !!e && (e.price !== (l.price === null ? '' : String(l.price)) || e.covered !== l.covered || e.priorAuth !== l.priorAuth); };
  const set = (l: Line, p: Partial<Edit>) => setEdits((x) => ({ ...x, [l.code]: { ...cur(l), ...p } }));
  const dirty = (data?.rows ?? []).filter(changed);

  const rows = useMemo(() => (data?.rows ?? []).filter((l) => {
    const t = search.toLowerCase();
    if (t && !`${l.code} ${l.name} ${l.category}`.toLowerCase().includes(t)) return false;
    const e = cur(l);
    if (show === 'Contracted') return e.price !== '' || !e.covered || e.priorAuth;
    if (show === 'Excluded') return !e.covered;
    if (show === 'PA') return e.priorAuth;
    return true;
  }), [data, search, show, edits]); // eslint-disable-hc-line react-hooks/exhaustive-deps

  const save = async () => {
    setSaving(true);
    try {
      const lines = dirty.map((l) => { const e = cur(l); const blank = e.price.trim() === ''; return { code: l.code, price: blank ? (e.covered && !e.priorAuth ? null : l.defaultPrice) : Number(e.price), covered: e.covered, priorAuth: e.priorAuth }; });
      const r = await api<{ changed: number }>(`/contracts/${priceListId}/lines`, { method: 'PUT', body: { lines } });
      toast({ tone: 'ok', title: healthcareT("{v0} contract line{v1} saved",{v0:r.changed,v1:r.changed === 1 ? '' : 's'}), body: healthcareT("New orders use these prices immediately.") });
      setEdits({}); reload();
    } catch (e) { toast({ tone: 'danger', title: healthcareT("Could not save pricing"), body: errorMessage(e) }); }
    finally { setSaving(false); }
  };

  const pl = data?.priceList;
  return (
    <div className="hc-panel flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-hc-line px-3 py-2">
        <div className="w-64"><RefSelect entity="price-lists" value={priceListId} onChange={(v) => { if (dirty.length && !confirm('Discard unsaved price changes?')) return; setPriceListId(v); router.replace(`/contracts?priceListId=${v}`); }} placeholder="Choose a contract" /></div>
        {pl && (
          <span className="flex items-center gap-2 text-hc-xs text-hc-ink-mute">
            <Badge tone={pl.contractType === 'Cash' ? 'selfpay' : 'petrol'}>{pl.contractType}</Badge>
            {fmtDate(pl.validFrom)} <LocalizedText message="to" /> {fmtDate(pl.validTo)} <LocalizedText message="· default discount" /> {pl.defaultDiscountPct}%
            <Link href={`/masters/price-lists?open=${pl.id}`} className="text-hc-petrol-700 hover:underline"><LocalizedText message="Contract terms" /></Link>
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {dirty.length > 0 && <span className="text-hc-xs font-medium text-hc-warn-700">{dirty.length} <LocalizedText message="unsaved" /></span>}
          <Button size="sm" variant="ghost" icon={<RotateCcw className="h-3.5 w-3.5" />} disabled={!dirty.length} onClick={() => setEdits({})}><LocalizedText message="Discard" /></Button>
          <Button mutation size="sm" variant="primary" icon={<Save className="h-3.5 w-3.5" />} disabled={!dirty.length} loading={saving} onClick={save}><LocalizedText message="Save pricing" /></Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-hc-line px-3 py-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Code, name or category" className="w-64" />
        <Segmented size="sm" value={kind} onChange={setKind} options={[{ value: 'all', label: 'All' }, { value: 'service', label: 'Services' }, { value: 'item', label: 'Items' }]} />
        <FilterChips value={show} onChange={setShow} options={[{ value: 'All', label: 'Everything' }, { value: 'Contracted', label: 'Has contract line' }, { value: 'Excluded', label: 'Not covered' }, { value: 'PA', label: 'Needs prior approval' }]} />
        <span className="ml-auto text-hc-2xs text-hc-ink-mute"><LocalizedText message="Leave the price blank to use the default (base price less the contract discount)." /></span>
      </div>
      {error && <div className="p-3"><ErrorBanner message={error.message} onRetry={reload} /></div>}
      {!data ? (loading ? <div className="flex flex-1 items-center justify-center"><Spinner label="Loading contract" /></div> : <EmptyState icon={<FileSignature className="h-8 w-8" />} title="Choose a contract" />) : (
        <TableContainer className="min-h-0 flex-1 overflow-auto">
          <Table className="w-full border-separate border-spacing-0 text-hc-sm">
            <TableHeader className="sticky top-0 z-10 bg-[#F6F8F7] text-hc-xs text-hc-ink-mute">
              <TableRow className="[&>th]:h-8 [&>th]:border-b [&>th]:border-hc-line [&>th]:px-3 [&>th]:font-medium">
                <TableHead className="text-left"><LocalizedText message="Code" /></TableHead><TableHead className="text-left"><LocalizedText message="Name" /></TableHead><TableHead className="text-left"><LocalizedText message="Category" /></TableHead><TableHead className="text-right"><LocalizedText message="Base" /></TableHead><TableHead className="text-right"><LocalizedText message="Default" /></TableHead>
                <TableHead className="w-32 text-right"><LocalizedText message="Contract price" /></TableHead><TableHead className="text-right"><LocalizedText message="Discount" /></TableHead><TableHead className="text-center"><LocalizedText message="Covered" /></TableHead><TableHead className="text-center"><LocalizedText message="Prior approval" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((l) => {
                const e = cur(l);
                const eff = e.price === '' ? l.defaultPrice : Number(e.price);
                const disc = l.basePrice ? Math.round((1 - eff / l.basePrice) * 1000) / 10 : 0;
                return (
                  <TableRow key={l.code} className={clsx('[&>td]:h-9 [&>td]:border-b [&>td]:border-hc-line/70 [&>td]:px-3', changed(l) ? 'bg-hc-warn-50/60' : 'hover:bg-[#F6F8F7]', !e.covered && 'text-hc-ink-mute')}>
                    <TableCell className="font-mono text-hc-xs">{l.code}</TableCell>
                    <TableCell className="font-medium">{l.name}</TableCell>
                    <TableCell><Badge tone={l.kind === 'item' ? 'selfpay' : 'petrol'}>{l.category}</Badge></TableCell>
                    <TableCell className="hc-num text-right text-hc-ink-mute">{money(l.basePrice)}</TableCell>
                    <TableCell className="hc-num text-right text-hc-ink-mute">{money(l.defaultPrice)}</TableCell>
                    <TableCell className="text-right">
                      <Input aria-label={t("Contract price for {v0}",{v0:l.name})} type="number" min={0} step="0.01" value={e.price} placeholder={money(l.defaultPrice)} onChange={(ev) => set(l, { price: ev.target.value })}
                        className="hc-num h-7 w-28 rounded border border-hc-line-strong bg-hc-surface px-2 text-right text-hc-sm placeholder:text-hc-ink-faint focus:border-hc-petrol-500 focus:outline-none focus:ring-2 focus:ring-hc-petrol-100" />
                    </TableCell>
                    <TableCell className={clsx('hc-num text-right text-hc-xs', disc < 0 ? 'text-hc-danger-600' : 'text-hc-ink-mute')}>{disc}%</TableCell>
                    <TableCell className="text-center"><Checkbox checked={e.covered} onChange={(v) => set(l, { covered: v })} className="justify-center" /></TableCell>
                    <TableCell className="text-center"><Checkbox checked={e.priorAuth} onChange={(v) => set(l, { priorAuth: v })} className="justify-center" /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {rows.length === 0 && <EmptyState title="No lines match" />}
        </TableContainer>
      )}
    </div>
  );
}

export default function ContractsPage() { return <Suspense><Contracts /></Suspense>; }
