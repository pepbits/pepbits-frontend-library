"use client";
import React from 'react';
import {TOKEN_NAMES,tokenVar} from '@pepbits/tokens';
import {usePreferences} from '@pepbits/preferences/react';
export function TokensDemo(){const {preferences}=usePreferences();return <div><p>Theme: {preferences.theme}. Color samples follow the effective theme.</p><div className="token-grid">{TOKEN_NAMES.map(name=><div key={name}><span className="token-swatch" style={name.includes('shadow')?{boxShadow:tokenVar(name)}:name.includes('radius')?{borderRadius:tokenVar(name)}:{background:tokenVar(name)}}/><code>{name}</code></div>)}</div><p style={{fontFamily:'var(--font-ui)',fontSize:'calc(16px * var(--fs-form))'}}>Aa · أب · अ · അ — selected typography</p><div className="flex gap-4">{[1,2,3,4,6,8].map(space=><span key={space} style={{padding:`${space*0.25}rem`,border:'1px solid var(--border)',borderRadius:'var(--radius)'}}>{space}</span>)}</div></div>;}
