'use client';
import { Link, useRouter, useSearchParams, cx, relativeDays, todayISO, useFormat, listUrl, useFetch, useEntityApi, Avatar, Badge, Button, Select, Stepper, StatusBadge, Textarea, useToast, FieldInput, missingRequired, RecordForm, useAuth, type ListResponse, type Row } from '@pepbits/reference-keystone-core';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CalendarClock, ChevronRight, Folder, FileText, Pencil, Plus, Save, Send, Trash2, X } from 'lucide-react';
import { newPath, nounOf, pagePath, recordPath } from '../../lib/registry';
import { usePageTitle } from '../shell/pageTitle';
import { Page, RecordBar, RecordLoading, Section, useRecord, useSaveShortcut, useUnsavedGuard, type Mode, type RecordProps } from './RecordShell';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


/** Shared create / edit form page for templates whose view page is custom. */
function FormPage({ def, id, mode, fields, defaults, extraBody, title, submitLabel, aside, validate }: RecordProps & { mode: Exclude<Mode, 'view'>; fields: typeof def.fields; defaults: Partial<Row>; extraBody?: (d: Partial<Row>) => Partial<Row>; title: string; submitLabel: string; aside?: (d: Partial<Row>) => ReactNode; validate?: (d: Partial<Row>) => string | null }) {
 const referenceT = useReferenceLocalization().t;

  const entityApi = useEntityApi();
  const router = useRouter();
  const toast = useToast();
  const { row, loading, error, reload } = useRecord(def, id);
  const [draft, setDraft] = useState<Partial<Row>>(defaults);
  const [errors, setErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (row) setDraft(row); }, [row]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(row ?? defaults);
  useUnsavedGuard(dirty);
  usePageTitle(mode === 'new' ? title : row ? `Edit ${row.code ?? ''}` : '');
  const save = useCallback(async () => {
    const miss = missingRequired(fields, draft);
    if (miss.length) { setErrors(true); toast(referenceT("{value0} is required", {value0: referenceT(miss[0].label)}), 'danger'); return; }
    const problem = validate?.(draft);
    if (problem) { toast(problem, 'danger'); return; }
    setBusy(true);
    try {
      const body = { ...draft, ...(extraBody?.(draft) ?? {}) };
      const saved = mode === 'new' ? await entityApi.create(def.entity, body) : await entityApi.update(def.entity, id!, body);
      toast(referenceT("{value0} {value1}", {value0: saved.code ?? nounOf(def), value1: mode === 'new' ? 'created' : 'saved'}));
      router.replace(recordPath(def, saved.id));
    } catch (e) { toast((e as Error).message, 'danger'); } finally { setBusy(false); }
  }, [fields, draft, validate, extraBody, mode, def, id, router, toast]);
  useSaveShortcut(save);
  if (mode === 'edit' && (loading || error || !row)) return <RecordLoading error={error} onRetry={reload} />;
  return (
    <>
      <RecordBar def={def} id={id} mode={mode} dirty={dirty}>
        <Button icon={X} onClick={() => router.push(mode === 'new' ? pagePath(def) : recordPath(def, id!))}><ReferenceText message="Cancel" /></Button>
        <Button variant="primary" icon={Save} loading={busy} onClick={save}>{submitLabel}</Button>
      </RecordBar>
      <Page>
        <div className={cx('grid gap-4', aside && 'lg:grid-cols-[minmax(0,1fr)_340px]')}>
          <Section title={mode === 'new' ? title : 'Details'} description={referenceT("Fields marked * are required. Ctrl + S saves.")}>
            <RecordForm fields={fields} value={draft} onChange={(k, v) => setDraft((d) => ({ ...d, [k]: v }))} columns={2} showErrors={errors} />
          </Section>
          {aside && <aside className="space-y-4">{aside(draft)}</aside>}
        </div>
      </Page>
    </>
  );
}

