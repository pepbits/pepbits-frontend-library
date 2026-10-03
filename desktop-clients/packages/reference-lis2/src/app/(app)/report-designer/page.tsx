'use client';
import {DiagnosticInput} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import { useEffect, useState } from 'react';
import { Copy, Save } from 'lucide-react';

import { useResource } from '../../../lib/hooks';
import { fullName } from '../../../lib/format';
import { Button, Checkbox, Empty, ErrorBanner, Field, Input, Loading, PageHeader, Section, Select, Textarea, cx, useToast } from '../../../components/ui';
import { ReportDocument } from '../../../components/report';
import { can, useUser } from '../../../components/shell';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


const TOGGLES: [string, string][] = [['show_method', 'Method'], ['show_loinc', 'LOINC codes'], ['show_ref_range', 'Reference interval'], ['show_flags', 'Flags'],
  ['highlight_abnormal', 'Bold abnormal results'], ['show_previous', 'Previous result'], ['group_by_department', 'New page per department'], ['is_default', 'Default template'], ['active', 'Active']];
const PLACEHOLDERS = ['lab.name', 'lab.address', 'lab.phone', 'lab.accreditation', 'patient.name', 'patient.mrn', 'patient.age', 'patient.gender', 'patient.dob', 'order.order_no', 'order.external_order_no', 'order.doctor', 'order.facility', 'printed_at'];

