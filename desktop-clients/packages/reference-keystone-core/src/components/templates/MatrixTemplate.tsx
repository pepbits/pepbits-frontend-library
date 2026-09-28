'use client';
import { Table, TableContainer } from '@pepbits/ops-ui';
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, Save, Search, Wand2 } from 'lucide-react';
import type { ListResponse, PageDef, Row } from '../../lib/types';
import { cx, todayISO, toISO, useFormat } from '../../lib/format';
import { listUrl, useFetch, useEntityApi } from '../../lib/client';
import { Avatar, Button, ErrorNote, IconButton, Input, Select, Skeleton, useToast } from '../ui';
import { Card, Frame } from './shared';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


type Cell = string | number | null;

const CODE_STYLE: Record<string, string> = {
  P: 'bg-ok-soft text-ok', A: 'bg-danger-soft text-danger', L: 'bg-warn-soft text-warn', H: 'bg-info-soft text-info', WO: 'bg-surface-3 text-ink-3', '': 'text-ink-3',
};
const CODE_NAME: Record<string, string> = { P: 'Present', A: 'Absent', L: 'Leave', H: 'Half day', WO: 'Week off' };

function mondayOf(d: Date) { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return toISO(x); }
function grade(p: number) { return p >= 90 ? 'A+' : p >= 80 ? 'A' : p >= 70 ? 'B' : p >= 60 ? 'C' : p >= 45 ? 'D' : 'E'; }

