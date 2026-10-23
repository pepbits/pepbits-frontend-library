import React from 'react';
import {Button} from '@pepbits/ui';
import {useShell} from '@pepbits/shell';
export function ShellCommandDemo(){const {setCommandOpen}=useShell();return <div className="space-y-3"><p>Search every registered showcase page. Pointer and normal keyboard navigation remain available when custom shortcuts are off.</p><Button onClick={()=>setCommandOpen(true)}>Open command palette</Button></div>;}
