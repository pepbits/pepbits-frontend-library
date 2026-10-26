import React, {useMemo, useState, type ReactNode} from 'react';
import {readFileSync} from 'node:fs';
import {vi} from 'vitest';
import {PreferenceHost} from '@pepbits/preferences/react';
import {DEFAULT_PREFERENCES, type PreferencePolicy, type UserPreferences} from '@pepbits/preferences';
import {LocalizationProvider} from '@pepbits/i18n/react';
import {createTranslator, directionOf} from '@pepbits/i18n';
import {ScreenHostProvider} from '@pepbits/patterns/screen-host';
import {NavigationProvider, type NavigationTarget} from '@pepbits/platform/navigation';
import {AllyVoraProvider} from '../../modules/registration/context';
import {hrefFor, LAYOUT_ROLES, REGISTRATION_ROLES, type AllyVoraTarget} from '../../modules/registration/routes';
import type {AllyVoraClient} from '../../adapters/allyvora';

const read = (language: string) => JSON.parse(readFileSync(process.cwd() + '/../../mock-api/config/localization/shared/' + language + '.json', 'utf8')).messages;
export const sharedMessages = read('en');
const arabicMessages = read('ar');

export interface TestHost {
  client: AllyVoraClient;
  preferences?: Partial<UserPreferences>;
  policy?: PreferencePolicy;
  role?: string;
  open?: (target: NavigationTarget) => void;
  replace?: (href: string) => void;
  notify?: (message: string, options?: {tone?: string}) => void;
  reportDirty?: (dirty: boolean) => void;
}
/** The same public providers the app host composes, with spies for navigation, toasts and dirty state. */
export function TestHostProvider({host, children}: {host: TestHost; children: ReactNode}) {
  const [patch, setPatch] = useState<Partial<UserPreferences>>({});
  const preferences = {...DEFAULT_PREFERENCES, ...host.preferences, ...patch};
  const role = host.role ?? 'enterprise-admin';
  const t = useMemo(() => createTranslator({language: preferences.language, catalogs: {en: sharedMessages, ar: arabicMessages}}), [preferences.language]);
  const navigation = useMemo(() => ({current: {pageId: 'test'}, hrefFor: (target: NavigationTarget) => hrefFor(target as AllyVoraTarget), open: (target: NavigationTarget) => host.open?.(target), openInNewContext: (target: NavigationTarget) => host.open?.(target)}), [host]);
  const can = (action: string) => action === 'allyvora-configure-layout' ? LAYOUT_ROLES.includes(role) : ['allyvora-create', 'allyvora-edit', 'allyvora-archive'].includes(action) && REGISTRATION_ROLES.includes(role);
  return <PreferenceHost preferences={preferences} preferencePolicy={host.policy} update={changes => setPatch(current => ({...current, ...changes}))}>
    <LocalizationProvider value={{t, language: preferences.language, direction: directionOf(preferences.language), dateTime: String}}>
      <NavigationProvider value={navigation}>
        <ScreenHostProvider value={{can, notify: (message, options) => host.notify?.(message, options), scope: {module: 'allyvora-patients'}, document: {id: 'test', focused: true, draftState: {}, setDraftState: () => {}, reportDirty: dirty => host.reportDirty?.(dirty)}}}>
          <AllyVoraProvider client={host.client} replace={href => host.replace?.(href)}>{children}</AllyVoraProvider>
        </ScreenHostProvider>
      </NavigationProvider>
    </LocalizationProvider>
  </PreferenceHost>;
}
export const spies = () => ({open: vi.fn(), replace: vi.fn(), notify: vi.fn(), reportDirty: vi.fn()});
