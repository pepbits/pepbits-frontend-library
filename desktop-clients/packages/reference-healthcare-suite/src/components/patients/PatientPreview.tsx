'use client';
import {LocalizedText} from '@pepbits/ops-ui';
import { CalendarPlus, Pencil, Stethoscope } from 'lucide-react';
import { ReferenceLink as Link } from '@pepbits/reference-host';
import { useFormat } from '../../lib/format';
import { useApi } from '../../lib/hooks';
import { Row } from '../../lib/types';
import { Badge, EmptyState, ErrorBanner, Spinner, StatusBadge } from '../ui/display';
import { PatientBanner } from './PatientBanner';

const btn = 'inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded text-hc-sm font-medium';

export function PatientPreview({ id }: { id: string }) {
  const { fmtDate, fmtDateTime , fmtTime } = useFormat();
  const { data: p, loading, error, reload } = useApi<Row>(`/patients/${id}`);
  if (error) return <div className="p-3"><ErrorBanner message={error.message} onRetry={reload} /></div>;
  if (!p || loading) return <div className="flex flex-1 justify-center py-10"><Spinner /></div>;
  const policies: Row[] = p.policies ?? [];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2 border-b border-hc-line p-3">
        <PatientBanner patient={p} policy={p.primaryPolicy} compact />
        <div className="flex gap-1.5">
          <Link href={`/encounters/new?patientId=${p.id}`} className={`${btn} bg-hc-petrol-600 text-white hover:bg-hc-petrol-700`}><Stethoscope className="h-3.5 w-3.5" /><LocalizedText message="Create encounter" /></Link>
          <Link href={`/appointments?patientId=${p.id}`} className={`${btn} border border-hc-line-strong bg-hc-surface hover:bg-hc-canvas/60`}><CalendarPlus className="h-3.5 w-3.5" /><LocalizedText message="Book" /></Link>
          <Link href={`/patients/${p.id}`} className={`${btn} max-w-[84px] border border-hc-line-strong bg-hc-surface hover:bg-hc-canvas/60`}><Pencil className="h-3.5 w-3.5" /><LocalizedText message="Edit" /></Link>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        <section>
          <h4 className="mb-1.5 text-hc-xs font-semibold text-hc-ink-soft"><LocalizedText message="Insurance" /></h4>
          {policies.length === 0 ? <p className="text-hc-xs text-hc-selfpay-700"><LocalizedText message="Self-pay, no policy on file" /></p> : policies.map((pol) => (
            <div key={pol.id} className="mb-1.5 rounded-md border border-hc-line px-2.5 py-2 text-hc-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{pol.payerName} · {pol.planName}</span>
                <span className="flex gap-1">{pol.isPrimary && <Badge tone="petrol"><LocalizedText message="Primary" /></Badge>}{pol.isExpired ? <Badge tone="danger"><LocalizedText message="Expired" /></Badge> : <StatusBadge status={pol.status} />}</span>
              </div>
              <p className="hc-num mt-0.5 text-hc-ink-mute">{pol.networkName} · {pol.tpaName} · <span className="font-mono">{pol.memberId}</span> <LocalizedText message="· to" /> {fmtDate(pol.validTo)}</p>
            </div>
          ))}
        </section>
        <section>
          <h4 className="mb-1.5 text-hc-xs font-semibold text-hc-ink-soft"><LocalizedText message="Upcoming appointments" /></h4>
          {(p.upcomingAppointments ?? []).length === 0 ? <p className="text-hc-xs text-hc-ink-mute"><LocalizedText message="None booked" /></p> : p.upcomingAppointments.map((a: Row) => (
            <Link key={a.id} href={`/appointments?date=${a.date}&focus=${a.id}`} className="mb-1 flex items-center justify-between rounded-md px-2 py-1.5 text-hc-xs hover:bg-hc-canvas">
              <span><span className="hc-num font-medium">{fmtDate(a.date)} {fmtTime(a.startTime)}</span> · {a.resourceName}</span><StatusBadge status={a.status} />
            </Link>
          ))}
        </section>
        <section>
          <h4 className="mb-1.5 text-hc-xs font-semibold text-hc-ink-soft"><LocalizedText message="Recent encounters" /></h4>
          {(p.encounters ?? []).length === 0 ? <EmptyState className="!py-4" title="No visits yet" /> : p.encounters.slice(0, 8).map((e: Row) => (
            <Link key={e.id} href={`/encounters/${e.id}`} className="mb-1 flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-hc-xs hover:bg-hc-canvas">
              <span className="min-w-0 truncate"><span className="font-mono text-hc-ink-soft">{e.encNo}</span> · {fmtDateTime(e.createdAt)} · {e.providerName || e.encounterType}</span>
              <StatusBadge status={e.status} />
            </Link>
          ))}
        </section>
      </div>
    </div>
  );
}
