'use client';
import React, {useCallback, useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {DEFAULT_LAYOUT_SETTINGS, defaultValues, todayISO, type FormValues, type LayoutKind, type LayoutSettings, type SettingsHistoryEntry} from '@allyvora/shared';
import {Skeleton, Button, Segmented, Toggle, cn} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import {useScreenHost} from '@pepbits/patterns/screen-host';
import {Check, Eye, History, RotateCcw, Save} from '@pepbits/icons';
import {useAllyVora} from '../context';
import {LAYOUTS, layoutMeta} from '../form/layout-meta';
import {PatientForm} from '../form/PatientForm';
import {KEYS, Notice, messageOf, useHotkey, useTimeFormat} from '../support';

const KEYS_COMPARED: (keyof LayoutSettings)[] = ['layout', 'density', 'columns', 'showSummary', 'validateOn', 'autosaveDraft'];
const same = (a: LayoutSettings, b: LayoutSettings) => KEYS_COMPARED.every(key => a[key] === b[key]);

/** Schematic drawing of each layout, so the choice is visual before it is verbal (decorative). */
function LayoutThumb({kind, selected}: {kind: LayoutKind; selected: boolean}) {
  const line = 'var(--border-strong)', fill = 'var(--surface-2)', hot = selected ? 'var(--primary)' : 'var(--text-subtle)';
  const card = (x: number, y: number, w: number, h: number, key?: string) => <rect key={key ?? `${x}-${y}`} x={x} y={y} width={w} height={h} rx={3} fill="var(--surface)" stroke={line}/>;
  const bars = (x: number, y: number, n: number, w: number) => Array.from({length: n}).map((_, i) => <rect key={`b${x}${y}${i}`} x={x} y={y + i * 6} width={w - (i % 2) * 8} height={2.5} rx={1.25} fill={line}/>);
  let body: ReactNode;
  switch (kind) {
    case 'scroll': body = <>{<rect x={4} y={4} width={26} height={68} rx={3} fill={fill}/>}{[0, 1, 2, 3, 4, 5].map(i => <rect key={i} x={8} y={9 + i * 10} width={i === 1 ? 18 : 14} height={4} rx={2} fill={i === 1 ? hot : line}/>)}{card(34, 4, 82, 30)}{bars(39, 11, 3, 60)}{card(34, 38, 82, 34)}{bars(39, 45, 4, 60)}</>; break;
    case 'tabs': body = <>{[0, 1, 2, 3, 4].map(i => <rect key={i} x={6 + i * 22} y={7} width={16} height={4} rx={2} fill={i === 1 ? hot : line}/>)}<rect x={4} y={15} width={112} height={1} fill={line}/><rect x={27} y={14} width={18} height={2} rx={1} fill={hot}/>{card(4, 21, 112, 51)}{bars(10, 29, 6, 80)}</>; break;
    case 'wizard': body = <><rect x={14} y={10} width={92} height={1.5} fill={line}/><rect x={14} y={10} width={30} height={1.5} fill={hot}/>{[0, 1, 2, 3, 4].map(i => <circle key={i} cx={14 + i * 23} cy={10.75} r={4} fill={i < 2 ? hot : 'var(--surface)'} stroke={i < 2 ? hot : line}/>)}{card(4, 21, 112, 51)}{bars(10, 29, 6, 80)}</>; break;
    case 'stepper': body = <><rect x={4} y={4} width={36} height={68} rx={3} fill={fill}/><rect x={11.5} y={10} width={1} height={54} fill={line}/>{[0, 1, 2, 3, 4].map(i => <g key={i}><circle cx={12} cy={12 + i * 12.5} r={3.5} fill={i === 1 ? hot : 'var(--surface)'} stroke={i === 1 ? hot : line}/><rect x={19} y={10.5 + i * 12.5} width={16} height={3} rx={1.5} fill={line}/></g>)}{card(44, 4, 72, 68)}{bars(50, 12, 7, 54)}</>; break;
    case 'accordion': body = <>{card(4, 4, 112, 10, 'a1')}{card(4, 17, 112, 34, 'a2')}<rect x={4} y={17} width={112} height={10} rx={3} fill={selected ? 'var(--primary-soft)' : fill} stroke={line}/><circle cx={11} cy={22} r={2.5} fill={hot}/>{bars(10, 32, 3, 80)}{card(4, 54, 112, 8, 'a3')}{card(4, 65, 112, 8, 'a4')}</>; break;
  }
  return <svg viewBox="0 0 120 76" className="h-auto w-full" aria-hidden="true">{body}</svg>;
}

function OptionRow({title, description, children}: {title: string; description: string; children: ReactNode}) {
  const {t} = useLocalization();
  return <div className="flex flex-col gap-2.5 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-6">
    <div className="min-w-0 flex-1"><p className="text-[length:calc(12.5px*var(--fs-scale))] font-semibold text-[var(--text)]">{t(title)}</p><p className="text-[length:calc(11.5px*var(--fs-scale))] text-[var(--text-muted)]">{t(description)}</p></div>
    <div className="shrink-0 sm:w-[260px]">{children}</div>
  </div>;
}

/** Fictional sample patient for the live preview (from the source layout page). */
export function sampleValues(branchId: number | null): FormValues {
  const today = todayISO(), year = Number(today.slice(0, 4));
  return {...defaultValues(today, branchId), title: 'ms', givenName: 'Meera', familyName: 'Varghese', displayName: 'Ms Meera Varghese', localName: 'മീര വർഗീസ്',
    dateOfBirth: `${year - 34}-03-12`, administrativeSex: 'female', mobile: '9847012345', email: 'meera.varghese@example.in', pincode: '682020',
    addressLine1: '41/2210, Chittoor Road', city: 'Kadavanthra', district: 'Ernakulam', state: 'KL', bloodGroup: 'B+', allergyStatus: 'known', allergens: ['penicillin'], department: 'card'};
}

/** Administrator layout designer: arrangement, display, checking/drafts, history and a live preview with the real form. */
export function LayoutSetup() {
  const {client, settings, setSettings, lookups, branchId} = useAllyVora();
  const {t} = useLocalization(), host = useScreenHost(), time = useTimeFormat();
  const canEdit = host.can('allyvora-configure-layout');
  const [draft, setDraft] = useState<LayoutSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<SettingsHistoryEntry[] | null>(null);
  const sample = useMemo(() => sampleValues(branchId), [branchId]);
  useEffect(() => setDraft(settings), [settings]);
  const loadHistory = useCallback(() => {client.settings.history().then(setHistory).catch(() => setHistory([]));}, [client]);
  useEffect(loadHistory, [loadHistory]);
  const dirty = !same(draft, settings);
  const set = <K extends keyof LayoutSettings>(key: K, value: LayoutSettings[K]) => {if (canEdit) setDraft(current => ({...current, [key]: value}));};
  const save = async () => {
    if (!dirty || saving || !canEdit) return;
    setSaving(true);
    try {
      const saved = await client.settings.saveLayout(draft);
      setSettings(saved); loadHistory();
      host.notify(`${t('Layout saved')}: ${t('Everyone now registers patients with {layout}.', {layout: t(layoutMeta(saved.layout).name).toLowerCase()})}`, {tone: 'success'});
    } catch (failure) {
      host.notify(`${t('Layout not saved')}: ${messageOf(failure)}`, {tone: 'error'});
    } finally {setSaving(false);}
  };
  useHotkey(KEYS.save, event => {event.preventDefault(); void save();});
  useEffect(() => {
    host.document.reportDirty(dirty);
    if (!dirty) return;
    const onUnload = (event: BeforeUnloadEvent) => {event.preventDefault(); event.returnValue = '';};
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [dirty, host.document]);
  const documentHost = useRef(host.document);
  documentHost.current = host.document;
  useEffect(() => () => documentHost.current.reportDirty(false), []);

  return <div className="flex flex-1 flex-col gap-4 px-3 py-4 sm:px-4 lg:px-6 lg:py-5" data-layout-setup="">
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1">
        <h1 className="text-[length:calc(22px*var(--fs-scale))] font-bold tracking-tight text-[var(--text)]">{t('Patient form layout')}</h1>
        <p className="text-[length:calc(12px*var(--fs-scale))] text-[var(--text-muted)]">{t('Choose how the registration form is arranged for everyone in your organisation. The fields and rules stay the same in every layout.')}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={() => setDraft({...DEFAULT_LAYOUT_SETTINGS})} disabled={!canEdit || same(draft, DEFAULT_LAYOUT_SETTINGS)}><RotateCcw className="size-4" aria-hidden="true"/>{t('Use defaults')}</Button>
        <Button variant="secondary" onClick={() => setDraft(settings)} disabled={!dirty}>{t('Discard')}</Button>
        <Button variant="primary" onClick={() => void save()} disabled={!dirty || saving || !canEdit} aria-busy={saving || undefined}><Save className="size-4" aria-hidden="true"/>{t(saving ? 'Saving…' : 'Save layout')}</Button>
      </div>
    </div>
    {!canEdit ? <Notice tone="info">{t('Only administrators can change the organisation layout. You can explore the options in the preview.')}</Notice> : null}
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(400px,460px)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4" aria-labelledby="layout-h">
          <h2 id="layout-h" className="text-[length:calc(13px*var(--fs-scale))] font-bold text-[var(--text)]">{t('Arrangement')}</h2>
          <p className="text-[length:calc(11.5px*var(--fs-scale))] text-[var(--text-muted)]">{t('Each layout shows the same nine sections.')}</p>
          <div role="radiogroup" aria-labelledby="layout-h" className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            {LAYOUTS.map(layout => {
              const selected = draft.layout === layout.id, current = settings.layout === layout.id;
              return <button key={layout.id} type="button" role="radio" aria-checked={selected} onClick={() => set('layout', layout.id)} aria-disabled={!canEdit || undefined}
                className={cn('focus-ring group flex flex-col gap-2.5 rounded-xl border p-3 text-start transition-colors', selected ? 'border-[var(--primary)] bg-[var(--primary-soft)] ring-1 ring-[var(--primary)]' : 'border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]')} data-layout-option={layout.id}>
                <div className={cn('rounded-lg border p-2', selected ? 'border-[var(--primary)] bg-[var(--surface)]' : 'border-[var(--border)] bg-[var(--bg)]')}><LayoutThumb kind={layout.id} selected={selected}/></div>
                <div>
                  <p className="flex items-center gap-2 text-[length:calc(12.5px*var(--fs-scale))] font-bold text-[var(--text)]">{t(layout.name)}{current ? <span className="rounded-full bg-[var(--surface-2)] px-2 py-px text-[length:calc(10px*var(--fs-scale))] font-semibold text-[var(--text-muted)]">{t('In use')}</span> : null}{selected ? <Check className="ms-auto size-4 text-[var(--primary)]" aria-hidden="true"/> : null}</p>
                  <p className="mt-0.5 text-[length:calc(11.5px*var(--fs-scale))] leading-[18px] text-[var(--text-muted)]">{t(layout.summary)}</p>
                  <p className="mt-1.5 text-[length:calc(10.5px*var(--fs-scale))] text-[var(--text-subtle)]">{t('Best for {who}', {who: t(layout.bestFor).charAt(0).toLowerCase() + t(layout.bestFor).slice(1)})}</p>
                </div>
              </button>;
            })}
          </div>
        </section>
        <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4" aria-labelledby="display-h">
          <h2 id="display-h" className="mb-3 text-[length:calc(13px*var(--fs-scale))] font-bold text-[var(--text)]">{t('Display')}</h2>
          <div className="divide-y divide-[var(--border)]">
            <OptionRow title="Density" description="Compact fits more fields on screen with less scrolling."><Segmented label="Density" value={draft.density} onChange={value => set('density', value as LayoutSettings['density'])} options={[{value: 'comfortable', label: 'Comfortable', disabled: !canEdit}, {value: 'compact', label: 'Compact', disabled: !canEdit}]}/></OptionRow>
            <OptionRow title="Columns on wide screens" description="Smaller screens drop columns automatically."><Segmented label="Columns on wide screens" value={String(draft.columns)} onChange={value => set('columns', Number(value) as LayoutSettings['columns'])} options={['2', '3', '4'].map(value => ({value, label: value, disabled: !canEdit}))}/></OptionRow>
            <OptionRow title="Patient summary band" description="Shows name, age, allergies and MRN above the form as you type."><Toggle label="Show the patient summary band" checked={draft.showSummary} onChange={value => set('showSummary', value)} disabled={!canEdit}/></OptionRow>
          </div>
        </section>
        <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4" aria-labelledby="check-h">
          <h2 id="check-h" className="mb-3 text-[length:calc(13px*var(--fs-scale))] font-bold text-[var(--text)]">{t('Checking and drafts')}</h2>
          <div className="divide-y divide-[var(--border)]">
            <OptionRow title="Show problems" description={draft.validateOn === 'change' ? 'Problems appear while typing. Strict, but can feel noisy.' : draft.validateOn === 'blur' ? 'Problems appear when you leave a field. Recommended.' : 'Problems appear only when you save or move to the next step.'}>
              <Segmented label="Show problems" value={draft.validateOn} onChange={value => set('validateOn', value as LayoutSettings['validateOn'])} options={[{value: 'change', label: 'Typing', disabled: !canEdit}, {value: 'blur', label: 'Leaving', disabled: !canEdit}, {value: 'submit', label: 'Saving', disabled: !canEdit}]}/>
            </OptionRow>
            <OptionRow title="Keep drafts" description="Unsaved new registrations are kept for the signed-in session and offered back. Nothing is written to browser storage."><Toggle label="Keep unsaved registrations" checked={draft.autosaveDraft} onChange={value => set('autosaveDraft', value)} disabled={!canEdit}/></OptionRow>
          </div>
        </section>
        <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4" aria-labelledby="hist-h" data-layout-history="">
          <h2 id="hist-h" className="flex items-center gap-2 text-[length:calc(13px*var(--fs-scale))] font-bold text-[var(--text)]"><History className="size-4 text-[var(--text-muted)]" aria-hidden="true"/>{t('Change history')}</h2>
          {settings.updatedAt ? <p className="mt-0.5 text-[length:calc(11.5px*var(--fs-scale))] text-[var(--text-muted)]">{t('Last changed {when} by {who}.', {when: time.relative(settings.updatedAt), who: settings.updatedBy ?? ''})}</p> : null}
          {!history ? <Skeleton className="mt-3 h-20"/> : history.length === 0 ? <p className="mt-3 text-[length:calc(11.5px*var(--fs-scale))] text-[var(--text-muted)]">{t('No changes yet. The default layout is in use.')}</p>
            : <ol className="mt-3 divide-y divide-[var(--border)]">{history.map((entry, i) => <li key={entry.id} className="flex items-center gap-3 py-2 text-[length:calc(11.5px*var(--fs-scale))]">
              <span className="min-w-0 flex-1">
                <span className="block text-[var(--text)]">{t('{layout}, {density}, {columns} columns', {layout: t(layoutMeta(entry.value.layout).name), density: t(entry.value.density), columns: entry.value.columns})}</span>
                <span className="block text-[length:calc(10.5px*var(--fs-scale))] text-[var(--text-muted)]" title={time.dateTime(entry.changedAt)}>{entry.changedBy}, {time.relative(entry.changedAt)}</span>
              </span>
              {i === 0 ? <span className="text-[length:calc(10.5px*var(--fs-scale))] text-[var(--text-muted)]">{t('Current')}</span> : <Button size="sm" variant="ghost" disabled={!canEdit} onClick={() => setDraft({...entry.value})}>{t('Use again')}</Button>}
            </li>)}</ol>}
        </section>
      </div>
      <section className="flex flex-col overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] xl:sticky xl:top-4" aria-labelledby="preview-h">
        <header className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-4 py-3">
          <Eye className="size-4 text-[var(--text-muted)]" aria-hidden="true"/>
          <h2 id="preview-h" className="text-[length:calc(13px*var(--fs-scale))] font-bold text-[var(--text)]">{t('Live preview')}</h2>
          <span className="text-[length:calc(11.5px*var(--fs-scale))] text-[var(--text-muted)]">{t('{layout} with a sample patient. Try it; nothing is saved.', {layout: t(layoutMeta(draft.layout).name)})}</span>
          {dirty ? <span className="ms-auto rounded-full bg-[color-mix(in_srgb,var(--warning)_16%,var(--surface))] px-2.5 py-0.5 text-[length:calc(10.5px*var(--fs-scale))] font-semibold text-[var(--warning-ink)]">{t('Not saved yet')}</span> : null}
        </header>
        <div className="h-[min(760px,calc(100dvh-180px))] min-h-[520px] bg-[var(--bg)] p-3" data-layout-preview={draft.layout}>
          <PatientForm mode="preview" initialValues={sample} settings={draft} lookups={lookups}
            onSubmit={async () => {host.notify(`${t('This is a preview')}: ${t('Patients are saved from the patient register.')}`, {tone: 'info'}); return {ok: false};}}
            onCancel={() => host.notify(t('This is a preview'), {tone: 'info'})}/>
        </div>
      </section>
    </div>
  </div>;
}
