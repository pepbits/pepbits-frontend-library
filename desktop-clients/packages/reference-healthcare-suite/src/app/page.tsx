'use client';
import {useLocalization as useHealthcareLocalization} from '@pepbits/ops-ui';
import {useLocalization} from '@pepbits/ops-ui';
import {LocalizedText} from '@pepbits/ops-ui';
import clsx from 'clsx';
import { AlertTriangle, ArrowUpRight, BadgeCheck, CalendarDays, CalendarPlus, Hospital, Pill, ReceiptText, Stethoscope, UserPlus, UserRoundX } from 'lucide-react';
import { ReferenceLink as Link } from '@pepbits/reference-host';
import { ReactNode } from 'react';
import { Badge, EmptyState, ErrorBanner, Spinner, StatusBadge } from '../components/ui/display';
import { useFormat } from '../lib/format';
import { useApi, useInterval } from '../lib/hooks';
import { usePageHeader, useSession } from '../lib/session';
import { Row } from '../lib/types';

function Kpi({ label, value, sub, href, tone = 'ink', icon }: { label: string; value: ReactNode; sub?: ReactNode; href: string; tone?: 'ink' | 'warn' | 'petrol' | 'selfpay'; icon: ReactNode }) {
  const {number}=useFormat();
  return (
    <Link href={href} className="hc-panel group flex items-start justify-between gap-3 p-3 transition-colors hover:border-hc-petrol-200">
      <div className="min-w-0">
        <p className="text-hc-xs text-hc-ink-mute"><LocalizedText message={label}/></p>
        <p className={clsx('hc-num mt-1 text-hc-2xl font-semibold leading-none', { ink: 'text-hc-ink', warn: 'text-hc-warn-700', petrol: 'text-hc-petrol-700', selfpay: 'text-hc-selfpay-700' }[tone])}>{typeof value==='number'?number(value):value}</p>
        {sub && <p className="mt-1.5 truncate text-hc-2xs text-hc-ink-mute">{typeof sub==='string'?<LocalizedText message={sub}/>:sub}</p>}
      </div>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-hc-canvas text-hc-ink-soft group-hover:bg-hc-petrol-50 group-hover:text-hc-petrol-700">{icon}</span>
    </Link>
  );
}

const ACTIONS = [
  { href: '/encounters/new', label: 'New encounter', icon: Stethoscope, primary: true },
  { href: '/appointments', label: 'Book appointment', icon: CalendarPlus },
  { href: '/patients/new', label: 'Register patient', icon: UserPlus },
  { href: '/billing/hospital', label: 'Hospital billing', icon: Hospital },
  { href: '/billing/pharmacy', label: 'Pharmacy billing', icon: Pill },
];

