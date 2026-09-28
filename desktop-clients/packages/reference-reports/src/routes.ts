/*
 * Route manifest for the 19 Lumen Reports page routes (src/app/(app)/** and src/app/login). Paths are the
 * source paths, relative to wherever the host mounts the module. `loader` is the demo API endpoint that
 * replaces the source's Next server-component loader. `permission` mirrors requirePagePerm on the server;
 * it is presentation metadata here, the loader enforces it.
 */
import type { ReferenceRoute } from '@pepbits/reference-host';
import type { Permission } from './types';

export type ReportsRouteId =
  | 'login' | 'overview' | 'library' | 'report' | 'builder' | 'builder-edit' | 'dashboards' | 'dashboard' | 'jobs' | 'job' | 'schedules'
  | 'email-in' | 'api-keys' | 'admin-access' | 'admin-users' | 'admin-settings' | 'admin-sources' | 'admin-audit' | 'admin-outbox';

export interface ReportsRouteDefinition {
  id: ReportsRouteId;
  pattern: string;
  title: string;
  source: string;
  loader: string;
  permission?: Permission;
  /** Concrete destinations for a dynamic route that exist in the demo fixtures. Empty when ids only exist at run time. */
  exemplars?: ReferenceRoute[];
}

/** System report ids and titles from the source catalogue (lumen-reports src/lib/catalog.ts). */
export const SYSTEM_REPORT_DESTINATIONS: ReadonlyArray<readonly [string, string]> = [
  ['revenue-by-service', 'Revenue by service line'],
  ['daily-revenue', 'Daily revenue and collections'],
  ['monthly-revenue-trend', 'Monthly revenue trend'],
  ['revenue-transactions', 'Revenue transaction detail'],
  ['payer-mix', 'Payer mix'],
  ['claims-denials', 'Claims and denials by payer'],
  ['denial-reasons', 'Denial reasons'],
  ['receivables-aging', 'Receivables aging'],
  ['trial-balance', 'Trial balance'],
  ['general-ledger', 'General ledger detail'],
  ['income-expense-summary', 'Income and expense summary'],
  ['cost-center-expense', 'Expense by cost center'],
  ['appointment-attendance', 'Appointment attendance'],
  ['no-show-trend', 'No-show trend'],
  ['waiting-time', 'Waiting time by department'],
  ['activity-by-department', 'Clinical activity by department'],
  ['bed-occupancy-trend', 'Bed occupancy trend'],
  ['admissions-register', 'Admissions register'],
  ['los-by-department', 'Length of stay by department'],
  ['diagnostics-tat', 'Diagnostics turnaround'],
  ['diagnostics-volume-trend', 'Diagnostics volume trend'],
  ['stock-position', 'Stock position'],
  ['expiry-risk', 'Near-expiry stock'],
  ['readmissions', '30-day readmissions'],
  ['discharge-outcomes', 'Discharge outcomes'],
  ['budget-vs-actual', 'Budget versus actual'],
  ['forecast-scenarios', 'Forecast scenarios'],
  ['service-line-growth', 'Service line growth'],
];
const SEEDED_DASHBOARDS: ReadonlyArray<readonly [string, string]> = [
  ['executive-overview', 'Executive overview'],
  ['finance-daily', 'Finance daily'],
  ['clinical-ops', 'Clinical operations'],
];

