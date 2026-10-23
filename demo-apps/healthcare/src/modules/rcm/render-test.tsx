import React,{useState} from 'react';
import {render as rtl,type RenderOptions} from '@testing-library/react';
import {ScreenHostProvider} from '@pepbits/patterns/screen-host';
/** Minimal notification host for the original command tests. Runtime uses EnterpriseShell. */
function Host({children}:{children:React.ReactNode}) {const [notices,setNotices]=useState<string[]>([]);return <ScreenHostProvider value={{notify:message=>setNotices(rows=>[...rows,message])}}>{children}<div aria-live="polite">{notices.map((message,index)=><div key={index}>{message.split(' — ').map((part,index)=><span key={index}>{part}</span>)}</div>)}</div></ScreenHostProvider>;}
export function render(ui:React.ReactElement,options?:RenderOptions){return rtl(ui,{...options,wrapper:Host});}
