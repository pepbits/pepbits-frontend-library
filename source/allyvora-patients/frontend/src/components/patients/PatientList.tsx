'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownUp, ChevronLeft, ChevronRight, Pencil, RefreshCw, Search, SearchX, UserPlus, X } from 'lucide-react';
import { lookupLabel, type PatientListItem } from '@allyvora/shared';
import { api, type PatientQuery } from '@/lib/api';
import { useApp } from '@/lib/app-context';
import { cn } from '@/lib/cn';
import { SEX_SHORT, initials, relativeTime } from '@/lib/format';
import { useAsync, useDebounced, useHotkey } from '@/lib/hooks';
import { Button } from '@/components/ui/Button';
import { Avatar, CompletionBar, EmptyState, Kbd, Skeleton } from '@/components/ui/Misc';

type View = 'active' | 'today' | 'week' | 'incomplete' | 'inactive';
const PAGE_SIZE = 20;
export const LIST_QS_KEY = 'allyvora:list-qs';

function AllergyDot({ status }: { status: string | null }) {
  const label = status === 'known' ? 'Has allergies' : status === 'nka' ? 'No known allergies' : 'Allergies not recorded';
  return (
    <span
      title={label}
      aria-label={label}
      className={cn('inline-block size-2 shrink-0 rounded-full', status === 'known' ? 'bg-danger' : status === 'nka' ? 'bg-ok' : 'bg-accent')}
    />
  );
}

