'use client';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import {ReferenceLink as Link} from '@pepbits/reference-host';
import {useReferenceSearchParams as useSearchParams} from '@pepbits/reference-host';
import { useState } from 'react';
import { PackagePlus } from 'lucide-react';

import { useFilters, useList } from '../../../lib/hooks';
import {titleCase} from '../../../lib/format';
import { Badge, Button, ErrorBanner, Field, Input, Modal, PageHeader, Select, Tabs, cx, useToast , DateInput} from '../../../components/ui';
import { FilterBar, FilterItem, PagedTable, SearchBox } from '../../../components/table';
import { RefSelect } from '../../../components/refselect';
import { can, useUser } from '../../../components/shell';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export default function InventoryPage() {
 const referenceT = useReferenceLocalization().t;

 const {post}=useDiagnosticClient();
 const {fmtDate,fmtDateTime}=useDiagnosticFormat();

  const sp = useSearchParams();
  const user = useUser();
  const toast = useToast();
  const [tab, setTab] = useState<'stock' | 'tx'>('stock');
  const [f, set] = useFilters({ q: '', analyzerId: '', low: sp.get('low') || '', pageSize: 25 });
  const stock = useList('/inventory/reagents', f);
  const [tf, tset] = useFilters({ reagentId: '', type: '', pageSize: 50 });
  const tx = useList(tab === 'tx' ? '/inventory/transactions' : null, tf);
  const [mv, setMv] = useState<any>(null);
  const [form, setForm] = useState({ type: 'RECEIPT', qty: '', lotNo: '', expiryDate: '', note: '' });
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try { await post('/inventory/transactions', { reagentId: mv.id, qty: Number(form.qty), type: form.type, lotNo: form.lotNo || undefined, expiryDate: form.expiryDate || undefined, note: form.note || undefined }); toast.ok('Stock updated.'); setMv(null); stock.reload(); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <>
      <PageHeader title={referenceT("Reagent stock")} subtitle={referenceT("Stock is reduced automatically when results are validated, using the reagent-per-test quantities in master data.")}
        actions={<Link href="/masters/reagents"><Button><ReferenceText message="Manage reagents" /></Button></Link>} />
      <Tabs className="mb-3" value={tab} onChange={setTab} tabs={[{ value: 'stock', label: 'Stock on hand' }, { value: 'tx', label: 'Movements' }]} />
      {tab === 'stock' && <>
        <ErrorBanner error={stock.error} onRetry={stock.reload} />
        <div className="panel">
          <FilterBar>
            <SearchBox className="w-64" value={f.q} onChange={(q) => set({ q })} placeholder={referenceT("Code, name or item code")} />
            <FilterItem label={referenceT("Analyzer")}><RefSelect entity="analyzers" className="w-48" value={f.analyzerId} onChange={(analyzerId) => set({ analyzerId })} /></FilterItem>
            <FilterItem label={referenceT("Stock")}><Select className="w-40" value={f.low} onChange={(low) => set({ low })} placeholder={referenceT("All")} options={[{ value: '1', label: 'At or below reorder' }]} /></FilterItem>
          </FilterBar>
          <PagedTable result={stock.data} loading={stock.loading} page={f.page} pageSize={f.pageSize} onPage={(page) => set({ page })} empty="No reagents" columns={[
            { key: 'name', header: 'Reagent', render: (r: any) => <div><div className="font-medium">{r.name}</div><div className="text-2xs text-ink-soft">{r.code}<ReferenceText message=", item" /> {r.item_code}</div></div> },
            { key: 'analyzer', header: 'Analyzer' }, { key: 'tests', header: 'Used by', className: 'text-xs' },
            { key: 'stock', header: 'On hand', render: (r: any) => {
              const ratio = r.reorder_level ? r.stock_qty / (r.reorder_level * 4) : 1;
              const low = r.stock_qty <= r.reorder_level;
              return <div className="w-40"><div className={cx('text-sm tnum', low && 'font-semibold text-crit')}>{r.stock_qty} {r.uom} {low && <Badge tone="crit"><ReferenceText message="Reorder" /></Badge>}</div>
                <div className="mt-1 h-1.5 overflow-hidden rounded bg-line"><div className={cx('h-full', low ? 'bg-crit' : 'bg-hema-500')} style={{ width: `${Math.min(100, ratio * 100)}%` }} /></div></div>;
            } },
            { key: 'reorder_level', header: 'Reorder at', align: 'right' },
            { key: 'used_30d', header: 'Used, 30 days', align: 'right' },
            { key: 'next_expiry', header: 'Next lot expiry', render: (r: any) => r.next_expiry ? <span className={cx(new Date(r.next_expiry) < new Date(Date.now() + 30 * 864e5) && 'text-high')}>{fmtDate(r.next_expiry)}</span> : <span className="text-ink-faint"><ReferenceText message="No lots" /></span> },
            { key: 'act', header: '', render: (r: any) => can(user, 'TECHNOLOGIST', 'PATHOLOGIST') && <Button size="sm" icon={<PackagePlus className="h-3.5 w-3.5" />} onClick={() => { setMv(r); setForm({ type: 'RECEIPT', qty: '', lotNo: '', expiryDate: '', note: '' }); }}><ReferenceText message="Stock movement" /></Button> },
          ]} />
        </div>
      </>}
      {tab === 'tx' && (
        <div className="panel">
          <FilterBar>
            <FilterItem label={referenceT("Reagent")}><RefSelect entity="reagents" className="w-60" value={tf.reagentId} onChange={(reagentId) => tset({ reagentId })} /></FilterItem>
            <FilterItem label={referenceT("Type")}><Select className="w-36" value={tf.type} onChange={(type) => tset({ type })} placeholder={referenceT("Any")} options={['CONSUMPTION', 'RECEIPT', 'ADJUSTMENT', 'WASTAGE', 'RETURN']} /></FilterItem>
          </FilterBar>
          <PagedTable result={tx.data} loading={tx.loading} page={tf.page} pageSize={tf.pageSize} onPage={(page) => tset({ page })} dense empty="No movements" columns={[
            { key: 'at', header: 'When', render: (r: any) => fmtDateTime(r.at) }, { key: 'reagent', header: 'Reagent', render: (r: any) => `${r.code} ${r.name}` },
            { key: 'type', header: 'Type', render: (r: any) => titleCase(r.type) }, { key: 'qty', header: 'Quantity', align: 'right', render: (r: any) => <span className={r.qty < 0 ? 'text-crit' : 'text-ok'}>{r.qty > 0 ? '+' : ''}{r.qty}</span> },
            { key: 'order_no', header: 'Order', className: 'tnum text-xs' }, { key: 'note', header: 'Note' }, { key: 'user', header: 'By', render: (r: any) => r.user || 'System' },
          ]} />
        </div>
      )}
      <Modal open={!!mv} onClose={() => setMv(null)} title={referenceT("Stock movement: {value0}", {value0: mv?.name})}
        footer={<><Button onClick={() => setMv(null)}><ReferenceText message="Cancel" /></Button><Button variant="primary" loading={busy} disabled={!form.qty} onClick={submit}><ReferenceText message="Record movement" /></Button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={referenceT("Type")}><Select value={form.type} onChange={(type) => setForm({ ...form, type })} options={['RECEIPT', 'ADJUSTMENT', 'WASTAGE', 'RETURN']} /></Field>
          <Field label={referenceT("Quantity ({value0})", {value0: mv?.uom || 'units'})} hint={form.type === 'ADJUSTMENT' ? 'Negative to reduce' : undefined}><Input type="number" autoFocus value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} /></Field>
          {form.type === 'RECEIPT' && <>
            <Field label={referenceT("Lot number")}><Input value={form.lotNo} onChange={(e) => setForm({ ...form, lotNo: e.target.value })} /></Field>
            <Field label={referenceT("Lot expiry")}><DateInput  value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} /></Field>
          </>}
          <Field label={referenceT("Note")} className="sm:col-span-2"><Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder={referenceT("GRN number, reason for adjustment…")} /></Field>
        </div>
      </Modal>
    </>
  );
}
