'use client';
import {DiagnosticButton,DiagnosticTable,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import {ReferenceLink as Link} from '@pepbits/reference-host';
import { useEffect, useState } from 'react';
import { FilePen, FileText, Printer } from 'lucide-react';

import {fullName,titleCase} from '../lib/format';
import { can, useUser } from './shell';
import { Badge, Button, FlagBadge, Loading, Modal, PromptModal, StatusBadge, Tabs, flagTextClass, useToast } from './ui';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


/** Side panel with everything about one reported test: results, versions, change history, delivery and audit trail. */
export function ReportItemDrawer({ itemId, onClose, onChanged }: { itemId: number | null; onClose: () => void; onChanged?: () => void }) {
 const referenceT = useReferenceLocalization().t;

 const {get,post}=useDiagnosticClient();
 const {fmtDateTime}=useDiagnosticFormat();

  const user = useUser();
  const toast = useToast();
  const [it, setIt] = useState<any>(null);
  const [tab, setTab] = useState<'results' | 'versions' | 'history' | 'delivery' | 'audit'>('results');
  const [amend, setAmend] = useState(false);
  const [addendum, setAddendum] = useState(false);
  const [version, setVersion] = useState<any>(null);
  const load = () => itemId && get(`/results/item/${itemId}`).then(setIt).catch((e) => toast.error(e.message));
  useEffect(() => { setIt(null); setTab('results'); load(); }, [itemId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!itemId) return null;
  return (
    <Modal side open={!!itemId} onClose={onClose} title={it ? `${it.test_name}, ${it.order_no}` : 'Report'}
      footer={it && <>
        <Link href={`/print/order/${it.order_id}?itemIds=${it.id}`} target="_blank"><Button icon={<Printer className="h-4 w-4" />} disabled={it.status !== 'SIGNED'}><ReferenceText message="Print" /></Button></Link>
        {it.sample_id && <Link href={`/results/sample/${it.sample_id}`}><Button icon={<FileText className="h-4 w-4" />}><ReferenceText message="Open result entry" /></Button></Link>}
        {can(user, 'PATHOLOGIST') && it.status === 'SIGNED' && <>
          <Button onClick={() => setAddendum(true)}><ReferenceText message="Add addendum" /></Button>
          <Button variant="accent" icon={<FilePen className="h-4 w-4" />} onClick={() => setAmend(true)}><ReferenceText message="Amend report" /></Button>
        </>}
      </>}>
      {!it ? <Loading /> : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{fullName(it)}</span><span className="text-ink-soft tnum">{it.mrn}, {it.age} {it.gender}</span>
            <StatusBadge status={it.status} />
            {it.report_version > 0 && <Badge tone="hema"><ReferenceText message="Version" /> {it.report_version}</Badge>}
            {it.status === 'SIGNED' && <span className="text-xs text-ink-soft"><ReferenceText message="Signed by" /> {it.signed_by_name}, {fmtDateTime(it.signed_at)}</span>}
          </div>
          {it.status === 'AMENDING' && <p className="mb-3 rounded-md bg-high-bg px-3 py-2 text-sm text-high"><ReferenceText message="Amendment open:" /> {it.amend_reason}<ReferenceText message=". Correct the results, validate and sign to issue the corrected report." /></p>}
          <Tabs value={tab} onChange={setTab} tabs={[
            { value: 'results', label: 'Results' }, { value: 'versions', label: 'Versions', count: it.versions.length }, { value: 'history', label: 'Changes', count: it.history.length },
            { value: 'delivery', label: 'Delivery', count: it.publications.length }, { value: 'audit', label: 'Audit' },
          ]} />
          <div className="pt-3">
            {tab === 'results' && (
              <DiagnosticTable className="w-full text-sm">
                <TableHeader><TableRow><TableHead className="th"><ReferenceText message="Parameter" /></TableHead><TableHead className="th text-right"><ReferenceText message="Result" /></TableHead><TableHead className="th"><ReferenceText message="Unit" /></TableHead><TableHead className="th"><ReferenceText message="Reference" /></TableHead><TableHead className="th"><ReferenceText message="Source" /></TableHead></TableRow></TableHeader>
                <TableBody>{it.results.map((r: any) => (
                  <TableRow key={r.id}><TableCell className="td">{r.name}{r.comment && <div className="text-2xs text-ink-soft">{r.comment}</div>}</TableCell>
                    <TableCell className={`td text-right tnum ${flagTextClass(r.flag, r.is_critical)}`}>{r.value} <FlagBadge flag={r.flag} critical={r.is_critical} /></TableCell>
                    <TableCell className="td text-ink-soft">{r.unit}</TableCell><TableCell className="td text-ink-soft">{r.ref_text}</TableCell><TableCell className="td text-2xs text-ink-soft">{titleCase(r.source)}{r.analyzer ? `, ${r.analyzer}` : ''}</TableCell></TableRow>
                ))}</TableBody>
              </DiagnosticTable>
            )}
            {tab === 'results' && it.interpretation && <p className="mt-3 rounded-md bg-paper p-3 text-sm"><span className="font-medium"><ReferenceText message="Interpretation:" /> </span>{it.interpretation}</p>}
            {tab === 'versions' && (
              <ol className="space-y-2">{it.versions.map((v: any) => (
                <li key={v.id} className="rounded-md border border-line p-3 text-sm">
                  <div className="flex items-center justify-between"><span className="font-medium"><ReferenceText message="Version" /> {v.version}, {titleCase(v.kind)}</span><DiagnosticButton className="link text-xs" onClick={() => get(`/reports/version/${v.id}`).then(setVersion)}><ReferenceText message="View snapshot" /></DiagnosticButton></div>
                  <div className="text-xs text-ink-soft">{v.signed_by_name}, {fmtDateTime(v.signed_at)}</div>
                  {v.reason && <div className="mt-1"><ReferenceText message="Reason:" /> {v.reason}</div>}
                  {v.addendum_text && <div className="mt-1 whitespace-pre-wrap">{v.addendum_text}</div>}
                </li>
              ))}{!it.versions.length && <p className="text-sm text-ink-soft"><ReferenceText message="Not signed yet." /></p>}</ol>
            )}
            {tab === 'history' && (
              <DiagnosticTable className="w-full text-sm"><TableHeader><TableRow><TableHead className="th"><ReferenceText message="When" /></TableHead><TableHead className="th"><ReferenceText message="Parameter" /></TableHead><TableHead className="th"><ReferenceText message="From" /></TableHead><TableHead className="th"><ReferenceText message="To" /></TableHead><TableHead className="th"><ReferenceText message="By" /></TableHead></TableRow></TableHeader>
                <TableBody>{it.history.map((h: any) => <TableRow key={h.id}><TableCell className="td whitespace-nowrap">{fmtDateTime(h.at)}</TableCell><TableCell className="td">{h.parameter}</TableCell><TableCell className="td tnum">{h.old_value ?? '—'}</TableCell><TableCell className="td tnum">{h.new_value ?? '—'}</TableCell>
                  <TableCell className="td text-xs">{h.changed_by_name || titleCase(h.source)}{h.reason && <div className="text-ink-soft">{h.reason}</div>}</TableCell></TableRow>)}</TableBody></DiagnosticTable>
            )}
            {tab === 'delivery' && (
              it.publications.length ? <DiagnosticTable className="w-full text-sm"><TableHeader><TableRow><TableHead className="th"><ReferenceText message="Event" /></TableHead><TableHead className="th"><ReferenceText message="To" /></TableHead><TableHead className="th"><ReferenceText message="Mode" /></TableHead><TableHead className="th"><ReferenceText message="Status" /></TableHead><TableHead className="th"><ReferenceText message="Created" /></TableHead></TableRow></TableHeader>
                <TableBody>{it.publications.map((p: any) => <TableRow key={p.id}><TableCell className="td">{titleCase(p.event)} <ReferenceText message="v" />{p.report_version}</TableCell><TableCell className="td">{p.facility || p.interface} ({p.format})</TableCell><TableCell className="td">{p.mode === 'PULL' ? 'Client pulls' : 'Pushed'}</TableCell>
                  <TableCell className="td"><StatusBadge status={p.status} />{p.last_error && <div className="text-2xs text-crit">{p.last_error}</div>}</TableCell><TableCell className="td">{fmtDateTime(p.created_at)}</TableCell></TableRow>)}</TableBody></DiagnosticTable>
                : <p className="text-sm text-ink-soft"><ReferenceText message="No external subscribers for this order. Internal reports are available here and in print." /></p>
            )}
            {tab === 'audit' && (
              <ul className="space-y-1 text-sm">{it.audit.map((a: any) => <li key={a.id} className="flex gap-3"><span className="w-32 shrink-0 text-ink-soft">{fmtDateTime(a.at)}</span><span className="font-medium">{titleCase(a.action)}</span><span className="text-ink-soft">{a.user || 'System'}</span></li>)}</ul>
            )}
          </div>
        </>
      )}
      <PromptModal open={amend} onClose={() => setAmend(false)} title={referenceT("Amend signed report")} label={referenceT("Reason for amendment")} confirmText="Open amendment" variant="accent"
        placeholder={referenceT("e.g. Transcription error in haemoglobin value")}
        onConfirm={async (reason) => { await post(`/results/item/${itemId}/amend`, { reason }); toast.ok('Amendment opened. Correct the results and sign again.'); load(); onChanged?.(); }}>
        <p className="mb-3 text-sm text-ink-soft"><ReferenceText message="The report goes back to result entry. Once corrected, validated and signed, a corrected report replaces this one and is sent to every recipient of the original." /></p>
      </PromptModal>
      <PromptModal open={addendum} onClose={() => setAddendum(false)} title={referenceT("Add addendum")} label={referenceT("Addendum text")} confirmText="Sign addendum"
        onConfirm={async (text) => { const r = await post(`/results/item/${itemId}/addendum`, { text }); toast.ok(`Addendum signed as version ${r.version}.`); load(); onChanged?.(); }}>
        <p className="mb-3 text-sm text-ink-soft"><ReferenceText message="The results stay as signed. The addendum is appended to the report and delivered as an update." /></p>
      </PromptModal>
      <Modal open={!!version} onClose={() => setVersion(null)} title={version ? `Version ${version.version} snapshot` : ''} width="max-w-2xl">
        {version && <>
          <DiagnosticTable className="w-full text-sm"><TableHeader><TableRow><TableHead className="th"><ReferenceText message="Parameter" /></TableHead><TableHead className="th"><ReferenceText message="Result" /></TableHead><TableHead className="th"><ReferenceText message="Unit" /></TableHead><TableHead className="th"><ReferenceText message="Reference" /></TableHead></TableRow></TableHeader>
            <TableBody>{version.snapshot?.results?.map((r: any) => <TableRow key={r.code}><TableCell className="td">{r.name}</TableCell><TableCell className={`td tnum ${flagTextClass(r.flag)}`}>{r.value} {r.flag && r.flag !== 'N' ? r.flag : ''}</TableCell><TableCell className="td">{r.unit}</TableCell><TableCell className="td">{r.ref_text}</TableCell></TableRow>)}</TableBody></DiagnosticTable>
          {version.snapshot?.interpretation && <p className="mt-3 text-sm"><ReferenceText message="Interpretation:" /> {version.snapshot.interpretation}</p>}
        </>}
      </Modal>
    </Modal>
  );
}
