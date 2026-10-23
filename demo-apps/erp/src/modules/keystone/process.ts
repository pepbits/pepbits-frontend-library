/*
 * Plays back the events returned by POST /api/processes/:entity/run so the source step
 * list, progress and run log keep their interaction. The server computes every value and
 * creates the run row; this only schedules what it returned.
 */
import type { Dispatch, SetStateAction } from 'react';
import type { ProcessEvent } from './api';

export type StepState = 'idle' | 'running' | 'done' | 'warn';
export interface RunLogLine { t: string; text: string; warn?: boolean }
export const PROCESS_EVENT_MS = 450;

export function playProcessEvents(
  events: ProcessEvent[],
  stepCount: number,
  sink: { setStates: Dispatch<SetStateAction<StepState[]>>; setLog: Dispatch<SetStateAction<RunLogLine[]>>; timers: ReturnType<typeof setTimeout>[] },
  interval = PROCESS_EVENT_MS,
): number {
  events.forEach((ev, i) => {
    sink.timers.push(setTimeout(() => {
      const warn = ev.tone === 'warn' || ev.tone === 'danger';
      if (ev.step !== undefined && ev.step >= 0 && ev.step < stepCount) {
        const finished = ev.progress === undefined || ev.progress >= 100;
        sink.setStates((st) => st.map((x, k) => (k < ev.step! && (x === 'idle' || x === 'running') ? 'done' : k === ev.step ? (warn ? 'warn' : finished ? (x === 'warn' ? 'warn' : 'done') : 'running') : x)));
      }
      sink.setLog((l) => [...l, { t: ev.time, text: ev.text, warn }]);
    }, i * interval));
  });
  return events.length * interval;
}