const APP = 'src/app/(app)';
export const REPORTS_ROUTE_DEFINITIONS: ReportsRouteDefinition[] = [
  { id: 'login', pattern: '/login', title: 'Sign in', source: 'src/app/login/page.tsx', loader: '/api/page/login' },
  { id: 'overview', pattern: '/', title: 'Overview', source: `${APP}/page.tsx`, loader: '/api/page/overview' },
  { id: 'library', pattern: '/reports', title: 'Report library', source: `${APP}/reports/page.tsx`, loader: '/api/page/reports' },
  { id: 'report', pattern: '/reports/:id', title: 'Report', source: `${APP}/reports/[id]/page.tsx`, loader: '/api/page/reports/:id', exemplars: SYSTEM_REPORT_DESTINATIONS.map(([id, title]) => ({ path: `/reports/${id}`, title })) },
  { id: 'builder', pattern: '/builder', title: 'Report builder', source: `${APP}/builder/page.tsx`, loader: '/api/page/builder', permission: 'reports.build' },
  { id: 'builder-edit', pattern: '/builder/:id', title: 'Build a report', source: `${APP}/builder/[id]/page.tsx`, loader: '/api/page/builder/:id', permission: 'reports.build', exemplars: [{ path: '/builder/new', title: 'New report' }] },
  { id: 'dashboards', pattern: '/dashboards', title: 'Dashboards', source: `${APP}/dashboards/page.tsx`, loader: '/api/page/dashboards' },
  { id: 'dashboard', pattern: '/dashboards/:id', title: 'Dashboard', source: `${APP}/dashboards/[id]/page.tsx`, loader: '/api/page/dashboards/:id', exemplars: SEEDED_DASHBOARDS.map(([id, title]) => ({ path: `/dashboards/${id}`, title })) },
  { id: 'jobs', pattern: '/jobs', title: 'My reports', source: `${APP}/jobs/page.tsx`, loader: '/api/page/jobs' },
  { id: 'job', pattern: '/jobs/:id', title: 'Report result', source: `${APP}/jobs/[id]/page.tsx`, loader: '/api/page/jobs/:id', exemplars: [] },
  { id: 'schedules', pattern: '/schedules', title: 'Schedules', source: `${APP}/schedules/page.tsx`, loader: '/api/page/schedules' },
  { id: 'email-in', pattern: '/email-in', title: 'Email requests', source: `${APP}/email-in/page.tsx`, loader: '/api/page/email-in' },
  { id: 'api-keys', pattern: '/api-keys', title: 'API keys and BI', source: `${APP}/api-keys/page.tsx`, loader: '/api/page/api-keys' },
  { id: 'admin-access', pattern: '/admin/access', title: 'Roles and access', source: `${APP}/admin/access/page.tsx`, loader: '/api/page/admin/access', permission: 'admin.access' },
  { id: 'admin-users', pattern: '/admin/users', title: 'Users', source: `${APP}/admin/users/page.tsx`, loader: '/api/page/admin/users', permission: 'admin.users' },
  { id: 'admin-settings', pattern: '/admin/settings', title: 'Settings and rules', source: `${APP}/admin/settings/page.tsx`, loader: '/api/page/admin/settings', permission: 'admin.settings' },
  { id: 'admin-sources', pattern: '/admin/sources', title: 'Data sources', source: `${APP}/admin/sources/page.tsx`, loader: '/api/page/admin/sources', permission: 'admin.sources' },
  { id: 'admin-audit', pattern: '/admin/audit', title: 'Audit log', source: `${APP}/admin/audit/page.tsx`, loader: '/api/page/admin/audit', permission: 'audit.view' },
  { id: 'admin-outbox', pattern: '/admin/outbox', title: 'Email outbox', source: `${APP}/admin/outbox/page.tsx`, loader: '/api/page/admin/outbox', permission: 'audit.view' },
];

/** Every module destination: static routes plus concrete exemplars of dynamic routes (jobs/:id ids exist only at run time). */
export const REFERENCE_REPORTS_ROUTES: ReferenceRoute[] = REPORTS_ROUTE_DEFINITIONS.flatMap((r) =>
  r.pattern.includes(':') ? r.exemplars ?? [] : [{ path: r.pattern, title: r.title }]);

export interface ReportsRouteMatch {
  route: ReportsRouteDefinition;
  params: Record<string, string>;
  pathname: string;
  search: URLSearchParams;
}

/** Matches a module-relative path ("/reports/payer-mix?x=1"). Unknown paths return null (not-found page). */
export function matchReportsRoute(path: string): ReportsRouteMatch | null {
  const [rawPath, query = ''] = (path || '/').split('?');
  const pathname = rawPath.length > 1 ? rawPath.replace(/\/+$/, '') || '/' : '/';
  for (const route of REPORTS_ROUTE_DEFINITIONS) {
    const keys: string[] = [];
    const re = new RegExp(`^${route.pattern.replace(/:(\w+)/g, (_, k: string) => { keys.push(k); return '([^/]+)'; })}$`);
    const m = re.exec(pathname);
    if (!m) continue;
    let params: Record<string, string>;
    try { params = Object.fromEntries(keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])); } catch { return null; }
    return { route, params, pathname, search: new URLSearchParams(query) };
  }
  return null;
}

/** The loader URL for a match, with params encoded and the page's query forwarded where the source read it. */
export function loaderPath(match: ReportsRouteMatch): string {
  const base = match.route.loader.replace(/:(\w+)/g, (_, k: string) => encodeURIComponent(match.params[k] ?? ''));
  if (match.route.id !== 'admin-audit') return base;
  const q = new URLSearchParams();
  for (const k of ['q', 'action']) { const v = match.search.get(k); if (v) q.set(k, v); }
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}
