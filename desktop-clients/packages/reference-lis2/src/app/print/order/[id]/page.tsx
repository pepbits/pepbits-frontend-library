'use client';
import {DiagnosticSelect} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import {useReferenceSearchParams as useSearchParams} from '@pepbits/reference-host';
import {useParams} from '@pepbits/reference-diagnostics';
import { Suspense, useEffect, useState } from 'react';
import { Printer } from 'lucide-react';

import { ReportDocument } from '../../../../components/report';
import { Button, ErrorBanner, Loading } from '../../../../components/ui';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


function PrintOrder() {
 const referenceT = useReferenceLocalization().t;

 const {get}=useDiagnosticClient();

  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [tpls, setTpls] = useState<any[]>([]);
  const [tplId, setTplId] = useState(sp.get('templateId') || '');
  useEffect(() => {
    get(`/reports/order/${id}/print`, { itemIds: sp.get('itemIds') || '', preview: sp.get('preview') || '', templateId: tplId }).then(setData).catch((e) => setError(e.message));
  }, [id, sp, tplId]);
  useEffect(() => { get('/masters/report_templates', { active: 1, pageSize: 100 }).then((r) => setTpls(r.data)).catch(() => {}); }, []);
  if (error) return <div className="mx-auto max-w-xl"><ErrorBanner error={error} /></div>;
  if (!data) return <Loading />;
  return (
    <>
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] items-center gap-2">
        <span className="text-sm text-ink-soft">{data.items.length ? `${data.items.length} test${data.items.length > 1 ? 's' : ''} on this report` : 'No signed tests on this order yet'}</span>
        <DiagnosticSelect className="input ml-auto h-9 w-56" value={tplId || data.template?.id || ''} onChange={(e) => setTplId(e.target.value)} aria-label={referenceT("Report template")}>
          {tpls.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </DiagnosticSelect>
        <Button variant="primary" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()} disabled={!data.items.length}><ReferenceText message="Print" /></Button>
      </div>
      {data.items.length ? <ReportDocument data={data} /> : <p className="text-center text-sm text-ink-soft"><ReferenceText message="Tests appear on the printed report once they are signed." /></p>}
    </>
  );
}
export default function Page() { return <Suspense fallback={<Loading />}><PrintOrder /></Suspense>; }
