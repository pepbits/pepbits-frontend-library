import {LocalizedText} from '@pepbits/ops-ui';
import clsx from 'clsx';
import { AlertTriangle, Phone, ShieldCheck, Wallet } from 'lucide-react';
import { ReactNode } from 'react';
import { useFormat } from '../../lib/format';
import { Row } from '../../lib/types';
import { Badge, StatusBadge } from '../ui/display';

/**
 * The "wristband": identity, allergy flag and who pays, readable at a glance.
 * Left stripe is petrol for insured and amber for self-pay so the payment class is never ambiguous.
 */
export function PatientBanner({ patient, policy, coverage, paymentClass, eligibility, right, compact, className }: {
  patient: Row; policy?: Row | null; coverage?: Row | null; paymentClass?: 'Cash' | 'Insurance' | string;
  eligibility?: { status: string; reference?: string } | null; right?: ReactNode; compact?: boolean; className?: string;
}) {
  const { fmtDate } = useFormat();
  const insured = paymentClass ? paymentClass === 'Insurance' : !!policy;
  const pol = policy ?? null;
  const cov = coverage ?? pol;
  const allergies = String(patient.allergies ?? '').trim();
  return (
    <div className={clsx('relative flex items-stretch overflow-hidden rounded-lg border bg-hc-surface', insured ? 'border-hc-petrol-200' : 'border-hc-selfpay-100', className)}>
      <div className={clsx('w-1.5 shrink-0', insured ? 'bg-hc-petrol-500' : 'bg-hc-selfpay-500')} aria-hidden />
      <div className={clsx('flex min-w-0 flex-1 flex-wrap items-center gap-x-6 gap-y-2 px-3', compact ? 'py-2' : 'py-2.5')}>
        <div className="flex min-w-0 items-center gap-3">
          <span className={clsx('grid shrink-0 place-items-center rounded-full font-semibold', compact ? 'h-8 w-8 text-hc-xs' : 'h-10 w-10 text-hc-sm', insured ? 'bg-hc-petrol-50 text-hc-petrol-700' : 'bg-hc-selfpay-50 text-hc-selfpay-700')}>
            {String(patient.firstName ?? patient.fullName ?? '?')[0]}{String(patient.lastName ?? '')[0] ?? ''}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold leading-tight text-hc-ink">{patient.fullName ?? `${patient.firstName} ${patient.lastName}`}</p>
            <p className="hc-num mt-0.5 flex flex-wrap items-center gap-x-2 text-hc-xs text-hc-ink-mute">
              <span className="font-mono font-medium text-hc-ink-soft">{patient.mrn}</span>
              <span>{patient.age ?? '-'}<LocalizedText message="y ·" /> {patient.gender}</span>
              {patient.dob && <span><LocalizedText message="DOB" /> {fmtDate(patient.dob)}</span>}
              {!compact && patient.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{patient.phone}</span>}
            </p>
          </div>
        </div>
        <div className={clsx('flex items-center gap-1.5 rounded-md px-2 py-1 text-hc-xs', allergies ? 'bg-hc-danger-50 text-hc-danger-700' : 'text-hc-ink-mute')}>
          <AlertTriangle className={clsx('h-3.5 w-3.5', !allergies && 'opacity-60')} />
          {allergies ? <span><span className="font-semibold"><LocalizedText message="Allergy:" /></span> {allergies}</span> : <LocalizedText message="No known allergies"/>}
        </div>
        <div className="flex min-w-0 items-center gap-2 text-hc-xs">
          {insured && cov ? (
            <>
              <ShieldCheck className="h-4 w-4 shrink-0 text-hc-petrol-600" />
              <div className="min-w-0 leading-tight">
                <p className="truncate font-medium text-hc-ink">{cov.payerName} · {cov.planName}</p>
                <p className="hc-num truncate text-hc-ink-mute">
                  {cov.networkName}{pol?.memberId ? <LocalizedText message=" · {v0}" values={{v0:pol.memberId}}/> : ''} <LocalizedText message="· Co-pay" /> {cov.copayPct ?? 0}%{Number(cov.maxCopayPerVisit) ? <LocalizedText message=" (cap {v0})" values={{v0:cov.maxCopayPerVisit}}/> : ''}
                </p>
              </div>
              {pol?.isExpired && <Badge tone="danger"><LocalizedText message="Expired" /> {fmtDate(pol.validTo)}</Badge>}
            </>
          ) : (
            <><Wallet className="h-4 w-4 text-hc-selfpay-600" /><span className="font-medium text-hc-selfpay-700"><LocalizedText message="Self-pay" /></span></>
          )}
          {eligibility && <StatusBadge status={eligibility.status} />}
          {eligibility?.reference && <span className="font-mono text-hc-2xs text-hc-ink-mute">{eligibility.reference}</span>}
        </div>
      </div>
      {right && <div className="flex shrink-0 items-center gap-2 border-l border-hc-line px-3">{right}</div>}
    </div>
  );
}
