'use client';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import {ReferenceLink as Link} from '@pepbits/reference-host';
import {useReferenceSearchParams as useSearchParams} from '@pepbits/reference-host';
import { useEffect, useMemo, useState } from 'react';
import { Printer, Syringe } from 'lucide-react';

import { useFilters, useList } from '../../../lib/hooks';
import { ago, age, fullName } from '../../../lib/format';
import { Badge, Button, Checkbox, Empty, ErrorBanner, Loading, Modal, PageHeader, Pagination, PriorityBadge, Select, cx, useToast } from '../../../components/ui';
import { FilterBar, FilterItem, SearchBox } from '../../../components/table';
import { RefSelect, useOptions } from '../../../components/refselect';
import { SpecimenLabel } from '../../../components/label';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export default function CollectionPage() {
 const referenceT = useReferenceLocalization().t;

 const {get}=useDiagnosticClient();

  const sp = useSearchParams();
  const [f, set] = useFilters({ q: sp.get('q') || '', priority: '', facilityId: '', locationId: '', pageSize: 10 });
  const { data, loading, error, reload } = useList('/samples/pending-collection', f);
  const [labels, setLabels] = useState<any[] | null>(null);
  return (
    <>
      <PageHeader title={referenceT("Sample collection")} subtitle={referenceT("Billed tests waiting to be drawn, grouped into tubes. Tests from different orders of the same patient share a tube when the specimen type and container match.")} />
      <ErrorBanner error={error} onRetry={reload} />
      <div className="panel mb-4">
        <FilterBar>
          <SearchBox className="w-72" value={f.q} onChange={(q) => set({ q })} placeholder={referenceT("Patient, MRN or order number")} autoFocus />
          <FilterItem label={referenceT("Priority")}><Select className="w-28" value={f.priority} onChange={(priority) => set({ priority })} placeholder={referenceT("Any")} options={['STAT', 'URGENT', 'ROUTINE']} /></FilterItem>
          <FilterItem label={referenceT("Ward / location")}><RefSelect entity="locations" className="w-44" value={f.locationId} onChange={(locationId) => set({ locationId })} placeholder={referenceT("Any")} /></FilterItem>
          <FilterItem label={referenceT("Client facility")}><RefSelect entity="external_facilities" className="w-44" value={f.facilityId} onChange={(facilityId) => set({ facilityId })} placeholder={referenceT("Any")} /></FilterItem>
          <span className="ml-auto self-center text-sm text-ink-soft">{data ? `${data.total} patient${data.total === 1 ? '' : 's'} waiting` : ''}</span>
        </FilterBar>
      </div>
      {loading && !data && <Loading />}
      {data && !data.data.length && <div className="panel"><Empty icon={<Syringe className="h-6 w-6" />} title={referenceT("No one is waiting for collection")}><ReferenceText message="New orders appear here once billed." /></Empty></div>}
      <div className="space-y-3">
        {data?.data.map((p: any) => <PatientCollect key={p.id} p={p} onCollected={(ls) => { setLabels(ls); reload(); }} />)}
      </div>
      {data && data.total > f.pageSize && <Pagination page={f.page} pageSize={f.pageSize} total={data.total} onPage={(page) => set({ page })} />}
      <Modal open={!!labels} onClose={() => setLabels(null)} title={referenceT("Collected. Label the tubes")} width="max-w-2xl"
        footer={labels && <><Button onClick={() => setLabels(null)}><ReferenceText message="Done" /></Button><Link href={`/print/labels?ids=${labels.map((l) => l.id).join(',')}`} target="_blank"><Button variant="primary" icon={<Printer className="h-4 w-4" />}><ReferenceText message="Print" /> {labels.length} <ReferenceText message="label" />{labels.length > 1 ? 's' : ''}</Button></Link></>}>
        <div className="flex flex-wrap gap-3">{labels?.map((l) => <SpecimenLabel key={l.id} l={l} />)}</div>
        <p className="mt-3 text-sm text-ink-soft"><ReferenceText message="Send the tubes to the laboratory. They are marked received when scanned at accession." /></p>
      </Modal>
    </>
  );
}

