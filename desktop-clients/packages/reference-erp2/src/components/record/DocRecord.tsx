'use client';
import { useRouter, useSearchParams, cx, todayISO, useFormat, useEntityApi, Badge, Button, MenuItem, Popover, Stepper, StatusBadge, Textarea, useToast, missingRequired, RecordForm, blankLine, LinesEditor, lineTotals, type Row, type Line, type LineKind } from '@pepbits/reference-keystone-core';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ban, CircleCheck, Copy, Ellipsis, Pencil, Printer, Save, Scale, Send, Trash2, X } from 'lucide-react';
import { newPath, nounOf, pagePath, recordPath } from '../../lib/registry';
import { usePageTitle } from '../shell/pageTitle';
import { Page, RecordBar, RecordLoading, Section, useRecord, useSaveShortcut, useUnsavedGuard, type RecordProps } from './RecordShell';
import { ActivityList } from './ProfileRecord';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


const TERMINAL = ['Cancelled', 'Reversed', 'Rejected'];
const ACTION: Record<string, string> = { Submitted: 'Submit', Approved: 'Approve', Delivered: 'Mark delivered', Received: 'Mark received', Paid: 'Record payment', Posted: 'Post', Unpaid: 'Issue invoice', Inspected: 'Mark inspected' };

function flowState(flow: string[], status: string) {
  const idx = flow.indexOf(status);
  const done = status === flow[flow.length - 1] || TERMINAL.includes(status);
  const next = done ? null : idx >= 0 ? flow[idx + 1] : flow[flow.length - 1];
  return { idx: idx >= 0 ? idx : Math.max(0, flow.length - 2), done, next };
}

