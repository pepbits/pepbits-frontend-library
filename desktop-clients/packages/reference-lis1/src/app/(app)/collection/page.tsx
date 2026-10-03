'use client';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import { useEffect, useState } from 'react';
import {useReferenceSearchParams as useSearchParams} from '@pepbits/reference-host';
import { Printer, RefreshCw, Search, Syringe } from 'lucide-react';

import { useApi, useDebounced } from '../../../lib/hooks';
import { dueIn } from '../../../lib/format';
import { Badge, Button, Card, Checkbox, Empty, ErrorNote, Input, Loading, Modal, PageHeader, Select, TubeChip, useAction } from '../../../components/ui';
import { SampleLabel } from '../../../components/SampleLabel';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


/** One patient's pending tubes. Tests sharing sample type + container are drawn into one tube. */
function PatientGroup({ g, onCollected }: { g: any; onCollected: (samples: any[]) => void }) {
 const referenceT = useReferenceLocalization().t;

 const {api}=useDiagnosticClient();

  const allIds = g.tubes.flatMap((t: any) => t.tests.map((x: any) => x.id));
  const [sel, setSel] = useState<number[]>(allIds);
  const [attach, setAttach] = useState<Record<string, string>>({});
  const { data: existing } = useApi<any[]>('/samples', { patientId: g.patient.id });
  const { busy, run } = useAction();
  const open = (existing || []).filter((s) => ['COLLECTED', 'ACCESSIONED', 'IN_PROCESS'].includes(s.status));

  const collect = async () => {
    const samples: any[] = [];
    const newIds: number[] = [];
    for (const tube of g.tubes) {
      const ids = tube.tests.map((t: any) => t.id).filter((id: number) => sel.includes(id));
      if (!ids.length) continue;
      if (attach[tube.key]) {
        const r = await run('c', () => api.post('/samples/collect', { orderTestIds: ids, attachToSampleId: Number(attach[tube.key]) }));
        if (!r) return;
        samples.push(...(r as any[]));
      } else newIds.push(...ids);
    }
    if (newIds.length) {
      const r = await run('c', () => api.post('/samples/collect', { orderTestIds: newIds }));
      if (!r) return;
      samples.push(...(r as any[]));
    }
    if (samples.length) onCollected(samples);
  };

  return (
    <Card className={g.stat ? 'border-flag-crit/40' : ''}
      title={<span className="flex items-center gap-2">{g.patient.fullName} <span className="font-mono text-xs font-normal text-ink-soft">{g.patient.mrn}</span> <span className="text-xs font-normal text-ink-soft">{g.patient.gender} · {g.patient.age}</span>{g.stat && <Badge value="STAT" />}</span>}
      actions={<Button variant="primary" size="sm" icon={Syringe} loading={busy === 'c'} disabled={!sel.length} onClick={collect}><ReferenceText message="Collect and print labels" /></Button>} bodyClass="p-0">
      {g.tubes.map((tube: any) => {
        const candidates = open.filter((s) => s.sampleTypeId === tube.sampleType?.id);
        return (
          <div key={tube.key} className="flex flex-wrap items-start gap-4 border-b border-line px-4 py-3 last:border-0">
            <div className="w-56">
              <TubeChip color={tube.container?.capColor} label={tube.container?.name ?? 'Container'} />
              <div className="mt-0.5 pl-4 text-xs text-ink-soft">{tube.sampleType?.name}{tube.container?.additive ? ` · ${tube.container.additive}` : ''}{tube.container?.volumeMl ? ` · ${tube.container.volumeMl} mL` : ''}</div>
            </div>
            <div className="flex flex-1 flex-col gap-1">
              {tube.tests.map((t: any) => (
                <div key={t.id} className="flex items-center gap-3 text-sm">
                  <Checkbox checked={sel.includes(t.id)} onChange={(v) => setSel((s) => (v ? [...s, t.id] : s.filter((x) => x !== t.id)))}
                    label={<span><span className="font-medium">{t.test?.name}</span> <span className="text-xs text-ink-mute">{t.order?.orderNo}</span></span>} />
                  {t.isOutsourced && <Badge value="OUTSOURCED" label={referenceT("Ref lab")} />}
                  {!t.isBilled && <Badge value="UNPAID" label={referenceT("Unbilled")} />}
                  <span className={`ml-auto text-xs ${dueIn(t.dueAt).overdue ? 'text-flag-crit' : 'text-ink-mute'}`}>{dueIn(t.dueAt).text}</span>
                </div>
              ))}
              {tube.tests.some((t: any) => t.test?.patientPreparation) && <div className="text-xs text-flag-warn"><ReferenceText message="Preparation:" /> {tube.tests.map((t: any) => t.test?.patientPreparation).filter(Boolean).join('; ')}</div>}
            </div>
            {candidates.length > 0 && (
              <div className="w-56">
                <Select value={attach[tube.key] || ''} onChange={(e) => setAttach({ ...attach, [tube.key]: e.target.value })} placeholder={referenceT("Draw a new tube")}
                  options={candidates.map((s) => ({ value: s.id, label: `Add to existing ${s.sampleNo}` }))} />
                <div className="mt-0.5 text-xs2 text-ink-mute"><ReferenceText message="One sample can serve several orders" /></div>
              </div>
            )}
          </div>
        );
      })}
    </Card>
  );
}

export default function CollectionPage() {
 const referenceT = useReferenceLocalization().t;

 const {api}=useDiagnosticClient();

  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get('q') || '');
  const dq = useDebounced(q);
  const { data, error, loading, reload } = useApi<any[]>('/samples/pending-collection', { q: dq });
  const [labels, setLabels] = useState<any[] | null>(null);
  useEffect(() => { setQ(sp.get('q') || ''); }, [sp]);

  const onCollected = async (samples: any[]) => {
    const full = await Promise.all([...new Set(samples.map((s) => s.id))].map((id) => api.get(`/samples/${id}`)));
    setLabels(full);
    reload();
  };

  return (
    <div>
      <PageHeader title={referenceT("Sample collection")} subtitle={referenceT("Tests are grouped into the fewest tubes by sample type and container. Collecting prints barcode labels.")}
        actions={<Button icon={RefreshCw} onClick={reload}><ReferenceText message="Refresh" /></Button>} />
      <ErrorNote error={error} />
      <div className="relative mb-3 max-w-sm"><Search className="absolute left-2.5 top-2 h-4 w-4 text-ink-mute" /><Input className="pl-8" placeholder={referenceT("Filter by MRN, name or order")} value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {loading && !data ? <Loading /> : !data?.length ? <Card><Empty title={referenceT("Nobody waiting for collection")} hint={referenceT("New orders appear here until their tubes are drawn.")} /></Card> : (
        <div className="space-y-3">{data.map((g) => <PatientGroup key={g.patient.id + JSON.stringify(g.tubes.map((t: any) => t.tests.length))} g={g} onCollected={onCollected} />)}</div>
      )}
      <Modal open={!!labels} onClose={() => setLabels(null)} title={referenceT("Labels ready")} width="max-w-3xl"
        footer={<><Button onClick={() => setLabels(null)}><ReferenceText message="Done" /></Button><Button variant="primary" icon={Printer} onClick={() => window.print()}><ReferenceText message="Print labels" /></Button></>}>
        <div className="flex flex-wrap gap-3">{labels?.map((s) => <SampleLabel key={s.id} s={s} />)}</div>
      </Modal>
      {labels && <div className="hidden print:block print-area"><div className="flex flex-wrap gap-2">{labels.map((s) => <SampleLabel key={s.id} s={s} />)}</div></div>}
    </div>
  );
}
