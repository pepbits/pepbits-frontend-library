'use client';

import { useParams } from '../host';
import { PrintSheet, useAmountInWords } from '../components/PrintSheet';
import { ErrorNote, Skeleton } from '../components/ui/primitives';
import { useApi } from '../lib/api';
import { useFormat } from '../lib/format';
import type { LedgerRow } from '../lib/types';

export default function PrintReceipt() {
  const { money, dateTime } = useFormat();
  const rupeesInWords = useAmountInWords();
  const { no } = useParams<{ no: string }>();
  const { data, error } = useApi<LedgerRow & { raw: Record<string, unknown> }>(`/receipts/${no}`);
  if (error) return <div className="mx-auto max-w-xl"><ErrorNote error={error} /></div>;
  if (!data) return <Skeleton className="mx-auto h-[400px] max-w-[148mm]" />;
  const out = data.amount < 0;
  const title = data.kind === 'deposit' ? (out ? 'Deposit refund voucher' : 'Deposit receipt') : out ? 'Refund voucher' : data.payment_type === 'S' ? 'Sponsor receipt' : 'Payment receipt';
  return (
    <PrintSheet title={title} size="a5">
      {data.status === 'X' && <p className="mt-3 border-2 border-rose-500 py-1 text-center font-semibold text-rose-600">CANCELLED</p>}
      <dl className="mt-4 grid grid-cols-2 gap-y-2">
        <dt className="text-ink-mute">Number</dt><dd className="font-semibold">{data.no}</dd>
        <dt className="text-ink-mute">Date</dt><dd>{dateTime(data.created_at)}</dd>
        <dt className="text-ink-mute">{out ? 'Paid to' : 'Received from'}</dt><dd>{data.payer_name || data.patient_name} <span className="text-ink-mute">({data.mr_no})</span></dd>
        {data.bill_no && <><dt className="text-ink-mute">Against bill</dt><dd>{data.bill_no}</dd></>}
        <dt className="text-ink-mute">Towards</dt><dd>{data.label}</dd>
        <dt className="text-ink-mute">Mode</dt><dd>{data.mode_name}{data.card_last4 ? ` ending ${data.card_last4}` : ''}{data.reference ? `, ref. ${data.reference}` : ''}{data.bank ? `, ${data.bank}` : ''}</dd>
        {data.raw.card_auth ? <><dt className="text-ink-mute">Authorization</dt><dd>{String(data.raw.card_auth)}</dd></> : null}
      </dl>
      <div className="mt-5 flex items-center justify-between rounded-lg border-2 border-ink px-4 py-3">
        <span className="font-medium">{out ? 'Amount paid' : 'Amount received'}</span>
        <span className="text-[length:calc(22px*var(--fs-scale,1))] font-semibold tabular-nums">{money(Math.abs(data.amount))}</span>
      </div>
      <p className="mt-2 italic text-ink-soft">Amount in words (English): {rupeesInWords(Math.abs(data.amount))}</p>
      {data.kind === 'deposit' && !data.realized && <p className="mt-2 text-[length:calc(11.5px*var(--fs-scale,1))]">Subject to realization of the cheque.</p>}
      <div className="mt-10 flex justify-between text-[length:calc(11.5px*var(--fs-scale,1))] text-ink-soft">
        <span>{data.counter_name}, {data.username}</span><span>Cashier’s signature</span>
      </div>
    </PrintSheet>
  );
}