/** Header + lines documents (orders, invoices, receipts), vouchers that must balance, and structures (BOM, salary, fees). */
export default function DocRecord({ def, id, mode }: RecordProps) {
 const referenceT = useReferenceLocalization().t;

  const entityApi = useEntityApi();
  const { amountInWords, fmtCurrency, fmtDate, fmtValue } = useFormat();
  const router = useRouter();
  const search = useSearchParams();
  const toast = useToast();
  const kind: LineKind = def.template === 'voucher' ? 'voucher' : def.template === 'structure' ? 'structure' : 'document';
  const flow = useMemo(() => def.statusFlow ?? def.fields.find((f) => f.type === 'status')?.options?.slice(0, 1) ?? ['Draft'], [def]);
  const { row, loading, error, reload } = useRecord(def, id);
  const fresh = useMemo<Partial<Row>>(() => ({ date: todayISO(), status: flow[0], lines: Array.from({ length: kind === 'voucher' ? 2 : 1 }, () => blankLine(def.lines!.fields)) }), [flow, kind, def]);
  const [draft, setDraft] = useState<Partial<Row>>(fresh);
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState(false);
  const noun = nounOf(def);

  useEffect(() => { if (row) setDraft(row); }, [row]);
  useEffect(() => {
    const copy = search.get('copy');
    if (mode !== 'new' || !copy) return;
    entityApi.get(def.entity, copy).then((r) => { const { id: _i, code: _c, ...rest } = r; void _i; void _c; setDraft({ ...rest, status: flow[0], date: todayISO() }); }).catch(() => {});
  }, [mode, search, def.entity]); // eslint-disable-line react-hooks/exhaustive-deps

  const editing = mode !== 'view';
  const lines = (draft.lines as Line[]) ?? [];
  const totals = lineTotals(kind, lines);
  const status = String(draft.status ?? flow[0]);
  const { idx, done, next } = flowState(flow, status);
  const balanced = kind !== 'voucher' || (totals.diff === 0 && totals.debit > 0);
  const headerFields = def.fields.filter((f) => !['code', 'status', 'total', 'narration'].includes(f.key));
  const narrationF = def.fields.find((f) => f.key === 'narration');
  const totalLabel = def.fields.find((f) => f.key === 'total')?.label ?? 'Total';
  const dirty = editing && JSON.stringify(draft) !== JSON.stringify(mode === 'new' ? fresh : row);
  useUnsavedGuard(dirty);

  const title = mode === 'new' ? `New ${noun}` : row ? String(row.code ?? row.name ?? '') : '';
  usePageTitle(mode === 'edit' && title ? `Edit ${title}` : title);

  const persist = useCallback(async (patch: Partial<Row>, label: string) => {
    const body = { ...draft, ...patch, lines, total: totals.total };
    const miss = missingRequired(def.fields, body);
    if (miss.length) { setErrors(true); toast(referenceT("{value0} is required", {value0: referenceT(miss[0].label)}), 'danger'); return; }
    if (!lines.length) { toast(referenceT("Add at least one line first"), 'danger'); return; }
    if (patch.status && kind === 'voucher' && !TERMINAL.includes(String(patch.status)) && !balanced) { toast(referenceT("Debits and credits must match before posting"), 'danger'); return; }
    setBusy(label);
    try {
      const saved = mode === 'new' ? await entityApi.create(def.entity, body) : await entityApi.update(def.entity, id!, body);
      toast(patch.status ? `${saved.code} ${String(patch.status).toLowerCase()}` : `${saved.code ?? noun} saved`);
      if (mode === 'view') reload(); else router.replace(recordPath(def, saved.id));
    } catch (e) { toast((e as Error).message, 'danger'); } finally { setBusy(null); }
  }, [draft, lines, totals.total, def, kind, balanced, mode, id, noun, reload, router, toast]);
  useSaveShortcut(editing ? () => persist({}, 'save') : null);

  if (mode !== 'new' && (loading || error || !row)) return <RecordLoading error={error} onRetry={reload} />;

  const actions = editing ? (
    <>
      <Button icon={X} onClick={() => router.push(mode === 'new' ? pagePath(def) : recordPath(def, id!))}><ReferenceText message="Cancel" /></Button>
      <Button variant="primary" icon={Save} loading={busy === 'save'} onClick={() => persist({}, 'save')}>{mode === 'new' ? (kind === 'structure' ? `Create ${noun}` : 'Save draft') : referenceT("Save changes")}</Button>
    </>
  ) : (
    <>
      <Popover align="right" width="w-52" trigger={(t) => <Button onClick={t} aria-label={referenceT("More actions")} className="px-2"><Ellipsis size={16} /></Button>}>
        {(close) => (
          <>
            <MenuItem icon={Copy} onClick={() => { close(); router.push(`${newPath(def)}?copy=${id}`); }}><ReferenceText message="Copy to new" /></MenuItem>
            {def.entity === 'sales-invoices' && <MenuItem icon={Printer} onClick={() => { close(); router.push(`/reports/invoice-print/${id}`); }}><ReferenceText message="Print preview" /></MenuItem>}
            {!done && kind !== 'structure' && <MenuItem icon={Ban} danger onClick={() => { close(); persist({ status: kind === 'voucher' && status === 'Posted' ? 'Reversed' : 'Cancelled' }, 'cancel'); }}><ReferenceText message="Cancel" /> {noun}</MenuItem>}
            {kind === 'structure' && <MenuItem icon={Trash2} danger onClick={async () => { close(); await entityApi.remove(def.entity, id!); toast(referenceT("{value0} deleted", {value0: title})); router.push(pagePath(def)); }}><ReferenceText message="Delete" /></MenuItem>}
          </>
        )}
      </Popover>
      {(!done || kind === 'structure') && <Button icon={Pencil} onClick={() => router.push(recordPath(def, id!, true))}><ReferenceText message="Edit" /></Button>}
      {kind !== 'structure' && next && (
        <Button variant="primary" icon={kind === 'voucher' ? CircleCheck : Send} loading={busy === 'next'} disabled={!balanced} onClick={() => persist({ status: next }, 'next')}>
          {ACTION[next] ?? `Move to ${next.toLowerCase()}`}
        </Button>
      )}
    </>
  );

  const value = editing ? draft : row!;
  return (
    <>
      <RecordBar def={def} id={id} mode={mode} dirty={dirty}>{actions}</RecordBar>
      <Page wide>
        {kind !== 'structure' && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-line bg-surface px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <span className="text-[length:calc(15px*var(--fs-scale))] font-semibold tnum">{mode === 'new' ? `New ${noun}` : String(value.code)}</span>
              {mode !== 'new' && <StatusBadge value={status} />}
            </div>
            <div className="min-w-0 flex-1 overflow-x-auto">
              <Stepper steps={flow} current={done && !TERMINAL.includes(status) ? flow.length : idx} failedAt={TERMINAL.includes(status) ? idx + 1 : undefined} />
            </div>
            <div className="text-right">
              <div className="text-[length:calc(11.5px*var(--fs-scale))] text-ink-3">{totalLabel}</div>
              <div className="text-[length:calc(20px*var(--fs-scale))] font-semibold tracking-tight tnum">{fmtCurrency(totals.total)}</div>
            </div>
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-4">
            <Section title={kind === 'structure' ? 'Details' : 'Header'} description={editing ? 'Fields marked * are required.' : undefined}>
              {editing ? (
                <RecordForm fields={kind === 'structure' ? def.fields.filter((f) => f.type !== 'code' && f.key !== 'total') : headerFields} value={draft} onChange={(k, v) => setDraft((d) => ({ ...d, [k]: v }))} columns={4} showErrors={errors} />
              ) : (
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-4">
                  {(kind === 'structure' ? def.fields.filter((f) => f.type !== 'code' && f.key !== 'total') : headerFields).map((f) => (
                    <div key={f.key} className="min-w-0">
                      <dt className="text-[length:calc(12px*var(--fs-scale))] text-ink-3"><ReferenceText message={f.label} /></dt>
                      <dd className="truncate text-[length:calc(13.5px*var(--fs-scale))] font-medium text-ink">{f.type === 'status' ? <StatusBadge value={value[f.key]} /> : fmtValue(f, value[f.key])}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </Section>
            <div className={editing ? 'h-[min(560px,calc(100dvh-260px))] min-h-[320px]' : ''}>
              <LinesEditor fields={def.lines!.fields} lines={lines} kind={kind} title={def.lines!.label} readOnly={!editing} onChange={(l) => setDraft((d) => ({ ...d, lines: l }))} />
            </div>
          </div>

          <aside className="space-y-4">
            {kind === 'voucher' ? (
              <Section title={<span className="flex items-center gap-2"><Scale size={15} className="text-ink-3" /><ReferenceText message="Balance check" /></span>} bodyClass="p-4">
                <dl className="space-y-1.5 text-[length:calc(13px*var(--fs-scale))]">
                  <div className="flex justify-between"><dt className="text-ink-3"><ReferenceText message="Total debit" /></dt><dd className="tnum">{fmtCurrency(totals.debit)}</dd></div>
                  <div className="flex justify-between"><dt className="text-ink-3"><ReferenceText message="Total credit" /></dt><dd className="tnum">{fmtCurrency(totals.credit)}</dd></div>
                  <div className="flex justify-between border-t border-line pt-1.5"><dt className="font-medium"><ReferenceText message="Difference" /></dt><dd className={cx('font-semibold tnum', totals.diff ? 'text-danger' : 'text-ok')}>{fmtCurrency(Math.abs(totals.diff))}</dd></div>
                </dl>
                <div className={cx('mt-3 rounded-md px-2.5 py-2 text-[length:calc(12.5px*var(--fs-scale))]', balanced ? 'bg-ok-soft text-ok' : 'bg-danger-soft text-danger')}>
                  {balanced ? referenceT("Balanced. Ready to post.") : totals.debit === 0 ? referenceT("Enter debit and credit lines.") : `Out of balance: ${totals.diff > 0 ? 'credits' : 'debits'} short by ${fmtCurrency(Math.abs(totals.diff))}.`}
                </div>
              </Section>
            ) : (
              <Section title={referenceT("Summary")} bodyClass="p-4">
                <dl className="space-y-1.5 text-[length:calc(13px*var(--fs-scale))]">
                  <div className="flex justify-between"><dt className="text-ink-3">{kind === 'structure' ? referenceT("Lines") : referenceT("Subtotal")}</dt><dd className="tnum">{kind === 'structure' ? lines.length : fmtCurrency(totals.subtotal)}</dd></div>
                  {totals.tax !== 0 && <div className="flex justify-between"><dt className="text-ink-3"><ReferenceText message="Tax" /></dt><dd className="tnum">{fmtCurrency(totals.tax)}</dd></div>}
                  <div className="flex items-baseline justify-between border-t border-line pt-2"><dt className="font-medium">{totalLabel}</dt><dd className="text-[length:calc(20px*var(--fs-scale))] font-semibold tracking-tight tnum">{fmtCurrency(totals.total)}</dd></div>
                </dl>
                {kind === 'document' && <p className="mt-2 text-[length:calc(12px*var(--fs-scale))] leading-snug text-ink-3">{amountInWords(Math.abs(totals.total))}</p>}
              </Section>
            )}
            {narrationF && (
              <Section title={referenceT("Narration")} bodyClass="p-4">
                {editing ? <Textarea value={String(draft.narration ?? '')} onChange={(e) => setDraft((d) => ({ ...d, narration: e.target.value }))} rows={3} placeholder={referenceT("Why this entry is being made")} />
                  : <p className="text-[length:calc(13px*var(--fs-scale))] text-ink-2">{String(value.narration ?? 'No narration')}</p>}
              </Section>
            )}
            {mode !== 'new' && (
              <Section title={referenceT("History")} bodyClass="p-4">
                <ActivityList row={row!} entity={def.entity} noun={noun} />
              </Section>
            )}
          </aside>
        </div>
      </Page>
    </>
  );
}
