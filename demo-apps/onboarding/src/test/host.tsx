import React, {useMemo, useState, type ReactNode} from 'react';
import {readFileSync} from 'node:fs';
import {render} from '@testing-library/react';
import {vi} from 'vitest';
import {createTranslator, directionOf} from '@pepbits/i18n';
import {LocalizationProvider} from '@pepbits/i18n/react';
import {DEFAULT_PREFERENCES, type PreferencePolicy, type UserPreferences} from '@pepbits/preferences';
import {PreferenceHost, usePreferences} from '@pepbits/preferences/react';
import {useFormatters} from '@pepbits/patterns/screen-host';
import {NavigationProvider, useNavigation, type NavigationPort} from '@pepbits/platform/navigation';
import {OnboardingRoute} from '../renderer';
import {createDemoOnboarding, memoryStore, type DemoOnboardingOptions, type DeviceStore, type OnboardingPort} from '../adapters/onboarding';
import {hrefFor, type OnboardingTarget} from '../navigation';
import {OnboardingServices} from '../modules/orvia/services';

const catalog = (language: string) => JSON.parse(readFileSync(`${process.cwd()}/../../dummy-api/config/localization/shared/${language}.json`, 'utf8')).messages as Record<string, string>;
/** Canonical protected API catalogs, read-only, so tests see the same keys as the runtime catalog. */
export const sharedMessages = catalog('en');
export const arabicMessages = catalog('ar');
export const NO_LATENCY = {lookup: 0, email: 0, signIn: 0, verify: 0, reset: 0, submit: 0};
export function testPort(options: Partial<DemoOnboardingOptions> = {}): OnboardingPort & {store: DeviceStore} {
  const store = options.store ?? memoryStore();
  return Object.assign(createDemoOnboarding({store, scope: 'fictional-tenant.fixture-admin', latency: NO_LATENCY, random: () => 0.5, now: () => new Date('2026-10-24T09:00:00Z'), ...options}), {store});
}
export interface HostOptions {preferences?: Partial<UserPreferences>; policy?: PreferencePolicy; target?: OnboardingTarget; port?: OnboardingPort; onOpen?: (target: OnboardingTarget) => void}

function Localized({children}: {children: ReactNode}) {
  const {preferences} = usePreferences(), format = useFormatters();
  const value = useMemo(() => ({language: preferences.language, direction: directionOf(preferences.language), dateTime: format.dateTime,
    t: createTranslator({language: preferences.language, catalogs: {en: sharedMessages, ar: arabicMessages}})}), [preferences.language, format]);
  return <LocalizationProvider value={value}><div dir={value.direction}>{children}</div></LocalizationProvider>;
}
/** Test host: accepted preferences with policy, runtime catalogs, a routed navigation port and the fictional adapter. */
export function TestHost({children, preferences = {}, policy, target = {pageId: 'orvia-landing'}, port, onOpen}: HostOptions & {children: ReactNode}) {
  const [patch, setPatch] = useState<Partial<UserPreferences>>({});
  const [current, setCurrent] = useState<OnboardingTarget>(target);
  const services = useMemo(() => port ?? testPort(), [port]);
  const navigation = useMemo<NavigationPort>(() => ({current, hrefFor, open: next => {onOpen?.(next); setCurrent(next);}, openInNewContext: next => onOpen?.(next)}), [current, onOpen]);
  return <PreferenceHost preferences={{...DEFAULT_PREFERENCES, ...preferences, ...patch}} preferencePolicy={policy} preferencesAvailable update={changes => setPatch(value => ({...value, ...changes}))}>
    <Localized><NavigationProvider value={navigation}><OnboardingServices value={services}>{children}</OnboardingServices></NavigationProvider></Localized>
  </PreferenceHost>;
}
export function renderWithHost(ui: ReactNode, options: HostOptions = {}) {
  const onOpen = options.onOpen ?? vi.fn();
  return {onOpen, ...render(<TestHost {...options} onOpen={onOpen}>{ui}</TestHost>)};
}
/** Renders whatever the host navigation currently targets, like the app's routed client. */
export function Routed() {
  const {current} = useNavigation();
  return <OnboardingRoute target={current as OnboardingTarget}/>;
}
