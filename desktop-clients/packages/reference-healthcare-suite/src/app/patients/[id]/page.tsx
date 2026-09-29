'use client';
import {useLocalization as useHealthcareLocalization} from '@pepbits/ops-ui';
import {LocalizedText} from '@pepbits/ops-ui';
import { ArrowLeft, CalendarPlus, Save, Stethoscope } from 'lucide-react';
import { ReferenceLink as Link } from '@pepbits/reference-host';
import { useReferenceRouter } from '@pepbits/reference-host';
import { useEffect, useState } from 'react';
import { PatientBanner } from '../../../components/patients/PatientBanner';
import { PatientForm } from '../../../components/patients/PatientForm';
import { Button, Select } from '../../../components/ui/controls';
import { ErrorBanner, Spinner, StatusBadge } from '../../../components/ui/display';
import { useToast } from '../../../components/ui/Toast';
import { useApiClient, ApiError, errorMessage } from '../../../lib/api';
import { useFormat } from '../../../lib/format';
import { useApi } from '../../../lib/hooks';
import { usePageHeader, useWriteAccess } from '../../../lib/session';
import { Row } from '../../../lib/types';

const editable = (p: Row): Row => ({ ...p, policies: (p.policies ?? []).filter((x: Row) => x.status !== 'Inactive') });

export default function PatientRecordPage({ params }: { params: { id: string } }) {
 const {t:healthcareT}=useHealthcareLocalization();
  const api = useApiClient();
  const canWrite=useWriteAccess();
  const { fmtDate, fmtDateTime , fmtTime } = useFormat();
  const router = useReferenceRouter();
  const toast = useToast();
  const { data, error, reload, setData } = useApi<Row>(`/patients/${params.id}`);
  const [value, setValue] = useState<Row | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  usePageHeader(data ? data.fullName : 'Patient', data ? `${data.mrn} · registered ${fmtDate(data.createdAt)}` : undefined);
  useEffect(() => { if (data) setValue(editable(data)); }, [data]);

  if (error) return <ErrorBanner message={error.message} onRetry={reload} />;
  if (!data || !value) return <div className="flex flex-1 items-center justify-center"><Spinner label="Loading patient" /></div>;
  const dirty = JSON.stringify(value) !== JSON.stringify(editable(data));

  const save = async () => {
    setSaving(true); setErrors({}); setBanner(null);
    try {
      const p = await api<Row>(`/patients/${data.id}`, { method: 'PUT', body: value });
      setData(p); toast({ tone: 'ok', title: healthcareT("Patient saved") });
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fields).length) { setErrors(e.fields); setBanner('Fix the highlighted fields and save again.'); }
      else setBanner(errorMessage(e));
    } finally { setSaving(false); }
  };

  return (
    <div className="flex min-h-0 flex-1 gap-3">
      <div className="hc-panel flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-hc-line px-3">
          <Button size="sm" variant="ghost" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => router.push('/patients')}><LocalizedText message="Patients" /></Button>
          <div className="flex items-center gap-1.5">
            <span className="text-hc-xs text-hc-ink-mute"><LocalizedText message="Status" /></span>
            <Select disabled={!canWrite} className="w-28" options={['Active', 'Inactive']} value={value.status} onChange={(v) => setValue({ ...value, status: v })} />
            {dirty && <Button variant="ghost" onClick={() => { setValue(editable(data)); setErrors({}); setBanner(null); }}><LocalizedText message="Discard" /></Button>}
            <Button mutation variant="primary" icon={<Save className="h-3.5 w-3.5" />} loading={saving} disabled={!dirty} onClick={save}><LocalizedText message="Save changes" /></Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-hc-canvas/50 p-3">
          <PatientBanner patient={data} policy={data.primaryPolicy} />
          {banner && <ErrorBanner message={banner} />}
          <fieldset disabled={!canWrite}><PatientForm value={value} onChange={setValue} errors={errors} /></fieldset>
        </div>
      </div>
      <aside className="hc-panel hidden w-[340px] shrink-0 flex-col overflow-hidden xl:flex">
        <div className="flex gap-1.5 border-b border-hc-line p-3">
          <Link href={`/encounters/new?patientId=${data.id}`} className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded bg-hc-petrol-600 text-hc-sm font-medium text-white hover:bg-hc-petrol-700"><Stethoscope className="h-3.5 w-3.5" /><LocalizedText message="Create encounter" /></Link>
          <Link href={`/appointments?patientId=${data.id}`} className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded border border-hc-line-strong text-hc-sm font-medium hover:bg-hc-canvas/60"><CalendarPlus className="h-3.5 w-3.5" /><LocalizedText message="Book" /></Link>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
          <section>
            <h4 className="mb-1.5 text-hc-xs font-semibold text-hc-ink-soft"><LocalizedText message="Appointments" /></h4>
            {(data.appointments ?? []).length === 0 ? <p className="text-hc-xs text-hc-ink-mute"><LocalizedText message="None" /></p> : data.appointments.map((a: Row) => (
              <div key={a.id} className="flex items-center justify-between py-1 text-hc-xs"><span className="hc-num">{fmtDate(a.date)} {fmtTime(a.startTime)} · {a.resourceName}</span><StatusBadge status={a.status} /></div>
            ))}
          </section>
          <section>
            <h4 className="mb-1.5 text-hc-xs font-semibold text-hc-ink-soft"><LocalizedText message="Encounters" /></h4>
            {(data.encounters ?? []).length === 0 ? <p className="text-hc-xs text-hc-ink-mute"><LocalizedText message="None" /></p> : data.encounters.map((e: Row) => (
              <Link key={e.id} href={`/encounters/${e.id}`} className="flex items-center justify-between gap-2 rounded px-1 py-1 text-hc-xs hover:bg-hc-canvas">
                <span className="truncate"><span className="font-mono">{e.encNo}</span> · {fmtDateTime(e.createdAt)}</span><StatusBadge status={e.status} />
              </Link>
            ))}
          </section>
        </div>
      </aside>
    </div>
  );
}
