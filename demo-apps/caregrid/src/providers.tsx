'use client';
import React, {useMemo} from 'react';
import {ApplicationProviders} from '@pepbits/shell/application-providers';
import type {EventSourceLike} from '@pepbits/platform/event-stream';
import {caregridProductForRole} from './navigation';
import {API_PRODUCT} from './adapters/http';
import type {CaregridClient} from './adapters/caregrid';
import {CaregridLiveProvider} from './modules/caregrid/live';
import {BookShortcut, CaregridInbox, caregridCommandSearch} from './modules/caregrid/chrome';
import {caregridTours} from './modules/caregrid/help';
export {useSettingsServices} from '@pepbits/shell/application-providers';
const brand = {name: 'CareGrid', tagline: 'Scheduling and resources'};
const tours = caregridTours();
const quickPages = [{id: 'caregrid-book', label: 'Book'}];
type Props = Omit<React.ComponentProps<typeof ApplicationProviders>, 'productId' | 'brand' | 'productForRole' | 'chrome'> & {client: CaregridClient; createEventSource?: (url: string) => EventSourceLike};
/** Shared host chain plus CareGrid live state, which serves both the header inbox and the page. */
export function CaregridProviders({client, createEventSource, ...props}: Props) {
  const chrome = useMemo(() => ({quickPages, tours, inbox: <CaregridInbox/>, commandSearch: caregridCommandSearch(client),
    surface: (frame: React.ReactNode) => <CaregridLiveProvider client={client} createEventSource={createEventSource}><BookShortcut/>{frame}</CaregridLiveProvider>}), [client, createEventSource]);
  return <ApplicationProviders {...props} productId={API_PRODUCT} brand={brand} productForRole={caregridProductForRole} className="caregrid-page" notice="Fictional demonstration only" chrome={chrome}/>;
}
