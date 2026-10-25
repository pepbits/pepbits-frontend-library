import React, {useMemo, useState, type ReactNode} from 'react';
import {readFileSync} from 'node:fs';
import {vi} from 'vitest';
import {PreferenceHost} from '@pepbits/preferences/react';
import {DEFAULT_PREFERENCES, type PreferencePolicy, type UserPreferences} from '@pepbits/preferences';
import {LocalizationProvider} from '@pepbits/i18n/react';
import {createTranslator, directionOf} from '@pepbits/i18n';
import {ScreenHostProvider} from '@pepbits/patterns/screen-host';
import {NavigationProvider, type NavigationTarget} from '@pepbits/platform/navigation';
import type {CaregridClient} from '../adapters/caregrid';
import {hrefFor} from '../navigation';
import {CaregridLiveProvider} from '../modules/caregrid/live';
import {createFakeEventSource} from './mock-api';

const catalog = (language: string) => JSON.parse(readFileSync(process.cwd() + `/../../mock-api/config/localization/shared/${language}.json`, 'utf8')).messages as Record<string, string>;
export const sharedMessages = catalog('en');
const catalogs = {en: sharedMessages, ar: catalog('ar')};
export interface TestHostOptions {client: CaregridClient; preferences?: Partial<UserPreferences>; policy?: PreferencePolicy; can?: (action: string) => boolean; notify?: ReturnType<typeof vi.fn>; navigate?: ReturnType<typeof vi.fn>}
/** Host chain for module tests: effective preferences, localization, navigation, ScreenHost and live scheduling state. */
export function TestHost({client, preferences = {}, policy, can = () => true, notify = vi.fn(), navigate = vi.fn(), children}: TestHostOptions & {children: ReactNode}) {
  const [patch, setPatch] = useState<Partial<UserPreferences>>({});
  const effective = {...DEFAULT_PREFERENCES, ...preferences, ...patch};
  const t = useMemo(() => createTranslator({language: effective.language, catalogs}), [effective.language]);
  const navigation = useMemo(() => ({current: {pageId: 'test'}, hrefFor, open: (target: NavigationTarget) => navigate(target), openInNewContext: (target: NavigationTarget) => navigate(target)}), [navigate]);
  return <PreferenceHost preferences={effective} preferencePolicy={policy} preferencesAvailable update={changes => {setPatch(value => ({...value, ...changes}));}}>
    <LocalizationProvider value={{t, language: effective.language, direction: directionOf(effective.language), dateTime: String}}>
      <NavigationProvider value={navigation}><ScreenHostProvider value={{can, notify: notify as never, scope: {module: 'caregrid'}}}>
        <CaregridLiveProvider client={client} createEventSource={createFakeEventSource}>{children}</CaregridLiveProvider>
      </ScreenHostProvider></NavigationProvider>
    </LocalizationProvider>
  </PreferenceHost>;
}
