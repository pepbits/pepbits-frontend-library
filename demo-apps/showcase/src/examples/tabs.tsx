"use client";
import React, {useState} from 'react';
import {Tabs} from '@pepbits/components';
import {Segmented} from '@pepbits/ui';
import {usePreference} from '@pepbits/preferences/react';
export function TabsDemo(){const [tab,setTab]=useState('summary'),view=usePreference('resultView');return <div className="space-y-3"><Tabs items={[{id:'summary',label:'Summary'},{id:'details',label:'Details'}]} value={tab} onChange={setTab}/><p>{tab}</p><Segmented label="Result view" value={view.value} options={(['table','cards'] as const).map(value=>({value,label:value,disabled:view.locked||!!view.allowedValues&&!view.allowedValues.includes(value)}))} onChange={value=>view.update({resultView:value as 'table'|'cards'})}/></div>;}