/* ═════════════════ Cases / tickets ═════════════════ */
export function CaseRecord({ def, id, mode }: RecordProps) {
 const referenceT = useReferenceLocalization().t;

  const entityApi = useEntityApi();
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const flow = def.statusFlow ?? [];
  const { row, loading, error, reload, setRow } = useRecord(def, mode === 'view' ? id : undefined);
  const [comment, setComment] = useState('');
  usePageTitle(mode === 'view' && row ? String(row.subject) : null);
  const fields = def.fields.filter((f) => !['code', 'status', 'created'].includes(f.key)).map((f) => (f.key === 'subject' ? { ...f, pool: undefined, required: true } : f));

  if (mode !== 'view') {
    return <FormPage def={def} id={id} mode={mode} fields={fields} title={referenceT("New {value0}", {value0: nounOf(def)})} submitLabel={mode === 'new' ? `Create ${nounOf(def)}` : 'Save changes'}
      defaults={{ priority: 'Normal', assignee: user?.name }}
      extraBody={(d) => (mode === 'new' ? { status: flow[0], created: todayISO(), activity: [{ at: todayISO(), by: user?.name ?? 'You', text: 'Created' }] } : { activity: d.activity })} />;
  }
  if (loading || error || !row) return <RecordLoading error={error} onRetry={reload} />;

  const update = async (patch: Partial<Row>, msg: string) => {
    const saved = await entityApi.update(def.entity, id!, patch);
    setRow(saved);
    toast(msg);
  };
  const move = (status: string) => update({ status, activity: [...(row.activity ?? []), { at: todayISO(), by: user?.name ?? 'You', text: `Moved from ${row.status} to ${status}` }] }, `Moved to ${status}`);
  const post = async () => {
    if (!comment.trim()) return;
    await update({ activity: [...(row.activity ?? []), { at: todayISO(), by: user?.name ?? 'You', text: comment.trim() }] }, 'Update posted');
    setComment('');
  };
  const idx = flow.indexOf(row.status);
  const next = idx >= 0 && idx < flow.length - 1 ? flow[idx + 1] : null;
  const prioF = def.fields.find((f) => f.key === 'priority')!;
  const assigneeF = def.fields.find((f) => f.key === 'assignee')!;
  const info = def.fields.filter((f) => !['code', 'status', 'subject', 'priority', 'assignee'].includes(f.key));

  return (
    <>
      <RecordBar def={def} id={id} mode="view">
        <Button icon={Pencil} onClick={() => router.push(recordPath(def, id!, true))}><ReferenceText message="Edit" /></Button>
        {next && <Button variant="primary" onClick={() => move(next)}><ReferenceText message="Move to" /> {next.toLowerCase()}</Button>}
      </RecordBar>
      <Page>
        <div className="rounded-xl border border-line bg-surface p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[length:calc(13px*var(--fs-scale))] font-semibold text-brand-ink tnum">{row.code}</span>
            <StatusBadge value={row.status} />
            {row.priority && <Badge tone={row.priority === 'Urgent' ? 'danger' : row.priority === 'High' ? 'warn' : 'neutral'}>{row.priority} <ReferenceText message="priority" /></Badge>}
            <span className="text-[length:calc(12.5px*var(--fs-scale))] text-ink-3"><ReferenceText message="Opened" /> {relativeDays(row.created)}</span>
          </div>
          <div className="mt-4 overflow-x-auto"><Stepper steps={flow} current={row.status === flow[flow.length - 1] ? flow.length : Math.max(0, idx)} /></div>
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Section title={referenceT("Conversation")} description={referenceT("{value0} updates", {value0: (row.activity ?? []).length})} bodyClass="p-5">
            <ol className="space-y-4">
              {[...(row.activity ?? [])].sort((x: { at: string }, y: { at: string }) => x.at.localeCompare(y.at)).map((a: { at: string; by: string; text: string }, i: number) => (
                <li key={i} className="flex gap-3">
                  <Avatar name={a.by} size={30} />
                  <div className="min-w-0 flex-1 rounded-lg bg-surface-2 px-3.5 py-2.5">
                    <div className="flex items-baseline justify-between gap-2"><span className="text-[length:calc(13px*var(--fs-scale))] font-medium">{a.by}</span><span className="text-[length:calc(11.5px*var(--fs-scale))] text-ink-3">{relativeDays(a.at)}</span></div>
                    <p className="mt-0.5 text-[length:calc(13px*var(--fs-scale))] text-ink-2">{a.text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-5 rounded-lg border border-line p-3">
              <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={referenceT("Write an update or reply to the customer")} rows={3} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) post(); }} />
              <div className="mt-2 flex items-center justify-between"><span className="text-[length:calc(11.5px*var(--fs-scale))] text-ink-3"><ReferenceText message="Ctrl + Enter to post" /></span><Button variant="primary" icon={Send} disabled={!comment.trim()} onClick={post}><ReferenceText message="Post update" /></Button></div>
            </div>
          </Section>
          <aside className="space-y-4">
            <Section title={referenceT("Properties")} bodyClass="p-4 space-y-3">
              <div><div className="mb-1 text-[length:calc(12px*var(--fs-scale))] text-ink-3"><ReferenceText message="Stage" /></div><Select value={row.status} onChange={(e) => move(e.target.value)}>{flow.map((s) => <option key={s}>{s}</option>)}</Select></div>
              <div><div className="mb-1 text-[length:calc(12px*var(--fs-scale))] text-ink-3"><ReferenceText message="Priority" /></div><FieldInput field={prioF} value={row.priority} onChange={(v) => update({ priority: v }, 'Priority updated')} /></div>
              <div><div className="mb-1 text-[length:calc(12px*var(--fs-scale))] text-ink-3"><ReferenceText message={assigneeF.label} /></div><FieldInput field={assigneeF} value={row.assignee} onChange={(v) => setRow({ ...row, assignee: v })} /></div>
            </Section>
            <Section title={referenceT("Details")} bodyClass="p-4">
              <RecordForm fields={info} value={row} onChange={() => {}} readOnly columns={2} />
            </Section>
          </aside>
        </div>
      </Page>
    </>
  );
}

/* ═════════════════ Bookings ═════════════════ */
const toMin = (t: string) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };

