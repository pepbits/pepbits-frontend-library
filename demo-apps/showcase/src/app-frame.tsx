"use client";
import React from 'react';
import {Badge, NavLink} from '@pepbits/ui';
import {Card, CardContent} from '@pepbits/components';
import {useLocalization} from '@pepbits/i18n/react';
import {areas} from './areas';
import {PreferenceControls} from './preference-controls';
/** Replace this single frame with full shell chrome after the parallel merge. */
export function AppFrame({area,children,navigate}:{area:string;children:React.ReactNode;navigate?:(path:string)=>void}) {
 const {t}=useLocalization();
 return <div className="app-frame library-preferences"><a className="skip-link" href="#main">{t('Skip to content')}</a>
 <header className="app-header"><div><strong>{t('Showcase')}</strong><span> / {t('Library examples')}</span></div><Badge>{t('Demo only — changes disappear on reload')}</Badge></header>
 <div className="app-body"><aside><nav aria-label={t('Gallery navigation')}>{areas.map(item=><NavLink key={item.id} href={'/'+item.id} onClick={navigate?event=>{if(!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey&&event.button===0){event.preventDefault();navigate('/'+item.id);}}:undefined} aria-current={area===item.id?'page':undefined} className="area-link">{t(item.title)}</NavLink>)}</nav>
 <Card><CardContent><PreferenceControls compact/></CardContent></Card></aside><main id="main" tabIndex={-1}>{children}</main></div></div>;
}
