'use client';
import {useCallback, useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {Check} from '@pepbits/icons';
import {useLocalization} from '@pepbits/i18n/react';
import {usePreferences} from '@pepbits/preferences/react';
import {cn} from '@pepbits/ui';
import {useFormatters} from '../screen-host';

/** One visible step. The host decides which steps are visible for the current data. */
export interface WizardStep<Id extends string = string> {id: Id; title: string; caption?: string; intro?: string}
/** Field path → message. Paths are host-defined (for example `org.city` or `facilities.1.name`). */
export type WizardErrors = Record<string, string>;
export interface WizardSnapshot<Id extends string = string> {current: Id; completed: Id[]; reached: Id[]}
export interface UseWizardOptions<Id extends string, Data> {
  /** Visible steps, in order. May change with the data (for example an optional step). */
  steps: readonly WizardStep<Id>[];
  data: Data;
  validate: (id: Id, data: Data) => WizardErrors;
  /** Restored position. A restored step that is hidden falls back to the first step until it becomes visible. */
  initial?: Partial<WizardSnapshot<Id>>;
  /** Called before a step becomes current, for host defaults such as pre-selection. */
  onEnter?: (id: Id) => void;
}
export interface WizardController<Id extends string> {
  steps: readonly WizardStep<Id>[]; current: Id; index: number; step: WizardStep<Id>; isFirst: boolean; isLast: boolean;
  completed: ReadonlySet<Id>; reached: ReadonlySet<Id>; errors: WizardErrors;
  /** Increments on every failed validation, so a host can re-announce or re-animate its error summary. */
  failures: number;
  /** Increments whenever the current step changes; hosts move focus when it changes. */
  moves: number;
  /** 0–1. A completed current step counts as done. */
  progress: number;
  goTo(id: Id): void;
  /** Validate the current step and move forward. Returns false and records errors when invalid. */
  next(): boolean;
  back(): void;
  /** Stepper jump: backwards is free, forwards validates the current step first; unreached steps are refused. */
  jump(id: Id): boolean;
  validateCurrent(): boolean;
  /** First visible step with errors, or null when every step passes. */
  firstInvalid(): {id: Id; errors: WizardErrors} | null;
  fail(errors: WizardErrors): void;
  completeAll(): void;
  restore(snapshot: Partial<WizardSnapshot<Id>>): void;
  snapshot(): WizardSnapshot<Id>;
}

// Restored IDs are kept even when their step is currently hidden: visibility can depend on data restored in the same update.
const known = <Id extends string>(ids: readonly Id[] | undefined) => (ids ?? []).filter(id => typeof id === 'string');

/**
 * Generic multi-step form state: current step, completed and reached steps, per-step validation,
 * forward-jump validation and error clearing as values are fixed. It renders nothing and stores
 * nothing; the host owns data, persistence and submission.
 */
export function useWizard<Id extends string, Data>({steps, data, validate, initial, onEnter}: UseWizardOptions<Id, Data>): WizardController<Id> {
  if (!steps.length) throw new Error('A wizard needs at least one step');
  const first = steps[0]!.id;
  const [current, setCurrent] = useState<Id>(() => initial?.current ?? first);
  const [completed, setCompleted] = useState<ReadonlySet<Id>>(() => new Set(known(initial?.completed)));
  const [reached, setReached] = useState<ReadonlySet<Id>>(() => new Set([first, ...known(initial?.reached)]));
  const [errors, setErrors] = useState<WizardErrors>({});
  const [failures, setFailures] = useState(0), [moves, setMoves] = useState(0);
  const latest = useRef({data, validate, onEnter});
  latest.current = {data, validate, onEnter};
  // A current step that is not visible (for example before restored data applies) renders the first step.
  const index = Math.max(0, steps.findIndex(step => step.id === current));
  const step = steps[index]!;
  const effective = step.id;

  // Errors disappear as their values are fixed; new errors only appear on an explicit attempt.
  useEffect(() => {
    setErrors(previous => {
      const keys = Object.keys(previous);
      if (!keys.length) return previous;
      const now = validate(effective, data), next: WizardErrors = {};
      for (const key of keys) if (now[key]) next[key] = now[key]!;
      return Object.keys(next).length === keys.length && keys.every(key => next[key] === previous[key]) ? previous : next;
    });
  }, [data, effective, validate]);

  const goTo = useCallback((id: Id) => {
    latest.current.onEnter?.(id);
    setCurrent(id); setReached(previous => previous.has(id) ? previous : new Set(previous).add(id));
    setErrors({}); setMoves(value => value + 1);
  }, []);
  const fail = useCallback((next: WizardErrors) => {setErrors(next); setFailures(value => value + 1);}, []);
  const validateCurrent = useCallback(() => {
    const found = latest.current.validate(effective, latest.current.data);
    if (Object.keys(found).length) {fail(found); return false;}
    setCompleted(previous => previous.has(effective) ? previous : new Set(previous).add(effective));
    return true;
  }, [effective, fail]);
  const next = useCallback(() => {
    if (!validateCurrent()) return false;
    const following = steps[index + 1];
    if (following) goTo(following.id);
    return true;
  }, [validateCurrent, steps, index, goTo]);
  const back = useCallback(() => {const previous = steps[index - 1]; if (previous) goTo(previous.id);}, [steps, index, goTo]);
  const jump = useCallback((id: Id) => {
    const target = steps.findIndex(candidate => candidate.id === id);
    if (target < 0 || target === index || !reached.has(id)) return false;
    if (target > index && !validateCurrent()) return false;
    goTo(id); return true;
  }, [steps, index, reached, validateCurrent, goTo]);
  const firstInvalid = useCallback(() => {
    for (const candidate of steps) {const found = latest.current.validate(candidate.id, latest.current.data); if (Object.keys(found).length) return {id: candidate.id, errors: found};}
    return null;
  }, [steps]);
  const completeAll = useCallback(() => setCompleted(new Set(steps.map(candidate => candidate.id))), [steps]);
  const restore = useCallback((snapshot: Partial<WizardSnapshot<Id>>) => {
    if (snapshot.current) setCurrent(snapshot.current);
    setCompleted(new Set(known(snapshot.completed)));
    setReached(new Set([first, ...known(snapshot.reached)]));
    setErrors({});
  }, [first]);
  const snapshot = useCallback(() => ({current: effective, completed: [...completed], reached: [...reached]}), [effective, completed, reached]);
  const progress = (index + (completed.has(effective) ? 1 : 0)) / steps.length;
  return useMemo(() => ({steps, current: effective, index, step, isFirst: index === 0, isLast: index === steps.length - 1, completed, reached, errors, failures, moves, progress,
    goTo, next, back, jump, validateCurrent, firstInvalid, fail, completeAll, restore, snapshot}),
  [steps, effective, index, step, completed, reached, errors, failures, moves, progress, goTo, next, back, jump, validateCurrent, firstInvalid, fail, completeAll, restore, snapshot]);
}

/**
 * Focus the first invalid control (`aria-invalid="true"` or `data-invalid="true"`) inside a container.
 * Scrolling is instant when the effective reduced-motion preference is on.
 */
export function focusFirstInvalid(container: HTMLElement | null, reducedMotion = false): HTMLElement | null {
  const element = container?.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid="true"]') ?? null;
  element?.focus({preventScroll: true});
  element?.scrollIntoView?.({block: 'center', behavior: reducedMotion ? 'auto' : 'smooth'});
  return element;
}

