"use client";
import React from 'react';
import {Select} from '@pepbits/ui';
import {usePreference} from '@pepbits/preferences/react';
export function PreferencesDemo(){const density=usePreference('density');return <Select label="Example density" value={density.value} disabled={density.locked} options={(['compact','comfortable','spacious'] as const).filter(value=>!density.allowedValues||density.allowedValues.includes(value)).map(value=>({value,label:value}))} onChange={event=>density.update({density:event.target.value as 'compact'|'comfortable'|'spacious'})}/>;}
