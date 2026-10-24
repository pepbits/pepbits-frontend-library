import React from 'react';
import {act, waitFor} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import axe from 'axe-core';
import {hrefFor, targetFromPath, type OnboardingTarget} from './navigation';
import {arabicMessages, renderWithHost, Routed, testPort} from './test/host';

const profiles = [
  ['default', {}, undefined],
  ['Arabic RTL', {language: 'ar'}, undefined],
  ['reduced motion', {reducedMotion: true}, undefined],
  ['locked preference', {density: 'spacious', fontSizeForm: 15}, {revision: 1, rules: {density: {value: 'compact', locked: true}, fontSizeForm: {value: 12, locked: true}}}],
] as const;
// Every page, its deep links and the source not-found page.
const routes: Array<[string, string]> = [
  ['/', 'One record of care, from front desk to final claim.'],
  ['/workspace', 'Find your workspace'],
  ['/sign-in?ws=stmarys', 'Sign in'],
  ['/login?ws=cityrx', 'Sign in'],
  ['/sign-in', 'Choose a workspace first'],
  ['/sign-in?ws=unknown-workspace', 'Choose a workspace first'],
  ['/register', 'Organization type'],
  ['/register?type=pharmacy', 'Organization type'],
  ['/register?structure=network', 'Organization type'],
  ['/legal/terms', "This page doesn't exist"],
];
describe.each(profiles)('%s route rendering', (profile, preferences, policy) => {
  it.each(routes)('%s', async (path, heading) => {
    const [pathname, query = ''] = path.split('?') as [string, string?];
    const target: OnboardingTarget = targetFromPath(pathname, query);
    const {container} = renderWithHost(<main><Routed/></main>, {target, preferences, policy, port: testPort()});
    // Arabic uses the canonical runtime catalog where it has the message; other copy stays readable English.
    const expected = profile === 'Arabic RTL' ? arabicMessages[heading] ?? heading : heading;
    await waitFor(() => expect(container.querySelector('h1')).toHaveTextContent(expected));
    await waitFor(() => expect(container.querySelector('[aria-busy="true"]')).toBeNull());
    const surface = container.querySelector('.orvia')!;
    expect(surface).toHaveAttribute('dir', profile === 'Arabic RTL' ? 'rtl' : 'ltr');
    expect(surface).toHaveAttribute('data-reduced-motion', String(profile === 'reduced motion'));
    if (target.pageId !== 'not-found') expect(targetFromPath(hrefFor(target).split('?')[0]!, hrefFor(target).split('?')[1])).toEqual(target);
    await act(async () => {expect((await axe.run(container, {rules: {'color-contrast': {enabled: false}}})).violations).toEqual([]);});
  });
});
