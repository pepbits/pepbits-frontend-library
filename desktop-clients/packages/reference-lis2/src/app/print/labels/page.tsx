'use client';
import {DiagnosticInput} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import {useReferenceSearchParams as useSearchParams} from '@pepbits/reference-host';
import { Suspense, useEffect, useState } from 'react';
import { Printer } from 'lucide-react';

import { SpecimenLabel } from '../../../components/label';
import { Button, Loading } from '../../../components/ui';
import { LocalizedText as ReferenceText } from '@pepbits/ops-ui';


function Labels() {
 const {get}=useDiagnosticClient();

  const sp = useSearchParams();
  const [labels, setLabels] = useState<any[] | null>(null);
  const [copies, setCopies] = useState(1);
  useEffect(() => {
    const ids = (sp.get('ids') || '').split(',').filter(Boolean);
    Promise.all(ids.map((id) => get(`/samples/${id}/label`))).then(setLabels).catch(() => setLabels([]));
  }, [sp]);
  if (!labels) return <Loading />;
  return (
    <div className="mx-auto max-w-3xl">
      <style><ReferenceText message="@media print { @page { size: 50mm 25mm; margin: 0 } .label-sheet { display: block !important } .label-sheet > div { page-break-after: always } }" /></style>
      <div className="no-print mb-4 flex items-center gap-3">
        <span className="text-sm text-ink-soft">{labels.length} <ReferenceText message="sample label" />{labels.length === 1 ? '' : 's'}<ReferenceText message=", printed on 50 × 25 mm stock" /></span>
        <label className="ml-auto text-sm"><ReferenceText message="Copies" /> <DiagnosticInput type="number" min={1} max={5} value={copies} onChange={(e) => setCopies(Math.max(1, Math.min(5, Number(e.target.value))))} className="input ml-1 inline-block h-8 w-16 py-1" /></label>
        <Button variant="primary" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}><ReferenceText message="Print labels" /></Button>
      </div>
      <div className="label-sheet flex flex-wrap gap-3">
        {labels.flatMap((l) => Array.from({ length: copies }, (_, i) => <SpecimenLabel key={`${l.sample_no}-${i}`} l={l} />))}
      </div>
    </div>
  );
}
export default function Page() { return <Suspense fallback={<Loading />}><Labels /></Suspense>; }