/** Grid entry: people down the side, days / subjects across, edit many cells then save once. */
export default function MatrixTemplate({ def }: { def: PageDef }) {
 const referenceT = useReferenceLocalization().t;

  const { fmtDate, fmtLocale } = useFormat();
  const entityApi = useEntityApi();
  const toast = useToast();
  const kind = def.matrix!.kind;
  const values = def.matrix!.values ?? [];
  const [period, setPeriod] = useState(() => (kind === 'attendance' ? todayISO().slice(0, 7) : kind === 'hours' ? mondayOf(new Date()) : 'Term 1'));
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [tick, setTick] = useState(0);
  const { data, loading, error, reload } = useFetch<ListResponse>(`${listUrl(def.entity, { size: 500, period })}&_r=${tick}`);

  useEffect(() => { if (data) { setRows(data.rows.map((r) => ({ ...r, cells: [...r.cells] }))); setDirty(new Set()); } }, [data]);

  const cols: string[] = rows[0]?.columns ?? [];
  const today = todayISO();
  const shown = rows.filter((r) => `${r.name} ${r.code}`.toLowerCase().includes(q.toLowerCase()));

  const setCell = (rowId: string, ci: number, v: Cell) => {
    setRows((rs) => rs.map((r) => (r.id === rowId ? { ...r, cells: r.cells.map((c: Cell, k: number) => (k === ci ? v : c)) } : r)));
    setDirty((d) => new Set(d).add(rowId));
  };
  const cycle = (rowId: string, ci: number, cur: Cell) => {
    const order = [...values, ''];
    const next = order[(order.indexOf(String(cur ?? '')) + 1) % order.length];
    setCell(rowId, ci, next || null);
  };
  const fillToday = () => {
    const ci = cols.indexOf(today);
    if (ci < 0) { toast(referenceT("Today is not in this period"), 'info'); return; }
    let n = 0;
    setRows((rs) => rs.map((r) => { if (r.cells[ci]) return r; n++; return { ...r, cells: r.cells.map((c: Cell, k: number) => (k === ci ? 'P' : c)) }; }));
    setDirty(new Set(rows.map((r) => r.id)));
    setTimeout(() => toast(n ? `Marked ${n} people present for today` : 'Everyone already has a mark for today', 'info'), 0);
  };
  const save = async () => {
    setSaving(true);
    try {
      await Promise.all([...dirty].map((id) => entityApi.update(def.entity, id, { cells: rows.find((r) => r.id === id)!.cells }, period)));
      toast(referenceT(dirty.size === 1 ? "Saved {count} row" : "Saved {count} rows", {count: dirty.size}));
      setDirty(new Set());
    } catch (e) { toast((e as Error).message, 'danger'); } finally { setSaving(false); }
  };

  const move = (dir: number) => {
    if (dirty.size && !confirm('You have unsaved changes. Discard them and switch period?')) return;
    if (kind === 'attendance') { const [y, m] = period.split('-').map(Number); const d = new Date(y, m - 1 + dir, 1); setPeriod(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); }
    else if (kind === 'hours') { const d = new Date(`${period}T00:00:00`); d.setDate(d.getDate() + dir * 7); setPeriod(toISO(d)); }
  };
  const periodLabel = kind === 'attendance'
    ? new Date(`${period}-01T00:00:00`).toLocaleDateString(fmtLocale, { month: 'long', year: 'numeric' })
    : kind === 'hours' ? `Week of ${fmtDate(period)}` : period;

  const summary = (r: Row) => {
    const cells: Cell[] = r.cells;
    if (kind === 'attendance') {
      const p = cells.filter((c) => c === 'P').length + cells.filter((c) => c === 'H').length * 0.5;
      const working = cells.filter((c) => c && c !== 'WO').length;
      return [p, cells.filter((c) => c === 'A').length, cells.filter((c) => c === 'L').length, working ? Math.round((p / working) * 100) : 0];
    }
    const nums = cells.map((c) => Number(c) || 0);
    const total = nums.reduce((a, b) => a + b, 0);
    if (kind === 'hours') return [total, Math.max(0, total - 40)];
    const pct = Math.round((total / (cols.length * 100)) * 100);
    return [total, pct, grade(pct)];
  };
  const colTotals = useMemo(() => cols.map((_, ci) => {
    const vals = rows.map((r) => r.cells[ci] as Cell);
    if (kind === 'attendance') return vals.filter((v) => v === 'P').length;
    const nums = vals.filter((v) => v !== null && v !== '').map(Number);
    if (kind === 'hours') return nums.reduce((a, b) => a + b, 0);
    return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0;
  }), [rows, cols, kind]);

  const headOf = (c: string) => {
    if (kind === 'marks') return { top: c, sub: 'of 100', weekend: false, isToday: false };
    const d = new Date(`${c}T00:00:00`);
    const wd = d.getDay();
    return { top: kind === 'attendance' ? String(d.getDate()) : d.toLocaleDateString(fmtLocale, { weekday: 'short' }), sub: kind === 'attendance' ? d.toLocaleDateString(fmtLocale, { weekday: 'narrow' }) : String(d.getDate()), weekend: wd === 0 || wd === 6, isToday: c === today };
  };
  const cellW = kind === 'attendance' ? 'w-8 min-w-8' : kind === 'hours' ? 'w-16 min-w-16' : 'w-24 min-w-24';

  return (
    <Frame>
      <Card className="shrink-0">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
          {kind === 'marks' ? (
            <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="w-36" aria-label={referenceT("Term")}>
              {['Term 1', 'Term 2', 'Final'].map((t) => <option key={t}>{t}</option>)}
            </Select>
          ) : (
            <div className="flex items-center gap-1">
              <IconButton icon={ChevronLeft} label={referenceT("Previous period")} onClick={() => move(-1)} />
              <span className="min-w-[150px] text-center text-[length:calc(14px*var(--fs-scale))] font-semibold">{periodLabel}</span>
              <IconButton icon={ChevronRight} label={referenceT("Next period")} onClick={() => move(1)} />
            </div>
          )}
          <div className="relative w-full sm:w-56">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={referenceT("Find a person")} className="pl-8" />
          </div>
          {kind === 'attendance' && (
            <div className="hidden items-center gap-2 lg:flex">
              {values.map((v) => <span key={v} className="flex items-center gap-1 text-[length:calc(12px*var(--fs-scale))] text-ink-2"><span className={cx('grid h-5 min-w-5 place-items-center rounded px-1 text-[length:calc(10.5px*var(--fs-scale))] font-semibold', CODE_STYLE[v])}>{v}</span>{CODE_NAME[v]}</span>)}
            </div>
          )}
          <span className="flex-1" />
          {kind === 'attendance' && <Button icon={Wand2} onClick={fillToday}><ReferenceText message="Mark all present today" /></Button>}
          {dirty.size > 0 && <Button icon={RotateCcw} onClick={() => setTick((t) => t + 1)}><ReferenceText message="Discard" /></Button>}
          <Button variant="primary" icon={Save} loading={saving} disabled={!dirty.size} onClick={save}>{dirty.size ? referenceT(dirty.size === 1 ? "Save {count} row" : "Save {count} rows", { count: dirty.size }) : referenceT("Save")}</Button>
        </div>
      </Card>

      <Card className="min-h-[440px] flex-1">
        {error && <ErrorNote message={error} onRetry={reload} />}
        <TableContainer className="h-full overflow-auto">
          <Table className="min-w-full border-separate border-spacing-0 text-[length:calc(12.5px*var(--fs-scale))]">
            <thead className="sticky top-0 z-20">
              <tr>
                <th className="sticky left-0 z-30 min-w-[220px] border-b border-r border-line bg-surface-2 px-3 py-1.5 text-left text-[length:calc(12px*var(--fs-scale))] font-medium text-ink-2"><ReferenceText message={def.fields.find((f) => f.primary)?.label} /> ({shown.length})</th>
                {cols.map((c) => {
                  const h = headOf(c);
                  return (
                    <th key={c} className={cx('border-b border-line px-0.5 py-1 text-center font-medium', cellW, h.isToday ? 'bg-accent-soft text-ink' : h.weekend ? 'bg-surface-3 text-ink-3' : 'bg-surface-2 text-ink-2')}>
                      <div className="text-[length:calc(12px*var(--fs-scale))] leading-4">{h.top}</div>
                      <div className="text-[length:calc(10.5px*var(--fs-scale))] font-normal leading-3 text-ink-3">{h.sub}</div>
                    </th>
                  );
                })}
                <th className="sticky right-0 z-30 w-32 min-w-32 border-b border-l border-line bg-surface-2 px-3 py-1.5 text-right text-[length:calc(12px*var(--fs-scale))] font-medium text-ink-2"><ReferenceText message="Summary" /></th>
              </tr>
            </thead>
            <tbody>
              {!data && loading && Array.from({ length: 12 }, (_, i) => <tr key={i}><td className="sticky left-0 border-b border-r border-line bg-surface px-3 py-2"><Skeleton className="w-32" /></td><td colSpan={40} className="border-b border-line" /></tr>)}
              {shown.map((r) => {
                const s = summary(r);
                return (
                  <tr key={r.id} className="group">
                    <td className={cx('sticky left-0 z-10 border-b border-r border-line px-3 py-1', dirty.has(r.id) ? 'bg-accent-soft' : 'bg-surface group-hover:bg-surface-2')}>
                      <div className="flex items-center gap-2">
                        <Avatar name={r.name} size={24} />
                        <div className="min-w-0">
                          <div className="truncate text-[length:calc(12.5px*var(--fs-scale))] font-medium text-ink">{r.name}</div>
                          <div className="truncate text-[length:calc(11px*var(--fs-scale))] text-ink-3">{r.code} {r.department ?? r.project ?? (r.section ? `Section ${r.section}` : '')}</div>
                        </div>
                      </div>
                    </td>
                    {r.cells.map((c: Cell, ci: number) => {
                      const h = headOf(cols[ci]);
                      if (kind === 'attendance') {
                        return (
                          <td key={ci} className={cx('border-b border-line p-0.5 text-center', h.isToday && 'bg-accent-soft/60')}>
                            <button onClick={() => cycle(r.id, ci, c)} title={referenceT("{value0}: {value1}", {value0: cols[ci], value1: CODE_NAME[String(c)] ?? 'Not marked'})} className={cx('h-7 w-7 rounded text-[length:calc(10.5px*var(--fs-scale))] font-semibold transition-colors hover:ring-2 hover:ring-brand/30', CODE_STYLE[String(c ?? '')], !c && 'border border-dashed border-line')}>
                              {c ?? ''}
                            </button>
                          </td>
                        );
                      }
                      const over = kind === 'marks' && c !== null && Number(c) < 40;
                      return (
                        <td key={ci} className={cx('border-b border-line p-0.5', h.weekend && 'bg-surface-2', h.isToday && 'bg-accent-soft/60')}>
                          <input
                            type="number"
                            min={0}
                            max={kind === 'hours' ? 24 : 100}
                            step={kind === 'hours' ? 0.5 : 1}
                            value={c ?? ''}
                            onChange={(e) => setCell(r.id, ci, e.target.value === '' ? null : Math.min(kind === 'hours' ? 24 : 100, Math.max(0, Number(e.target.value))))}
                            className={cx('h-7 w-full rounded border border-transparent bg-transparent px-1 text-center tnum hover:border-line focus:border-brand focus:bg-surface focus:outline-none', over && 'text-danger font-semibold')}
                            aria-label={referenceT("{value0} {value1}", {value0: r.name, value1: cols[ci]})}
                          />
                        </td>
                      );
                    })}
                    <td className={cx('sticky right-0 z-10 border-b border-l border-line px-3 py-1 text-right', dirty.has(r.id) ? 'bg-accent-soft' : 'bg-surface group-hover:bg-surface-2')}>
                      {kind === 'attendance' ? (
                        <>
                          <div className={cx('text-[length:calc(13px*var(--fs-scale))] font-semibold tnum', Number(s[3]) < 75 ? 'text-danger' : 'text-ink')}>{s[3]}%</div>
                          <div className="text-[length:calc(11px*var(--fs-scale))] text-ink-3 tnum"><ReferenceText message="P" /> {s[0]} <ReferenceText message="A" /> {s[1]} <ReferenceText message="L" /> {s[2]}</div>
                        </>
                      ) : kind === 'hours' ? (
                        <>
                          <div className="text-[length:calc(13px*var(--fs-scale))] font-semibold tnum">{s[0]} <ReferenceText message="h" /></div>
                          <div className={cx('text-[length:calc(11px*var(--fs-scale))] tnum', Number(s[1]) > 0 ? 'text-warn' : 'text-ink-3')}>{Number(s[1]) > 0 ? `${s[1]} h overtime` : referenceT("No overtime")}</div>
                        </>
                      ) : (
                        <>
                          <div className="text-[length:calc(13px*var(--fs-scale))] font-semibold text-brand-ink tnum">{s[2]} <span className="font-normal text-ink-3">{s[1]}%</span></div>
                          <div className="text-[length:calc(11px*var(--fs-scale))] text-ink-3 tnum">{s[0]} <ReferenceText message="of" /> {cols.length * 100}</div>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="sticky bottom-0 z-20">
                <tr>
                  <td className="sticky left-0 z-30 border-r border-t-2 border-line-strong bg-surface-2 px-3 py-1.5 text-[length:calc(12px*var(--fs-scale))] font-semibold">{kind === 'attendance' ? referenceT("Present") : kind === 'hours' ? referenceT("Hours logged") : referenceT("Class average")}</td>
                  {colTotals.map((t, i) => <td key={i} className="border-t-2 border-line-strong bg-surface-2 py-1.5 text-center text-[length:calc(11.5px*var(--fs-scale))] font-semibold tnum">{t || ''}</td>)}
                  <td className="sticky right-0 z-30 border-l border-t-2 border-line-strong bg-surface-2" />
                </tr>
              </tfoot>
            )}
          </Table>
        </TableContainer>
      </Card>
    </Frame>
  );
}
