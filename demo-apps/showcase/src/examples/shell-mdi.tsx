import React from 'react';
import {Toggle} from '@pepbits/ui';
import {usePreference} from '@pepbits/preferences/react';
export function ShellMdiDemo(){const preference=usePreference('floatingWindows');return <div className="space-y-3"><p>Open another page, then arrange the shell’s MDI frames. Minimize, restore, maximize and drag using the library window controls. This is browser geometry, not a native executable.</p><Toggle label="Floating workspace windows" checked={preference.value} disabled={preference.locked||!!preference.allowedValues&&!preference.allowedValues.includes(!preference.value)} onChange={value=>preference.update({floatingWindows:value})}/></div>;}
