import React from 'react';
import {Button} from '@pepbits/ui';
import {useShell} from '@pepbits/shell';
import {usePreferences} from '@pepbits/preferences/react';
export function ShellDocumentationDemo(){const {setDocumentationOpen}=useShell(),{preferences}=usePreferences();return <div className="space-y-3"><p>The host supplies a fictional guide through an in-memory documentation request port. No documentation service is contacted.</p><Button disabled={!preferences.documentationEnabled} onClick={()=>setDocumentationOpen(true)}>Open fictional guide</Button></div>;}