export function PatientList() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { lookups, session } = useApp();
  const search = useRef<HTMLInputElement>(null);

  const [q, setQ] = useState(params.get('q') ?? '');
  const view = (params.get('view') as View) || 'active';
  const sex = params.get('sex') ?? '';
  const payer = params.get('payer') ?? '';
  const branch = params.get('branch') ?? '';
  const sort = (params.get('sort') as PatientQuery['sort']) || 'updated';
  const page = Math.max(1, Number(params.get('page') ?? 1));
  const dq = useDebounced(q, 250);

  const setParams = (patch: Record<string, string | number | null>) => {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '' || (k === 'page' && v === 1) || (k === 'view' && v === 'active') || (k === 'sort' && v === 'updated')) sp.delete(k);
      else sp.set(k, String(v));
    }
    if (!('page' in patch)) sp.delete('page');
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  useEffect(() => {
    if ((params.get('q') ?? '') !== dq) setParams({ q: dq || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq]);

  useEffect(() => {
    try {
      sessionStorage.setItem(LIST_QS_KEY, params.toString());
    } catch {
      /* ignore */
    }
  }, [params]);

  const query: PatientQuery = useMemo(
    () => ({
      q: params.get('q') ?? undefined,
      status: view === 'inactive' ? 'inactive' : 'active',
      created: view === 'today' ? 'today' : view === 'week' ? 'week' : undefined,
      incomplete: view === 'incomplete' || undefined,
      sex: sex || undefined,
      payer: payer || undefined,
      branchId: branch ? Number(branch) : undefined,
      sort,
      dir: sort === 'name' || sort === 'mrn' ? 'asc' : sort === 'completion' ? 'asc' : 'desc',
      page,
      pageSize: PAGE_SIZE,
    }),
    [params, view, sex, payer, branch, sort, page],
  );

  const list = useAsync(() => api.patients.list(query), [JSON.stringify(query)]);
  const stats = useAsync(() => api.patients.stats(), []);

  useHotkey('/', (e) => {
    e.preventDefault();
    search.current?.focus();
  });
  useHotkey('n', () => router.push('/patients?mode=new'));

  const views: { id: View; label: string; count?: number }[] = [
    { id: 'active', label: 'All patients', count: stats.data?.active },
    { id: 'today', label: 'Registered today', count: stats.data?.today },
    { id: 'week', label: 'Last 7 days', count: stats.data?.week },
    { id: 'incomplete', label: 'Need more details', count: stats.data?.incomplete },
    { id: 'inactive', label: 'Inactive', count: stats.data?.inactive },
  ];

  const total = list.data?.total ?? 0;
  const from = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(page * PAGE_SIZE, total);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtersOn = !!(sex || payer || branch || params.get('q'));

  const open = (p: PatientListItem) => router.push(`/patients?mode=view&id=${p.id}`);

  return (
    <div className="flex flex-1 flex-col gap-4 px-3 py-4 sm:px-4 lg:px-6 lg:py-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-cond text-[26px] font-semibold leading-8 tracking-tight text-ink">Patient register</h1>
          <p className="text-ink-2">Find a patient by name, MRN or mobile number, or register someone new.</p>
        </div>
        <Button variant="primary" icon={<UserPlus className="size-4" />} kbd="N" onClick={() => router.push('/patients?mode=new')}>
          New patient
        </Button>
      </div>

      <div className="no-scrollbar -mx-3 flex gap-1.5 overflow-x-auto px-3 sm:mx-0 sm:px-0" role="tablist" aria-label="Patient views">
        {views.map((v) => {
          const sel = v.id === view;
          return (
            <button
              key={v.id}
              role="tab"
              aria-selected={sel}
              onClick={() => setParams({ view: v.id })}
              className={cn(
                'flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition-colors',
                sel ? 'border-rail bg-rail text-white' : 'border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink',
              )}
            >
              {v.label}
              <span className={cn('tabular rounded-full px-1.5 text-xs', sel ? 'bg-white/15' : 'bg-sunken text-ink-3')}>{v.count ?? '–'}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="relative min-w-[220px] flex-[2_1_280px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
            <input
              ref={search}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, MRN, mobile or local-script name"
              aria-label="Search patients"
              className="control h-9 pl-9 pr-16 text-sm"
            />
            <span className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
              {q ? (
                <button onClick={() => setQ('')} aria-label="Clear search" className="rounded p-1 text-ink-3 hover:text-ink">
                  <X className="size-3.5" />
                </button>
              ) : (
                <Kbd>/</Kbd>
              )}
            </span>
          </div>
          <select value={sex} onChange={(e) => setParams({ sex: e.target.value })} aria-label="Filter by sex" className="control h-9 w-auto flex-1 px-2.5 text-[13px] sm:flex-none">
            <option value="">Any sex</option>
            {(lookups.administrativeSex ?? []).map((o) => (
              <option key={o.code} value={o.code}>
                {o.label}
              </option>
            ))}
          </select>
          <select value={payer} onChange={(e) => setParams({ payer: e.target.value })} aria-label="Filter by payer" className="control h-9 w-auto flex-1 px-2.5 text-[13px] sm:flex-none">
            <option value="">Any payer</option>
            {(lookups.payerType ?? []).map((o) => (
              <option key={o.code} value={o.code}>
                {o.label}
              </option>
            ))}
          </select>
          <select value={branch} onChange={(e) => setParams({ branch: e.target.value })} aria-label="Filter by branch" className="control h-9 w-auto flex-1 px-2.5 text-[13px] sm:flex-none">
            <option value="">All branches</option>
            {(session?.branches ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <label className="flex flex-1 items-center gap-1.5 sm:flex-none">
            <ArrowDownUp className="size-4 text-ink-3" aria-hidden />
            <span className="sr-only">Sort by</span>
            <select value={sort} onChange={(e) => setParams({ sort: e.target.value })} className="control h-9 w-auto flex-1 px-2.5 text-[13px]">
              <option value="updated">Recently updated</option>
              <option value="created">Recently registered</option>
              <option value="name">Name, A to Z</option>
              <option value="mrn">MRN</option>
              <option value="completion">Least complete first</option>
            </select>
          </label>
          {filtersOn && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQ('');
                setParams({ q: null, sex: null, payer: null, branch: null });
              }}
            >
              Clear filters
            </Button>
          )}
        </div>

        {list.error ? (
          <EmptyState
            icon={<RefreshCw className="size-6" />}
            title="Patients couldn’t load"
            action={
              <Button variant="primary" onClick={list.reload}>
                Try again
              </Button>
            }
          >
            {list.error.message}
          </EmptyState>
        ) : list.loading && !list.data ? (
          <div className="divide-y divide-line">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <Skeleton className="size-9 rounded-full" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="ml-auto h-4 w-24" />
                <Skeleton className="hidden h-4 w-32 md:block" />
              </div>
            ))}
          </div>
        ) : total === 0 ? (
          <EmptyState
            icon={<SearchX className="size-6" />}
            title={filtersOn ? 'No patients match' : 'No patients in this view'}
            action={
              <Button variant="primary" icon={<UserPlus className="size-4" />} onClick={() => router.push('/patients?mode=new')}>
                Register a new patient
              </Button>
            }
          >
            {filtersOn ? 'Check the spelling or try the mobile number. If they’re new here, register them.' : 'Patients you register will appear here.'}
          </EmptyState>
        ) : (
          <>
            {/* Table for tablets and up */}
            <div className={cn('hidden overflow-x-auto md:block', list.loading && 'opacity-60 transition-opacity')}>
              <table className="w-full min-w-[860px] text-left">
                <thead>
                  <tr className="border-b border-line text-xs text-ink-3">
                    <th scope="col" className="py-2.5 pl-4 pr-3 font-medium">Patient</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">MRN</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Age, sex</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Mobile</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Payer</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Record</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Updated</th>
                    <th scope="col" className="py-2.5 pl-3 pr-4"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {list.data!.items.map((p) => (
                    <tr key={p.id} onClick={() => open(p)} className="group cursor-pointer transition-colors hover:bg-sunken/70">
                      <td className="py-2.5 pl-4 pr-3">
                        <div className="flex items-center gap-3">
                          <Avatar text={initials(p.displayName)} />
                          <div className="min-w-0">
                            <Link
                              href={`/patients?mode=view&id=${p.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-2 font-medium text-ink hover:text-brand"
                            >
                              <span className="truncate">{p.displayName}</span>
                              <AllergyDot status={p.allergyStatus} />
                            </Link>
                            {p.localName && <p className="truncate text-xs text-ink-3">{p.localName}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="tabular whitespace-nowrap px-3 py-2.5 text-[13px] text-ink">{p.mrn}</td>
                      <td className="tabular whitespace-nowrap px-3 py-2.5 text-[13px] text-ink-2">
                        {[p.ageLabel, p.sex ? SEX_SHORT[p.sex] : null].filter(Boolean).join(', ') || '–'}
                      </td>
                      <td className="tabular whitespace-nowrap px-3 py-2.5 text-[13px] text-ink-2">{p.mobile ? `+91 ${p.mobile}` : '–'}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-[13px] text-ink-2">{lookupLabel(lookups, 'payerType', p.payerType) || '–'}</td>
                      <td className="px-3 py-2.5">
                        <CompletionBar value={p.completion} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-[13px] text-ink-3" title={new Date(p.updatedAt).toLocaleString()}>
                        {relativeTime(p.updatedAt)}
                      </td>
                      <td className="py-2.5 pl-3 pr-4 text-right">
                        <Link
                          href={`/patients?mode=edit&id=${p.id}`}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Edit ${p.displayName}`}
                          className="inline-flex size-8 items-center justify-center rounded-lg text-ink-3 opacity-60 hover:bg-surface hover:text-brand group-hover:opacity-100"
                        >
                          <Pencil className="size-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cards for phones */}
            <ul className="divide-y divide-line md:hidden">
              {list.data!.items.map((p) => (
                <li key={p.id}>
                  <Link href={`/patients?mode=view&id=${p.id}`} className="flex items-center gap-3 px-3 py-3 active:bg-sunken">
                    <Avatar text={initials(p.displayName)} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 font-medium text-ink">
                        <span className="truncate">{p.displayName}</span>
                        <AllergyDot status={p.allergyStatus} />
                      </p>
                      <p className="tabular truncate text-xs text-ink-2">
                        {p.mrn}
                        {p.ageLabel ? `, ${p.ageLabel}` : ''}
                        {p.sex ? ` ${SEX_SHORT[p.sex]}` : ''}
                      </p>
                    </div>
                    <CompletionBar value={p.completion} className="shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-3 border-t border-line px-4 py-2.5 text-[13px] text-ink-2">
              <span className="tabular">
                {from}–{to} of {total}
              </span>
              <div className="ml-auto flex items-center gap-1">
                <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setParams({ page: page - 1 })} icon={<ChevronLeft className="size-4" />}>
                  Previous
                </Button>
                <span className="tabular px-2 text-xs text-ink-3">
                  Page {page} of {pages}
                </span>
                <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => setParams({ page: page + 1 })}>
                  Next
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
