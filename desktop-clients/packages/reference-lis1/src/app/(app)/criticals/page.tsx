'use client';
import {DiagnosticTable,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import { useState } from 'react';
import {ReferenceLink as Link} from '@pepbits/reference-host';
import { PhoneCall } from 'lucide-react';

import { useAuth } from '../../../lib/auth';
import { useApi } from '../../../lib/hooks';

import { Badge, Button, Card, Checkbox, Empty, ErrorNote, Field, Flag, Input, Loading, Modal, PageHeader, Tabs, Textarea, useAction } from '../../../components/ui';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export default function CriticalsPage() {
 const referenceT = useReferenceLocalization().t;

 const {api}=useDiagnosticClient();
 const {fmtDateTime}=useDiagnosticFormat();

  const [tab, setTab] = useState('OPEN');
  const { data, loading, reload } = useApi<any[]>('/results/critical-alerts', { status: tab === 'ALL' ? '' : tab });
  const { can } = useAuth();
  const [notify, setNotify] = useState<any>(null);
  const [f, setF] = useState({ notifiedTo: '', readBackConfirmed: true, notes: '' });
  const [err, setErr] = useState<string | null>(null);
  const { busy, run } = useAction();

  const open = (a: any) => { setF({ notifiedTo: a.doctor || '', readBackConfirmed: true, notes: '' }); setErr(null); setNotify(a); };
  const save = async () => {
    if (!f.notifiedTo.trim()) return setErr('Record who was informed.');
    const r = await run('n', () => api.post(`/results/critical-alerts/${notify.id}/notify`, f), 'Notification recorded');
    if (r) { setNotify(null); reload(); }
  };

  return (
    <div>
      <PageHeader title={referenceT("Critical alerts")} subtitle={referenceT("Life-threatening values must be phoned to the responsible clinician with read-back, and recorded here")} />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'OPEN', label: 'Awaiting notification' }, { value: 'NOTIFIED', label: 'Notified' }, { value: 'ALL', label: 'All' }]} />
      <Card bodyClass="p-0">
        {loading && !data ? <Loading /> : !data?.length ? <Empty title={tab === 'OPEN' ? 'No open critical values' : 'Nothing here'} /> : (
          <DiagnosticTable className="tbl">
            <TableHeader><TableRow><TableHead><ReferenceText message="Raised" /></TableHead><TableHead><ReferenceText message="Patient" /></TableHead><TableHead><ReferenceText message="Test / parameter" /></TableHead><TableHead><ReferenceText message="Value" /></TableHead><TableHead><ReferenceText message="Order" /></TableHead><TableHead><ReferenceText message="Clinician" /></TableHead><TableHead><ReferenceText message="Status" /></TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>{data.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="text-xs">{fmtDateTime(a.createdAt)}</TableCell>
                <TableCell>{a.patientName}<div className="font-mono text-xs2 text-ink-mute">{a.mrn}</div></TableCell>
                <TableCell>{a.parameterName}<div className="text-xs2 text-ink-mute">{a.testName}</div></TableCell>
                <TableCell><span className="num font-semibold text-flag-crit">{a.value}</span> <Flag flag={a.flag} /></TableCell>
                <TableCell><Link href={`/orders/${a.orderId}`} className="font-mono text-xs text-lab-700 hover:underline">{a.orderNo}</Link></TableCell>
                <TableCell className="text-sm">{a.doctor || '—'}{a.doctorPhone && <div className="text-xs text-ink-soft">{a.doctorPhone}</div>}</TableCell>
                <TableCell>
                  <Badge value={a.status} />
                  {a.status === 'NOTIFIED' && <div className="mt-0.5 text-xs2 text-ink-mute"><ReferenceText message="to" /> {a.notifiedTo} <ReferenceText message="by" /> {a.notifiedByName} · {fmtDateTime(a.notifiedAt)}{a.readBackConfirmed ? ' · read back' : ''}</div>}
                </TableCell>
                <TableCell className="text-right">{a.status === 'OPEN' && can('TECHNOLOGIST', 'PATHOLOGIST') && <Button size="sm" variant="danger" icon={PhoneCall} onClick={() => open(a)}><ReferenceText message="Record call" /></Button>}</TableCell>
              </TableRow>
            ))}</TableBody>
          </DiagnosticTable>
        )}
      </Card>
      <Modal open={!!notify} onClose={() => setNotify(null)} title={referenceT("Record critical value notification")} width="max-w-md"
        footer={<><Button onClick={() => setNotify(null)}><ReferenceText message="Cancel" /></Button><Button variant="primary" loading={busy === 'n'} onClick={save}><ReferenceText message="Save" /></Button></>}>
        {notify && <div className="space-y-3">
          <ErrorNote error={err} />
          <div className="rounded border border-[#E7B7B2] bg-[#FDF3F2] p-2 text-sm">{notify.patientName} · {notify.parameterName} <b className="text-flag-crit">{notify.value}</b> <Flag flag={notify.flag} /></div>
          <Field label={referenceT("Person informed (name and role)")}><Input autoFocus value={f.notifiedTo} onChange={(e) => setF({ ...f, notifiedTo: e.target.value })} /></Field>
          <Checkbox label={referenceT("Value was read back and confirmed")} checked={f.readBackConfirmed} onChange={(v) => setF({ ...f, readBackConfirmed: v })} />
          <Field label={referenceT("Notes")}><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        </div>}
      </Modal>
    </div>
  );
}