export interface WizardStepperClassNames {list: string; item: string; connector: string; connectorPending: string; connectorDone: string; button: string; buttonCurrent: string; buttonJumpable: string;
  marker: string; markerDone: string; markerCurrent: string; markerPending: string; title: string; titleActive: string; titlePending: string; caption: string}
const STEPPER_CLASSES: WizardStepperClassNames = {
  list: 'space-y-1', item: 'relative', connector: 'absolute bottom-[-12px] start-[25.5px] top-[42px] w-px', connectorPending: 'bg-[var(--border)]', connectorDone: 'bg-[var(--primary)]',
  button: 'flex w-full items-start gap-3 rounded-[var(--radius)] px-3 py-2.5 text-start disabled:cursor-default', buttonCurrent: 'bg-[var(--primary-soft)]', buttonJumpable: 'hover:bg-[var(--surface-2)]',
  marker: 'grid h-7 w-7 shrink-0 place-items-center rounded-full text-[length:calc(12px*var(--fs-scale))] font-semibold tabular-nums',
  markerDone: 'bg-[var(--primary-fill)] text-white', markerCurrent: 'border-2 border-[var(--primary)] bg-[var(--surface)] text-[var(--primary-strong)]', markerPending: 'border border-[var(--border-strong)] text-[var(--text-muted)]',
  title: 'block text-[length:calc(14px*var(--fs-scale))] font-semibold leading-tight', titleActive: 'text-[var(--text)]', titlePending: 'text-[var(--text-muted)]',
  caption: 'mt-0.5 block text-[length:calc(12px*var(--fs-scale))] leading-snug text-[var(--text-muted)]',
};
export interface WizardStepperProps<Id extends string> {
  /** Accessible name of the step navigation. */
  label: string;
  steps: readonly WizardStep<Id>[];
  /** Null after completion: no step is current. */
  current: Id | null;
  completed: ReadonlySet<Id>;
  /** Steps the user may jump to. Pass an empty set to make the stepper read-only. */
  reachable: ReadonlySet<Id>;
  onJump: (id: Id) => void;
  /** Override any class slot; defaults use semantic host tokens. State slots (pending/done/current) are mutually exclusive. */
  classNames?: Partial<WizardStepperClassNames>;
  /** Marker renderer for completed steps. Defaults to a check icon. */
  doneMarker?: ReactNode;
}
/** Vertical step navigation. Completed steps expose a hidden "(completed)" suffix and the current step `aria-current="step"`. */
export function WizardStepper<Id extends string>({label, steps, current, completed, reachable, onJump, classNames, doneMarker}: WizardStepperProps<Id>) {
  const {t} = useLocalization(), {preferences} = usePreferences(), format = useFormatters(), c = {...STEPPER_CLASSES, ...classNames};
  const motion = preferences.reducedMotion ? 'transition-none' : 'transition-colors duration-150';
  return <nav aria-label={t(label)} data-wizard-stepper><ol className={c.list}>
    {steps.map((step, index) => {
      const isCurrent = step.id === current, isDone = completed.has(step.id) && !isCurrent, canJump = reachable.has(step.id) && !isCurrent;
      return <li key={step.id} className={c.item} data-step={step.id} data-state={isCurrent ? 'current' : isDone ? 'done' : 'pending'}>
        {index < steps.length - 1 && <span aria-hidden="true" className={cn(c.connector, motion, isDone ? c.connectorDone : c.connectorPending)}/>}
        <button type="button" disabled={!canJump} onClick={() => onJump(step.id)} aria-current={isCurrent ? 'step' : undefined}
          className={cn(c.button, motion, isCurrent && c.buttonCurrent, canJump && c.buttonJumpable)}>
          <span className={cn(c.marker, motion, isDone ? c.markerDone : isCurrent ? c.markerCurrent : c.markerPending)}>
            {isDone ? doneMarker ?? <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true"/> : format.number(index + 1)}
          </span>
          <span className="min-w-0 pt-0.5">
            <span className={cn(c.title, isCurrent || isDone ? c.titleActive : c.titlePending)}>{t(step.title)}{isDone && <span className="sr-only"> {t('(completed)')}</span>}</span>
            {step.caption && <span className={c.caption}>{t(step.caption)}</span>}
          </span>
        </button>
      </li>;
    })}
  </ol></nav>;
}

/** `className`/`barClassName` replace the default track and bar colors. */
export interface WizardProgressProps {label: string; value: number; className?: string; barClassName?: string}
/** Determinate progress bar (0–1) with a percentage value for assistive technology. Uses logical start alignment for RTL. */
export function WizardProgress({label, value, className, barClassName}: WizardProgressProps) {
  const {t} = useLocalization(), {preferences} = usePreferences(), bounded = Math.min(1, Math.max(0, value));
  return <div role="progressbar" aria-label={t(label)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(bounded * 100)} className={className ?? 'h-1 w-full bg-[var(--surface-3)]'} data-wizard-progress>
    <div className={cn('h-full', barClassName ?? 'bg-[var(--primary)]', !preferences.reducedMotion && 'transition-[width] duration-500 ease-out')} style={{width: `${Math.max(bounded, 0.02) * 100}%`}}/>
  </div>;
}
