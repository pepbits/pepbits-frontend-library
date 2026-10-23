"use client";
import React from 'react';
import * as icons from '@pepbits/icons';
export function IconsDemo(){return <div className="token-grid">{Object.entries(icons).filter(([name])=>name!=='Icon').map(([name,icon])=><div key={name}><icons.Icon icon={icon as icons.IconComponent} label={name}/><code>{name}</code></div>)}</div>;}
