'use client';
import React, {useMemo} from 'react';
import {createPageRenderer} from '@pepbits/page-engines/renderer';
import {PreferencesPage} from '@pepbits/shell/preferences-page';
import {useSession} from '@pepbits/platform/auth';
import {useSettingsServices} from './providers';
import {pages, type OnboardingTarget} from './navigation';
import {browserStore, createDemoOnboarding, type OnboardingPort} from './adapters/onboarding';
import {OnboardingServices} from './modules/orvia/services';
import {LandingRoute, OrviaNotFound, RegisterRoute, SignInRoute, WorkspaceRoute} from './modules/orvia/pages';

function Settings() {return <PreferencesPage showTabPreferences={false} services={useSettingsServices()}/>;}
const Renderer = createPageRenderer({renderers: {'orvia-landing': LandingRoute, 'orvia-workspace': WorkspaceRoute, 'orvia-sign-in': SignInRoute, 'orvia-register': RegisterRoute, preferences: Settings}});

/** One route per page through the public renderer registry; unknown targets show the source not-found page. */
export function OnboardingRoute({target}: {target: OnboardingTarget}) {
  const page = pages.find(candidate => candidate.id === target.pageId);
  return page ? <Renderer page={page} target={target}/> : <OrviaNotFound/>;
}
export function OnboardingPage({target, port}: {target: OnboardingTarget; port?: OnboardingPort}) {
  const {user} = useSession();
  const scope = [user?.tenantId ?? 'anonymous', user?.id ?? 'anonymous'].map(encodeURIComponent).join('.');
  // Device-local fictional adapter, isolated per authenticated tenant/user. Not authorization.
  const services = useMemo(() => port ?? createDemoOnboarding({store: browserStore(), scope}), [port, scope]);
  return <OnboardingServices value={services}><OnboardingRoute target={target}/></OnboardingServices>;
}
