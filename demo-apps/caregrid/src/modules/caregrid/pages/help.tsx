'use client';
import React, {useMemo, useState} from 'react';
import {BookOpen, Keyboard, Layers} from '@pepbits/icons';
import {SearchInput} from '@pepbits/ui';
import {usePreferences} from '@pepbits/preferences/react';
import {DESTINATIONS, to} from '../../../navigation';
import {useScreen} from '../context';
import {CONCEPTS, HELP} from '../help';
import {KIND_LABEL, PATTERN_HINT, SLOT_MODEL_LABEL} from '../labels';
import {KindIcon, Panel} from '../ui';

const SLOT_MODELS = [['fixed', 'Set start times for one practitioner, such as consultations.'], ['capacity', 'Several identical chairs or beds; any free one is used, such as sample collection.'], ['block', 'Long cases of varying length in a theatre or suite.'], ['open', 'Queue-based or variable length, such as walk-ins and admissions.']] as const;
/** Help search matches concepts and screen guides, as in the source. */
export function matchHelp(query: string) {
  const match = (text: string) => !query || text.toLowerCase().includes(query.toLowerCase());
  return {concepts: CONCEPTS.filter(c => match(c.title + ' ' + c.body.join(' '))), pages: DESTINATIONS.filter(d => d.id !== 'caregrid-help' && HELP[d.id] && match(`${HELP[d.id]!.title} ${HELP[d.id]!.intro} ${HELP[d.id]!.steps.join(' ')}`))};
}

export function HelpPage() {
  const {t, navigation} = useScreen(), {preferences} = usePreferences();
  const [q, setQ] = useState('');
  const {concepts, pages} = useMemo(() => matchHelp(q), [q]);
  const shortcuts: [string, string][] = [['Ctrl K', 'Search patients, services, resources, pages'], ['B', 'Book an appointment'], ['?', 'Help for the current page'], ['Esc', 'Close any panel']];
  return <div className="mx-auto max-w-[90rem] space-y-3" data-help-page>
    <div className="cg-panel flex flex-wrap items-center gap-4 p-5">
      <p className="flex-1 text-sm text-[var(--text-muted)]">{t('How CareGrid finds time across people, machines, rooms, chairs, beds and vehicles, and how to use each screen.')}</p>
      <div className="w-full max-w-md" data-tour="cg-help-search"><SearchInput aria-label="Search help" placeholder="Search help, for example “breakdown” or “waitlist”" value={q} onChange={setQ}/></div>
    </div>
    <div className="grid gap-3 xl:grid-cols-[1fr_22rem]">
      <div className="space-y-3">
        <Panel title={<span className="flex items-center gap-2"><Layers aria-hidden className="size-4"/>{t('Concepts')}</span>} bodyClassName="px-5 pb-5">
          <div className="grid gap-x-8 gap-y-5 lg:grid-cols-2">
            {concepts.map(c => <article key={c.id} id={c.id} data-concept={c.id}><h3 className="font-semibold">{t(c.title)}</h3>{c.body.map((p, i) => <p key={i} className="mt-1.5 text-sm leading-relaxed text-[var(--text-muted)]">{t(p)}</p>)}</article>)}
            {!concepts.length ? <p className="text-sm text-[var(--text-muted)]">{t('No concept matches “{q}”.', {q})}</p> : null}
          </div>
        </Panel>
        <Panel title={<span className="flex items-center gap-2"><BookOpen aria-hidden className="size-4"/>{t('Screen guides')}</span>} bodyClassName="px-5 pb-5">
          <ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">{pages.map(d => {const h = HELP[d.id]!, Icon = d.icon; return <li key={d.id}><button type="button" data-guide={d.id} onClick={() => navigation.open(to(d.id))} className="h-full w-full rounded-[var(--radius)] border border-[var(--border)] p-4 text-start hover:border-[var(--primary)]">
            <span className="flex items-center gap-2 font-semibold"><Icon aria-hidden className="size-4" style={{color: 'var(--primary)'}}/>{t(h.title)}</span>
            <span className="mt-1 block text-xs leading-relaxed text-[var(--text-muted)]">{t(h.intro)}</span>
            <ol className="mt-2 space-y-1 text-xs">{h.steps.map((s, i) => <li key={i} className="flex gap-2"><span className="font-semibold" style={{color: 'var(--primary)'}}>{i + 1}.</span><span>{t(s)}</span></li>)}</ol>
          </button></li>;})}</ul>
        </Panel>
      </div>
      <div className="space-y-3">
        <Panel title={<span className="flex items-center gap-2"><Keyboard aria-hidden className="size-4"/>{t('Keyboard shortcuts')}</span>} bodyClassName="px-5 pb-5">
          {!preferences.keyboardShortcuts ? <p className="mb-2 rounded-lg p-2 text-xs cg-wash-info">{t('Keyboard shortcuts are switched off in your preferences.')}</p> : null}
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">{shortcuts.map(([key, label]) => <React.Fragment key={key}><dt><kbd className="cg-kbd">{key}</kbd></dt><dd>{t(label)}</dd></React.Fragment>)}</dl>
        </Panel>
        <Panel title={t('Resource types')} bodyClassName="px-5 pb-5"><ul className="space-y-2 text-sm">{Object.keys(KIND_LABEL).map(k => <li key={k} className="flex items-center gap-2"><KindIcon kind={k}/>{t(KIND_LABEL[k]!)}</li>)}</ul></Panel>
        <Panel title={t('Resource patterns')} bodyClassName="px-5 pb-5"><dl className="space-y-2 text-sm">{Object.entries(PATTERN_HINT).map(([k, v]) => <div key={k}><dt className="font-medium">{k}</dt><dd className="text-xs text-[var(--text-muted)]">{t(v)}</dd></div>)}</dl></Panel>
        <Panel title={t('Slot models')} bodyClassName="px-5 pb-5"><dl className="space-y-2 text-sm">{SLOT_MODELS.map(([k, v]) => <div key={k}><dt className="font-medium">{t(SLOT_MODEL_LABEL[k]!)}</dt><dd className="text-xs text-[var(--text-muted)]">{t(v)}</dd></div>)}</dl></Panel>
      </div>
    </div>
  </div>;
}
