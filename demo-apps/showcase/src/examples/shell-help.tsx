import React from 'react';
import {Button} from '@pepbits/ui';
import {useShell} from '@pepbits/shell';
import {usePreferences} from '@pepbits/preferences/react';
export function ShellHelpDemo(){const {setHelpOpen}=useShell(),{preferences}=usePreferences();return <div className="space-y-3"><p>Open Help, choose Tour, and press Play. Two host-authored steps identify the gallery heading and example search. Scrolling honors reduced motion.</p><Button disabled={!preferences.helperEnabled} onClick={()=>setHelpOpen(true)}>Open help and tours</Button></div>;}
