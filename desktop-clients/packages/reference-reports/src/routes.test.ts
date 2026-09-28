import { describe, expect, it } from 'vitest';
import { loaderPath, matchReportsRoute, REFERENCE_REPORTS_ROUTES, REPORTS_ROUTE_DEFINITIONS, SYSTEM_REPORT_DESTINATIONS } from './routes';
import { REPORTS_NAVIGATION, visibleReportsNavigation } from './navigation';

// The 19 page routes pinned in docs/reference-import/SOURCE-INVENTORY.json for the reports module.
const SOURCE_PAGE_ROUTES = ['/admin/access', '/admin/audit', '/admin/outbox', '/admin/settings', '/admin/sources', '/admin/users', '/api-keys', '/builder/[id]', '/builder', '/dashboards/[id]', '/dashboards', '/email-in', '/jobs/[id]', '/jobs', '/', '/reports/[id]', '/reports', '/schedules', '/login'];

describe('reference reports route manifest', () => {
  it('covers every source page route exactly once', () => {
    const patterns = REPORTS_ROUTE_DEFINITIONS.map((r) => r.pattern.replace(/:(\w+)/g, '[$1]'));
    expect(patterns).toHaveLength(19);
    expect([...patterns].sort()).toEqual([...SOURCE_PAGE_ROUTES].sort());
    expect(new Set(REPORTS_ROUTE_DEFINITIONS.map((r) => r.id)).size).toBe(19);
  });

  it('lists static destinations and concrete dynamic exemplars, all routable', () => {
    const paths = REFERENCE_REPORTS_ROUTES.map((r) => r.path);
    for (const r of REPORTS_ROUTE_DEFINITIONS.filter((x) => !x.pattern.includes(':'))) expect(paths).toContain(r.pattern);
    for (const [id] of SYSTEM_REPORT_DESTINATIONS) expect(paths).toContain(`/reports/${id}`);
    expect(paths).toContain('/builder/new');
    expect(paths).toContain('/dashboards/executive-overview');
    expect(SYSTEM_REPORT_DESTINATIONS).toHaveLength(28);
    for (const route of REFERENCE_REPORTS_ROUTES) expect(matchReportsRoute(route.path), route.path).not.toBeNull();
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('matches dynamic params, trailing slashes and queries; rejects unknown paths', () => {
    const m = matchReportsRoute('/reports/payer-mix/?denied=1')!;
    expect(m.route.id).toBe('report');
    expect(m.params.id).toBe('payer-mix');
    expect(m.search.get('denied')).toBe('1');
    expect(loaderPath(m)).toBe('/api/page/reports/payer-mix');
    expect(loaderPath(matchReportsRoute('/jobs/job_abc%2F1')!)).toBe('/api/page/jobs/job_abc%2F1');
    expect(matchReportsRoute('/reports/a/b')).toBeNull();
    expect(matchReportsRoute('/nope')).toBeNull();
    expect(matchReportsRoute('/reports/%E0%A4%A')).toBeNull();
  });

  it('forwards only the audit filters to the audit loader', () => {
    expect(loaderPath(matchReportsRoute('/admin/audit?q=trial&action=report&x=1')!)).toBe('/api/page/admin/audit?q=trial&action=report');
    expect(loaderPath(matchReportsRoute('/admin/users?q=1')!)).toBe('/api/page/admin/users');
  });

  it('keeps navigation hrefs routable and filters by permission', () => {
    for (const item of REPORTS_NAVIGATION.flatMap((s) => s.items)) expect(matchReportsRoute(item.href)).not.toBeNull();
    const analyst = visibleReportsNavigation(['reports.build', 'api.keys'], false).flatMap((s) => s.items.map((i) => i.href));
    expect(analyst).toContain('/builder');
    expect(analyst).not.toContain('/admin/access');
    expect(visibleReportsNavigation([], true).flatMap((s) => s.items)).toHaveLength(14);
  });
});
