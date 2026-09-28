"use client";
/*
 * Ports of the 19 source page routes. Each page body is the source JSX; its data comes from the matching
 * loader endpoint (see routes.ts) instead of db()/requirePageUser() on a Next server.
 */
import { Blocks, CalendarClock, Database, FolderDown, History, LayoutDashboard, Plus, ShieldCheck, Star } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow, useLocalization } from '@pepbits/ops-ui';
import { ReferenceLink, useReferenceHost } from '@pepbits/reference-host';
import { useModuleRouter } from '../api/client';
import {MailText} from '../jobs/SecureDownload';
import { AccessControl, type AccessReport } from '../admin/AccessControl';
import { ApiKeysPanel } from '../admin/ApiKeysPanel';
import { SettingsForm } from '../admin/SettingsForm';
import { UsersAdmin, type DirectoryUser } from '../admin/UsersAdmin';
import { DeleteDefinitionButton } from '../builder/DeleteDefinitionButton';
import { ReportBuilder } from '../builder/ReportBuilder';
import { DashboardView, NewDashboardButton, type WidgetReport } from '../dashboards/DashboardView';
import { EmailInPanel } from '../emailin/EmailInPanel';
import { JobResults, JobsTable } from '../jobs/Jobs';
import { ReportLibrary, type LibraryItem } from '../reports/ReportLibrary';
import { ReportViewer, type ViewerProps } from '../reports/ReportViewer';
import { SchedulesPanel } from '../schedules/SchedulesPanel';
import type { ReportsRouteMatch } from '../routes';
import type { ReportsSession } from '../shell/ModuleBar';
import type { Action, ApiKey, Dashboard, Dataset, InboundLog, Job, Occurrence, OutboxMessage, AuditEntry, ReportDefinition, Role, Grant, Schedule, Settings } from '../types';
import { Badge, Card, CardHeader, EmptyState, LinkButton, Notice, PageHeader, SelectInput, StatusBadge, Button } from '../ui/primitives';
import { useReportFormat } from '../ui/preferences';
import { PageLoader } from './common';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export interface PageProps { match: ReportsRouteMatch; loader: string; session: ReportsSession | null }

// ---------------------------------------------------------------------------
// Login (src/app/login/page.tsx): sign-in is delegated to the host. The page keeps the source's two-panel
// layout and explains the boundary; it never asks for a password.

export function LoginBoundaryPage({ match, loader, session }: PageProps) {
  const { t } = useLocalization();
  const router = useModuleRouter();
  const next = match.search.get('next');
  const safeNext = next?.startsWith('/') && !next.startsWith('//') ? next : null;
  useEffect(() => { if (safeNext) router.replace(safeNext); }, [safeNext, router]);
  return (
    <PageLoader<{ orgName: string }> path={loader}>
      {(d) => (
        <div className="lr-login">
          <section className="lr-login-brand">
            <div className="lr-row"><span className="lr-login-mark" aria-hidden><ReferenceText message="L" /></span><span className="lr-medium">{t('Lumen Reports')}</span></div>
            <div>
              <h1 className="lr-login-title">{t('Every report your role allows, from one place.')}</h1>
              <p className="lr-mt">{t('Run finance, clinical and operations reports on screen. Long periods run in the background and arrive by email. Schedules, email requests and exports follow the same access rules.')}</p>
            </div>
            <p className="lr-xs">{d.orgName}</p>
          </section>
          <section className="lr-login-panel">
            <h2 className="lr-h2">{t('Sign in')}</h2>
            <p className="lr-sm lr-muted lr-mt-xs">{t('Sign-in is handled by this application. Reports uses the account you are already signed in with.')}</p>
            {session && (
              <dl className="lr-definition lr-mt">
                <div><dt>{t('Signed in as')}</dt><dd>{session.user.name} ({session.user.email})</dd></div>
                <div><dt>{t('Roles')}</dt><dd>{session.user.roleNames.join(', ')}</dd></div>
              </dl>
            )}
            <div className="lr-mt"><LinkButton href="/" variant="primary"><ReferenceText message="Continue to reports" /></LinkButton></div>
          </section>
        </div>
      )}
    </PageLoader>
  );
}

