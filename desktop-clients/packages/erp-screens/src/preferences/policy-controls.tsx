"use client";
import React from 'react';
import {useERP} from '@pepbits/erp-shell';
import {LocalizedText} from '@pepbits/ops-ui';
import type {PreferenceKey} from '@pepbits/erp-config';
export function PreferenceControl({preferenceKey,children}:{preferenceKey:PreferenceKey;children:React.ReactNode}) {
 const {preferencePolicy,preferencesAvailable}=useERP();const locked=preferencePolicy.rules[preferenceKey]?.locked===true;
 const allowed=preferencePolicy.rules[preferenceKey]?.allowedValues;
 const filter=(nodes:React.ReactNode):React.ReactNode=>React.Children.map(nodes,node=>{if(!React.isValidElement(node))return node;const props=node.props as {options?:Array<{value:unknown}>;children?:React.ReactNode;id?:string};if(allowed&&props.id&&!allowed.includes(props.id))return null;return React.cloneElement(node as React.ReactElement<any>,{...(allowed&&props.options?{options:props.options.filter(o=>allowed.some(v=>String(v)===String(o.value)))}:{}),...(props.children?{children:filter(props.children)}:{})});});
 return <fieldset disabled={locked||!preferencesAvailable} data-preference={preferenceKey} className="m-0 min-w-0 border-0 p-0">
  {filter(children)}
  {locked?<p className="mt-1 text-xs text-[var(--text-muted)]"><LocalizedText message="Managed by your administrator" /></p>:null}
 </fieldset>;
}
