'use client';
import React, {useMemo, type ComponentType} from 'react';
import {LoadingState, NotFoundState} from '@pepbits/components';
import type {PageRenderContext} from '@pepbits/page-engines/renderer';
import type {CaregridTarget} from '../../navigation';
import {useLive} from './live';
import {QueryError} from './ui';
import type {ScreenProps} from './context';
import {CommandCenter} from './pages/dashboard';
import {BookPage} from './pages/book';
import {SchedulePage} from './pages/schedule';
import {FrontDeskPage} from './pages/frontdesk';
import {ExceptionsPage} from './pages/exceptions';
import {ResourcesPage} from './pages/resources';
import {CatalogPage} from './pages/catalog';
import {PatientsPage} from './pages/patients';
import {PharmacyPage} from './pages/pharmacy';
import {InsightsPage} from './pages/insights';
import {HelpPage} from './pages/help';

export const SCREENS: Readonly<Record<string, ComponentType<ScreenProps>>> = {
  'caregrid-dashboard': CommandCenter, 'caregrid-book': BookPage, 'caregrid-schedule': SchedulePage, 'caregrid-frontdesk': FrontDeskPage,
  'caregrid-exceptions': ExceptionsPage, 'caregrid-resources': ResourcesPage, 'caregrid-catalog': CatalogPage, 'caregrid-patients': PatientsPage,
  'caregrid-pharmacy': PharmacyPage, 'caregrid-insights': InsightsPage, 'caregrid-help': HelpPage,
};
/** Page-engine renderer for every CareGrid destination; reference metadata gates rendering. */
export function CaregridScreen({page, target}: PageRenderContext) {
  const {meta, metaError, retryMeta} = useLive();
  const query = (target as CaregridTarget).query ?? '';
  const params = useMemo(() => new URLSearchParams(query), [query]);
  const Screen = SCREENS[page.id];
  if (!Screen) return <NotFoundState/>;
  if (!meta) return metaError ? <QueryError error={metaError} onRetry={retryMeta}/> : <LoadingState title="Loading scheduling data…"/>;
  return <div data-tour="cg-page" data-caregrid-screen={page.id}><Screen meta={meta} params={params}/></div>;
}