// ---------------------------------------------------------------------------
// Overview (src/app/(app)/page.tsx)

interface OverviewData {
  firstName: string; hour: number; canBuild: boolean;
  recent: { id: string; title: string; category: string }[];
  favorites: { id: string; title: string }[];
  jobs: { id: string; reportTitle: string; createdAt: string; status: string }[];
  access: { roleNames: string[]; reportCount: number; branches: string[] | null; unmask: boolean };
  schedules: { id: string; name: string; timing: string; nextRunAt?: string; timezone: string }[];
  timezone: string;
}

export function OverviewPage({ match, loader }: PageProps) {
 const referenceT = useReferenceLocalization().t;

  const { t } = useLocalization();
  const fmt = useReportFormat();
  const denied = match.search.get('denied');
  return (
    <PageLoader<OverviewData> path={loader} skeleton="dashboard">
      {(d) => {
        const greeting = d.hour < 12 ? 'Good morning' : d.hour < 17 ? 'Good afternoon' : 'Good evening';
        return (
          <>
            <PageHeader title={t(`${greeting}, {name}`, { name: d.firstName })} description={referenceT("Pick up where you left off, or find a report in the library.")}
              actions={<><LinkButton href="/reports" variant="primary"><ReferenceText message="Open report library" /></LinkButton>{d.canBuild && <LinkButton href="/builder/new"><ReferenceText message="Build a report" /></LinkButton>}</>} />
            {denied && <Notice tone="warning" className="lr-mb">{t('That page needs a permission your role does not have.')}</Notice>}
            <div className="lr-overview-grid">
              <Card className="lr-span-2">
                <CardHeader title={referenceT("Recently run")} />
                {d.recent.length === 0 ? (
                  <EmptyState icon={<History className="lr-icon-lg" />} title={referenceT("Nothing run yet")}><ReferenceText message="Reports you open appear here so you can return to them in one click." /></EmptyState>
                ) : (
                  <ul className="lr-list">
                    {d.recent.map((r) => (
                      <li key={r.id}>
                        <ReferenceLink href={`/reports/${r.id}`} className="lr-link-row">
                          <span className="lr-medium">{r.title}</span>
                          <span className="lr-xs lr-muted">{r.category}</span>
                        </ReferenceLink>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card>
                <CardHeader title={referenceT("Favorites")} />
                {d.favorites.length === 0 ? (
                  <EmptyState icon={<Star className="lr-icon-lg" />} title={referenceT("No favorites yet")}><ReferenceText message="Star a report in the library to pin it here." /></EmptyState>
                ) : (
                  <ul className="lr-list">
                    {d.favorites.map((r) => (
                      <li key={r.id}>
                        <ReferenceLink href={`/reports/${r.id}`} className="lr-link-row lr-link-row-start">
                          <Star className="lr-icon-xs lr-star-on" aria-hidden />
                          <span className="lr-truncate">{r.title}</span>
                        </ReferenceLink>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card className="lr-span-2">
                <CardHeader title={referenceT("Background reports")} actions={<LinkButton href="/jobs" size="sm"><ReferenceText message="All my reports" /></LinkButton>} />
                {d.jobs.length === 0 ? (
                  <EmptyState icon={<FolderDown className="lr-icon-lg" />} title={referenceT("No background reports")}><ReferenceText message="Long periods and large exports run here and can be emailed to you." /></EmptyState>
                ) : (
                  <ul className="lr-list">
                    {d.jobs.map((j) => (
                      <li key={j.id} className="lr-row lr-row-between lr-list-item lr-sm">
                        <ReferenceLink href={`/jobs/${j.id}`} className="lr-medium lr-plain-link lr-hover-underline">{j.reportTitle}</ReferenceLink>
                        <span className="lr-row lr-xs lr-muted">{fmt.dateTime(j.createdAt, d.timezone)}<StatusBadge status={j.status} /></span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card>
                <CardHeader title={referenceT("Your access")} />
                <dl className="lr-definition lr-pad">
                  <div><dt>{t('Roles')}</dt><dd>{d.access.roleNames.join(', ')}</dd></div>
                  <div><dt>{t('Reports available')}</dt><dd className="lr-num">{fmt.count(d.access.reportCount)}</dd></div>
                  <div><dt>{t('Branches')}</dt><dd>{d.access.branches ? d.access.branches.join(', ') : t('All branches')}</dd></div>
                  <div><dt>{t('Sensitive columns')}</dt><dd>{t(d.access.unmask ? 'Visible' : 'Masked')}</dd></div>
                </dl>
                <p className="lr-card-footnote lr-row lr-row-start lr-gap-xs"><ShieldCheck className="lr-icon-xs lr-shrink0" aria-hidden /> {t('The same rules apply on screen, in exports, schedules, email requests and the API.')}</p>
              </Card>
              <Card className="lr-span-3">
                <CardHeader title={referenceT("Upcoming schedules")} actions={<LinkButton href="/schedules" size="sm"><ReferenceText message="Manage schedules" /></LinkButton>} />
                {d.schedules.length === 0 ? (
                  <EmptyState icon={<CalendarClock className="lr-icon-lg" />} title={referenceT("No active schedules")}><ReferenceText message="Open a report and choose Schedule to have it emailed daily, weekly or monthly." /></EmptyState>
                ) : (
                  <ul className="lr-list">
                    {d.schedules.map((x) => (
                      <li key={x.id} className="lr-row lr-row-between lr-list-item lr-sm">
                        <span><span className="lr-medium">{x.name}</span><span className="lr-muted lr-ms">{x.timing}</span></span>
                        <span className="lr-xs lr-muted">{t('Next run {when}', { when: fmt.dateTime(x.nextRunAt, x.timezone) })}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </>
        );
      }}
    </PageLoader>
  );
}

// ---------------------------------------------------------------------------
// Report library and viewer

export function LibraryPage({ match, loader }: PageProps) {
 const referenceT = useReferenceLocalization().t;

  const { t } = useLocalization();
  return (
    <PageLoader<{ reports: LibraryItem[]; categories: string[] }> path={loader}>
      {(d) => (
        <>
          <PageHeader title={referenceT("Report library")} description={t('{count} reports available to your role. Star the ones you use most to find them first.', { count: d.reports.length })} />
          {match.search.get('denied') && <Notice tone="warning" className="lr-mb">{t('You do not have access to that report. Ask an administrator if you need it.')}</Notice>}
          <ReportLibrary reports={d.reports} categories={d.categories} initialQuery={match.search.get('q') ?? ''} />
        </>
      )}
    </PageLoader>
  );
}

export function ReportPage({ loader }: PageProps) {
  return <PageLoader<ViewerProps> path={loader}>{(d) => <ReportViewer key={`${d.def.id}:${d.def.version}`} {...d} />}</PageLoader>;
}

// ---------------------------------------------------------------------------
// Builder

interface BuilderListData {
  isAdmin: boolean;
  reports: { id: string; title: string; category: string; subcategory: string; version: number; datasetName: string; visibility: ReportDefinition['visibility']; visibilityLabel: string; sharedRoleNames: string[]; ownerName: string | null; updatedAt: string }[];
}

export function BuilderListPage({ loader, session }: PageProps) {
 const referenceT = useReferenceLocalization().t;

  const { t } = useLocalization();
  const fmt = useReportFormat();
  const tz = session?.org.timezone;
  return (
    <PageLoader<BuilderListData> path={loader}>
      {(d) => (
        <>
          <PageHeader title={referenceT("Report builder")} description={referenceT("Create reports from approved datasets: pick grouping, measures and calculated columns, then share them with roles. Access, branch limits and masking still apply.")}
            actions={<LinkButton href="/builder/new" variant="primary" icon={<Plus className="lr-icon-sm" />}><ReferenceText message="New report" /></LinkButton>} />
          <Card>
            {d.reports.length === 0 ? (
              <EmptyState icon={<Blocks className="lr-icon-lg" />} title={referenceT("No custom reports yet")} action={<LinkButton href="/builder/new" variant="primary"><ReferenceText message="Build your first report" /></LinkButton>}><ReferenceText message="Start from a dataset such as revenue, claims or admissions. You can preview results before saving." /></EmptyState>
            ) : (
              <TableContainer className="lr-table-scroll">
                <Table className="lr-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('Report')}</TableHead>
                      <TableHead>{t('Dataset')}</TableHead>
                      <TableHead>{t('Shared with')}</TableHead>
                      {d.isAdmin && <TableHead>{t('Owner')}</TableHead>}
                      <TableHead>{t('Updated')}</TableHead>
                      <TableHead><span className="lr-sr-only">{t('Actions')}</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.reports.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <ReferenceLink href={`/reports/${r.id}`} className="lr-medium lr-plain-link lr-hover-underline">{r.title}</ReferenceLink>
                          <p className="lr-xs lr-muted">{t('{category} / {subcategory}, version {version}', { category: r.category, subcategory: r.subcategory, version: r.version })}</p>
                        </TableCell>
                        <TableCell>{r.datasetName}</TableCell>
                        <TableCell>
                          <Badge tone={r.visibility === 'private' ? 'neutral' : 'brand'}>{r.visibilityLabel}</Badge>
                          {r.visibility === 'roles' && <p className="lr-xs lr-muted lr-mt-xs">{r.sharedRoleNames.join(', ')}</p>}
                        </TableCell>
                        {d.isAdmin && <TableCell>{r.ownerName ?? '–'}</TableCell>}
                        <TableCell className="lr-nowrap lr-xs lr-muted">{fmt.dateTime(r.updatedAt, tz)}</TableCell>
                        <TableCell className="lr-nowrap lr-end">
                          <span className="lr-row lr-row-flush-end">
                            <LinkButton href={`/builder/${r.id}`} size="sm"><ReferenceText message="Edit" /></LinkButton>
                            <DeleteDefinitionButton id={r.id} title={r.title} />
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Card>
        </>
      )}
    </PageLoader>
  );
}

export function BuilderEditPage({ loader }: PageProps) {
 const referenceT = useReferenceLocalization().t;

  const { t } = useLocalization();
  return (
    <PageLoader<{ datasets: Dataset[]; categories: string[]; roles: { id: string; name: string }[]; canShare: boolean; isAdmin: boolean; existing: ReportDefinition | null }> path={loader}>
      {(d) => (
        <>
          <PageHeader title={d.existing ? t('Edit: {title}', { title: d.existing.title }) : 'New report'} description={referenceT("Changes are validated against the dataset on save. Existing saved views and schedules keep working.")}
            actions={<LinkButton href="/builder"><ReferenceText message="All custom reports" /></LinkButton>} />
          <ReportBuilder key={d.existing ? `${d.existing.id}:${d.existing.version}` : 'new'} datasets={d.datasets} categories={d.categories} roles={d.roles} canShare={d.canShare} isAdmin={d.isAdmin} existing={d.existing} />
        </>
      )}
    </PageLoader>
  );
}

// ---------------------------------------------------------------------------
// Dashboards

export function DashboardsPage({ loader }: PageProps) {
 const referenceT = useReferenceLocalization().t;

  const { t } = useLocalization();
  return (
    <PageLoader<{ canCreate: boolean; dashboards: { id: string; name: string; description: string; visibility: Dashboard['visibility']; widgetCount: number; ownerName: string }[] }> path={loader}>
      {(d) => (
        <>
          <PageHeader title={referenceT("Dashboards")} description={referenceT("Several reports on one page, sharing one period. Each widget respects the viewer's own report access.")} actions={d.canCreate ? <NewDashboardButton /> : undefined} />
          {d.dashboards.length === 0 ? (
            <Card><EmptyState icon={<LayoutDashboard className="lr-icon-lg" />} title={referenceT("No dashboards shared with you yet")} /></Card>
          ) : (
            <ul className="lr-card-grid">
              {d.dashboards.map((x) => (
                <li key={x.id}>
                  <ReferenceLink href={`/dashboards/${x.id}`} className="lr-dashboard-tile">
                    <span className="lr-row lr-row-between lr-row-start">
                      <span className="lr-h2">{x.name}</span>
                      <Badge tone={x.visibility === 'private' ? 'neutral' : 'brand'}>{x.visibility === 'private' ? 'Private' : x.visibility === 'everyone' ? 'Everyone' : 'Shared'}</Badge>
                    </span>
                    <span className="lr-block lr-sm lr-muted lr-mt-xs">{x.description}</span>
                    <span className="lr-block lr-xs lr-muted lr-mt">{t('{count} widgets, owned by {owner}', { count: x.widgetCount, owner: x.ownerName })}</span>
                  </ReferenceLink>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </PageLoader>
  );
}

export function DashboardPage({ loader }: PageProps) {
  return (
    <PageLoader<{ dashboard: Dashboard; reports: WidgetReport[]; canEdit: boolean; canShare: boolean; roles: { id: string; name: string }[] }> path={loader} skeleton="dashboard">
      {(d) => <DashboardView key={d.dashboard.id} dashboard={d.dashboard} reports={d.reports} canEdit={d.canEdit} canShare={d.canShare} roles={d.roles} />}
    </PageLoader>
  );
}

// ---------------------------------------------------------------------------
// Jobs

export function JobsPage({ loader }: PageProps) {
 const referenceT = useReferenceLocalization().t;

  const { t } = useLocalization();
  return (
    <PageLoader<{ jobs: Job[]; isAdmin: boolean; userId: string; retentionHours: number; maxActiveJobsPerUser: number; timezone: string }> path={loader}>
      {(d) => (
        <>
          <PageHeader title={referenceT("My reports")} description={t('Background reports, scheduled runs and email requests. Results are kept for {hours} hours. You can run up to {max} at a time.', { hours: d.retentionHours, max: d.maxActiveJobsPerUser })} />
          <JobsTable initial={d.jobs} isAdmin={d.isAdmin} timezone={d.timezone} userId={d.userId} />
        </>
      )}
    </PageLoader>
  );
}

export function JobPage({ loader }: PageProps) {
  return <PageLoader<JobPageData> path={loader}>{(d) => <JobDetail data={d} />}</PageLoader>;
}

interface JobPageData { job: Job; filtersText: string; timezone: string }

function JobDetail({ data }: { data: JobPageData }) {
  const { t } = useLocalization();
  const fmt = useReportFormat();
  const router = useModuleRouter();
  const job = data.job;
  const active = job.status === 'queued' || job.status === 'running';
  // The source page was static until reloaded; while the job is in progress it is re-read every 2.5 s.
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(router.refresh, 2500);
    return () => clearInterval(timer);
  }, [active, router]);
  const rows: [string, React.ReactNode][] = [
    ['Status', <StatusBadge key="s" status={job.status} />],
    ['Filters', data.filtersText || t('Report defaults')],
    ['Format', job.format.toUpperCase()],
    ['Rows', job.rowCount ? fmt.count(job.rowCount) : '–'],
    ['File size', fmt.bytes(job.resultBytes)],
    ['Delivery', job.deliver === 'email' ? t('Email to {to}', { to: job.recipients.join(', ') }) : t('Download')],
    ['Delivery result', job.deliveryNote ?? '–'],
    ['Requested', fmt.dateTime(job.createdAt, data.timezone)],
    ['Finished', fmt.dateTime(job.finishedAt, data.timezone)],
    ['Available until', fmt.dateTime(job.expiresAt, data.timezone)],
  ];
  return (
    <>
      <PageHeader title={job.reportTitle} description={t('Background report {id}', { id: job.id })} actions={<LinkButton href="/jobs"><ReferenceText message="Back to My reports" /></LinkButton>} />
      <Card className="lr-mb">
        <dl className="lr-definition-grid lr-pad">
          {rows.map(([k, v]) => (
            <div key={k}><dt>{t(k)}</dt><dd>{v}</dd></div>
          ))}
        </dl>
        {job.error && <p role="alert" className="lr-card-footnote lr-danger-ink">{job.error}</p>}
      </Card>
      <JobResults key={`${job.id}:${job.status}`} job={job} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Schedules, email requests, API keys

export function SchedulesPage({ loader }: PageProps) {
 const referenceT = useReferenceLocalization().t;

  const { t } = useLocalization();
  return (
    <PageLoader<{ schedules: Schedule[]; occurrences: Occurrence[]; reports: { def: ReportDefinition; actions: Action[] }[]; owners: Record<string, string>; isAdmin: boolean; userEmail: string; userId: string; timezone: string; cronHint: string }> path={loader}>
      {(d) => (
        <>
          <PageHeader title={referenceT("Schedules")} description={referenceT("{value0} {value1}", {value0: t('Reports delivered by email on a timetable. Each run covers a moving period and never sends the same run twice.'), value1: t(d.cronHint)})} />
          <SchedulesPanel schedules={d.schedules} occurrences={d.occurrences} reports={d.reports} owners={d.owners} isAdmin={d.isAdmin} userEmail={d.userEmail} userId={d.userId} timezone={d.timezone} />
        </>
      )}
    </PageLoader>
  );
}

export function EmailInPage({ loader, session }: PageProps) {
 const referenceT = useReferenceLocalization().t;

  return (
    <PageLoader<{ help: string; mailbox: string; enabled: boolean; logs: InboundLog[]; isAdmin: boolean; userEmail: string; examples: string[] }> path={loader}>
      {(d) => (
        <>
          <PageHeader title={referenceT("Email requests")} description={referenceT("Registered users can email the reports mailbox and receive the result by return email, even for very long periods.")} />
          <EmailInPanel {...d} timezone={session?.org.timezone ?? 'UTC'} />
        </>
      )}
    </PageLoader>
  );
}

export function ApiKeysPage({ loader, session }: PageProps) {
 const referenceT = useReferenceLocalization().t;

  return (
    <PageLoader<{ keys: Omit<ApiKey, 'hash'>[]; canCreate: boolean; baseUrl: string; apiReports: { id: string; title: string }[] }> path={loader}>
      {(d) => (
        <>
          <PageHeader title={referenceT("API keys and BI")} description={referenceT("Give dashboards and spreadsheets read-only access to the reports you are allowed to see.")} />
          <ApiKeysPanel initial={d.keys} canCreate={d.canCreate} baseUrl={d.baseUrl} apiReports={d.apiReports} timezone={session?.org.timezone ?? 'UTC'} />
        </>
      )}
    </PageLoader>
  );
}

// ---------------------------------------------------------------------------
// Administration

export function AdminAccessPage({ loader }: PageProps) {
 const referenceT = useReferenceLocalization().t;

  return (
    <PageLoader<{ roles: Role[]; grants: Grant[]; reports: AccessReport[]; userCounts: Record<string, number> }> path={loader}>
      {(d) => (
        <>
          <PageHeader title={referenceT("Roles and access")} description={referenceT("Decide, per role, which reports can be viewed, exported, emailed, scheduled or pulled by BI tools. Every screen, export, schedule, email request and API call checks these rules on the server.")} />
          <AccessControl roles={d.roles} grants={d.grants} reports={d.reports} userCounts={d.userCounts} />
        </>
      )}
    </PageLoader>
  );
}

export function AdminUsersPage({ loader, session }: PageProps) {
 const referenceT = useReferenceLocalization().t;

  return (
    <PageLoader<{ users: DirectoryUser[]; roles: { id: string; name: string }[]; branches: string[]; selfId: string }> path={loader}>
      {(d) => (
        <>
          <PageHeader title={referenceT("Users")} description={referenceT("Assign roles and branches. A user with several roles gets the combined access of all of them.")} />
          <UsersAdmin users={d.users} roles={d.roles} branches={d.branches} timezone={session?.org.timezone ?? 'UTC'} selfId={d.selfId} />
        </>
      )}
    </PageLoader>
  );
}

export function AdminSettingsPage({ loader }: PageProps) {
 const referenceT = useReferenceLocalization().t;

  const { t } = useLocalization();
  const fmt = useReportFormat();
  return (
    <PageLoader<{ settings: Settings; smtp: boolean; timezones: string[]; overrides: { id: string; title: string; maxOnlineRangeDays: number; maxOnlineRows: number }[] }> path={loader}>
      {(d) => (
        <>
          <PageHeader title={referenceT("Settings and rules")} description={referenceT("Organisation defaults, on-screen limits, background processing, delivery and email request rules.")} />
          <SettingsForm initial={d.settings} smtp={d.smtp} timezones={d.timezones} />
          <Card className="lr-mt-lg">
            <CardHeader title={referenceT("Report-specific limits")} description={referenceT("These reports set their own on-screen limits, usually because they return one row per record.")} />
            <TableContainer className="lr-table-scroll">
              <Table className="lr-table">
                <TableHeader><TableRow><TableHead>{t('Report')}</TableHead><TableHead className="lr-end">{t('Longest period (days)')}</TableHead><TableHead className="lr-end">{t('Most rows')}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {d.overrides.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell><ReferenceLink className="lr-plain-link lr-hover-underline" href={`/reports/${r.id}`}>{r.title}</ReferenceLink></TableCell>
                      <TableCell className="lr-num lr-end">{fmt.count(r.maxOnlineRangeDays)}</TableCell>
                      <TableCell className="lr-num lr-end">{fmt.count(r.maxOnlineRows)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </>
      )}
    </PageLoader>
  );
}

interface SourceView { id: string; name: string; description: string; status: 'connected' | 'planned'; datasets: { id: string; name: string; domain: string; fields: number; rows: number | null; generatedAt: string | null }[] }

export function AdminSourcesPage({ loader, session }: PageProps) {
 const referenceT = useReferenceLocalization().t;

  const { t } = useLocalization();
  const fmt = useReportFormat();
  return (
    <PageLoader<{ sources: SourceView[] }> path={loader}>
      {(d) => (
        <>
          <PageHeader title={referenceT("Data sources")} description={referenceT("Where reports read from. Reports only run read-only queries against approved datasets, never against a live transactional database.")} />
          <div className="lr-stack">
            {d.sources.map((src) => (
              <Card key={src.id}>
                <CardHeader title={<span className="lr-row lr-gap-xs"><Database className="lr-icon-sm lr-muted" aria-hidden />{src.name}</span>} description={src.description}
                  actions={<Badge tone={src.status === 'connected' ? 'brand' : 'neutral'}>{src.status === 'connected' ? 'Connected' : 'Planned connector'}</Badge>} />
                {src.datasets.length > 0 ? (
                  <TableContainer className="lr-table-scroll">
                    <Table className="lr-table">
                      <TableHeader><TableRow>
                        <TableHead>{t('Dataset')}</TableHead><TableHead>{t('Domain')}</TableHead><TableHead className="lr-end">{t('Fields')}</TableHead><TableHead className="lr-end">{t('Rows loaded')}</TableHead><TableHead>{t('Last refreshed')}</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {src.datasets.map((ds) => (
                          <TableRow key={ds.id}>
                            <TableCell><span className="lr-medium">{ds.name}</span><p className="lr-xs lr-muted">{ds.id}</p></TableCell>
                            <TableCell>{ds.domain}</TableCell>
                            <TableCell className="lr-num lr-end">{ds.fields}</TableCell>
                            <TableCell className="lr-num lr-end">{ds.rows === null ? t('Loads on first use') : fmt.count(ds.rows)}</TableCell>
                            <TableCell className="lr-xs lr-muted">{ds.generatedAt ? fmt.dateTime(ds.generatedAt, session?.org.timezone) : '–'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <p className="lr-pad lr-sm lr-muted">{t('A production connector implements the source adapter against a read replica or warehouse and registers its datasets. Credentials belong in server-side configuration only.')}</p>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </PageLoader>
  );
}

export function AdminAuditPage({ match, loader, session }: PageProps) {
 const referenceT = useReferenceLocalization().t;

  const { t } = useLocalization();
  const fmt = useReportFormat();
  const router = useModuleRouter();
  const [q, setQ] = useState(match.search.get('q') ?? '');
  const [action, setAction] = useState(match.search.get('action') ?? '');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (action) params.set('action', action);
    const s = params.toString();
    router.push(`/admin/audit${s ? `?${s}` : ''}`);
  };
  return (
    <PageLoader<{ rows: AuditEntry[]; actions: string[] }> path={loader}>
      {(d) => (
        <>
          <PageHeader title={referenceT("Audit log")} description={referenceT("Who ran, exported, emailed, scheduled or changed what. The newest 500 matching entries are shown.")} />
          <form className="lr-row lr-row-end lr-mb" onSubmit={submit} role="search">
            <div className="lr-grow lr-min-240">
              <label className="lr-label" htmlFor="lr-audit-q">{t('Search')}</label>
              <input id="lr-audit-q" className="lr-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Email, report id or detail')} />
            </div>
            <div className="lr-min-180">
              <SelectInput label={referenceT("Area")} value={action} onChange={(e) => setAction(e.target.value)} options={[{ value: '', label: 'All areas' }, ...d.actions.map((a) => ({ value: a, label: a }))]} />
            </div>
            <Button type="submit"><ReferenceText message="Filter" /></Button>
          </form>
          <Card>
            <TableContainer className="lr-table-scroll lr-table-scroll-tall">
              <Table className="lr-table">
                <TableHeader><TableRow>
                  <TableHead>{t('When')}</TableHead><TableHead>{t('Who')}</TableHead><TableHead>{t('Action')}</TableHead><TableHead>{t('Target')}</TableHead><TableHead>{t('Detail')}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {d.rows.length === 0 && <TableRow><TableCell colSpan={5} className="lr-table-empty">{t('No entries match.')}</TableCell></TableRow>}
                  {d.rows.map((a) => (
                    <TableRow key={a.id} className="lr-top">
                      <TableCell className="lr-nowrap lr-xs lr-muted">{fmt.dateTime(a.at, session?.org.timezone)}</TableCell>
                      <TableCell>{a.userEmail ?? t('system')}</TableCell>
                      <TableCell><code className="lr-xs">{a.action}</code></TableCell>
                      <TableCell>{a.target ?? ''}</TableCell>
                      <TableCell className="lr-xs">{a.detail ?? ''}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </>
      )}
    </PageLoader>
  );
}

export function AdminOutboxPage({ loader, session }: PageProps) {
 const referenceT = useReferenceLocalization().t;

  const { t } = useLocalization();
  const fmt = useReportFormat();
  return (
    <PageLoader<{ smtp: boolean; mails: OutboxMessage[] }> path={loader}>
      {(d) => (
        <>
          <PageHeader title={referenceT("Email outbox")} description={d.smtp ? 'Every email the system tried to send, with its delivery result.' : 'This demo never sends email. Every message is recorded here so you can check content and recipients.'} />
          {d.mails.length === 0 ? <Card><EmptyState title={referenceT("No emails yet")}><ReferenceText message="Run a report in the background with email delivery, or try an email request." /></EmptyState></Card> : (
            <ul className="lr-stack-sm">
              {d.mails.map((m) => (
                <li key={m.id}>
                  <Card as="div">
                    <details className="lr-details">
                      <summary className="lr-row lr-summary">
                        <StatusBadge status={m.status} />
                        <span className="lr-medium">{m.subject}</span>
                        <span className="lr-muted">{t('to {to}', { to: m.to.join(', ') })}</span>
                        <span className="lr-ml-auto lr-xs lr-muted">{fmt.dateTime(m.at, session?.org.timezone)}</span>
                      </summary>
                      <div className="lr-details-body">
                        {m.error && <p className="lr-xs lr-warn-ink lr-mb-sm">{m.error}</p>}
                        <pre className="lr-pre"><MailText text={m.text}/></pre>
                        {m.attachments.length > 0 && <p className="lr-xs lr-muted lr-mt-sm">{t('Attachments:')} {m.attachments.map((a) => `${a.filename} (${fmt.bytes(a.bytes)})`).join(', ')}</p>}
                      </div>
                    </details>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </PageLoader>
  );
}
