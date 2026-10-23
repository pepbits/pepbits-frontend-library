import {ShellTestHost} from "../test/host";
import React from 'react';
import {render as renderUI,screen,fireEvent,waitFor} from '@testing-library/react';
import {test,expect,vi} from 'vitest';
import {PreferencePageProvider,usePreferenceRequest} from './services';
const session=vi.hoisted(()=>({token:'one'}));
vi.mock('@pepbits/platform',async importOriginal=>({...await importOriginal<typeof import('@pepbits/platform')>(),readToken:()=>session.token,authedFetch:vi.fn()}));
function render(ui:React.ReactNode){return renderUI(ui,{wrapper:ShellTestHost});}
function Probe(){
 const request=usePreferenceRequest();const [status,setStatus]=React.useState('idle');
 return <><button onClick={()=>void request('/worklists/search',{method:'POST',body:'{}'}).then(()=>setStatus('done')).catch(()=>setStatus('ended'))}>Search</button><span>{status}</span></>;
}
test('a product replaces transport and an old session cannot make another request',async()=>{
 session.token='one';const request=vi.fn().mockResolvedValue(new Response('{}'));
 render(<PreferencePageProvider services={{request}}><Probe /></PreferencePageProvider>);
 fireEvent.click(screen.getByText('Search'));await waitFor(()=>expect(screen.getByText('done')).toBeVisible());
 expect(request).toHaveBeenCalledWith('/worklists/search',expect.objectContaining({method:'POST',body:'{}',signal:expect.any(AbortSignal)}));
 session.token='two';fireEvent.click(screen.getByText('Search'));await waitFor(()=>expect(screen.getByText('ended')).toBeVisible());
 expect(request).toHaveBeenCalledTimes(1);
});

test('localizes an API error descriptor while preserving HTTP status and diagnostics',async()=>{
 session.token='one';
 const request=vi.fn().mockResolvedValue(new Response(JSON.stringify({error:'English fallback',errorMessage:{messageKey:'test.error',messageValues:{record:'REC-001'}},detail:'Trace X-19'}),{status:409,headers:{'Content-Type':'application/json','ETag':'"v2"'}}));
 const {LocalizationProvider}=await import('@pepbits/i18n/react');
 function ErrorProbe(){const send=usePreferenceRequest();const [result,setResult]=React.useState('');return <button onClick={()=>void send('/records').then(async response=>{const body=await response.json();setResult(`${response.status}|${response.headers.get('ETag')}|${body.error}|${body.detail}`);})}>{result||'Send error'}</button>}
 render(<LocalizationProvider value={{language:'ar',direction:'rtl',dateTime:String,t:(key,values)=>key==='test.error'?`تعارض ${values?.record}`:key}}><PreferencePageProvider services={{request}}><ErrorProbe/></PreferencePageProvider></LocalizationProvider>);
 fireEvent.click(screen.getByText('Send error'));await waitFor(()=>expect(screen.getByText('409|"v2"|تعارض REC-001|Trace X-19')).toBeVisible());
});