export default function ReportDesigner() {
 const referenceT = useReferenceLocalization().t;

 const {get,post,put}=useDiagnosticClient();

  const user = useUser();
  const toast = useToast();
  const { data: list, error, reload } = useResource<any>('/masters/report_templates?pageSize=100');
  const [sel, setSel] = useState<number | null>(null);
  const [draft, setDraft] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [orderId, setOrderId] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (list?.data?.length && !sel) setSel(list.data[0].id); }, [list, sel]);
  useEffect(() => { const t = list?.data?.find((x: any) => x.id === sel); if (t) setDraft({ ...t }); }, [sel, list]);
  useEffect(() => {
    get('/reports', { pageSize: 30, status: 'SIGNED,VALIDATED,RESULTED,AMENDING' }).then((r) => {
      const uniq = [...new Map(r.data.map((x: any) => [x.order_id, x])).values()];
      setOrders(uniq); if (uniq[0]) setOrderId(String((uniq[0] as any).order_id));
    }).catch(() => {});
  }, []);
  useEffect(() => { if (orderId) get(`/reports/order/${orderId}/print`, { preview: 1 }).then(setPreview).catch((e) => toast.error(e.message)); }, [orderId]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: string) => (v: any) => setDraft((d: any) => ({ ...d, [k]: v }));
  const fields = ['code', 'name', 'paper_size', 'font_family', 'font_size', 'accent_color', 'header_html', 'footer_html', 'disclaimer', ...TOGGLES.map((t) => t[0])];
  const save = async () => {
    setBusy(true);
    try { const body = Object.fromEntries(fields.map((k) => [k, draft[k]])); await put(`/masters/report_templates/${draft.id}`, body); toast.ok('Template saved. New prints use it immediately.'); reload(); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  const duplicate = async () => {
    const body = Object.fromEntries(fields.map((k) => [k, draft[k]]));
    try { const r = await post('/masters/report_templates', { ...body, code: `${draft.code}-COPY-${Date.now() % 1000}`, name: `${draft.name} (copy)`, is_default: 0 }); toast.ok('Copy created.'); await reload(); setSel(r.id); }
    catch (e: any) { toast.error(e.message); }
  };
  if (error) return <ErrorBanner error={error} onRetry={reload} />;
  if (!list || !draft) return <Loading />;
  const editable = can(user, 'PATHOLOGIST');
  return (
    <>
      <PageHeader title={referenceT("Report designer")} subtitle={referenceT("Adjust how printed reports look. The preview uses a real order; unsigned tests show a preliminary watermark.")}
        actions={<>
          <Select className="w-64" value={sel ?? ''} onChange={(v) => setSel(Number(v))} options={list.data.map((t: any) => ({ value: t.id, label: `${t.name}${t.is_default ? ' (default)' : ''}` }))} />
          {editable && <Button icon={<Copy className="h-4 w-4" />} onClick={duplicate}><ReferenceText message="Duplicate" /></Button>}
          {editable && <Button variant="primary" loading={busy} icon={<Save className="h-4 w-4" />} onClick={save}><ReferenceText message="Save template" /></Button>}
        </>} />
      <div className="grid gap-4 2xl:grid-cols-[440px_1fr] xl:grid-cols-[400px_1fr]">
        <div className="space-y-4">
          <Section title={referenceT("Page")}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={referenceT("Name")} className="sm:col-span-2"><Input value={draft.name || ''} onChange={(e) => set('name')(e.target.value)} disabled={!editable} /></Field>
              <Field label={referenceT("Paper")}><Select value={draft.paper_size} onChange={set('paper_size')} options={['A4', 'LETTER', 'A5']} disabled={!editable} /></Field>
              <Field label={referenceT("Base size (pt)")}><Input type="number" min={7} max={14} value={draft.font_size ?? 10} onChange={(e) => set('font_size')(Number(e.target.value))} disabled={!editable} /></Field>
              <Field label={referenceT("Font family")} className="sm:col-span-2"><Input value={draft.font_family || ''} onChange={(e) => set('font_family')(e.target.value)} disabled={!editable} /></Field>
              <Field label={referenceT("Accent colour")}><div className="flex gap-2"><DiagnosticInput type="color" className="h-9 w-12 rounded border border-line-strong" value={draft.accent_color || '#2f3a8f'} onChange={(e) => set('accent_color')(e.target.value)} disabled={!editable} /><Input value={draft.accent_color || ''} onChange={(e) => set('accent_color')(e.target.value)} disabled={!editable} /></div></Field>
            </div>
          </Section>
          <Section title={referenceT("Content")}>
            <div className="grid grid-cols-2 gap-2">{TOGGLES.map(([k, l]) => <Checkbox key={k} checked={!!draft[k]} onChange={(v) => editable && set(k)(v ? 1 : 0)} label={l} />)}</div>
          </Section>
          <Section title={referenceT("Header, footer and disclaimer")}>
            <Field label={referenceT("Header HTML")}><Textarea className="min-h-[110px] font-mono text-xs" value={draft.header_html || ''} onChange={(e) => set('header_html')(e.target.value)} disabled={!editable} /></Field>
            <Field label={referenceT("Footer HTML")} className="mt-3"><Textarea className="min-h-[70px] font-mono text-xs" value={draft.footer_html || ''} onChange={(e) => set('footer_html')(e.target.value)} disabled={!editable} /></Field>
            <Field label={referenceT("Disclaimer")} className="mt-3"><Textarea value={draft.disclaimer || ''} onChange={(e) => set('disclaimer')(e.target.value)} disabled={!editable} /></Field>
            <p className="mt-3 text-2xs text-ink-soft"><ReferenceText message="Placeholders:" /> {PLACEHOLDERS.map((p) => <code key={p} className="mr-1 inline-block rounded bg-paper px-1 font-mono">{referenceT("{{{value0}}}", {value0: p})}</code>)}</p>
          </Section>
        </div>
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm text-ink-soft"><ReferenceText message="Preview with" /></span>
            <Select className="w-96" value={orderId} onChange={setOrderId} placeholder={orders.length ? undefined : 'No resulted orders yet'} options={orders.map((o: any) => ({ value: o.order_id, label: `${o.order_no}, ${fullName(o)}, ${o.test_code}` }))} />
          </div>
          <div className={cx('overflow-auto rounded-lg bg-[#E6E8E4] p-6', !preview && 'grid place-items-center')}>
            {preview ? (preview.items.length ? <div className="origin-top-left"><ReportDocument data={preview} template={draft} /></div> : <Empty title={referenceT("This order has no results yet")} />)
              : <Empty title={referenceT("Nothing to preview yet")}><ReferenceText message="Once an order has results, pick it here to see the template applied to real data." /></Empty>}
          </div>
        </div>
      </div>
    </>
  );
}
