import React from 'react';
import {Card, CardGrid, StatCard} from '@pepbits/components';
import {Button} from '@pepbits/ui';
import {useScreenHost} from '@pepbits/patterns/screen-host';
import {useLocalization} from '@pepbits/i18n/react';
import {usePreferences} from '@pepbits/preferences/react';
import {useNavigation} from '@pepbits/platform/navigation';
import {useWindowPort} from '@pepbits/platform/windows';
import {WorkspacePage, useOptionalWorkspace, useWorkspaceDocuments, useSplitIn, useDetachedIn, type Workspace} from '@pepbits/shell';
import type {PageRenderContext} from '@pepbits/page-engines/renderer';
import {inTauri} from '../../platform/tauri-windows';

/** Desktop-owned overview: what this host can do here, and shortcuts into the record screens. */
export function DesktopOverview({page}: PageRenderContext) {
  const workspace = useOptionalWorkspace();
  return workspace ? <Overview page={page} workspace={workspace}/> : <Overview page={page}/>;
}
function Counts({workspace}: {workspace: Workspace}) {
  const {t} = useLocalization(), documents = useWorkspaceDocuments(), split = useSplitIn(workspace), detached = useDetachedIn(workspace);
  return <><StatCard label={t('Open documents')} value={documents.length}/><StatCard label={t('Split panes')} value={split.length}/><StatCard label={t('Separate windows')} value={detached.length}/></>;
}
function Overview({page, workspace}: Pick<PageRenderContext, 'page'> & {workspace?: Workspace}) {
  const {t} = useLocalization(), {preferences} = usePreferences(), navigation = useNavigation(), windows = useWindowPort();
  const host = useScreenHost();
  const runtime = inTauri() ? t('Tauri desktop window') : t('Web browser (web mode)');
  return <WorkspacePage><section aria-labelledby="desktop-overview-title" className="space-y-4 p-4" data-desktop-overview>
    <header className="space-y-1"><h1 id="desktop-overview-title" className="text-xl font-bold">{t(page.title)}</h1>
      <p className="text-[var(--text-muted)]">{t('Fictional demonstration data from the demo API. Open records in tabs, compare two side by side, or move one into its own window when the desktop runtime provides windows.')}</p></header>
    <CardGrid columns="auto" minCardWidth={180}>
      <StatCard label={t('Runtime')} value={runtime}/>
      <StatCard label={t('Separate windows')} value={windows.available ? t('Available') : t('Not available here')}/>
      <StatCard label={t('Record layout')} value={preferences.floatingWindows ? t('Floating windows') : preferences.openRecordsInTabs ? t('Tabs') : t('One document at a time')}/>
      {workspace ? <Counts workspace={workspace}/> : null}
    </CardGrid>
    <Card as="section" aria-labelledby="desktop-start" className="space-y-3 p-4"><h2 id="desktop-start" className="font-semibold">{t('Start working')}</h2>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => navigation.open({pageId: 'customer-master'})}>{t('Open Customer Master')}</Button>
        <Button disabled={!host.can('create')} onClick={() => {if (host.can('create')) navigation.open({pageId: 'customer-master', mode: 'new'});}}>{t('New customer')}</Button>
        <Button onClick={() => navigation.open({pageId: 'component-examples'})}>{t('Library examples')}</Button>
        <Button onClick={() => navigation.open({pageId: 'preferences'})}>{t('Preferences')}</Button>
      </div>
      <ul className="list-disc space-y-1 ps-5 text-[var(--text-muted)]">
        <li>{t('Tab options split the active record with the previous one, swap panes or return to one pane.')}</li>
        <li>{t('Turn on floating windows in Preferences to arrange records as movable frames with a taskbar.')}</li>
        <li>{t('Open in its own window appears only in the desktop runtime; closing that window brings the record back.')}</li>
        <li>{t('Unsaved changes are kept until you confirm closing a record or leaving the module.')}</li>
      </ul>
    </Card>
  </section></WorkspacePage>;
}
