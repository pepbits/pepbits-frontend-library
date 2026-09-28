"use client";
/*
 * The parts of the source Header/CommandPalette/Footer that are module features rather than shell chrome:
 * report search, the background-report indicator and the time-zone/synthetic-data note. Sidebar, sign-out,
 * user menu and page frame belong to the host shell and are not reproduced.
 *
 * Shortcut: the source bound Ctrl/⌘+K; the host shell owns that key for its own palette, so the module uses
 * Ctrl/⌘+Shift+K, bound only while the keyboardShortcuts preference is on.
 */
import { FileBarChart, FolderDown, Loader2, Search } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalization } from '@pepbits/ops-ui';
import { ReferenceLink, useReferenceHost } from '@pepbits/reference-host';
import { useModuleRouter, useReportsClient } from '../api/client';
import { visibleReportsNavigation } from '../navigation';
import type { Job, Permission } from '../types';
import { Modal } from '../ui/primitives';
import { useModuleShortcut } from '../ui/preferences';
import { useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export interface ReportsSession {
  user: { id: string; name: string; email: string; roleNames: string[]; branches: string[]; permissions: Permission[]; isAdmin: boolean };
  reports: { id: string; title: string; category: string }[];
  org: { name: string; timezone: string; locale: string; currency: string };
  navigation: string[];
  demo?: Record<string, string>;
}

function useActiveJobs() {
  const { api } = useReportsClient();
  const [jobs, setJobs] = useState<Job[]>([]);
  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const load = async () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        try {
          const next = await api<Job[]>('/api/jobs?active=1', { signal: controller.signal });
          if (!stop) setJobs(next);
        } catch { /* offline or signed out: the indicator is advisory */ }
      }
      if (!stop) timer = setTimeout(load, 5000);
    };
    void load();
    return () => { stop = true; controller.abort(); if (timer) clearTimeout(timer); };
  }, [api]);
  return jobs;
}

interface Item { href: string; title: string; sub: string; kind: 'report' | 'page' }

export function CommandPalette({ open, onClose, session }: { open: boolean; onClose: () => void; session: ReportsSession }) {
 const referenceT = useReferenceLocalization().t;

  const { t } = useLocalization();
  const router = useModuleRouter();
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const all = useMemo<Item[]>(() => [
    ...session.reports.map((r) => ({ href: `/reports/${r.id}`, title: r.title, sub: r.category, kind: 'report' as const })),
    ...visibleReportsNavigation(session.user.permissions, session.user.isAdmin).flatMap((s) => s.items.map((i) => ({ href: i.href, title: t(i.label), sub: t(s.section), kind: 'page' as const }))),
  ], [session, t]);
  const results = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return all.slice(0, 12);
    return all.filter((i) => terms.every((term) => `${i.title} ${i.sub} ${i.href}`.toLowerCase().includes(term))).slice(0, 20);
  }, [q, all]);
  useEffect(() => {
    if (!open) return;
    setQ('');
    setIdx(0);
    const timer = setTimeout(() => input.current?.focus(), 10);
    return () => clearTimeout(timer);
  }, [open]);
  const go = (i: Item) => { onClose(); router.push(i.href); };
  return (
    <Modal open={open} onClose={onClose} title={referenceT("Find a report or page")}>
      <div className="lr-palette">
        <div className="lr-palette-search">
          <Search className="lr-icon-sm lr-muted" aria-hidden />
          <input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); }} aria-label={t('Search')} placeholder={t('Type a report name, category or page')}
            role="combobox" aria-expanded aria-controls="lr-palette-results" aria-activedescendant={results[idx] ? `lr-palette-${idx}` : undefined}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(results.length - 1, i + 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
              if (e.key === 'Enter' && results[idx]) go(results[idx]);
            }} />
        </div>
        <ul id="lr-palette-results" className="lr-palette-results" role="listbox">
          {results.length === 0 && <li className="lr-empty-text lr-center lr-pad">{t('Nothing matches “{q}”. Reports you cannot access are not listed.', { q })}</li>}
          {results.map((r, i) => (
            <li key={r.href} id={`lr-palette-${i}`} role="option" aria-selected={i === idx}>
              <button type="button" onMouseEnter={() => setIdx(i)} onClick={() => go(r)} className={`lr-palette-item${i === idx ? ' lr-palette-item-active' : ''}`}>
                <FileBarChart className={`lr-icon-sm ${r.kind === 'report' ? 'lr-brand-ink' : 'lr-subtle'}`} aria-hidden />
                <span className="lr-grow lr-truncate lr-medium">{r.title}</span>
                <span className="lr-xs lr-muted">{r.sub}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}

export function ModuleBar({ session }: { session: ReportsSession | null }) {
  const { t } = useLocalization();
  const { preferences } = useReferenceHost();
  const jobs = useActiveJobs();
  const [palette, setPalette] = useState(false);
  useModuleShortcut((e) => (e.metaKey || e.ctrlKey) && e.shiftKey && e.code === 'KeyK', () => setPalette((p) => !p));
  return (
    <div className="lr-module-bar no-print">
      <button type="button" className="lr-module-search" onClick={() => setPalette(true)} disabled={!session}>
        <Search className="lr-icon-sm" aria-hidden />
        <span className="lr-grow">{t('Find a report or page')}</span>
        {preferences.keyboardShortcuts && preferences.showKeyboardHints && <kbd className="lr-kbd">{t('Ctrl Shift K')}</kbd>}
      </button>
      <ReferenceLink href="/jobs" className={`lr-module-jobs${jobs.length ? ' lr-module-jobs-active' : ''}`} title={t('Reports running in the background')}>
        {jobs.length ? <Loader2 className="lr-icon-sm lr-spin" aria-hidden /> : <FolderDown className="lr-icon-sm" aria-hidden />}
        <span>{jobs.length ? t('{count} in progress', { count: jobs.length }) : t('My reports')}</span>
      </ReferenceLink>
      {session && <CommandPalette open={palette} onClose={() => setPalette(false)} session={session} />}
    </div>
  );
}

export function ModuleFootnote({ session }: { session: ReportsSession | null }) {
  const { t } = useLocalization();
  if (!session) return null;
  return (
    <p className="lr-footnote no-print">
      <span>{t('{org} reporting workspace', { org: session.org.name })}</span>
      <span>{t('Times shown in {zone}', { zone: session.org.timezone })}</span>
      <span>{t('Demo data is synthetic and generated by the demo API. Email is recorded in the outbox, never sent.')}</span>
    </p>
  );
}
