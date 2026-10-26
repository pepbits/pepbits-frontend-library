'use client';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {lookupLabel, type Paged, type PatientListItem, type PatientStats} from '@allyvora/shared';
import {CollectionView, type CollectionColumn} from '@pepbits/components/collection-view';
import {EmptyState, Pagination, RecoveryNotice, Tabs} from '@pepbits/components';
import {Button, NavLink, SearchInput, Select, cn} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import {usePreferences} from '@pepbits/preferences/react';
import {useNavigation, type NavigationTarget} from '@pepbits/platform/navigation';
import {useScreenHost} from '@pepbits/patterns/screen-host';
import {Pencil, UserPlus} from '@pepbits/icons';
import {useAllyVora} from '../context';
import {PAGE, hrefFor} from '../routes';
import type {PatientQuery} from '../../../adapters/allyvora';
import {CompletionBar, KEYS, SEX_SHORT, failureOf, initials, useHotkey, useTimeFormat} from '../support';

type View = 'active' | 'today' | 'week' | 'incomplete' | 'inactive';
const VIEWS: View[] = ['active', 'today', 'week', 'incomplete', 'inactive'];
const SORTS = ['updated', 'created', 'name', 'mrn', 'completion'] as const;

function AllergyDot({status}: {status: string | null}) {
  const {t} = useLocalization();
  const label = status === 'known' ? 'Has allergies' : status === 'nka' ? 'No known allergies' : 'Allergies not recorded';
  return <span role="img" aria-label={t(label)} title={t(label)} className={cn('inline-block size-2 shrink-0 rounded-full', status === 'known' ? 'bg-[var(--danger)]' : status === 'nka' ? 'bg-[var(--success)]' : 'bg-[var(--warning)]')}/>;
}

