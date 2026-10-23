"use client";
import React from 'react';
import {WorkspaceShell} from '@pepbits/shell';
import {useLocalization} from '@pepbits/i18n/react';
import {useDemoWorkspace} from './demo-state';
import {GalleryPage} from './gallery';
import {areas} from './areas';
/** Thin composition: the library owns chrome, workspace, layers and preferences. */
export function AppFrame({children}:{children?:React.ReactNode}) {
 const navigation=useDemoWorkspace(),{t}=useLocalization();
 return <div className="library-preferences"><a className="skip-link" href={`#gallery-${navigation.port.current.pageId}`}>{t('Skip to content')}</a><WorkspaceShell navigation={navigation} renderDocument={document=>{
  const area=areas.find(item=>item.id===document.route)?.id??'page-engines';
  return <><GalleryPage area={area}/>{children}</>;
 }}/></div>;
}
