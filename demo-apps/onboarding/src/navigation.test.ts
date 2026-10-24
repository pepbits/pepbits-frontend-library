import {describe, expect, it} from 'vitest';
import {hrefFor, MODULE_ID, onboardingTarget, product, ROUTES, targetFromPath} from './navigation';

describe('onboarding navigation', () => {
  it('exposes one Orvia header module with the four source destinations and shared preferences', () => {
    const items = product.modules[MODULE_ID]!.navigation.flatMap(section => section.items.map(item => item.pageId));
    expect(items).toEqual(['orvia-landing', 'orvia-workspace', 'orvia-sign-in', 'orvia-register']);
    expect(Object.keys(product.pages).sort()).toEqual(['orvia-landing', 'orvia-register', 'orvia-sign-in', 'orvia-workspace', 'preferences']);
    expect(Object.values(product.pages).every(page => !page.ai?.enabled)).toBe(true);
  });
  it.each(ROUTES.map(route => [route.path, route.pageId] as const))('round trips %s', (path, pageId) => {
    expect(targetFromPath(path)).toEqual({pageId});
    expect(hrefFor({pageId})).toBe(path);
  });
  it('keeps deep-link query parameters and accepts the source /login alias', () => {
    expect(targetFromPath('/login', 'ws=stmarys')).toEqual({pageId: 'orvia-sign-in', query: 'ws=stmarys'});
    expect(hrefFor(targetFromPath('/register', 'type=hospital'))).toBe('/register?type=hospital');
    expect(hrefFor(onboardingTarget('orvia-register', {structure: 'network', type: undefined}))).toBe('/register?structure=network');
    expect(targetFromPath('/workspace/')).toEqual({pageId: 'orvia-workspace'});
    expect(targetFromPath('/preferences')).toEqual({pageId: 'preferences'});
    expect(hrefFor({pageId: 'preferences'})).toBe('/preferences');
  });
  it.each(['/nope', '/register/extra', '/legal/terms', '/sign-in/stmarys'])('rejects %s', path => {
    expect(targetFromPath(path).pageId).toBe('not-found');
    expect(hrefFor({pageId: 'not-found'})).toBe('/not-found');
  });
});