export default function Dashboard() {
 const {t:healthcareT}=useHealthcareLocalization();
 const {t}=useLocalization();
  const { money, sinceLabel,number , fmtTime } = useFormat();
  const { session, facility, currency } = useSession();
  usePageHeader(healthcareT("Dashboard"), facility ? t('{facility} · today at a glance',{facility:facility.name}) : undefined);
  const { data: d, error, reload } = useApi<Row>('/dashboard');
  useInterval(reload, 15000);
  if (error) return <ErrorBanner message={error.message} onRetry={reload} />;
  if (!d) return <div className="flex flex-1 items-center justify-center"><Spinner label="Loading today" /></div>;
  const appt = d.appointments.byStatus ?? {};

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-hc-sm text-hc-ink-soft"><LocalizedText message={new Date().getHours()<12?'Good morning, {name}.':new Date().getHours()<17?'Good afternoon, {name}.':'Good evening, {name}.'} values={{name:session?.user?.name.split(' ')[0]??''}}/></p>
        <div className="flex flex-wrap gap-1.5">
          {ACTIONS.map((a) => (
            <Link key={a.href} href={a.href} className={clsx('inline-flex h-8 items-center gap-1.5 rounded px-3 text-hc-sm font-medium', a.primary ? 'bg-hc-petrol-600 text-white hover:bg-hc-petrol-700' : 'border border-hc-line-strong bg-hc-surface hover:border-hc-ink-faint')}>
              <a.icon className="h-3.5 w-3.5" /><LocalizedText message={a.label}/>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Appointments" value={d.appointments.total} sub={t('{booked} booked · {arrived} arrived · {noShow} no-show',{booked:number(appt.Booked??0),arrived:number(appt.Arrived??0),noShow:number(appt['No-show']??0)})} href="/appointments" icon={<CalendarDays className="h-4 w-4" />} />
        <Kpi label="Encounters" value={d.encounters.total} sub={Object.entries(d.encounters.byType ?? {}).map(([k, v]) => `${number(Number(v))} ${t(k)}`).join(' · ') || t('None yet')} href="/encounters" icon={<Stethoscope className="h-4 w-4" />} />
        <Kpi label="Pending approvals" value={d.approvals.pending} tone={d.approvals.pending ? 'warn' : 'ink'} sub="Prior approval and eRx" href="/approvals" icon={<BadgeCheck className="h-4 w-4" />} />
        <Kpi label="Waiting to bill" value={d.unbilled.hospital + d.unbilled.pharmacy} sub={t('{hospital} hospital · {pharmacy} pharmacy',{hospital:number(d.unbilled.hospital),pharmacy:number(d.unbilled.pharmacy)})} href="/billing/hospital" icon={<ReceiptText className="h-4 w-4" />} />
        <Kpi label={t("Billed today ({v0})",{v0:currency})} value={money(d.revenue.hospital + d.revenue.pharmacy)} tone="petrol" sub={t('{hospital} hospital · {pharmacy} pharmacy',{hospital:money(d.revenue.hospital),pharmacy:money(d.revenue.pharmacy)})} href="/billing/invoices" icon={<Hospital className="h-4 w-4" />} />
        <Kpi label={t("Collected ({v0})",{v0:currency})} value={money(d.revenue.collected)} tone="selfpay" sub={t('{amount} to claim from payers',{amount:money(d.revenue.receivable)})} href="/billing/invoices" icon={<Pill className="h-4 w-4" />} />
      </div>

      <div className="grid min-h-[320px] flex-1 gap-3 lg:grid-cols-3">
        <section className="hc-panel flex min-h-0 flex-col overflow-hidden lg:col-span-1">
          <div className="hc-panel-head"><h3 className="hc-panel-title"><LocalizedText message="Next appointments" /></h3><Link href="/appointments" className="flex items-center gap-0.5 text-hc-xs text-hc-petrol-700 hover:underline"><LocalizedText message="Board" /><ArrowUpRight className="h-3 w-3" /></Link></div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {d.upcoming.length === 0 ? <EmptyState title="No more bookings today" /> : d.upcoming.map((a: Row) => (
              <Link key={a.id} href={a.patientId ? `/encounters/new?appointmentId=${a.id}` : `/appointments?focus=${a.id}`} className="flex items-center gap-2.5 rounded-md px-2 py-2 hover:bg-hc-canvas">
                <span className="hc-num w-11 shrink-0 text-hc-sm font-semibold">{fmtTime(a.startTime)}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 truncate text-hc-sm font-medium">{!a.patientId && <UserRoundX className="h-3.5 w-3.5 text-hc-selfpay-600" />}{a.patientName || a.guestName}</span>
                  <span className="block truncate text-hc-2xs text-hc-ink-mute">{a.resourceName} · {a.reason}</span>
                </span>
                <span className="text-hc-2xs font-medium text-hc-petrol-700">{a.patientId ? <LocalizedText message="Check in"/> : <LocalizedText message="Register"/>}</span>
              </Link>
            ))}
          </div>
        </section>
        <section className="hc-panel flex min-h-0 flex-col overflow-hidden">
          <div className="hc-panel-head"><h3 className="hc-panel-title"><LocalizedText message="Waiting on payers" /></h3><Link href="/approvals" className="flex items-center gap-0.5 text-hc-xs text-hc-petrol-700 hover:underline"><LocalizedText message="All" /><ArrowUpRight className="h-3 w-3" /></Link></div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {d.approvals.recentPending.length === 0 ? <EmptyState icon={<BadgeCheck className="h-7 w-7" />} title="Nothing pending" body="Requests appear here while the payer is deciding." /> : d.approvals.recentPending.map((a: Row) => (
              <Link key={a.id} href={`/encounters/${a.encounterId}`} className="block rounded-md px-2 py-2 hover:bg-hc-canvas">
                <span className="flex items-center justify-between gap-2 text-hc-sm"><span className="truncate font-medium">{a.patientName}</span><Badge tone={a.channel === 'eRx' ? 'info' : 'warn'}>{a.channel === 'eRx' ? <LocalizedText message="eRx"/> : <LocalizedText message="Prior approval"/>}</Badge></span>
                <span className="block truncate text-hc-2xs text-hc-ink-mute">{a.approvalNo} · {a.itemsLabel} · {sinceLabel(a.submittedAt)}</span>
              </Link>
            ))}
          </div>
        </section>
        <section className="hc-panel flex min-h-0 flex-col overflow-hidden">
          <div className="hc-panel-head"><h3 className="hc-panel-title"><LocalizedText message="Stock below reorder level" /></h3><Link href="/masters/items" className="flex items-center gap-0.5 text-hc-xs text-hc-petrol-700 hover:underline"><LocalizedText message="Items" /><ArrowUpRight className="h-3 w-3" /></Link></div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {d.lowStock.length === 0 ? <EmptyState title="Stock levels are healthy" /> : d.lowStock.map((i: Row) => (
              <div key={i.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-2 text-hc-sm">
                <span className="flex min-w-0 items-center gap-2"><AlertTriangle className="h-3.5 w-3.5 shrink-0 text-hc-warn-600" /><span className="truncate">{i.name}</span></span>
                <span className="hc-num shrink-0 text-hc-xs"><span className="font-semibold text-hc-danger-700">{i.stockQty}</span><span className="text-hc-ink-mute"> / {i.reorderLevel} {i.uom}</span></span>
              </div>
            ))}
            {Object.keys(d.encounters.byStatus ?? {}).length > 0 && (
              <div className="mt-2 border-t border-hc-line px-2 pt-2">
                <p className="mb-1 text-hc-2xs text-hc-ink-mute"><LocalizedText message="Encounters by status" /></p>
                <div className="flex flex-wrap gap-1.5">{Object.entries(d.encounters.byStatus).map(([s, n]) => <span key={s} className="flex items-center gap-1"><StatusBadge status={s} /><span className="hc-num text-hc-2xs">{n as number}</span></span>)}</div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
