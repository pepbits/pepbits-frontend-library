'use client';

import clsx from 'clsx';
import { ArrowRight, BadgeCheck, CornerDownLeft, FilePlus2, History, ReceiptText, Search, Settings2, User, Vault, Wallet } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { qs, useApi, useDebounced } from '@/lib/api';
import { money, STATUS } from '@/lib/format';

type Result = { id: string; group: string; title: string; sub?: string; icon: React.ReactNode; run: () => void; right?: React.ReactNode };
interface SearchRes {
  bills: { bill_no: string; status: keyof typeof STATUS; patient_due: number; patient_name: string; bill_type: string }[];
  patients: { mr_no: string; name: string; phone: string; city: string }[];
  receipts: { no: string; bill_no: string | null; amount: number }[];
}

export function CommandPalette({ open, onClose, onNewBill }: { open: boolean; onClose: () => void; onNewBill: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const dq = useDebounced(q.trim(), 150);
  const input = useRef<HTMLInputElement>(null);
  const { data } = useApi<SearchRes>(open && dq.length >= 2 ? `/search${qs({ q: dq })}` : null);

  useEffect(() => { if (open) { setQ(''); setIdx(0); setTimeout(() => input.current?.focus(), 20); } }, [open]);

  const go = (href: string) => () => { onClose(); router.push(href); };

  const results = useMemo<Result[]>(() => {
    const actions: Result[] = [
      { id: 'new', group: 'Actions', title: 'New bill', icon: <FilePlus2 className="h-4 w-4" />, run: () => { onClose(); onNewBill(); }, right: 'N' },
      { id: 'bills', group: 'Actions', title: 'Open bills with dues', icon: <ReceiptText className="h-4 w-4" />, run: go('/bills?due=patient') },
      { id: 'dep', group: 'Actions', title: 'Collect a deposit', icon: <Wallet className="h-4 w-4" />, run: go('/patients') },
      { id: 'cheq', group: 'Actions', title: 'Realize cheques', icon: <Wallet className="h-4 w-4" />, run: go('/receipts?unrealized=1') },
      { id: 'appr', group: 'Actions', title: 'Review approvals', icon: <BadgeCheck className="h-4 w-4" />, run: go('/approvals') },
      { id: 'close', group: 'Actions', title: 'Close my counter', icon: <Vault className="h-4 w-4" />, run: go('/day-close') },
      { id: 'audit', group: 'Actions', title: 'Audit trail', icon: <History className="h-4 w-4" />, run: go('/audit') },
      { id: 'set', group: 'Actions', title: 'Settings', icon: <Settings2 className="h-4 w-4" />, run: go('/settings') },
    ];
    const term = q.trim().toLowerCase();
    const acts = term ? actions.filter((a) => a.title.toLowerCase().includes(term)) : actions;
    const out: Result[] = [];
    if (data && dq.length >= 2) {
      for (const b of data.bills) out.push({ id: `b${b.bill_no}`, group: 'Bills', title: `${b.bill_no}  ${b.patient_name}`, sub: STATUS[b.status].label,
        icon: <ReceiptText className="h-4 w-4" />, run: go(`/bills/${b.bill_no}`), right: b.patient_due > 0.004 ? `Due ${money(b.patient_due)}` : undefined });
      for (const p of data.patients) out.push({ id: `p${p.mr_no}`, group: 'Patients', title: p.name, sub: `${p.mr_no}, ${p.phone}`, icon: <User className="h-4 w-4" />, run: go(`/patients/${p.mr_no}`) });
      for (const r of data.receipts) out.push({ id: `r${r.no}`, group: 'Receipts', title: r.no, sub: r.bill_no ? `Bill ${r.bill_no}` : 'Deposit', icon: <Wallet className="h-4 w-4" />,
        run: go(`/receipts?open=${r.no}`), right: money(r.amount) });
    }
    return [...out, ...acts];
  }, [data, dq, q]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setIdx(0); }, [results.length]);

  if (!open || typeof document === 'undefined') return null;
  let lastGroup = '';
  return createPortal(
    <div data-dialog-open="true" className="fixed inset-0 z-[85] flex items-start justify-center p-3 pt-[10vh]" onKeyDown={(e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, results.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
      if (e.key === 'Enter') { e.preventDefault(); results[idx]?.run(); }
    }}>
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label="Search" className="relative w-full max-w-[640px] animate-pop-in overflow-hidden rounded-2xl bg-white shadow-pop">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="h-5 w-5 text-ink-mute" />
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search bill, patient, MR, phone or receipt…"
            className="h-14 flex-1 bg-transparent text-[16px] outline-none placeholder:text-ink-mute" aria-label="Search" />
          <kbd className="rounded border border-line px-1.5 text-[11px] text-ink-mute">Esc</kbd>
        </div>
        <div className="max-h-[56vh] overflow-y-auto p-2" role="listbox">
          {results.length === 0 && <p className="px-3 py-8 text-center text-[14px] text-ink-soft">Nothing found for “{q}”.</p>}
          {results.map((r, i) => {
            const header = r.group !== lastGroup ? r.group : null;
            lastGroup = r.group;
            return (
              <div key={r.id}>
                {header && <p className="px-3 pb-1 pt-2.5 text-[11.5px] font-medium text-ink-mute">{header}</p>}
                <button type="button" role="option" aria-selected={i === idx} onMouseEnter={() => setIdx(i)} onClick={r.run}
                  className={clsx('flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left', i === idx ? 'bg-pine-50' : '')}>
                  <span className={clsx('flex h-8 w-8 items-center justify-center rounded-lg', i === idx ? 'bg-white text-pine-700' : 'bg-mist text-ink-soft')}>{r.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium">{r.title}</span>
                    {r.sub && <span className="block truncate text-[12px] text-ink-mute">{r.sub}</span>}
                  </span>
                  {r.right && <span className="text-[12.5px] text-ink-soft">{r.right}</span>}
                  {i === idx && <CornerDownLeft className="h-4 w-4 text-pine-600" />}
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 border-t border-line bg-mist/60 px-4 py-2 text-[12px] text-ink-mute">
          <span className="inline-flex items-center gap-1"><ArrowRight className="h-3 w-3 rotate-90" /> to move</span>
          <span className="inline-flex items-center gap-1"><CornerDownLeft className="h-3 w-3" /> to open</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
