'use client';
import {CardGrid} from '@pepbits/ops-ui';

import {DiagnosticButton} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import { useState } from 'react';
import {ReferenceLink as Link} from '@pepbits/reference-host';
import {useReferenceRouter as useRouter} from '@pepbits/reference-host';
import {useParams} from '@pepbits/reference-diagnostics';
import { FilePlus2, History, PenSquare, Printer, Send } from 'lucide-react';

import { useAuth } from '../../../../lib/auth';
import { useApi, useMaster } from '../../../../lib/hooks';

import { Badge, Button, Card, ErrorNote, Field, Loading, Modal, PageHeader, Select, Textarea, useAction } from '../../../../components/ui';
import { PrintableReport } from '../../../../components/PrintableReport';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export default function ReportView() {
 const referenceT = useReferenceLocalization().t;

 const {api}=useDiagnosticClient();
 const {fmtDateTime}=useDiagnosticFormat();

  const { orderId } = useParams<{ orderId: string }>();
  const router = useRouter();
  const { can } = useAuth();
  const [templateId, setTemplateId] = useState('');
  const { data: r, error, reload } = useApi<any>(`/reports/order/${orderId}`, { templateId });
  const { data: versions, reload: reloadVersions } = useApi<any[]>(`/reports/order/${orderId}/versions`);
  const templates = useMaster('report-templates');
  const [snapshot, setSnapshot] = useState<any>(null);
  const [addendum, setAddendum] = useState(false);
  const [addText, setAddText] = useState('');
  const [addTest, setAddTest] = useState('');
  const [amendTest, setAmendTest] = useState<string>('');
  const [amendOpen, setAmendOpen] = useState(false);
  const [amendReason, setAmendReason] = useState('');
  const { busy, run } = useAction();

  if (error) return <ErrorNote error={error} />;
  if (!r) return <Loading />;
  const signedTests = r.departments.flatMap((d: any) => d.tests);

  const saveAddendum = async () => {
    const res = await run('add', () => api.post(`/reports/order/${orderId}/addendum`, { text: addText, orderTestId: addTest ? Number(addTest) : undefined }), 'Addendum added – new report version issued');
    if (res) { setAddendum(false); setAddText(''); reload(); reloadVersions(); }
  };

  return (
    <div>
      <PageHeader title={r.report ? `Report ${r.report.reportNo}` : `Report preview · ${r.order.orderNo}`}
        subtitle={<>{r.patient.fullName} <ReferenceText message="· order" /> <Link href={`/orders/${r.order.id}`} className="font-mono text-lab-700 hover:underline">{r.order.orderNo}</Link> {r.report && <><Badge value={r.report.status} /> <span className="text-xs"><ReferenceText message="v" />{r.report.version}</span></>}</>}
        actions={<>
          <Select className="w-48" value={templateId} onChange={(e) => setTemplateId(e.target.value)} placeholder={referenceT("Default template")} options={templates.filter((t) => t.active).map((t) => ({ value: t.id, label: t.name }))} />
          {can('PATHOLOGIST') && r.report && <Button icon={FilePlus2} onClick={() => setAddendum(true)}><ReferenceText message="Addendum" /></Button>}
          {can('PATHOLOGIST') && signedTests.length > 0 && <Button icon={PenSquare} onClick={() => { setAmendTest(String(signedTests[0].orderTestId)); setAmendReason(''); setAmendOpen(true); }}><ReferenceText message="Amend result" /></Button>}
          {can('TECHNOLOGIST', 'PATHOLOGIST') && r.report && <Button icon={Send} loading={busy === 'pub'} onClick={() => run('pub', () => api.post(`/reports/order/${orderId}/publish`), (x: any) => x?.skipped ? `Not published: ${x.skipped}` : x?.ok ? 'Published to the external system' : `Publish failed (HTTP ${x?.status})`)}><ReferenceText message="Publish" /></Button>}
          <Button variant="primary" icon={Printer} onClick={() => window.print()}><ReferenceText message="Print" /></Button>
        </>} />
      <CardGrid className="grid gap-4 xl:grid-cols-[1fr_300px]">
        <div className="overflow-x-auto rounded border border-line bg-[#E9ECEF] p-4">
          {!signedTests.length && <div className="no-print mb-3 rounded border border-[#EBCB94] bg-[#FFF7E8] px-3 py-2 text-sm text-flag-warn"><ReferenceText message="No tests on this order are signed yet – this preview has no results." /></div>}
          <PrintableReport r={r} />
        </div>
        <div className="no-print space-y-4">
          <Card title={<span className="flex items-center gap-1.5"><History className="h-4 w-4" /><ReferenceText message="Versions" /></span>} bodyClass="p-0">
            {!versions?.length ? <div className="p-4 text-sm text-ink-mute"><ReferenceText message="Not released yet." /></div> : versions.map((v) => (
              <DiagnosticButton key={v.id} onClick={async () => setSnapshot(await api.get(`/reports/versions/${v.id}`))} className="block w-full border-b border-line px-4 py-2.5 text-left last:border-0 hover:bg-paper">
                <div className="flex items-center justify-between text-sm"><span className="font-medium"><ReferenceText message="Version" /> {v.version}</span><Badge value={v.event === 'RELEASE' ? 'SIGNED' : v.event === 'AMENDMENT' ? 'AMENDED' : 'VALIDATED'} label={v.event.toLowerCase()} /></div>
                <div className="text-xs text-ink-soft">{fmtDateTime(v.createdAt)}{v.createdByName ? ` · ${v.createdByName}` : ''}</div>
                {v.reason && <div className="mt-0.5 line-clamp-2 text-xs text-ink-mute">{v.reason}</div>}
              </DiagnosticButton>
            ))}
          </Card>
          {r.pending?.length > 0 && (
            <Card title={referenceT("Still pending")}>
              {r.pending.map((p: any, i: number) => <div key={i} className="flex justify-between text-sm"><span>{p.name}</span><Badge value={p.status} /></div>)}
            </Card>
          )}
        </div>
      </CardGrid>

      <Modal open={!!snapshot} onClose={() => setSnapshot(null)} title={snapshot ? `Version ${snapshot.version} as issued · ${snapshot.event.toLowerCase()}` : ''} width="max-w-5xl">
        {snapshot && <div className="bg-[#E9ECEF] p-3"><PrintableReport r={snapshot.snapshot} watermark={versions?.[0]?.id !== snapshot.id ? 'Superseded' : undefined} /></div>}
      </Modal>
      <Modal open={addendum} onClose={() => setAddendum(false)} title={referenceT("Add addendum")}
        footer={<><Button onClick={() => setAddendum(false)}><ReferenceText message="Cancel" /></Button><Button variant="primary" loading={busy === 'add'} disabled={!addText.trim()} onClick={saveAddendum}><ReferenceText message="Issue addendum" /></Button></>}>
        <div className="space-y-3">
          <div className="text-sm text-ink-soft"><ReferenceText message="An addendum adds information without changing results. It issues a new report version and republishes it." /></div>
          <Field label={referenceT("Relates to test (optional)")}><Select value={addTest} onChange={(e) => setAddTest(e.target.value)} placeholder={referenceT("Whole report")} options={signedTests.map((t: any) => ({ value: t.orderTestId, label: t.name }))} /></Field>
          <Field label={referenceT("Addendum text")}><Textarea rows={5} autoFocus value={addText} onChange={(e) => setAddText(e.target.value)} /></Field>
        </div>
      </Modal>
      <Modal open={amendOpen} onClose={() => setAmendOpen(false)} title={referenceT("Amend a signed result")} width="max-w-md"
        footer={<><Button onClick={() => setAmendOpen(false)}><ReferenceText message="Cancel" /></Button><Button variant="warn" loading={busy === 'amend'} disabled={!amendReason.trim()}
          onClick={() => run('amend', () => api.post(`/results/order-tests/${amendTest}/amend`, { reason: amendReason.trim() }), 'Amendment opened – correct and re-validate the result').then((x) => { if (x) router.push(`/results?ot=${amendTest}`); })}><ReferenceText message="Open amendment" /></Button></>}>
        <div className="space-y-3">
          <div className="text-sm text-ink-soft"><ReferenceText message="The test returns to result entry. After correction it must be validated and signed again; the report is re-issued as a new version marked amended." /></div>
          <Field label={referenceT("Test to amend")}><Select value={amendTest} onChange={(e) => setAmendTest(e.target.value)} options={signedTests.map((t: any) => ({ value: t.orderTestId, label: t.name }))} /></Field>
          <Field label={referenceT("Reason (printed on the report)")}><Textarea value={amendReason} onChange={(e) => setAmendReason(e.target.value)} /></Field>
        </div>
      </Modal>
    </div>
  );
}
