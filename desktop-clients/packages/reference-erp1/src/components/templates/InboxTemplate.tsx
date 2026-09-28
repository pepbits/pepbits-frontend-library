'use client';
import { RecordDocuments, useShortcutsEnabled, cx, daysBetween, relativeDays, todayISO, useFormat, listUrl, useDebounce, useFetch, useMediaQuery, useEntityApi, Avatar, Badge, Button, Checkbox, Drawer, Empty, Input, Kbd, Segmented, Skeleton, StatusBadge, Textarea, useToast, Card, Frame, type ListResponse, type PageDef, type Row } from '@pepbits/reference-keystone-core';
import { useEffect, useMemo, useState } from 'react';
import { Banknote, Check, CircleX, FileText, Inbox, MessageSquare, Plane, Receipt, Search, ShoppingBag, type LucideIcon } from 'lucide-react';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


const TYPE_ICON: Record<string, LucideIcon> = { Leave: Plane, 'Expense claim': Receipt, 'Purchase order': ShoppingBag, 'Payment voucher': Banknote, 'Credit note': FileText };

function Detail({ entity, row, onDecide, busy, related, onPick }: { entity: string; row: Row | null; onDecide: (r: Row, s: string, note: string) => void; busy: string | null; related: Row[]; onPick: (id: string) => void }) {
 const referenceT = useReferenceLocalization().t;

  const { fmtCurrency, fmtDate } = useFormat();
  const [note, setNote] = useState('');
  useEffect(() => setNote(''), [row?.id]);
  if (!row) return <Empty icon={Inbox} title={referenceT("Nothing selected")} body="Pick a request on the left. Use J and K to move, A to approve, R to reject." className="h-full" />;
  const I = TYPE_ICON[row.type] ?? FileText;
  const overdue = row.status === 'Pending' && row.due < todayISO();
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line px-5 py-4">
        <div className="flex items-center gap-2 text-[length:calc(12.5px*var(--fs-scale))] text-ink-3">
          <I size={15} /> {row.type} <span className="tnum">{row.code}</span>
          <span className="flex-1" />
          <StatusBadge value={row.status} />
        </div>
        <div className="mt-2 flex items-center gap-3">
          <Avatar name={row.requester} size={40} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[length:calc(17px*var(--fs-scale))] font-semibold tracking-tight">{row.requester}</h2>
            <div className="text-[length:calc(12.5px*var(--fs-scale))] text-ink-3">{row.department}</div>
          </div>
          <div className="text-right">
            <div className="text-[length:calc(22px*var(--fs-scale))] font-semibold tracking-tight tnum">{row.type === 'Leave' ? referenceT(row.days === 1 ? "{count} day" : "{count} days", { count: row.days }) : fmtCurrency(row.amount)}</div>
            <div className={cx('text-[length:calc(12px*var(--fs-scale))]', overdue ? 'font-medium text-danger' : 'text-ink-3')}>{overdue ? referenceT(daysBetween(row.due, todayISO()) === 1 ? "Overdue by {count} day" : "Overdue by {count} days", { count: daysBetween(row.due, todayISO()) }) : referenceT("Due {date}", { date: fmtDate(row.due) })}</div>
          </div>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[['Submitted', fmtDate(row.submitted)], ['Due by', fmtDate(row.due)], ['Priority', row.priority], ['Department', row.department]].map(([k, v]) => (
            <div key={k} className="rounded-md bg-surface-2 px-3 py-2"><dt className="text-[length:calc(11.5px*var(--fs-scale))] text-ink-3">{k}</dt><dd className="text-[length:calc(13px*var(--fs-scale))] font-medium">{v}</dd></div>
          ))}
        </dl>
        <div>
          <h3 className="mb-1 text-[length:calc(13px*var(--fs-scale))] font-semibold"><ReferenceText message="Request" /></h3>
          <p className="max-w-prose text-[length:calc(13.5px*var(--fs-scale))] leading-relaxed text-ink-2">{row.summary}</p>
        </div>
        <div>
          <h3 className="mb-2 text-[length:calc(13px*var(--fs-scale))] font-semibold"><ReferenceText message="Route" /></h3>
          <ol className="flex flex-wrap items-center gap-2 text-[length:calc(12.5px*var(--fs-scale))]">
            {[row.requester, 'You', 'Finance controller'].map((p, i) => (
              <li key={p} className="flex items-center gap-2">
                <span className={cx('rounded-full px-2.5 py-1', i === 0 ? 'bg-brand-soft text-brand-ink' : i === 1 ? (row.status === 'Pending' ? 'bg-accent-soft font-medium text-warn' : 'bg-brand-soft text-brand-ink') : 'bg-surface-3 text-ink-3')}>{p}</span>
                {i < 2 && <span className="text-ink-3"><ReferenceText message="then" /></span>}
              </li>
            ))}
          </ol>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <div>
            <h3 className="mb-2 text-[length:calc(13px*var(--fs-scale))] font-semibold"><ReferenceText message="Attachments" /></h3>
            <RecordDocuments entity={entity} id={row.id} compact includeLocalAttachments={false} />
          </div>
          <div>
            <h3 className="mb-2 text-[length:calc(13px*var(--fs-scale))] font-semibold"><ReferenceText message="Also waiting from" /> {String(row.requester).split(' ')[0]}<ReferenceText message="'s team" /></h3>
            <ul className="divide-y divide-line rounded-lg border border-line text-[length:calc(13px*var(--fs-scale))]">
              {related.map((x) => (
                <li key={x.id}>
                  <button onClick={() => onPick(x.id)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-2">
                    <span className="flex-1 truncate">{x.type} <ReferenceText message="from" /> {x.requester}</span>
                    <span className="text-[length:calc(12px*var(--fs-scale))] text-ink-3 tnum">{x.type === 'Leave' ? `${x.days}d` : fmtCurrency(x.amount)}</span>
                  </button>
                </li>
              ))}
              {!related.length && <li className="px-3 py-3 text-[length:calc(12.5px*var(--fs-scale))] text-ink-3"><ReferenceText message="Nothing else pending from" /> {row.department}.</li>}
            </ul>
          </div>
        </div>
      </div>
      {row.status === 'Pending' ? (
        <div className="space-y-2 border-t border-line bg-surface-2 px-5 py-3">
          <div className="relative">
            <MessageSquare size={14} className="absolute left-2.5 top-2.5 text-ink-3" />
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={referenceT("Note to the requester (optional)")} rows={2} className="pl-8" />
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-[length:calc(12px*var(--fs-scale))] text-ink-3 sm:inline"><Kbd><ReferenceText message="A" /></Kbd> <ReferenceText message="approve" /> <Kbd><ReferenceText message="R" /></Kbd> <ReferenceText message="reject" /></span>
            <span className="flex-1" />
            <Button variant="danger" icon={CircleX} loading={busy === 'Rejected'} onClick={() => onDecide(row, 'Rejected', note)}><ReferenceText message="Reject" /></Button>
            <Button variant="primary" icon={Check} loading={busy === 'Approved'} onClick={() => onDecide(row, 'Approved', note)}><ReferenceText message="Approve" /></Button>
          </div>
        </div>
      ) : (
        <div className="border-t border-line bg-surface-2 px-5 py-3 text-[length:calc(12.5px*var(--fs-scale))] text-ink-3"><ReferenceText message="Decided. This request is" /> {String(row.status).toLowerCase()}.</div>
      )}
    </div>
  );
}

