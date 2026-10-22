'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Check, Eye, History, RotateCcw, Save } from 'lucide-react';
import {
  DEFAULT_LAYOUT_SETTINGS,
  defaultValues,
  todayISO,
  type FormValues,
  type LayoutKind,
  type LayoutSettings,
  type SettingsHistoryEntry,
} from '@allyvora/shared';
import { api } from '@/lib/api';
import { useApp } from '@/lib/app-context';
import { cn } from '@/lib/cn';
import { dateTime, relativeTime } from '@/lib/format';
import { useHotkey } from '@/lib/hooks';
import { LAYOUTS, layoutMeta } from '@/lib/layouts';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Misc';
import { useToast } from '@/components/ui/Toast';
import { Segmented, Switch } from '@/components/form/Controls';
import { PatientForm } from '@/components/patient-form/PatientForm';

const KEYS: (keyof LayoutSettings)[] = ['layout', 'density', 'columns', 'showSummary', 'validateOn', 'autosaveDraft'];
const same = (a: LayoutSettings, b: LayoutSettings) => KEYS.every((k) => a[k] === b[k]);

/** Schematic drawing of each layout, so the choice is visual before it's verbal. */
function LayoutThumb({ kind, selected }: { kind: LayoutKind; selected: boolean }) {
  const line = 'rgb(var(--line-strong))';
  const fill = 'rgb(var(--sunken))';
  const hot = selected ? 'rgb(var(--brand))' : 'rgb(var(--ink-3))';
  const card = (x: number, y: number, w: number, h: number, k?: string) => (
    <rect key={k ?? `${x}-${y}`} x={x} y={y} width={w} height={h} rx={3} fill="rgb(var(--surface))" stroke={line} />
  );
  const bars = (x: number, y: number, n: number, w: number) =>
    Array.from({ length: n }).map((_, i) => <rect key={`b${x}${y}${i}`} x={x} y={y + i * 6} width={w - (i % 2) * 8} height={2.5} rx={1.25} fill={line} />);

  let body: ReactNode;
  switch (kind) {
    case 'scroll':
      body = (
        <>
          <rect x={4} y={4} width={26} height={68} rx={3} fill={fill} />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect key={i} x={8} y={9 + i * 10} width={i === 1 ? 18 : 14} height={4} rx={2} fill={i === 1 ? hot : line} />
          ))}
          {card(34, 4, 82, 30)}
          {bars(39, 11, 3, 60)}
          {card(34, 38, 82, 34)}
          {bars(39, 45, 4, 60)}
        </>
      );
      break;
    case 'tabs':
      body = (
        <>
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x={6 + i * 22} y={7} width={16} height={4} rx={2} fill={i === 1 ? hot : line} />
          ))}
          <rect x={4} y={15} width={112} height={1} fill={line} />
          <rect x={27} y={14} width={18} height={2} rx={1} fill={hot} />
          {card(4, 21, 112, 51)}
          {bars(10, 29, 6, 80)}
        </>
      );
      break;
    case 'wizard':
      body = (
        <>
          <rect x={14} y={10} width={92} height={1.5} fill={line} />
          <rect x={14} y={10} width={30} height={1.5} fill={hot} />
          {[0, 1, 2, 3, 4].map((i) => (
            <circle key={i} cx={14 + i * 23} cy={10.75} r={4} fill={i < 2 ? hot : 'rgb(var(--surface))'} stroke={i < 2 ? hot : line} />
          ))}
          {card(4, 21, 112, 51)}
          {bars(10, 29, 6, 80)}
        </>
      );
      break;
    case 'stepper':
      body = (
        <>
          <rect x={4} y={4} width={36} height={68} rx={3} fill={fill} />
          <rect x={11.5} y={10} width={1} height={54} fill={line} />
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i}>
              <circle cx={12} cy={12 + i * 12.5} r={3.5} fill={i === 1 ? hot : 'rgb(var(--surface))'} stroke={i === 1 ? hot : line} />
              <rect x={19} y={10.5 + i * 12.5} width={16} height={3} rx={1.5} fill={line} />
            </g>
          ))}
          {card(44, 4, 72, 68)}
          {bars(50, 12, 7, 54)}
        </>
      );
      break;
    case 'accordion':
      body = (
        <>
          {card(4, 4, 112, 10, 'a1')}
          {card(4, 17, 112, 34, 'a2')}
          <rect x={4} y={17} width={112} height={10} rx={3} fill={selected ? 'rgb(var(--brand-soft))' : fill} stroke={line} />
          <circle cx={11} cy={22} r={2.5} fill={hot} />
          {bars(10, 32, 3, 80)}
          {card(4, 54, 112, 8, 'a3')}
          {card(4, 65, 112, 8, 'a4')}
        </>
      );
      break;
  }
  return (
    <svg viewBox="0 0 120 76" className="h-auto w-full" aria-hidden>
      {body}
    </svg>
  );
}

function OptionRow({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-6">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink">{title}</p>
        <p className="text-[13px] text-ink-2">{description}</p>
      </div>
      <div className="shrink-0 sm:w-[260px]">{children}</div>
    </div>
  );
}

