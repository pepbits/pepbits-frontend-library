'use client';

import { ArrowLeft, BedDouble, ChevronDown, FileText, Printer, Send, Settings2, Stethoscope, UserRound } from '@pepbits/icons';
import { Link } from '../host';
import { useParams, useRouter, useSettleRoute } from '../host';
import { useRef, useState } from 'react';
import { BalanceLine, LifecycleRail } from '../components/bill/BalanceLine';
import { BillSettingsDrawer, ReasonDialog } from '../components/bill/BillDialogs';
import { ApprovalsTab, PaymentsTab, SponsorTab, Timeline } from '../components/bill/BillTabs';
import { ChargesPanel, type ChargesHandle } from '../components/bill/ChargesPanel';
import { DepositPointsPanel, PaymentPanel, type PaymentHandle } from '../components/bill/MoneyRail';
import { Menu, MenuItem, useErrorToast, useToast } from '../components/ui/overlay';
import { Badge, Button, ErrorNote, Gated, Skeleton, Tabs } from '../components/ui/primitives';
import { useApi, useMutation } from '../lib/api';
import { age, billTypeLabel, restrictionLabel, useFormat } from '../lib/format';
import { useHotkey } from '../lib/hotkeys';
import { useSession } from '../lib/session';
import type { BillPayload } from '../lib/types';

type Tab = 'charges' | 'sponsor' | 'payments' | 'approvals' | 'history';
type Ask = null | 'reopen' | 'cancel' | 'writeoff';

