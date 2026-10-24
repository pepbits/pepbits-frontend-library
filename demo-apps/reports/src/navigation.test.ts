import {describe, expect, it} from 'vitest';
import {productForRole} from '@pepbits/shell';
import {hrefFor, pages, product, targetFromPath} from './navigation';
import {REFERENCE_REPORTS_ROUTES, REPORTS_ROUTE_DEFINITIONS} from './modules/reports/routes';
import {REPORTS_NAVIGATION} from './modules/reports/navigation';

describe('reports application navigation', () => {
  it('registers one page per source route plus the download adaptation and preferences', () => {
    expect(pages.filter(page => page.kind === 'reports')).toHaveLength(REPORTS_ROUTE_DEFINITIONS.length + 1);
    expect(pages.map(page => page.id)).toContain('preferences');
    expect(new Set(pages.map(page => page.id)).size).toBe(pages.length);
  });
  it('round-trips every source destination, query and dynamic id as a deep link', () => {
    for (const route of REFERENCE_REPORTS_ROUTES) {
      const target = targetFromPath(route.path);
      expect(target.pageId, route.path).not.toBe('not-found');
      expect(hrefFor(target)).toBe(route.path);
    }
    expect(targetFromPath('/reports/payer-mix', 'denied=1')).toMatchObject({pageId: 'reports-report', recordId: 'payer-mix', query: 'denied=1'});
    expect(hrefFor(targetFromPath('/admin/audit', 'q=trial&action=report'))).toBe('/admin/audit?q=trial&action=report');
    expect(hrefFor(targetFromPath('/jobs/job_42'))).toBe('/jobs/job_42');
    expect(hrefFor({pageId: 'reports-report', recordId: 'trial-balance'})).toBe('/reports/trial-balance');
    expect(targetFromPath('/downloads/abc.DEF-1_2')).toMatchObject({pageId: 'reports-download'});
    expect(targetFromPath('/reports/')).toMatchObject({pageId: 'reports-library'});
  });
  it('rejects unknown and malformed paths', () => {
    for (const path of ['/nowhere', '/reports/a/b', '/reports/%E0%A4%A', '/downloads/a/b']) expect(targetFromPath(path).pageId, path).toBe('not-found');
    expect(hrefFor({pageId: 'reports-report'})).toBe('/not-found');
  });
  it('shows the source sidebar sections in order and hides administration from non-administrators', () => {
    const module = product.modules['reference-reports']!;
    expect(module.navigation.map(section => section.label)).toEqual(REPORTS_NAVIGATION.map(section => section.section));
    expect(module.navigation.flatMap(section => section.items.map(item => item.label))).toEqual(REPORTS_NAVIGATION.flatMap(section => section.items.map(item => item.label)));
    const analyst = productForRole(product, 'operations-analyst'), administrator = productForRole(product, 'enterprise-admin');
    expect(Object.keys(analyst.pages).some(id => id.startsWith('reports-admin-'))).toBe(false);
    expect(Object.keys(analyst.pages)).toContain('reports-builder');
    expect(Object.keys(administrator.pages).filter(id => id.startsWith('reports-admin-'))).toHaveLength(6);
    expect(Object.keys(productForRole(product, 'school-student').pages)).toEqual(['preferences']);
  });
});