export function BookingRecord({ def, id, mode }: RecordProps) {
 const referenceT = useReferenceLocalization().t;

  const entityApi = useEntityApi();
  const { fmtDate } = useFormat();
  const router = useRouter();
  const toast = useToast();
  const search = useSearchParams();
  const { row, loading, error, reload } = useRecord(def, mode === 'view' ? id : undefined);
  const resLabel = def.fields.find((f) => f.key === 'resource')?.label ?? 'Resource';
  usePageTitle(mode === 'view' && row ? `${row.person}, ${row.start}` : null);
  const defaults = useMemo(() => ({ resource: search.get('resource') ?? def.resources?.[0], date: search.get('date') ?? todayISO(), start: search.get('start') ?? '09:00', duration: 30, type: def.fields.find((f) => f.key === 'type')?.options?.[0] }), [search, def]);
  const [day, setDay] = useState<Row[]>([]);
  const dayDate = mode === 'view' ? row?.date : defaults.date;
  const { data } = useFetch<ListResponse>(dayDate ? listUrl(def.entity, { size: 500, filters: { date: [dayDate] }, sort: 'start', dir: 'asc' }) : null);
  useEffect(() => { if (data) setDay(data.rows); }, [data]);

  if (mode !== 'view') {
    const clash = (d: Partial<Row>) => day.find((r) => r.id !== id && r.resource === d.resource && r.date === d.date && r.status !== 'Cancelled' && toMin(String(d.start)) < toMin(r.start) + Number(r.duration) && toMin(r.start) < toMin(String(d.start)) + Number(d.duration || 30));
    return <FormPage def={def} id={id} mode={mode} fields={def.fields.filter((f) => f.key !== 'code' && f.key !== 'status')} defaults={defaults}
      title={referenceT("New {value0}", {value0: nounOf(def)})} submitLabel={mode === 'new' ? 'Confirm booking' : 'Save changes'}
      extraBody={(d) => ({ status: d.status ?? 'Booked', duration: Number(d.duration) || 30 })}
      validate={(d) => { const c = clash(d); return c ? `${d.resource} already has ${c.person} at ${c.start}` : null; }}
      aside={(d) => (
        <Section title={referenceT("{value0} on {value1}", {value0: d.resource ?? resLabel, value1: fmtDate(d.date, false)})} bodyClass="p-0">
          <ul className="divide-y divide-line">
            {day.filter((r) => r.resource === d.resource && r.status !== 'Cancelled').map((r) => (
              <li key={r.id} className={cx('flex items-center gap-3 px-4 py-2 text-[length:calc(13px*var(--fs-scale))]', clash(d)?.id === r.id && 'bg-danger-soft')}>
                <span className="w-12 font-semibold tnum">{r.start}</span><span className="flex-1 truncate">{r.person}</span><span className="text-[length:calc(12px*var(--fs-scale))] text-ink-3">{r.duration}<ReferenceText message="m" /></span>
              </li>
            ))}
            {!day.some((r) => r.resource === d.resource && r.status !== 'Cancelled') && <li className="px-4 py-4 text-[length:calc(12.5px*var(--fs-scale))] text-ink-3"><ReferenceText message="Nothing else booked. Every slot is free." /></li>}
          </ul>
        </Section>
      )} />;
  }
  if (loading || error || !row) return <RecordLoading error={error} onRetry={reload} />;
  const setStatus = async (s: string) => { await entityApi.update(def.entity, id!, { status: s }); toast(referenceT("{value0} marked {value1}", {value0: row.code, value1: referenceT(s)})); reload(); };
  const hasNoShow = def.fields.find((f) => f.key === 'status')?.options?.includes('No show');
  return (
    <>
      <RecordBar def={def} id={id} mode="view">
        {row.status === 'Booked' && <Button variant="danger" onClick={() => setStatus('Cancelled')}><ReferenceText message="Cancel booking" /></Button>}
        {row.status === 'Booked' && hasNoShow && <Button onClick={() => setStatus('No show')}><ReferenceText message="No show" /></Button>}
        {['Booked', 'Checked in'].includes(row.status) && <Button icon={Pencil} onClick={() => router.push(recordPath(def, id!, true))}><ReferenceText message="Reschedule" /></Button>}
        {row.status === 'Booked' && <Button variant="primary" onClick={() => setStatus('Checked in')}><ReferenceText message="Check in" /></Button>}
        {row.status === 'Checked in' && <Button variant="primary" onClick={() => setStatus('Completed')}><ReferenceText message="Mark completed" /></Button>}
      </RecordBar>
      <Page>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-5 rounded-xl border border-line bg-surface p-5">
              <div className="grid h-16 w-16 place-items-center rounded-xl bg-brand-soft text-brand-ink"><CalendarClock size={26} /></div>
              <div className="flex-1">
                <div className="text-[length:calc(26px*var(--fs-scale))] font-semibold leading-8 tracking-tight tnum">{row.start}</div>
                <div className="text-[length:calc(13px*var(--fs-scale))] text-ink-3">{fmtDate(row.date)}, {row.duration} <ReferenceText message="minutes," /> {row.resource}</div>
              </div>
              <StatusBadge value={row.status} />
            </div>
            <Section title={referenceT("Booking details")}><RecordForm fields={def.fields.filter((f) => !['code', 'status', 'start', 'date', 'duration'].includes(f.key))} value={row} onChange={() => {}} readOnly columns={2} /></Section>
          </div>
          <Section title={referenceT("{value0} that day", {value0: row.resource})} actions={<Link href={`${pagePath(def)}`} className="text-[length:calc(12px*var(--fs-scale))] text-brand hover:underline"><ReferenceText message="Open schedule" /></Link>} bodyClass="p-0">
            <ul className="divide-y divide-line">
              {day.filter((r) => r.resource === row.resource).map((r) => (
                <li key={r.id}>
                  <Link href={recordPath(def, r.id)} className={cx('flex items-center gap-3 px-4 py-2 text-[length:calc(13px*var(--fs-scale))] hover:bg-surface-2', r.id === row.id && 'bg-brand-soft')}>
                    <span className="w-12 font-semibold tnum">{r.start}</span><span className="flex-1 truncate">{r.person}</span><StatusBadge value={r.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </Page>
    </>
  );
}

/* ═════════════════ Tree nodes ═════════════════ */
export function TreeRecord({ def, id, mode }: RecordProps) {
 const referenceT = useReferenceLocalization().t;

  const entityApi = useEntityApi();
  const router = useRouter();
  const toast = useToast();
  const search = useSearchParams();
  const { data } = useFetch<ListResponse>(listUrl(def.entity, { size: 2000 }));
  const all = useMemo(() => data?.rows ?? [], [data]);
  const byId = useMemo(() => new Map(all.map((r) => [r.id, r])), [all]);
  const node = id ? byId.get(id) : undefined;
  const parentId = mode === 'new' ? search.get('parent') : node?.parentId;
  const parent = parentId ? byId.get(String(parentId)) : undefined;
  const [draft, setDraft] = useState<Partial<Row> | null>(null);
  const [errors, setErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!data) return;
    if (mode === 'new') setDraft({ parentId: parent?.id ?? null, level: parent ? parent.level + 1 : 0, status: 'Active', type: def.fields.find((f) => f.key === 'type')?.options?.slice(-1)[0], nature: parent?.nature });
    else if (node) setDraft({ ...node });
  }, [data, mode, node, parent, def]);
  const path = (start?: Row) => { const out: Row[] = []; let cur = start; while (cur) { out.unshift(cur); cur = cur.parentId ? byId.get(cur.parentId) : undefined; } return out; };
  const crumbs = mode === 'new' ? path(parent) : path(node);
  const kids = node ? all.filter((r) => r.parentId === node.id) : [];
  usePageTitle(mode === 'new' ? `New item${parent ? ` under ${parent.name}` : ''}` : node ? (mode === 'edit' ? `Edit ${node.name}` : String(node.name)) : null);
  const editing = mode !== 'view';

  const save = useCallback(async () => {
    if (!draft) return;
    const miss = missingRequired(def.fields, draft);
    if (miss.length) { setErrors(true); toast(referenceT("{value0} is required", {value0: referenceT(miss[0].label)}), 'danger'); return; }
    setBusy(true);
    try {
      if (mode === 'new') {
        const siblings = all.filter((r) => (r.parentId ?? null) === (parent?.id ?? null));
        const created = await entityApi.create(def.entity, { ...draft, code: draft.code || (parent ? `${parent.code}.${siblings.length + 1}` : String((siblings.length + 1) * 1000)) });
        toast(referenceT("{value0} added", {value0: created.name}));
        router.replace(recordPath(def, created.id));
      } else {
        await entityApi.update(def.entity, id!, draft);
        toast(referenceT("Changes saved"));
        router.replace(recordPath(def, id!));
      }
    } catch (e) { toast((e as Error).message, 'danger'); } finally { setBusy(false); }
  }, [draft, def, mode, all, parent, id, router, toast]);
  useSaveShortcut(editing ? save : null);

  if (!data || !draft) return <RecordLoading />;
  const remove = async () => {
    if (kids.length) { toast(referenceT("Move or delete the {value0} items under {value1} first", {value0: kids.length, value1: node?.name}), 'danger'); return; }
    await entityApi.remove(def.entity, id!);
    toast(referenceT("{value0} deleted", {value0: node?.name}));
    router.push(pagePath(def));
  };
  return (
    <>
      <RecordBar def={def} id={id} mode={mode}>
        {editing ? (
          <>
            <Button icon={X} onClick={() => router.push(mode === 'new' ? pagePath(def) : recordPath(def, id!))}><ReferenceText message="Cancel" /></Button>
            <Button variant="primary" icon={Save} loading={busy} onClick={save}>{mode === 'new' ? referenceT("Create") : referenceT("Save changes")}</Button>
          </>
        ) : (
          <>
            <Button variant="danger" icon={Trash2} onClick={remove} aria-label={referenceT("Delete")} className="px-2" />
            <Button icon={Plus} onClick={() => router.push(newPath(def, { parent: id! }))}><ReferenceText message="Add child" /></Button>
            <Button variant="primary" icon={Pencil} onClick={() => router.push(recordPath(def, id!, true))}><ReferenceText message="Edit" /></Button>
          </>
        )}
      </RecordBar>
      <Page>
        <nav className="flex flex-wrap items-center gap-1 rounded-xl border border-line bg-surface px-4 py-3 text-[length:calc(13px*var(--fs-scale))]" aria-label={referenceT("Position in hierarchy")}>
          <Link href={pagePath(def)} className="text-ink-3 hover:text-ink"><ReferenceText message="Top" /></Link>
          {crumbs.map((c) => (
            <span key={c.id} className="flex items-center gap-1">
              <ChevronRight size={13} className="text-ink-3" />
              <Link href={recordPath(def, c.id)} className={cx('hover:underline', c.id === id ? 'font-semibold text-ink' : 'text-ink-2')}>{c.name}</Link>
            </span>
          ))}
          {mode === 'new' && <span className="flex items-center gap-1"><ChevronRight size={13} className="text-ink-3" /><span className="font-semibold">{draft.name || 'New item'}</span></span>}
          <span className="flex-1" />
          {node && <StatusBadge value={node.status} />}
        </nav>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <Section title={referenceT("Details")}>
            <RecordForm fields={def.fields} value={draft} onChange={(k, v) => setDraft((d) => ({ ...d, [k]: v }))} readOnly={!editing} showErrors={errors} columns={3} />
          </Section>
          {mode !== 'new' && (
            <Section title={referenceT("Under {value0}", {value0: node?.name})} description={referenceT(kids.length === 1 ? "{count} direct item" : "{count} direct items", {count: kids.length})} actions={<Button size="sm" icon={Plus} onClick={() => router.push(newPath(def, { parent: id! }))}><ReferenceText message="Add" /></Button>} bodyClass="p-0">
              <ul className="divide-y divide-line">
                {kids.map((k) => (
                  <li key={k.id}>
                    <Link href={recordPath(def, k.id)} className="flex items-center gap-2.5 px-4 py-2 text-[length:calc(13px*var(--fs-scale))] hover:bg-surface-2">
                      {all.some((r) => r.parentId === k.id) ? <Folder size={15} className="text-accent" /> : <FileText size={14} className="text-ink-3" />}
                      <span className="flex-1 truncate">{k.name}</span>
                      <span className="text-[length:calc(12px*var(--fs-scale))] text-ink-3 tnum">{k.code}</span>
                    </Link>
                  </li>
                ))}
                {!kids.length && <li className="px-4 py-5 text-[length:calc(12.5px*var(--fs-scale))] text-ink-3"><ReferenceText message="Nothing sits under this item yet." /></li>}
              </ul>
            </Section>
          )}
        </div>
      </Page>
    </>
  );
}
