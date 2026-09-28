'use client';
import { cx, todayISO, useFormat, useEntityApi, Button, Progress, useToast, RecordForm, WorkList, useAuth, Card, Frame, type PageDef, type Row, useProcessRunner, playProcessEvents, type ProcessRunResult, type StepState } from '@pepbits/reference-keystone-core';
import { useReducedMotion } from '@pepbits/reference-keystone-core';
import { useEffect, useRef, useState } from 'react';
import { Check, CircleAlert, LoaderCircle, Play, RotateCcw } from 'lucide-react';
import { LocalizedText as ReferenceText } from '@pepbits/ops-ui';
import { useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';




/** Periodic jobs (payroll, depreciation): set parameters, watch each step run, keep a history. */
export default function ProcessTemplate({ def }: { def: PageDef }) {
  const reducedMotion = useReducedMotion();
 const referenceT = useReferenceLocalization().t;

  const entityApi = useEntityApi();
  const { fmtCompact, fmtDate, fmtTime } = useFormat();
  const toast = useToast();
  const { user } = useAuth();
  const steps = def.steps ?? [];
  const [params, setParams] = useState<Partial<Row>>(() => Object.fromEntries((def.params ?? []).map((f) => [f.key, f.options?.[0] ?? (f.type === 'boolean' ? true : f.type === 'date' ? todayISO(5) : '')])));
  const [states, setStates] = useState<StepState[]>(steps.map(() => 'idle'));
  const [log, setLog] = useState<{ t: string; text: string; warn?: boolean }[]>([]);
  const [running, setRunning] = useState(false);
  const [last, setLast] = useState<Row | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const logRef = useRef<HTMLOListElement>(null);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: reducedMotion ? 'auto' : 'smooth' }); }, [log, reducedMotion]);

  const done = states.filter((s) => s === 'done' || s === 'warn').length;
  const stamp = () => fmtTime(new Date(), true);

  const runProcess = useProcessRunner(def.entity);
  const run = async () => {
    setRunning(true);
    setStates(steps.map(() => 'idle'));
    setLog([{ t: stamp(), text: `Started ${def.title.toLowerCase()} for ${params.period ?? 'the period'}` }]);
    let result: ProcessRunResult;
    try {
      result = await runProcess(params);
    } catch (err) {
      const message = (err as Error).message || 'The run could not be started';
      setLog((l) => [...l, { t: stamp(), text: `Run failed: ${message}`, warn: true }]);
      setRunning(false);
      toast(message, 'danger');
      return;
    }
    const saved = result.row;
    const took = playProcessEvents(result.events, steps.length, { setStates, setLog, timers: timers.current });
    timers.current.push(setTimeout(() => {
      setStates((st) => st.map((x) => (x === 'running' ? 'done' : x)));
      setLog((l) => [...l, { t: stamp(), text: `Finished. Run ${saved.code} saved to history.` }]);
      setRunning(false);
      setLast(saved);
      setReloadKey((k) => k + 1);
      toast(referenceT("{value0} completed", {value0: saved.code}));
    }, took + 200));
  };


  return (
    <Frame className="lg:flex-row">
      <Card className="flex shrink-0 flex-col lg:w-[400px] xl:w-[440px]">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-[length:calc(14px*var(--fs-scale))] font-semibold"><ReferenceText message="Run parameters" /></h2>
          <p className="text-[length:calc(12.5px*var(--fs-scale))] text-ink-3">{last ? `Last run ${last.code} on ${fmtDate(last.runAt)}, ${fmtCompact(last.gross)} processed` : referenceT("Check the parameters, then start the run.")}</p>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <RecordForm fields={def.params ?? []} value={params} onChange={(k, v) => setParams((p) => ({ ...p, [k]: v }))} readOnly={running} columns={2} compact />
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[length:calc(13px*var(--fs-scale))] font-semibold"><ReferenceText message="Steps" /></span>
              <span className="text-[length:calc(12px*var(--fs-scale))] text-ink-3 tnum">{done}/{steps.length}</span>
            </div>
            <Progress value={(done / steps.length) * 100} tone={states.includes('warn') ? 'warn' : 'brand'} className="mb-3" />
            <ol className="space-y-1">
              {steps.map((s, i) => {
                const st = states[i];
                return (
                  <li key={s} className={cx('flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[length:calc(13px*var(--fs-scale))]', st === 'running' && 'bg-accent-soft')}>
                    <span className={cx('grid h-5 w-5 place-items-center rounded-full text-[length:calc(11px*var(--fs-scale))] font-semibold', st === 'done' ? 'bg-brand text-white' : st === 'warn' ? 'bg-warn text-white' : st === 'running' ? 'text-warn' : 'bg-surface-3 text-ink-3')}>
                      {st === 'done' ? <Check size={12} strokeWidth={3} /> : st === 'warn' ? <CircleAlert size={12} /> : st === 'running' ? <LoaderCircle size={16} className="animate-spin" /> : i + 1}
                    </span>
                    <span className={cx('flex-1', st === 'idle' ? 'text-ink-3' : 'text-ink')}>{s}</span>
                    {st === 'warn' && <span className="text-[length:calc(11.5px*var(--fs-scale))] text-warn"><ReferenceText message="Needs review" /></span>}
                  </li>
                );
              })}
            </ol>
          </div>
          <div>
            <div className="mb-1.5 text-[length:calc(13px*var(--fs-scale))] font-semibold"><ReferenceText message="Run log" /></div>
            <ol ref={logRef} className="h-32 overflow-y-auto rounded-md bg-rail p-2.5 text-[length:calc(11.5px*var(--fs-scale))] leading-5 text-rail-ink">
              {!log.length && <li className="text-rail-ink-2"><ReferenceText message="Nothing has run in this session yet." /></li>}
              {log.map((l, i) => <li key={i} className={l.warn ? 'text-accent' : ''}><span className="text-rail-ink-2 tnum">{l.t}</span> {l.text}</li>)}
            </ol>
          </div>
        </div>
        <div className="flex items-center gap-2 border-t border-line bg-surface-2 px-4 py-2.5">
          <Button icon={RotateCcw} disabled={running || !log.length} onClick={() => { setStates(steps.map(() => 'idle')); setLog([]); }}><ReferenceText message="Reset" /></Button>
          <span className="flex-1" />
          <Button variant="primary" icon={Play} loading={running} onClick={run}>{running ? referenceT("Running") : referenceT("Start run")}</Button>
        </div>
      </Card>
      <Card className="min-h-[420px] min-w-0 flex-1">
        <WorkList def={def} readOnly reloadKey={reloadKey} showTotals onLoaded={(res) => { if (!last && res.rows[0]) setLast(res.rows[0]); }} />
      </Card>
    </Frame>
  );
}