function sampleValues(branchId: number | null): FormValues {
  const today = todayISO();
  const year = Number(today.slice(0, 4));
  return {
    ...defaultValues(today, branchId),
    title: 'ms',
    givenName: 'Meera',
    familyName: 'Varghese',
    displayName: 'Ms Meera Varghese',
    localName: 'മീര വർഗീസ്',
    dateOfBirth: `${year - 34}-03-12`,
    administrativeSex: 'female',
    mobile: '9847012345',
    email: 'meera.varghese@example.in',
    pincode: '682020',
    addressLine1: '41/2210, Chittoor Road',
    city: 'Kadavanthra',
    district: 'Ernakulam',
    state: 'KL',
    bloodGroup: 'B+',
    allergyStatus: 'known',
    allergens: ['penicillin'],
    department: 'card',
  };
}

export function LayoutSetup() {
  const { ready, settings, setSettings, lookups, branchId } = useApp();
  const toast = useToast();
  const [draft, setDraft] = useState<LayoutSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<SettingsHistoryEntry[] | null>(null);
  const sample = useMemo(() => sampleValues(branchId), [branchId]);

  useEffect(() => setDraft(settings), [settings]);
  const loadHistory = useCallback(() => {
    api.settings.history().then(setHistory).catch(() => setHistory([]));
  }, []);
  useEffect(loadHistory, [loadHistory]);

  const dirty = !same(draft, settings);
  const set = <K extends keyof LayoutSettings>(k: K, v: LayoutSettings[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      const saved = await api.settings.saveLayout(draft);
      setSettings(saved);
      loadHistory();
      toast({ tone: 'success', title: 'Layout saved', detail: `Everyone now registers patients with ${layoutMeta(saved.layout).name.toLowerCase()}.` });
    } catch (e) {
      toast({ tone: 'error', title: 'Layout not saved', detail: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  useHotkey('mod+s', (e) => {
    e.preventDefault();
    void save();
  });

  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [dirty]);

  if (!ready) {
    return (
      <div className="grid gap-4 px-3 py-4 sm:px-4 lg:px-6 xl:grid-cols-[440px_1fr]">
        <Skeleton className="h-[70vh] rounded-2xl" />
        <Skeleton className="h-[70vh] rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 px-3 py-4 sm:px-4 lg:px-6 lg:py-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-cond text-[26px] font-semibold leading-8 tracking-tight text-ink">Patient form layout</h1>
          <p className="text-ink-2">
            Choose how the registration form is arranged for everyone in {lookups.branch?.length ? 'your organisation' : 'this workspace'}. The fields and rules stay the same in every layout.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" icon={<RotateCcw className="size-4" />} onClick={() => setDraft({ ...DEFAULT_LAYOUT_SETTINGS })} disabled={same(draft, DEFAULT_LAYOUT_SETTINGS)}>
            Use defaults
          </Button>
          <Button variant="secondary" onClick={() => setDraft(settings)} disabled={!dirty}>
            Discard
          </Button>
          <Button variant="primary" icon={<Save className="size-4" />} onClick={save} loading={saving} disabled={!dirty} kbd="⌘S">
            Save layout
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(400px,460px)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <section className="rounded-2xl border border-line bg-surface p-4" aria-labelledby="layout-h">
            <h2 id="layout-h" className="font-semibold text-ink">
              Arrangement
            </h2>
            <p className="text-[13px] text-ink-2">Each layout shows the same nine sections.</p>
            <div role="radiogroup" aria-labelledby="layout-h" className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              {LAYOUTS.map((l) => {
                const sel = draft.layout === l.id;
                const current = settings.layout === l.id;
                return (
                  <button
                    key={l.id}
                    type="button"
                    role="radio"
                    aria-checked={sel}
                    onClick={() => set('layout', l.id)}
                    className={cn(
                      'group flex flex-col gap-2.5 rounded-xl border p-3 text-left transition-colors',
                      sel ? 'border-brand bg-brand-soft/50 ring-1 ring-brand' : 'border-line hover:border-line-strong hover:bg-sunken/50',
                    )}
                  >
                    <div className={cn('rounded-lg border p-2', sel ? 'border-brand/30 bg-surface' : 'border-line bg-bg')}>
                      <LayoutThumb kind={l.id} selected={sel} />
                    </div>
                    <div>
                      <p className="flex items-center gap-2 font-semibold text-ink">
                        {l.name}
                        {current && <span className="rounded-full bg-sunken px-2 py-px text-2xs font-medium text-ink-2">In use</span>}
                        {sel && <Check className="ml-auto size-4 text-brand" aria-hidden />}
                      </p>
                      <p className="mt-0.5 text-[13px] leading-[18px] text-ink-2">{l.summary}</p>
                      <p className="mt-1.5 text-xs text-ink-3">Best for {l.bestFor.charAt(0).toLowerCase() + l.bestFor.slice(1)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-surface p-4" aria-labelledby="display-h">
            <h2 id="display-h" className="mb-3 font-semibold text-ink">
              Display
            </h2>
            <div className="divide-y divide-line">
              <OptionRow title="Density" description="Compact fits more fields on screen with less scrolling.">
                <Segmented
                  id="opt-density"
                  labelId="display-h"
                  options={[
                    { code: 'comfortable', label: 'Comfortable' },
                    { code: 'compact', label: 'Compact' },
                  ]}
                  value={draft.density}
                  onChange={(v) => v && set('density', v as LayoutSettings['density'])}
                />
              </OptionRow>
              <OptionRow title="Columns on wide screens" description="Smaller screens drop columns automatically.">
                <Segmented
                  id="opt-columns"
                  labelId="display-h"
                  options={[
                    { code: '2', label: '2' },
                    { code: '3', label: '3' },
                    { code: '4', label: '4' },
                  ]}
                  value={String(draft.columns)}
                  onChange={(v) => v && set('columns', Number(v) as LayoutSettings['columns'])}
                />
              </OptionRow>
              <OptionRow title="Patient summary band" description="Shows name, age, allergies and MRN above the form as you type.">
                <div className="flex sm:justify-end">
                  <Switch id="opt-summary" checked={draft.showSummary} onChange={(v) => set('showSummary', v)} />
                </div>
              </OptionRow>
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-surface p-4" aria-labelledby="check-h">
            <h2 id="check-h" className="mb-3 font-semibold text-ink">
              Checking and drafts
            </h2>
            <div className="divide-y divide-line">
              <OptionRow
                title="Show problems"
                description={
                  draft.validateOn === 'change'
                    ? 'Problems appear while typing. Strict, but can feel noisy.'
                    : draft.validateOn === 'blur'
                      ? 'Problems appear when you leave a field. Recommended.'
                      : 'Problems appear only when you save or move to the next step.'
                }
              >
                <Segmented
                  id="opt-validate"
                  labelId="check-h"
                  options={[
                    { code: 'change', label: 'Typing' },
                    { code: 'blur', label: 'Leaving' },
                    { code: 'submit', label: 'Saving' },
                  ]}
                  value={draft.validateOn}
                  onChange={(v) => v && set('validateOn', v as LayoutSettings['validateOn'])}
                />
              </OptionRow>
              <OptionRow title="Keep drafts" description="Unsaved new registrations are kept on this device and offered back next time.">
                <div className="flex sm:justify-end">
                  <Switch id="opt-draft" checked={draft.autosaveDraft} onChange={(v) => set('autosaveDraft', v)} />
                </div>
              </OptionRow>
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-surface p-4" aria-labelledby="hist-h">
            <h2 id="hist-h" className="flex items-center gap-2 font-semibold text-ink">
              <History className="size-4 text-ink-3" aria-hidden />
              Change history
            </h2>
            {settings.updatedAt && (
              <p className="mt-0.5 text-[13px] text-ink-2">
                Last changed {relativeTime(settings.updatedAt)} by {settings.updatedBy}.
              </p>
            )}
            {!history ? (
              <Skeleton className="mt-3 h-20" />
            ) : history.length === 0 ? (
              <p className="mt-3 text-[13px] text-ink-3">No changes yet. The default layout is in use.</p>
            ) : (
              <ol className="mt-3 divide-y divide-line">
                {history.map((h, i) => (
                  <li key={h.id} className="flex items-center gap-3 py-2 text-[13px]">
                    <span className="min-w-0 flex-1">
                      <span className="block text-ink">
                        {layoutMeta(h.value.layout).name}, {h.value.density}, {h.value.columns} columns
                      </span>
                      <span className="block text-xs text-ink-3" title={dateTime(h.changedAt)}>
                        {h.changedBy}, {relativeTime(h.changedAt)}
                      </span>
                    </span>
                    {i === 0 ? (
                      <span className="text-xs text-ink-3">Current</span>
                    ) : (
                      <Button size="sm" variant="quiet" onClick={() => setDraft({ ...h.value })}>
                        Use again
                      </Button>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <section className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface xl:sticky xl:top-[calc(var(--header-h)+16px)]" aria-labelledby="preview-h">
          <header className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
            <Eye className="size-4 text-ink-3" aria-hidden />
            <h2 id="preview-h" className="font-semibold text-ink">
              Live preview
            </h2>
            <span className="text-[13px] text-ink-2">{layoutMeta(draft.layout).name} with a sample patient. Try it; nothing is saved.</span>
            {dirty && <span className="ml-auto rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent-ink">Not saved yet</span>}
          </header>
          <div className="h-[min(760px,calc(100dvh-var(--header-h)-var(--footer-h)-110px))] min-h-[520px] bg-bg p-3">
            <PatientForm
              mode="preview"
              initialValues={sample}
              settings={draft}
              lookups={lookups}
              onSubmit={async () => {
                toast({ tone: 'info', title: 'This is a preview', detail: 'Patients are saved from the patient register.' });
                return { ok: false };
              }}
              onCancel={() => toast({ tone: 'info', title: 'This is a preview' })}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
