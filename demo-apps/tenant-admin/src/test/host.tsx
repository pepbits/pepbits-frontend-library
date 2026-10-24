import React, {type ReactNode} from 'react';
import {vi} from 'vitest';
import {SessionProvider} from '@pepbits/platform/auth';
import {NavigationProvider} from '@pepbits/platform/navigation';
import {PreferenceHost} from '@pepbits/preferences/react';
import {DEFAULT_PREFERENCES, type PreferencePolicy, type UserPreferences} from '@pepbits/preferences';
import {createTranslator, directionOf} from '@pepbits/i18n';
import {LocalizationProvider} from '@pepbits/i18n/react';
import {RequestContext, type Request} from '../adapters/http';
import {hrefFor, type TenantAdminTarget} from '../navigation';
import {catalog} from '../modules/tenant-admin/test-utils';
import {fixtureSession} from './session';
const catalogs = {en: catalog('en'), ar: catalog('ar')};
/** The public providers the application host supplies to a page renderer, controlled for a test. */
export function AppHost({request, preferences = {}, rules = {}, current = {pageId: 'overview'}, open = vi.fn(), children}: {request: Request; preferences?: Partial<UserPreferences>; rules?: PreferencePolicy['rules']; current?: TenantAdminTarget; open?: (target: TenantAdminTarget) => void; children: ReactNode}) {
  const effective = {...DEFAULT_PREFERENCES, ...preferences};
  const t = createTranslator({language: effective.language, catalogs});
  return <SessionProvider value={fixtureSession}><RequestContext.Provider value={request}>
    <PreferenceHost preferences={effective} preferencePolicy={{revision: 1, rules}} update={async () => {}}>
      <LocalizationProvider value={{language: effective.language, direction: directionOf(effective.language), dateTime: String, t}}>
        <NavigationProvider value={{current, hrefFor, open, openInNewContext: open}}><div dir={directionOf(effective.language)}>{children}</div></NavigationProvider>
      </LocalizationProvider>
    </PreferenceHost>
  </RequestContext.Provider></SessionProvider>;
}
