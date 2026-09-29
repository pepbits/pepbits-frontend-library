'use client';
import {useLocalization as useHealthcareLocalization} from '@pepbits/ops-ui';
import {LocalizedText} from '@pepbits/ops-ui';
import {Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableContainer} from '@pepbits/ops-ui';
import { FileCheck2, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApiClient, ApiError, errorMessage } from '../../lib/api';
import { useFormat } from '../../lib/format';
import { OrderLine } from '../../lib/types';
import { Button, Field, Input, Textarea } from '../ui/controls';
import { ErrorBanner } from '../ui/display';
import { Modal } from '../ui/overlay';
import { useToast } from '../ui/Toast';

export const ICD = [
  'J02.9 Acute pharyngitis', 'J06.9 Upper respiratory infection', 'E11.9 Type 2 diabetes mellitus', 'I10 Essential hypertension', 'M23.2 Meniscus derangement',
  'M54.5 Low back pain', 'M05.9 Rheumatoid arthritis', 'L40.0 Psoriasis vulgaris', 'J45.9 Asthma', 'K21.9 Gastro-oesophageal reflux', 'S93.4 Ankle sprain', 'Z00.0 General medical examination',
];

export function ApprovalModal({ open, onClose, channel, encounterId, lines, insured, onSubmitted }: {
  open: boolean; onClose: () => void; channel: 'PriorAuth' | 'eRx'; encounterId: string; lines: OrderLine[]; insured: boolean; onSubmitted: () => void;
}) {
 const {t:healthcareT}=useHealthcareLocalization();
  const api = useApiClient();
  const { money } = useFormat();
  const toast = useToast();
  const [diagnosis, setDiagnosis] = useState('');
  const [justification, setJustification] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setErrors({}); setBanner(null); } }, [open]);

  const submit = async () => {
    setSaving(true); setErrors({}); setBanner(null);
    try {
      const a = await api<{ approvalNo: string }>(`/encounters/${encounterId}/approvals`, { method: 'POST', body: { channel, orderIds: lines.map((l) => l.id), diagnosis, justification } });
      toast({ tone: 'info', title: healthcareT("{v0} sent to payer",{v0:a.approvalNo}), body: healthcareT("The response appears here as soon as it arrives.") });
      onSubmitted(); onClose();
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fields).length) setErrors(e.fields); else setBanner(errorMessage(e));
    } finally { setSaving(false); }
  };

  const total = lines.reduce((s, l) => s + (insured ? l.payerShare : l.net), 0);
  const isErx = channel === 'eRx';
  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-2xl"
      title={<span className="flex items-center gap-2">{isErx ? <Send className="h-4 w-4 text-hc-info-600" /> : <FileCheck2 className="h-4 w-4 text-hc-warn-600" />}{isErx ? <LocalizedText message="Send electronic prescription"/> : <LocalizedText message="Request prior approval"/>}</span>}
      subtitle={isErx ? 'The prescription is validated by the payer (or the eRx hub for self-pay). Approval also covers prior approval for these drugs.' : 'Sent to the TPA for adjudication. Lines stay blocked from billing until approved.'}
      footer={<><Button variant="ghost" onClick={onClose}><LocalizedText message="Cancel" /></Button><Button mutation variant="primary" loading={saving} icon={<Send className="h-3.5 w-3.5" />} onClick={submit}><LocalizedText message="Submit {count} lines" values={{count:lines.length}}/></Button></>}
    >
      <div className="space-y-3">
        {banner && <ErrorBanner message={banner} />}
        <TableContainer className="overflow-hidden rounded-md border border-hc-line">
          <Table className="w-full text-hc-sm">
            <TableHeader className="bg-[#F6F8F7] text-hc-xs text-hc-ink-mute"><TableRow><TableHead className="px-3 py-1.5 text-left font-medium"><LocalizedText message="Line" /></TableHead><TableHead className="px-3 py-1.5 text-right font-medium"><LocalizedText message="Qty" /></TableHead><TableHead className="px-3 py-1.5 text-right font-medium">{insured ? <LocalizedText message="Payer amount"/> : <LocalizedText message="Net"/>}</TableHead></TableRow></TableHeader>
            <TableBody>
              {lines.map((l) => (
                <TableRow key={l.id} className="border-t border-hc-line">
                  <TableCell className="px-3 py-1.5"><span className="font-medium">{l.name}</span>{l.dosage && <span className="block text-hc-2xs text-hc-ink-mute">{l.dosage} · {l.frequency} · {l.durationDays} <LocalizedText message="days ·" /> {l.route}</span>}</TableCell>
                  <TableCell className="hc-num px-3 py-1.5 text-right">{l.qty}</TableCell>
                  <TableCell className="hc-num px-3 py-1.5 text-right">{money(insured ? l.payerShare : l.net)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t border-hc-line bg-hc-canvas/60 font-semibold"><TableCell className="px-3 py-1.5" colSpan={2}><LocalizedText message="Requested" /></TableCell><TableCell className="hc-num px-3 py-1.5 text-right">{money(total)}</TableCell></TableRow>
            </TableBody>
          </Table>
        </TableContainer>
        <Field htmlFor="appr-dx" label="Diagnosis (ICD-10)" required error={errors.diagnosis} hint="Pick from the list or type a code and description">
          <Input id="appr-dx" autoFocus list="icd-codes" value={diagnosis} invalid={!!errors.diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="e.g. M23.2 Meniscus derangement" />
          <datalist id="icd-codes">{ICD.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field htmlFor="appr-just" label="Clinical justification" required={!isErx} error={errors.justification || errors.orderIds}>
          <Textarea id="appr-just" rows={3} value={justification} invalid={!!errors.justification} onChange={(e) => setJustification(e.target.value)} placeholder={isErx ? 'Optional note for the pharmacist or payer' : 'Symptoms, findings and why this is needed now'} />
        </Field>
      </div>
    </Modal>
  );
}
