import React, {useEffect, useMemo} from 'react';
import {ResourceScope, type JsonRequest} from '@pepbits/patterns/resources';
import {usePreferences} from '@pepbits/preferences/react';
import {useNavigation} from '@pepbits/platform/navigation';
import {moduleLandingPage} from '@pepbits/shell';
import {createPageRenderer, type PageRenderContext} from '@pepbits/page-engines/renderer';
import {NotFoundState} from '@pepbits/components';
import {PreferencesPage} from '@pepbits/shell/preferences-page';
import {useSettingsServices} from '@pepbits/shell/application-providers';
import type {NavigationTarget} from '@pepbits/platform/navigation';
import {pages, product} from './navigation';
import {DesktopOverview} from './modules/workspace/DesktopOverview';
import {DesktopRecordsPage} from './modules/records/RecordsPage';
import {LibraryExamples} from './modules/library/LibraryExamples';
import {readJson, useRequest} from './adapters/http';
import {useDesktopIdentity} from './adapters/records';

function Settings() {return <PreferencesPage services={useSettingsServices()}/>;}
function NotFound(_: PageRenderContext) {return <NotFoundState title="Page not found" description="This desktop address does not match a page."/>;}
/** One registration per page kind; the workspace renders every document through it. */
export const Renderer = createPageRenderer({renderers: {
  'desktop-overview': DesktopOverview, 'desktop-records': DesktopRecordsPage, 'desktop-examples': LibraryExamples, preferences: Settings, 'not-found': NotFound,
}});
export function DesktopPage({target}: {target: NavigationTarget}) {
  const request = useRequest(), identity = useDesktopIdentity();
  const {preferences} = usePreferences(), navigation = useNavigation();
  // Only an unqualified launch uses the preferred module; explicit deep links keep their target.
  useEffect(() => {
    if (!['/', '/index.html'].includes(window.location.pathname) || target.pageId !== 'desktop-overview') return;
    if (new URLSearchParams(window.location.search).has('document')) return;
    const preferred = preferences.defaultModule;
    if (!product.modules[preferred]) return;
    const pageId = moduleLandingPage(product, preferred);
    if (pageId && pageId !== target.pageId) navigation.open({pageId});
  }, [preferences.defaultModule, target.pageId, navigation]);
  const json = useMemo<JsonRequest>(() => async (path, init) => readJson(await request(path, init)), [request]);
  const page = pages[target.pageId] ?? pages['not-found']!;
  // Reads use the shared abort/retry lifecycle. No useStoredState writer is mounted;
  // worklist layouts remain owned by the engine's /layouts adapter.
  return <ResourceScope scopeKey={identity} request={json} statePath="/layouts"><Renderer page={page} target={target}/></ResourceScope>;
}
