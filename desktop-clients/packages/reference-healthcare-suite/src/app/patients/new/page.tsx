'use client';
import {useLocalization as useHealthcareLocalization} from '@pepbits/ops-ui';
import {LocalizedText} from '@pepbits/ops-ui';
import { ArrowLeft, Save, Stethoscope } from 'lucide-react';
import { useReferenceRouter } from '@pepbits/reference-host';
import { useState } from 'react';
import { blankPatient, PatientForm } from '../../../components/patients/PatientForm';
import { Button } from '../../../components/ui/controls';
import { ErrorBanner } from '../../../components/ui/display';
import { useToast } from '../../../components/ui/Toast';
import { useApiClient, ApiError, errorMessage } from '../../../lib/api';
import { usePageHeader } from '../../../lib/session';
import { PatientSummary, Row } from '../../../lib/types';

export default function NewPatientPage() {
 const {t:healthcareT}=useHealthcareLocalization();
  const api = useApiClient();
  usePageHeader(healthcareT("New patient"), healthcareT("Register demographics and insurance"));
  const router = useReferenceRouter();
  const toast = useToast();
  const [value, setValue] = useState<Row>(blankPatient());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const save = async (then: 'view' | 'encounter') => {
    setSaving(then); setErrors({}); setBanner(null);
    try {
      const p = await api<PatientSummary>('/patients', { method: 'POST', body: value });
      toast({ tone: 'ok', title: healthcareT("{v0} registered",{v0:p.fullName}), body: healthcareT("MRN {v0}",{v0:p.mrn}) });
      router.push(then === 'encounter' ? `/encounters/new?patientId=${p.id}` : `/patients/${p.id}`);
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fields).length) { setErrors(e.fields); setBanner('Fix the highlighted fields and save again.'); }
      else setBanner(errorMessage(e));
      setSaving(null);
    }
  };

  return (
    <div className="hc-panel flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-hc-line px-3">
        <Button size="sm" variant="ghost" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => router.push('/patients')}><LocalizedText message="Patients" /></Button>
        <div className="flex gap-1.5">
          <Button mutation variant="secondary" icon={<Save className="h-3.5 w-3.5" />} loading={saving === 'view'} onClick={() => save('view')}><LocalizedText message="Save" /></Button>
          <Button mutation variant="primary" icon={<Stethoscope className="h-3.5 w-3.5" />} loading={saving === 'encounter'} onClick={() => save('encounter')}><LocalizedText message="Save & create encounter" /></Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto bg-hc-canvas/50 p-3">
        {banner && <div className="mb-3"><ErrorBanner message={banner} /></div>}
        <PatientForm value={value} onChange={setValue} errors={errors} />
      </div>
    </div>
  );
}
