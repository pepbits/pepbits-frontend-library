"use client";
import React from 'react';
import {Toggle} from '@pepbits/ui';
import {Card,CardContent,CardGrid} from '@pepbits/components';
import {usePreferences} from '@pepbits/preferences/react';
import {parsePreferencePolicy} from '@pepbits/preferences';
import {useLocalization} from '@pepbits/i18n/react';
import {useDemoPolicy} from './providers';
import {PreferenceControls} from './preference-controls';
export function Playground(){const {policy,setPolicy}=useDemoPolicy(),{preferences}=usePreferences(),{t}=useLocalization();
 const rule=(key:string,value:unknown)=>setPolicy(parsePreferencePolicy({revision:policy.revision+1,rules:{...policy.rules,[key]:value}}));
 return <CardGrid columns={2}><Card><CardContent><PreferenceControls/></CardContent></Card><Card><CardContent className="space-y-4"><h2>{t('Tenant policy simulator')}</h2><Toggle label="Lock density" checked={!!policy.rules.density?.locked} onChange={locked=>rule('density',{value:'compact',locked})}/><Toggle label="Lock theme" checked={!!policy.rules.theme?.locked} onChange={locked=>rule('theme',{value:'contrast',locked})}/><Toggle label="Restrict page sizes" checked={!!policy.rules.pageSize?.allowedValues} onChange={restricted=>rule('pageSize',{value:10,locked:false,...(restricted?{allowedValues:[10,20]}:{})})}/><p>{t('Demo only — changes disappear on reload')}</p><p>Managed controls are disabled. The central update path also rejects locked or disallowed changes.</p><pre tabIndex={0} aria-label="Effective preference snapshot" dir="ltr">{JSON.stringify(preferences,null,2)}</pre></CardContent></Card></CardGrid>;
}
