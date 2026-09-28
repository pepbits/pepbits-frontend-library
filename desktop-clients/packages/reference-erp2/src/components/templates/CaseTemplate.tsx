'use client';
import { useRouter, cx, daysBetween, statusTone, todayISO, listUrl, useDebounce, useFetch, useEntityApi, Avatar, Badge, Button, Input, Segmented, Select, Skeleton, useToast, WorkList, useAuth, Card, Frame, nounOf, type ListResponse, type PageDef, type Row } from '@pepbits/reference-keystone-core';
import { useEffect, useMemo, useState } from 'react';
import { Kanban, List, Plus, Search } from 'lucide-react';
import { newPath, recordPath } from '../../lib/registry';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


const DOT: Record<string, string> = { ok: 'bg-ok', warn: 'bg-warn', danger: 'bg-danger', info: 'bg-info', neutral: 'bg-ink-3', brand: 'bg-brand', violet: 'bg-violet' };
const PRIO_TONE = (p: string) => (p === 'Urgent' ? 'danger' : p === 'High' ? 'warn' : p === 'Low' ? 'neutral' : 'info') as 'danger' | 'warn' | 'neutral' | 'info';

/** Work that moves through stages: drag cards across the board, discuss in the side panel. */
export default function CaseTemplate({ def }: { def: PageDef }) {
 const referenceT = useReferenceLocalization().t;

  const entityApi = useEntityApi();
  const toast = useToast();
  const { user } = useAuth();
  const flow = def.statusFlow ?? [];
  const [mode, setMode] = useState<'board' | 'list'>('board');
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 250);
  const [prio, setPrio] = useState('');
  const [assignee, setAssignee] = useState('');
  const [tick, setTick] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const router = useRouter();
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const filters = prio ? { priority: [prio] } : {};
  const { data, loading } = useFetch<ListResponse>(`${listUrl(def.entity, { q: dq, size: 1000, filters, sort: 'created', dir: 'desc' })}&_r=${tick}`);
  useEffect(() => { if (data) setRows(data.rows); }, [data]);
  const people = useMemo(() => [...new Set(rows.map((r) => String(r.assignee ?? '')))].filter(Boolean).sort(), [rows]);
  const shown = useMemo(() => (assignee ? rows.filter((r) => r.assignee === assignee) : rows), [rows, assignee]);

  const move = async (id: string, status: string) => {
    const r = rows.find((x) => x.id === id);
    if (!r || r.status === status) return;
    const activity = [...(r.activity ?? []), { at: todayISO(), by: user?.name ?? 'You', text: `Moved from ${r.status} to ${status}` }];
    setRows((rs) => rs.map((x) => (x.id === id ? { ...x, status, activity } : x)));
    try {
      const saved = await entityApi.update(def.entity, id, { status, activity });
      toast(referenceT("{value0} moved to {value1}", {value0: r.code, value1: status}));
      void saved;
    } catch (e) { toast((e as Error).message, 'danger'); setTick((t) => t + 1); }
  };


  const newCase = () => router.push(newPath(def));

  return (
    <Frame>
      <Card className="shrink-0">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={referenceT("Search {value0}", {value0: referenceT(def.title)})} className="pl-8" />
          </div>
          <Select value={prio} onChange={(e) => setPrio(e.target.value)} className="w-auto" aria-label={referenceT("Priority")}>
            <option value=""><ReferenceText message="Any priority" /></option>
            {['Urgent', 'High', 'Normal', 'Low'].map((p) => <option key={p}>{p}</option>)}
          </Select>
          <Select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="w-auto max-w-[200px]" aria-label={referenceT("Assignee")}>
            <option value=""><ReferenceText message="Everyone" /></option>
            {people.map((p) => <option key={p}>{p}</option>)}
          </Select>
          <span className="flex-1" />
          <span className="hidden text-[length:calc(12.5px*var(--fs-scale))] text-ink-3 md:inline tnum">{shown.filter((r) => r.status !== flow[flow.length - 1]).length} <ReferenceText message="open," /> {shown.length} <ReferenceText message="total" /></span>
          <Segmented size="sm" value={mode} onChange={setMode} options={[{ value: 'board', icon: Kanban, label: 'Board' }, { value: 'list', icon: List, label: 'List' }]} />
          <Button variant="primary" icon={Plus} onClick={newCase}><ReferenceText message="New" /> {nounOf(def)}</Button>
        </div>
      </Card>

      {mode === 'list' ? (
        <Card className="min-h-[420px] flex-1"><WorkList def={def} reloadKey={tick} newLabel={`New ${nounOf(def)}`} /></Card>
      ) : (
        <div className="flex min-h-[460px] flex-1 gap-3 overflow-x-auto pb-1">
          {flow.map((s) => {
            const items = shown.filter((r) => r.status === s);
            return (
              <div
                key={s}
                onDragOver={(e) => { e.preventDefault(); setOver(s); }}
                onDragLeave={() => setOver((o) => (o === s ? null : o))}
                onDrop={(e) => { e.preventDefault(); setOver(null); if (dragId) move(dragId, s); setDragId(null); }}
                className={cx('flex w-[250px] min-w-[236px] flex-1 flex-col rounded-lg border bg-surface-2 transition-colors', over === s ? 'border-brand bg-brand-soft/60' : 'border-line')}
              >
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <span className={cx('h-2 w-2 rounded-full', DOT[statusTone(s)])} />
                  <span className="text-[length:calc(13px*var(--fs-scale))] font-semibold">{s}</span>
                  <span className="rounded bg-surface-3 px-1.5 text-[length:calc(11.5px*var(--fs-scale))] text-ink-2 tnum">{items.length}</span>
                </div>
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2 pb-2">
                  {loading && !data && Array.from({ length: 3 }, (_, i) => <div key={i} className="rounded-md border border-line bg-surface p-3"><Skeleton className="mb-2 w-16" /><Skeleton className="w-full" /></div>)}
                  {items.map((r) => {
                    const age = r.created ? daysBetween(r.created, todayISO()) : 0;
                    return (
                      <div
                        key={r.id}
                        draggable
                        onDragStart={(e) => { setDragId(r.id); e.dataTransfer.effectAllowed = 'move'; }}
                        onDragEnd={() => setDragId(null)}
                        onClick={() => router.push(recordPath(def, r.id))}
                        className={cx('cursor-grab rounded-md border border-line bg-surface p-2.5 shadow-sm transition-shadow hover:border-line-strong hover:shadow-panel active:cursor-grabbing', dragId === r.id && 'opacity-50')}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[length:calc(11.5px*var(--fs-scale))] font-medium text-brand-ink tnum">{r.code}</span>
                          <span className="flex-1" />
                          {r.priority && <Badge tone={PRIO_TONE(r.priority)}>{r.priority}</Badge>}
                        </div>
                        <p className="mt-1 line-clamp-2 text-[length:calc(13px*var(--fs-scale))] font-medium leading-snug text-ink">{r.subject}</p>
                        <p className="mt-0.5 truncate text-[length:calc(12px*var(--fs-scale))] text-ink-3">{r.customer ?? r.location} {r.category ? `/ ${r.category}` : ''}</p>
                        <div className="mt-2 flex items-center gap-2 text-[length:calc(11.5px*var(--fs-scale))] text-ink-3">
                          <Avatar name={r.assignee} size={20} />
                          <span className="flex-1 truncate">{r.assignee}</span>
                          <span className={cx('tnum', age > 7 && s !== flow[flow.length - 1] && 'font-medium text-danger')}>{age}<ReferenceText message="d" /></span>
                        </div>
                      </div>
                    );
                  })}
                  {!loading && !items.length && <div className="rounded-md border border-dashed border-line px-3 py-6 text-center text-[length:calc(12px*var(--fs-scale))] text-ink-3"><ReferenceText message="Drop items here" /></div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

    </Frame>
  );
}