/** Patient register: quick views, search, filters, sorting and preference-sized pages over the AllyVora list API. */
export function PatientList({query}: {query: string}) {
  const {client, lookups, session, replace, setListQuery} = useAllyVora();
  const {t} = useLocalization(), {preferences, isLocked, allowedValues, update} = usePreferences(), navigation = useNavigation(), host = useScreenHost(), time = useTimeFormat();
  const params = useMemo(() => new URLSearchParams(query), [query]);
  const search = useRef<HTMLInputElement>(null);
  const querySearch = params.get('q') ?? '';
  const [q, setQ] = useState(querySearch);
  const view = (VIEWS as string[]).includes(params.get('view') ?? '') ? params.get('view') as View : 'active';
  const sex = params.get('sex') ?? '', payer = params.get('payer') ?? '', branch = params.get('branch') ?? '';
  const sort = (SORTS as readonly string[]).includes(params.get('sort') ?? '') ? params.get('sort') as NonNullable<PatientQuery['sort']> : 'updated';
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1);
  const pageSize = preferences.pageSize;
  const canCreate = host.can('allyvora-create');

  const setParams = useCallback((patch: Record<string, string | number | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === '' || (key === 'page' && value === 1) || (key === 'view' && value === 'active') || (key === 'sort' && value === 'updated')) next.delete(key);
      else next.set(key, String(value));
    }
    if (!('page' in patch)) next.delete('page');
    replace(hrefFor({pageId: PAGE.register, ...(next.toString() ? {query: next.toString()} : {})}));
  }, [params, replace]);

  // Debounced search writes the URL, so a refresh or shared link keeps the same list.
  useEffect(() => setQ(querySearch), [querySearch]);
  useEffect(() => {
    const timer = setTimeout(() => {if (querySearch !== q.trim()) setParams({q: q.trim() || null});}, 250);
    return () => clearTimeout(timer);
  }, [q, querySearch, setParams]);
  useEffect(() => setListQuery(query), [query, setListQuery]);

  const request: PatientQuery = useMemo(() => ({
    q: params.get('q') ?? undefined,
    status: view === 'inactive' ? 'inactive' : 'active',
    created: view === 'today' ? 'today' : view === 'week' ? 'week' : undefined,
    incomplete: view === 'incomplete' || undefined,
    sex: sex || undefined, payer: payer || undefined, branchId: branch ? Number(branch) : undefined,
    sort, dir: sort === 'name' || sort === 'mrn' || sort === 'completion' ? 'asc' : 'desc', page, pageSize,
  }), [params, view, sex, payer, branch, sort, page, pageSize]);

  const [list, setList] = useState<Paged<PatientListItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const [stats, setStats] = useState<PatientStats | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(null);
    client.patients.list(request, controller.signal).then(result => {if (!controller.signal.aborted) {setList(result); setLoading(false);}}).catch(failure => {if (!controller.signal.aborted) {setError(failure); setLoading(false);}});
    return () => controller.abort();
  }, [client, request, attempt]);
  useEffect(() => {let live = true; client.patients.stats().then(result => {if (live) setStats(result);}).catch(() => {}); return () => {live = false;};}, [client, attempt]);

  useHotkey(KEYS.search, event => {event.preventDefault(); search.current?.focus();});
  useHotkey(KEYS.create, () => {if (canCreate) navigation.open({pageId: PAGE.create, mode: 'new'});});

  const counts: Record<View, number | undefined> = {active: stats?.active, today: stats?.today, week: stats?.week, incomplete: stats?.incomplete, inactive: stats?.inactive};
  const labels: Record<View, string> = {active: 'All patients', today: 'Registered today', week: 'Last 7 days', incomplete: 'Need more details', inactive: 'Inactive'};
  const total = list?.total ?? 0;
  const filtersOn = !!(sex || payer || branch || params.get('q'));
  const viewTarget = (row: PatientListItem) => ({pageId: PAGE.view, mode: 'view' as const, recordId: String(row.id)});
  const editTarget = (row: PatientListItem) => ({pageId: PAGE.edit, mode: 'edit' as const, recordId: String(row.id)});
  const follow = (target: NavigationTarget) => (event: React.MouseEvent<HTMLElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) return;
    event.preventDefault(); event.stopPropagation(); navigation.open(target);
  };

  const columns: CollectionColumn<PatientListItem>[] = [
    {key: 'patient', header: 'Patient', render: row => <div className="flex items-center gap-3">
      <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface-3)] text-[length:calc(9.5px*var(--fs-scale))] font-bold text-[var(--text)]">{initials(row.displayName)}</span>
      <div className="min-w-0">
        <NavLink href={navigation.hrefFor(viewTarget(row))} onClick={follow(viewTarget(row))} className="flex items-center gap-2 font-semibold text-[var(--text)] hover:text-[var(--primary)]"><span className="truncate">{row.displayName}</span><AllergyDot status={row.allergyStatus}/></NavLink>
        {row.localName ? <p className="truncate text-[length:calc(10.5px*var(--fs-scale))] text-[var(--text-muted)]">{row.localName}</p> : null}
      </div>
    </div>},
    {key: 'mrn', header: 'MRN', className: 'whitespace-nowrap tabular-nums'},
    {key: 'age', header: 'Age, sex', className: 'whitespace-nowrap tabular-nums', render: row => [row.ageLabel, row.sex ? SEX_SHORT[row.sex] : null].filter(Boolean).join(', ') || '–'},
    {key: 'mobile', header: 'Mobile', className: 'whitespace-nowrap tabular-nums', render: row => row.mobile ? `+91 ${row.mobile}` : '–'},
    {key: 'payer', header: 'Payer', className: 'whitespace-nowrap', render: row => lookupLabel(lookups, 'payerType', row.payerType) || '–'},
    {key: 'completion', header: 'Record', render: row => <CompletionBar value={row.completion}/>},
    {key: 'updated', header: 'Updated', className: 'whitespace-nowrap', render: row => <span title={time.dateTime(row.updatedAt)}>{time.relative(row.updatedAt)}</span>},
  ];

  return <div className="flex flex-1 flex-col gap-4 px-3 py-4 sm:px-4 lg:px-6 lg:py-5" data-patient-register="">
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1">
        <h1 className="text-[length:calc(22px*var(--fs-scale))] font-bold tracking-tight text-[var(--text)]">{t('Patient register')}</h1>
        <p className="text-[length:calc(12px*var(--fs-scale))] text-[var(--text-muted)]">{t('Find a patient by name, MRN or mobile number, or register someone new.')}</p>
        <p className="text-[length:calc(10.5px*var(--fs-scale))] text-[var(--text-subtle)]">{t('Fictional data. The AllyVora demo API saves changes as {name} ({role}), its simulated user.', {name: session.user.name, role: session.user.role})}</p>
      </div>
      <Button variant="primary" disabled={!canCreate} onClick={() => navigation.open({pageId: PAGE.create, mode: 'new'})}><UserPlus className="size-4" aria-hidden="true"/>{t('New patient')}</Button>
    </div>
    <Tabs variant="pills" value={view} onChange={next => setParams({view: next})} items={VIEWS.map(id => ({id, label: labels[id], badge: counts[id] ?? '–'}))} className="overflow-x-auto"/>
    <div className="flex flex-col overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex flex-wrap items-end gap-2 border-b border-[var(--border)] p-3">
        <SearchInput value={q} onChange={setQ} onClear={() => setQ('')} inputRef={search} aria-label="Search patients" placeholder="Search name, MRN, mobile or local-script name" className="min-w-[220px] flex-[2_1_280px]"/>
        <Select label="Sex" value={sex} onChange={event => setParams({sex: event.target.value})} placeholder="Any sex" options={(lookups.administrativeSex ?? []).map(option => ({value: option.code, label: option.label}))} className="w-36"/>
        <Select label="Payer" value={payer} onChange={event => setParams({payer: event.target.value})} placeholder="Any payer" options={(lookups.payerType ?? []).map(option => ({value: option.code, label: option.label}))} className="w-40"/>
        <Select label="Branch" value={branch} onChange={event => setParams({branch: event.target.value})} placeholder="All branches" options={session.branches.map(item => ({value: String(item.id), label: item.name}))} className="w-52"/>
        <Select label="Sort by" value={sort} onChange={event => setParams({sort: event.target.value})} placeholder="" options={[{value: 'updated', label: 'Recently updated'}, {value: 'created', label: 'Recently registered'}, {value: 'name', label: 'Name, A to Z'}, {value: 'mrn', label: 'MRN'}, {value: 'completion', label: 'Least complete first'}]} className="w-48"/>
        {filtersOn ? <Button variant="ghost" size="sm" onClick={() => {setQ(''); setParams({q: null, sex: null, payer: null, branch: null});}}>{t('Clear filters')}</Button> : null}
      </div>
      {error ? <div className="p-4"><RecoveryNotice failure={failureOf(error)} onRetry={() => setAttempt(n => n + 1)}/></div>
        : !loading && total === 0 ? <div className="p-6" data-register-empty=""><EmptyState title={filtersOn ? 'No patients match' : 'No patients in this view'} description={filtersOn ? 'Check the spelling or try the mobile number. If they’re new here, register them.' : 'Patients you register will appear here.'}
          action={canCreate ? <Button variant="primary" onClick={() => navigation.open({pageId: PAGE.create, mode: 'new'})}><UserPlus className="size-4" aria-hidden="true"/>{t('Register a new patient')}</Button> : undefined}/></div>
        : <>
          <CollectionView columns={columns} rows={list?.items ?? []} rowKey={row => String(row.id)} loading={loading && !list} view={preferences.resultView}
            onRowClick={row => navigation.open(viewTarget(row))}
            rowActions={row => <NavLink href={navigation.hrefFor(editTarget(row))} onClick={follow(editTarget(row))} className="focus-ring inline-flex size-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--primary)]" title={t('Edit {name}', {name: row.displayName})}><Pencil className="size-4" aria-hidden="true"/><span className="sr-only">{t('Edit {name}', {name: row.displayName})}</span></NavLink>}
            className={cn(loading && list && 'opacity-60')}/>
          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={next => setParams({page: next})}
            onPageSizeChange={size => void update({pageSize: size})} pageSizeDisabled={isLocked('pageSize')} allowedPageSizes={allowedValues('pageSize')}/>
        </>}
    </div>
  </div>;
}
