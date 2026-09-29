'use client';
import {LocalizedText} from '@pepbits/ops-ui';
import clsx from 'clsx';
import { Boxes, ClipboardList, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useApiClient, qs } from '../../lib/api';
import { useFormat } from '../../lib/format';
import { useClickOutside, useDebounced } from '../../lib/hooks';
import { Quote } from '../../lib/types';
import { Input, inputBase } from '../ui/controls';
import { Badge, Spinner } from '../ui/display';

/** Searches items and services with prices already resolved for this patient's contract. */
export function CatalogSearch({ policyId, encounterType, onPick, disabled, kind }: {
  policyId?: string; encounterType: string; onPick: (q: Quote) => void; disabled?: boolean; kind: 'all' | 'item' | 'service';
}) {
  const api = useApiClient();
  const { money } = useFormat();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(false);
  const [hi, setHi] = useState(0);
  const dq = useDebounced(q.trim(), 180);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const ac = new AbortController();
    setLoading(true);
    api<Quote[]>(`/catalog/search${qs({ q: dq, kind, policyId, encounterType })}`, { signal: ac.signal })
      .then((r) => { setRows(r); setHi(0); })
      .catch(() => undefined)
      .finally(() => !ac.signal.aborted && setLoading(false));
    return () => ac.abort();
  }, [dq, open, kind, policyId, encounterType]);

  const pick = (r: Quote) => { onPick(r); setQ(''); setOpen(false); input.current?.blur(); };

  return (
    <div ref={ref} className="relative flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-hc-ink-faint" />
      <Input
        ref={input}
        value={q}
        disabled={disabled}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(rows.length - 1, h + 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
          else if (e.key === 'Enter' && rows[hi]) { e.preventDefault(); pick(rows[hi]); }
          else if (e.key === 'Escape') setOpen(false);
        }}
        role="combobox"
        aria-expanded={open}
        aria-controls="catalog-results"
        placeholder={disabled ? 'Ordering is closed for this encounter' : 'Order a service, drug or consumable: name, code or category'}
        className={clsx(inputBase, 'h-10 border-hc-line-strong pl-9 focus:border-hc-petrol-500 focus:ring-hc-petrol-100')}
      />
      {open && (
        <div id="catalog-results" role="listbox" className="absolute inset-x-0 top-[calc(100%+4px)] z-40 max-h-[420px] overflow-y-auto rounded-lg border border-hc-line bg-hc-surface shadow-hc-pop">
          <div className="sticky top-0 grid grid-cols-[1fr_90px_90px_150px] gap-2 border-b border-hc-line bg-[#F6F8F7] px-3 py-1.5 text-hc-2xs font-medium text-hc-ink-mute">
            <span><LocalizedText message="Item" /></span><span className="text-right"><LocalizedText message="Net" /></span><span className="text-right"><LocalizedText message="Patient pays" /></span><span><LocalizedText message="Coverage" /></span>
          </div>
          {loading && rows.length === 0 && <div className="p-3"><Spinner label="Searching" /></div>}
          {!loading && rows.length === 0 && <p className="p-3 text-hc-xs text-hc-ink-mute"><LocalizedText message={'Nothing matches "{query}".'} values={{query:dq}} /></p>}
          {rows.map((r, i) => (
            <button
              key={r.code}
              type="button"
              role="option"
              aria-selected={i === hi}
              onMouseEnter={() => setHi(i)}
              onClick={() => pick(r)}
              className={clsx('grid w-full grid-cols-[1fr_90px_90px_150px] items-center gap-2 px-3 py-2 text-left', i === hi && 'bg-hc-petrol-50')}
            >
              <span className="flex min-w-0 items-center gap-2">
                {r.kind === 'item' ? <Boxes className="h-4 w-4 shrink-0 text-hc-selfpay-600" /> : <ClipboardList className="h-4 w-4 shrink-0 text-hc-petrol-600" />}
                <span className="min-w-0">
                  <span className="block truncate text-hc-sm font-medium">{r.name}</span>
                  <span className="block truncate text-hc-2xs text-hc-ink-mute">
                    <span className="font-mono">{r.code}</span> · {r.category} · {r.billingCategory}{' '}<LocalizedText message="bill" />{r.stockQty !== null && <span className={clsx(r.stockQty <= 5 && 'text-hc-danger-600')}> · {r.stockQty} <LocalizedText message="in stock" /></span>}
                  </span>
                </span>
              </span>
              <span className="hc-num text-right text-hc-sm">{money(r.net)}</span>
              <span className="hc-num text-right text-hc-sm font-medium">{money(r.patientShare)}</span>
              <span className="flex flex-wrap gap-1">
                {!r.covered && <Badge tone="danger"><LocalizedText message="Not covered" /></Badge>}
                {r.priorAuthRequired && !r.erxRequired && <Badge tone="warn"><LocalizedText message="Prior approval" /></Badge>}
                {r.erxRequired && <Badge tone="info"><LocalizedText message="eRx" /></Badge>}
                {r.covered && !r.priorAuthRequired && !r.erxRequired && <Badge tone="ok"><LocalizedText message="Covered" /></Badge>}
              </span>
            </button>
          ))}
          {rows[0] && <p className="border-t border-hc-line px-3 py-1.5 text-hc-2xs text-hc-ink-mute"><LocalizedText message="Prices from" /> {rows[0].priceSource.replace(/ \(.*\)$/, '')}</p>}
        </div>
      )}
    </div>
  );
}
