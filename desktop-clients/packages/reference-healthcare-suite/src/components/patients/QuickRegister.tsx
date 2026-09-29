'use client';
import {useLocalization as useHealthcareLocalization} from '@pepbits/ops-ui';
import {LocalizedText} from '@pepbits/ops-ui';
import { ShieldPlus, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApiClient, ApiError, errorMessage } from '../../lib/api';
import { PatientSummary, Row } from '../../lib/types';
import { Button } from '../ui/controls';
import { ErrorBanner } from '../ui/display';
import { Modal } from '../ui/overlay';
import { useToast } from '../ui/Toast';
import { blankPatient, Demographics } from './PatientForm';
import { blankPolicy, PolicyEditor } from './PolicyEditor';

/** Turns whatever was typed in a search box into a sensible starting point. */
export function prefillFromQuery(q = '', extra: Row = {}): Row {
  const p = { ...blankPatient(), ...extra };
  const s = q.trim();
  if (!s) return p;
  if (/^[+\d][\d\s-]{5,}$/.test(s)) return { ...p, phone: s };
  if (/^784/.test(s)) return { ...p, nationalId: s };
  const [first, ...rest] = s.split(/\s+/);
  return { ...p, firstName: first[0].toUpperCase() + first.slice(1), lastName: rest.join(' ') };
}

export function QuickRegister({ open, onClose, initial, onCreated, title = 'Register patient', submitLabel = 'Register', submit }: {
  open: boolean; onClose: () => void; initial?: Row; onCreated: (p: PatientSummary) => void; title?: string; submitLabel?: string;
  /** Override the POST, e.g. to register an appointment guest. */
  submit?: (body: Row) => Promise<PatientSummary>;
}) {
 const {t:healthcareT}=useHealthcareLocalization();
  const api = useApiClient();
  const toast = useToast();
  const [value, setValue] = useState<Row>(blankPatient());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setValue({ ...blankPatient(), ...initial }); setErrors({}); setBanner(null); } }, [open]); // eslint-disable-hc-line react-hooks/exhaustive-deps

  const save = async () => {
    setSaving(true); setErrors({}); setBanner(null);
    try {
      const p = submit ? await submit(value) : await api<PatientSummary>('/patients', { method: 'POST', body: value });
      toast({ tone: 'ok', title: healthcareT("{v0} registered",{v0:p.fullName}), body: healthcareT("MRN {v0}",{v0:p.mrn}) });
      onCreated(p);
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fields).length) { setErrors(e.fields); setBanner('Check the highlighted fields.'); }
      else setBanner(errorMessage(e));
    } finally { setSaving(false); }
  };

  const policies: Row[] = value.policies ?? [];
  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-4xl"
      title={<span className="flex items-center gap-2"><UserPlus className="h-4 w-4 text-hc-petrol-600" />{title}</span>}
      subtitle="Only the starred fields are needed now. The MRN is issued on save."
      footer={<><Button variant="ghost" onClick={onClose}><LocalizedText message="Cancel" /></Button><Button mutation variant="primary" loading={saving} onClick={save}>{submitLabel}</Button></>}
    >
      <div className="space-y-3" onKeyDown={(e) => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') { e.preventDefault(); save(); } }}>
        {banner && <ErrorBanner message={banner} />}
        <Demographics value={value} onChange={setValue} errors={errors} compact />
        {policies.length === 0 ? (
          <Button mutation size="sm" variant="subtle" icon={<ShieldPlus className="h-3.5 w-3.5" />} onClick={() => setValue({ ...value, policies: [blankPolicy(true)] })}><LocalizedText message="Add insurance now" /></Button>
        ) : (
          <PolicyEditor value={policies} onChange={(p) => setValue({ ...value, policies: p })} errors={errors} />
        )}
      </div>
    </Modal>
  );
}
