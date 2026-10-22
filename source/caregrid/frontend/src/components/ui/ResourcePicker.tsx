'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { useApi } from '@/lib/live';
import { KindIcon } from './primitives';

export function ResourcePicker({ value, onChange }: { value: number | null; onChange: (id: number | null, r?: any) => void }) {
  const { data } = useApi<any[]>('/resources', { live: false });
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const selected = data?.find(r => r.id === value);
  const list = useMemo(() => (data ?? []).filter(r => !q || `${r.name} ${r.role_label} ${r.department}`.toLowerCase().includes(q.toLowerCase())).slice(0, 80), [data, q]);
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)} className="field flex items-center gap-2 text-left">
        {selected ? <><KindIcon kind={selected.kind} className="h-4 w-4 shrink-0" /><span className="flex-1 truncate">{selected.name}</span><span className="truncate text-xs text-muted">{selected.role_label}</span></>
          : <span className="flex-1 text-ink-400">Choose a person, machine, room, chair, bed or vehicle</span>}
        <ChevronDown className="h-4 w-4 shrink-0 text-ink-400" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-line bg-white shadow-pop animate-rise">
          <div className="relative border-b border-line">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input autoFocus className="h-10 w-full pl-9 pr-3 text-sm outline-none" placeholder="Search by name, role or department" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {list.map(r => (
              <button type="button" key={r.id} onClick={() => { onChange(r.id, r); setOpen(false); setQ(''); }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-canvas">
                <KindIcon kind={r.kind} className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-ink">{r.name}</span>
                <span className="max-w-[45%] truncate text-xs text-muted">{r.role_label}, {r.department}</span>
              </button>
            ))}
            {!list.length && <div className="px-3 py-4 text-center text-sm text-muted">No resource matches.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