function PatientCollect({ p, onCollected }: { p: any; onCollected: (labels: any[]) => void }) {
 const referenceT = useReferenceLocalization().t;

 const {get,post}=useDiagnosticClient();

  const toast = useToast();
  const [sel, setSel] = useState<Set<number>>(new Set(p.items.map((i: any) => i.id)));
  const [bodySite, setBodySite] = useState('');
  const [attach, setAttach] = useState('');
  const [busy, setBusy] = useState(false);
  const {options:sites,error:lookupError} = useOptions('body_sites');
  useEffect(() => setSel(new Set(p.items.map((i: any) => i.id))), [p]);
  const groups = useMemo(() => {
    const m = new Map<string, any[]>();
    p.items.forEach((i: any) => m.set(i.group_key, [...(m.get(i.group_key) || []), i]));
    return [...m.values()];
  }, [p]);
  const needSite = p.items.some((i: any) => sel.has(i.id) && i.body_site_required && !i.body_site_id);
  const chosenTypes = new Set(p.items.filter((i: any) => sel.has(i.id)).map((i: any) => i.sample_type_id));
  const attachable = p.openSamples.filter((s: any) => chosenTypes.size === 1 && chosenTypes.has(s.sample_type_id));
  const collect = async () => {
    setBusy(true);
    try {
      const r = await post('/samples/collect', { itemIds: [...sel], bodySiteId: bodySite ? Number(bodySite) : undefined, attachToSampleId: attach ? Number(attach) : undefined });
      const labels = await Promise.all(r.samples.map((s: any) => get(`/samples/${s.id}/label`).then((l) => ({ ...l, id: s.id }))));
      toast.ok(`${r.samples.length} sample${r.samples.length > 1 ? 's' : ''} collected: ${r.samples.map((s: any) => s.sample_no).join(', ')}`);
      onCollected(labels);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <div className={cx('panel overflow-hidden', p.priority === 'STAT' && 'border-l-4 border-l-crit', p.priority === 'URGENT' && 'border-l-4 border-l-high')}>{lookupError && <p role="alert">{lookupError}</p>}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-2.5">
        <Link href={`/patients/${p.id}`} className="font-semibold hover:underline">{fullName(p)}</Link>
        <span className="text-sm text-ink-soft tnum">{p.mrn}, {[age(p.dob), p.gender].filter(Boolean).join(' ')}</span>
        <PriorityBadge priority={p.priority} />
        <span className="text-xs text-ink-faint"><ReferenceText message="waiting since" /> {ago(p.oldest)}</span>
      </div>
      <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((g, gi) => (
          <div key={gi} className="rounded-md border border-line">
            <div className="flex items-center gap-2 border-b border-line bg-paper px-3 py-1.5 text-sm">
              <span className="h-3.5 w-3.5 rounded-full border border-black/20" style={{ background: g[0].cap_color || '#ccc' }} aria-hidden />
              <span className="font-medium">{g[0].container || 'Container'}</span><span className="text-ink-soft">{g[0].sample_type}</span>
              {g[0].body_site && <Badge>{g[0].body_site}</Badge>}
              <span className="ml-auto text-2xs text-ink-faint"><ReferenceText message="Tube" /> {gi + 1}</span>
            </div>
            <ul className="px-3 py-1.5">
              {g.map((i: any) => (
                <li key={i.id} className="flex items-start gap-2 py-1">
                  <Checkbox checked={sel.has(i.id)} onChange={(v) => { const s = new Set(sel); v ? s.add(i.id) : s.delete(i.id); setSel(s); }}
                    label={<span><span className="font-medium">{i.test_code}</span> <span className="text-ink-soft">{i.test_name}</span></span>} />
                  <span className="ml-auto whitespace-nowrap text-2xs text-ink-faint tnum">{i.order_no}</span>
                </li>
              ))}
              {g.some((i: any) => i.patient_preparation) && <li className="pt-1 text-2xs text-high">{g.find((i: any) => i.patient_preparation).patient_preparation}</li>}
            </ul>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3 border-t border-line bg-paper/60 px-4 py-2.5">
        {needSite && <FilterItem label={referenceT("Body site for this collection *")}><Select className="w-52" value={bodySite} onChange={setBodySite} placeholder={referenceT("Choose")} options={sites.map((s) => ({ value: s.id, label: s.label }))} /></FilterItem>}
        {attachable.length > 0 && <FilterItem label={referenceT("Add to an existing tube")}><Select className="w-60" value={attach} onChange={setAttach} placeholder={referenceT("No, use new tube(s)")} options={attachable.map((s: any) => ({ value: s.id, label: `${s.sample_no} (${s.sample_type}, ${s.status.toLowerCase()})` }))} /></FilterItem>}
        <Button variant="primary" className="ml-auto" loading={busy} disabled={!sel.size || (needSite && !bodySite)} icon={<Syringe className="h-4 w-4" />} onClick={collect}><ReferenceText message="Collect" />{sel.size} <ReferenceText message="test" />{sel.size === 1 ? '' : 's'}
        </Button>
      </div>
    </div>
  );
}