/** Everything that needs a decision, from every module, in one queue. */
export default function InboxTemplate({ def }: { def: PageDef }) {
 const referenceT = useReferenceLocalization().t;

  const entityApi = useEntityApi();
  const { fmtCurrency } = useFormat();
  const toast = useToast();
  const isWide = useMediaQuery('(min-width: 1024px)');
  const [type, setType] = useState<string | null>(null);
  const [status, setStatus] = useState<'Pending' | 'Approved' | 'Rejected'>('Pending');
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 250);
  const [tick, setTick] = useState(0);
  const [selId, setSelId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const types = def.fields.find((f) => f.key === 'type')?.options ?? [];

  const { data, loading } = useFetch<ListResponse>(`${listUrl(def.entity, { q: dq, size: 300, facet: 'type', sort: 'due', dir: 'asc', filters: { status: [status], ...(type ? { type: [type] } : {}) } })}&_r=${tick}`);
  const rows = useMemo(() => data?.rows ?? [], [data]);
  const sel = rows.find((r) => r.id === selId) ?? null;
  useEffect(() => { if (isWide && rows.length && !rows.some((r) => r.id === selId)) setSelId(rows[0].id); }, [rows, selId, isWide]);
  useEffect(() => setChecked(new Set()), [type, status, dq]);

  const decide = async (r: Row, s: string, note = '') => {
    setBusy(s);
    try {
      await entityApi.update(def.entity, r.id, { status: s, decisionNote: note });
      toast(referenceT("{value0} {value1}", {value0: r.code, value1: referenceT(s)}));
      const idx = rows.findIndex((x) => x.id === r.id);
      setSelId(rows[idx + 1]?.id ?? rows[idx - 1]?.id ?? null);
      setTick((t) => t + 1);
    } catch (e) { toast((e as Error).message, 'danger'); } finally { setBusy(null); }
  };
  const bulk = async (s: string) => {
    const ids = [...checked];
    await Promise.all(ids.map((id) => entityApi.update(def.entity, id, { status: s })));
    toast(referenceT(ids.length === 1 ? "{count} request {status}" : "{count} requests {status}", {count: ids.length, status: referenceT(s)}));
    setChecked(new Set());
    setTick((t) => t + 1);
  };

  const shortcuts = useShortcutsEnabled();
  useEffect(() => {
    if (!shortcuts) return;
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || e.ctrlKey || e.metaKey) return;
      const idx = rows.findIndex((r) => r.id === selId);
      if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); setSelId(rows[Math.min(rows.length - 1, idx + 1)]?.id ?? null); }
      if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); setSelId(rows[Math.max(0, idx - 1)]?.id ?? null); }
      if (sel && sel.status === 'Pending' && e.key === 'a') decide(sel, 'Approved');
      if (sel && sel.status === 'Pending' && e.key === 'r') decide(sel, 'Rejected');
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });
  useEffect(() => { document.querySelector(`[data-inbox="${selId}"]`)?.scrollIntoView({ block: 'nearest' }); }, [selId]);

  const facetTotal = data ? Object.values(data.facets).reduce((a, b) => a + b, 0) : 0;
  const related = sel ? rows.filter((r) => r.id !== sel.id && r.department === sel.department).slice(0, 4) : [];
  const detail = <Detail entity={def.entity} row={sel} onDecide={decide} busy={busy} related={related} onPick={setSelId} />;

  return (
    <Frame className={cx(isWide && 'flex-row')}>
      <Card className={cx('flex flex-col', isWide ? 'w-[420px] shrink-0 xl:w-[460px]' : 'flex-1')}>
        <div className="space-y-2 border-b border-line p-2.5">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={referenceT("Search requests")} className="pl-8" />
            </div>
            <Segmented size="sm" value={status} onChange={setStatus} options={[{ value: 'Pending', label: 'To do' }, { value: 'Approved', label: 'Approved' }, { value: 'Rejected', label: 'Rejected' }]} />
          </div>
          <div className="flex gap-1 overflow-x-auto">
            {[null, ...types].map((t) => (
              <button key={t ?? 'all'} onClick={() => setType(t)} className={cx('shrink-0 rounded-full px-2.5 py-1 text-[length:calc(12.5px*var(--fs-scale))] font-medium', type === t ? 'bg-rail text-white dark:bg-brand' : 'text-ink-2 hover:bg-surface-3')}>
                {t ?? 'All'} <span className="opacity-70 tnum">{t ? data?.facets[t] ?? 0 : facetTotal}</span>
              </button>
            ))}
          </div>
          {checked.size > 0 && status === 'Pending' && (
            <div className="flex items-center gap-2 rounded-md bg-rail px-3 py-1.5 text-[length:calc(12.5px*var(--fs-scale))] text-white anim-fade">
              <span className="flex-1 font-medium">{checked.size} <ReferenceText message="selected" /></span>
              <button className="rounded px-2 py-0.5 hover:bg-rail-3" onClick={() => bulk('Approved')}><ReferenceText message="Approve all" /></button>
              <button className="rounded px-2 py-0.5 text-[#ffb4a6] hover:bg-rail-3" onClick={() => bulk('Rejected')}><ReferenceText message="Reject all" /></button>
            </div>
          )}
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {loading && !data && Array.from({ length: 8 }, (_, i) => <li key={i} className="border-b border-line px-3 py-3"><Skeleton className="mb-2 w-2/3" /><Skeleton className="w-full" /></li>)}
          {rows.map((r) => {
            const I = TYPE_ICON[r.type] ?? FileText;
            const overdue = r.status === 'Pending' && r.due < todayISO();
            const active = r.id === selId;
            return (
              <li key={r.id} data-inbox={r.id}>
                <div onClick={() => setSelId(r.id)} className={cx('relative flex cursor-pointer gap-2.5 border-b border-line px-3 py-2.5', active ? 'bg-brand-soft' : 'hover:bg-surface-2')}>
                  {active && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-accent" />}
                  {status === 'Pending' && <Checkbox checked={checked.has(r.id)} onChange={(on) => setChecked((s) => { const n = new Set(s); if (on) n.add(r.id); else n.delete(r.id); return n; })} className="mt-1" />}
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-surface-3 text-ink-2"><I size={15} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[length:calc(13px*var(--fs-scale))] font-medium">{r.requester}</span>
                      {r.priority !== 'Normal' && <Badge tone={r.priority === 'Urgent' ? 'danger' : 'warn'}>{r.priority}</Badge>}
                      <span className="flex-1" />
                      <span className="text-[length:calc(12.5px*var(--fs-scale))] font-medium tnum">{r.type === 'Leave' ? referenceT(r.days === 1 ? "{count} day" : "{count} days", { count: r.days }) : fmtCurrency(r.amount)}</span>
                    </div>
                    <div className="truncate text-[length:calc(12.5px*var(--fs-scale))] text-ink-2">{r.type}, {r.department}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-[length:calc(11.5px*var(--fs-scale))] text-ink-3">
                      <span className="tnum">{r.code}</span>
                      <span><ReferenceText message="Submitted" /> {relativeDays(r.submitted)}</span>
                      <span className={cx('ml-auto', overdue && 'font-medium text-danger')}>{overdue ? referenceT("Overdue") : `Due ${relativeDays(r.due)}`}</span>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
          {data && !rows.length && <Empty icon={Check} title={status === 'Pending' ? 'You are all caught up' : 'No requests here'} body={status === 'Pending' ? 'New requests will appear here as soon as they are submitted.' : 'Try another type or clear the search.'} />}
        </ul>
        <div className="border-t border-line bg-surface-2 px-3 py-1.5 text-[length:calc(12px*var(--fs-scale))] text-ink-3 tnum">{referenceT(rows.length === 1 ? "{count} request, oldest due first" : "{count} requests, oldest due first", {count: rows.length})}</div>
      </Card>
      {isWide ? <Card className="min-w-0 flex-1">{detail}</Card> : (
        <Drawer open={Boolean(sel)} onClose={() => setSelId(null)} title={sel?.code ?? ''} width="lg">
          <div className="-mx-5 -my-4 h-[calc(100dvh-58px)]">{detail}</div>
        </Drawer>
      )}
    </Frame>
  );
}