export default function BillPage() {
  const { money, date } = useFormat();
  const { billNo } = useParams<{ billNo: string }>();
  const router = useRouter();
  const { openWindow } = useSettleRoute();
  const { data, error, loading, reload } = useApi<BillPayload>(`/bills/${billNo}`);
  const { meta } = useSession();
  const { run, pending } = useMutation();
  const toast = useToast();
  const fail = useErrorToast();
  const [tab, setTab] = useState<Tab>('charges');
  const [ask, setAsk] = useState<Ask>(null);
  const [settings, setSettings] = useState(false);
  const charges = useRef<ChargesHandle>(null);
  const pay = useRef<PaymentHandle>(null);

  const act = async (path: string, body: object, ok: (d: BillPayload) => string | null, failTitle: string) => {
    try {
      const { data: d } = await run<BillPayload>(`/bills/${billNo}/${path}`, 'POST', body);
      const msg = ok(d);
      if (msg) toast({ tone: 'success', title: msg });
      setAsk(null);
      return d;
    } catch (e) { fail(e, failTitle); return null; }
  };

  const finalize = () => act('finalize', {}, (d) => {
    const o = d.result?.overpayment;
    if (o?.deposit) toast({ tone: 'info', title: `Excess ${money(o.refunds.reduce((s, r) => s - r.amount, 0))} moved to deposit ${o.deposit}`, body: 'It can be set off on any future bill for this patient.' });
    else if (o?.trimmed) toast({ tone: 'info', title: `Set-off reduced by ${money(o.trimmed)} so the bill isn’t overpaid` });
    return `Bill ${billNo} finalized`;
  }, 'Not finalized');

  useHotkey('a', () => { setTab('charges'); setTimeout(() => charges.current?.focusAdd(), 30); }, !!data);
  useHotkey('p', () => pay.current?.focusAmount(), !!data);
  useHotkey('f', () => { if (data?.actions.finalize.allowed) finalize(); }, !!data);

  if (error) return <div className="space-y-3"><BackLink /><ErrorNote error={error} onRetry={reload} /></div>;
  if (loading || !data) return <WorkspaceSkeleton />;

  const { bill, patient, visit, actions } = data;
  const pendingApprovals = data.approvals.filter((a) => a.status === 'pending').length;
  const sponsorName = data.claims.find((c) => c.priority === 1)?.sponsor_name;

  const primary = (() => {
    if (bill.status === 'A') return { label: 'Finalize', kbd: 'F', gate: actions.finalize, onClick: finalize };
    if (bill.status === 'F') {
      if (actions.close.allowed) return { label: 'Close bill', gate: actions.close, onClick: () => act('close', {}, () => `Bill ${billNo} closed`, 'Not closed') };
      if (actions.sendClaim.allowed) return { label: 'Send claim to sponsor', gate: actions.sendClaim, onClick: () => act('send-claim', {}, () => 'Claim sent', 'Claim not sent'), icon: <Send className="h-4 w-4" /> };
      return { label: 'Close bill', gate: actions.close, onClick: () => {} };
    }
    return null;
  })();

  return (
    <div className="flex flex-col gap-4">
      {/* Header strip */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Link href="/bills" aria-label="Back to bills" className="mt-1 rounded-lg p-1.5 text-ink-soft hover:bg-panel hover:text-ink"><ArrowLeft className="rtl:-scale-x-100 h-5 w-5" /></Link>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="text-[length:calc(22px*var(--fs-scale,1))] font-semibold tracking-[-0.01em]">{bill.bill_no}</h1>
              <Badge tone={bill.bill_type === 'P' ? 'sky' : 'indigo'}>{billTypeLabel(bill.bill_type)}</Badge>
              {bill.restriction_type !== 'N' && <Badge>{restrictionLabel(bill.restriction_type)}</Badge>}
              {bill.is_primary ? <Badge tone="pine">Primary</Badge> : null}
              {sponsorName && <Badge tone="indigo">{sponsorName}</Badge>}
              {data.ratePlan && data.ratePlan.discount_pct > 0 && <Badge tone="gray">{data.ratePlan.name}</Badge>}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[length:calc(13px*var(--fs-scale,1))] text-ink-soft">
              <Link href={`/patients/${patient.mr_no}`} className="inline-flex items-center gap-1.5 font-medium text-ink hover:text-pine-700">
                <UserRound className="h-3.5 w-3.5" />{patient.name}
              </Link>
              <span>{patient.mr_no}{patient.gender ? `, ${patient.gender}` : ''}{age(patient.dob) !== null ? ` ${age(patient.dob)} y` : ''}</span>
              <span className="inline-flex items-center gap-1.5">
                {visit.visit_type === 'i' ? <BedDouble className="h-3.5 w-3.5" /> : <Stethoscope className="h-3.5 w-3.5" />}
                {visit.visit_id}, {visit.doctor || 'no doctor'}{visit.ward ? `, ${visit.ward}` : ''}
              </span>
              <span>Opened {date(bill.created_at)}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 ps-11 xl:ps-0">
          <LifecycleRail bill={bill} />
          <div className="flex items-center gap-2">
            {primary && (
              <Gated reasons={primary.gate.allowed ? undefined : primary.gate.reasons} side="bottom">
                <Button variant="primary" kbd={primary.kbd} icon={primary.icon} disabled={!primary.gate.allowed} loading={pending} onClick={primary.onClick}>{primary.label}</Button>
              </Gated>
            )}
            <Menu trigger={({ toggle, open }) => (
              <Button variant="secondary" onClick={toggle} aria-expanded={open}>More <ChevronDown className="h-4 w-4" /></Button>
            )}>
              {(close) => (
                <>
                  <MenuItem icon={<Printer className="h-4 w-4" />} onClick={() => { close(); openWindow(`/print/bill/${billNo}`); }}>Print bill</MenuItem>
                  <MenuItem icon={<FileText className="h-4 w-4" />} onClick={() => { close(); openWindow(`/print/bill/${billNo}?detail=1`); }}>Print itemized statement</MenuItem>
                  <MenuItem icon={<Settings2 className="h-4 w-4" />} onClick={() => { close(); setSettings(true); }}>Bill settings</MenuItem>
                  <div className="my-1 h-px bg-line" />
                  {bill.status === 'F' && actions.sendClaim.allowed && primary?.label !== 'Send claim to sponsor' && (
                    <MenuItem onClick={() => { close(); act('send-claim', {}, () => 'Claim sent', 'Claim not sent'); }}>Send claim to sponsor</MenuItem>
                  )}
                  <MenuItem disabled={!actions.writeoff.allowed} hint={actions.writeoff.allowed ? undefined : actions.writeoff.reasons[0]} onClick={() => { close(); setAsk('writeoff'); }}>Request write-off</MenuItem>
                  <MenuItem disabled={!actions.reopen.allowed} hint={actions.reopen.allowed ? undefined : actions.reopen.reasons[0]} onClick={() => { close(); setAsk('reopen'); }}>Reopen bill</MenuItem>
                  <MenuItem disabled={!actions.cancel.allowed} hint={actions.cancel.allowed ? undefined : actions.cancel.reasons[0]} onClick={() => { close(); setAsk('cancel'); }}>
                    <span className={actions.cancel.allowed ? 'text-rose-600' : ''}>Cancel bill</span>
                  </MenuItem>
                </>
              )}
            </Menu>
          </div>
        </div>
      </div>

      {bill.reopen_reason && bill.status === 'A' && (
        <p className="rounded-lg border border-marigold-100 bg-marigold-50 px-4 py-2 text-[length:calc(13px*var(--fs-scale,1))] text-marigold-800">Reopened — {bill.reopen_reason}</p>
      )}

      <BalanceLine bill={bill} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className="panel flex min-h-[420px] flex-col overflow-hidden xl:h-[calc(100dvh-var(--header-h)-var(--footer-h)-260px)] xl:min-h-[460px]">
          <Tabs className="px-2" value={tab} onChange={setTab} tabs={[
            { value: 'charges', label: 'Charges', count: data.charges.filter((c) => c.status === 'A' && !c.is_system).length },
            { value: 'sponsor', label: 'Sponsor split', hidden: !bill.is_tpa },
            { value: 'payments', label: 'Payments', count: data.receipts.length + data.setoffs.length },
            { value: 'approvals', label: 'Approvals', count: pendingApprovals || null },
            { value: 'history', label: 'History' },
          ]} />
          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === 'charges' && <ChargesPanel ref={charges} data={data} />}
            {tab === 'sponsor' && <SponsorTab data={data} />}
            {tab === 'payments' && <PaymentsTab data={data} />}
            {tab === 'approvals' && <ApprovalsTab data={data} />}
            {tab === 'history' && <Timeline entries={data.history} />}
          </div>
        </section>

        <aside className="flex flex-col gap-4 xl:sticky xl:top-[calc(var(--header-h)+16px)] xl:max-h-[calc(100dvh-var(--header-h)-var(--footer-h)-260px)] xl:min-h-[460px] xl:overflow-y-auto">
          <PaymentPanel ref={pay} data={data} />
          <DepositPointsPanel data={data} />
          <div className="panel grid grid-cols-2 gap-3 p-4 text-[length:calc(12.5px*var(--fs-scale,1))]">
            <Fact label="Advances held" value={money(bill.advance_balance || 0)} />
            <Fact label="Receipts" value={String(data.receipts.filter((r) => r.status === 'A' && !r.reversal_of).length)} />
            <Fact label="Finalized" value={bill.finalized_at ? `${date(bill.finalized_at)}, ${bill.finalized_by}` : 'Not yet'} />
            <Fact label="Deposit balance" value={money(data.deposits.balance)} />
          </div>
        </aside>
      </div>

      <ReasonDialog open={ask === 'reopen'} onClose={() => setAsk(null)} title={`Reopen ${billNo}`} sub="Reopening clears finalization and write-off status. Changes are tracked in the history."
        confirmLabel="Reopen bill" codes={meta?.reopenReasons} pending={pending} onConfirm={(reason, code) => act('reopen', { reason, reasonCode: code }, () => `Bill ${billNo} reopened`, 'Not reopened')} />
      <ReasonDialog open={ask === 'cancel'} onClose={() => setAsk(null)} title={`Cancel ${billNo}`} danger confirmLabel={meta?.prefs.bill_cancellation_requires_approval ? 'Request cancellation' : 'Cancel bill'}
        sub={meta?.prefs.bill_cancellation_requires_approval ? 'An approver will review this before the bill is cancelled.' : 'The bill will be cancelled straight away.'}
        pending={pending} onConfirm={(reason) => act('cancel', { reason }, (d) => (d.result?.requested ? 'Cancellation sent for approval' : `Bill ${billNo} cancelled`), 'Not cancelled')} />
      <ReasonDialog open={ask === 'writeoff'} onClose={() => setAsk(null)} title={`Write off ${money(bill.patient_due)}`} sub="The amount is marked for write-off and sent for approval. Once approved, the bill closes."
        confirmLabel="Send for approval" pending={pending} onConfirm={(reason) => act('writeoff', { reason }, () => 'Write-off sent for approval', 'Write-off not requested')} />
      <BillSettingsDrawer open={settings} onClose={() => setSettings(false)} data={data} />
      {bill.status === 'X' && <CancelledNote onBack={() => router.push('/bills')} />}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div><p className="text-ink-mute">{label}</p><p className="truncate font-medium text-ink">{value}</p></div>;
}

function BackLink() {
  return <Link href="/bills" className="inline-flex items-center gap-1.5 text-[length:calc(13px*var(--fs-scale,1))] text-ink-soft hover:text-ink"><ArrowLeft className="rtl:-scale-x-100 h-4 w-4" />All bills</Link>;
}

function CancelledNote({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-[length:calc(13px*var(--fs-scale,1))] text-rose-700">
      This bill is cancelled and kept for the record only.
      <Button size="sm" variant="secondary" onClick={onBack}>Back to bills</Button>
    </div>
  );
}

function WorkspaceSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-12 w-80" />
      <Skeleton className="h-24 w-full" />
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]"><Skeleton className="h-[460px]" /><Skeleton className="h-[460px]" /></div>
    </div>
  );
}
