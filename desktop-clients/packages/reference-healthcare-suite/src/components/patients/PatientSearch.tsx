'use client';
import {LocalizedText} from '@pepbits/ops-ui';
import clsx from 'clsx';
import { Search, UserPlus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useApiClient, qs } from '../../lib/api';
import { useClickOutside, useDebounced } from '../../lib/hooks';
import { Page, PatientSummary } from '../../lib/types';
import { Input, inputBase } from '../ui/controls';
import { Badge, Spinner } from '../ui/display';

/** Typeahead over MRN, name, phone, national ID and email. Enter picks the highlighted patient. */
export function PatientSearch({ onSelect, onCreate, autoFocus, placeholder, className, size = 'md' }: {
  onSelect: (p: PatientSummary) => void; onCreate?: (query: string) => void; autoFocus?: boolean; placeholder?: string; className?: string; size?: 'md' | 'lg';
}) {
  const api = useApiClient();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<PatientSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [hi, setHi] = useState(0);
  const dq = useDebounced(q.trim(), 200);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!dq) { setRows([]); return; }
    const ac = new AbortController();
    setLoading(true);
    api<Page<PatientSummary>>(`/patients${qs({ search: dq, pageSize: 8, status: 'Active' })}`, { signal: ac.signal })
      .then((r) => { setRows(r.data); setHi(0); })
      .catch(() => undefined)
      .finally(() => !ac.signal.aborted && setLoading(false));
    return () => ac.abort();
  }, [dq]);

  const pick = (p: PatientSummary) => { onSelect(p); setOpen(false); setQ(''); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(rows.length, h + 1)); setOpen(true); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (rows[hi]) pick(rows[hi]); else if (onCreate && hi === rows.length) { onCreate(q); setOpen(false); } }
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div ref={ref} className={clsx('relative', className)}>
      <Search className={clsx('pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-hc-ink-faint', size === 'lg' ? 'h-4 w-4' : 'h-3.5 w-3.5')} />
      <Input
        ref={inputRef}
        value={q}
        autoFocus={autoFocus}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        role="combobox"
        aria-expanded={open}
        aria-controls="patient-search-list"
        placeholder={placeholder ?? 'Search MRN, name, phone or national ID'}
        className={clsx(inputBase, 'border-hc-line-strong focus:border-hc-petrol-500 focus:ring-hc-petrol-100', size === 'lg' ? 'h-10 pl-9 text-hc-sm' : 'pl-8')}
      />
      {loading && <Spinner className="absolute right-3 top-1/2 -translate-y-1/2" />}
      {open && dq && (
        <div id="patient-search-list" role="listbox" className="absolute inset-x-0 top-[calc(100%+4px)] z-40 max-h-[360px] overflow-y-auto rounded-lg border border-hc-line bg-hc-surface py-1 shadow-hc-pop">
          {rows.map((p, i) => (
            <button
              key={p.id}
              type="button"
              role="option"
              aria-selected={i === hi}
              onMouseEnter={() => setHi(i)}
              onClick={() => pick(p)}
              className={clsx('flex w-full items-center gap-3 px-3 py-2 text-left', i === hi && 'bg-hc-petrol-50')}
            >
              <span className={clsx('h-8 w-1 shrink-0 rounded-full', p.primaryPolicy ? 'bg-hc-petrol-500' : 'bg-hc-selfpay-500')} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-hc-sm font-medium">{p.fullName}</span>
                  <span className="font-mono text-hc-2xs text-hc-ink-mute">{p.mrn}</span>
                </span>
                <span className="hc-num block truncate text-hc-2xs text-hc-ink-mute">{p.age}<LocalizedText message="y" /> {p.gender[0]} · {p.phone}{p.nationalId ? <LocalizedText message=" · {v0}" values={{v0:p.nationalId}}/> : ''}</span>
              </span>
              <Badge tone={p.primaryPolicy ? 'petrol' : 'selfpay'}>{p.insuranceLabel}</Badge>
            </button>
          ))}
          {!loading && rows.length === 0 && <p className="px-3 py-2 text-hc-xs text-hc-ink-mute"><LocalizedText message={'No patient matches "{query}".'} values={{query:dq}} /></p>}
          {onCreate && (
            <button
              type="button"
              onMouseEnter={() => setHi(rows.length)}
              onClick={() => { onCreate(q); setOpen(false); }}
              className={clsx('flex w-full items-center gap-2 border-t border-hc-line px-3 py-2 text-left text-hc-sm text-hc-petrol-700', hi === rows.length && 'bg-hc-petrol-50')}
            >
              <UserPlus className="h-4 w-4" /> <LocalizedText message={q ? 'Register a new patient "{query}"' : 'Register a new patient'} values={{query:q}} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
