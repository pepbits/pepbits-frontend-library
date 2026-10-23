import React from 'react';
import {Button} from '@pepbits/ui';
import {useScreenHost} from '@pepbits/patterns/screen-host';
export function ShellToastsDemo(){const host=useScreenHost();return <div className="space-y-3"><p>The document’s ScreenHost sends notifications to the shell’s single toast viewport. Duration and visible count follow effective preferences.</p><Button onClick={()=>host.notify('Fictional change saved',{tone:'success'})}>Show success toast</Button></div>;}
