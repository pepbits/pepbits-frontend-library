import React,{createContext,useContext} from 'react';
import {act,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import type {Request} from '@pepbits/platform/http';
import {ApplicationProviders} from './application-providers';
import {useERP,type CommandSearch} from './shell-context';
import {product,port,session} from './test/host';
import {messages} from './test/messages';
import {preferenceMessages} from './test/preference-messages';
const catalogs={...messages,...preferenceMessages};
const request=vi.fn<Request>(async(path)=>{
 if(path.startsWith('/localization'))return Response.json({messages:catalogs,fallbackMessages:catalogs});
 if(path==='/preferences')return Response.json({preferences:{},overrides:{},policy:{revision:1,rules:{}},userRevision:1,canManage:false});
 throw new Error('Unexpected request '+path);
});
const navigation={...port,open:vi.fn()};
const Live=createContext('none');
function Inbox(){return <output aria-label="Live inbox">{useContext(Live)}</output>;}
function Page(){const {setCommandOpen}=useERP();return <><p>{useContext(Live)} page</p><button onClick={()=>setCommandOpen(true)}>Open palette</button></>;}
function tree(chrome?:React.ComponentProps<typeof ApplicationProviders>['chrome']){return <ApplicationProviders productId="example" brand={{name:'Example',tagline:'Fictional'}} productForRole={()=>product} apiBaseUrl="/api" navigation={navigation} request={request} session={session} chrome={chrome}><Page/></ApplicationProviders>;}

test('omitted chrome keeps the plain shell; supplied inbox and surface share one host state above header and page',async()=>{
 const plain=render(tree());await screen.findByText('none page');expect(screen.queryByLabelText('Live inbox')).toBeNull();plain.unmount();
 render(tree({inbox:<Inbox/>,surface:frame=><Live.Provider value="connected">{frame}</Live.Provider>}));
 await screen.findByText('connected page');expect(screen.getByLabelText('Live inbox')).toHaveTextContent('connected');
 expect(screen.getByRole('banner')).toContainElement(screen.getByLabelText('Live inbox'));
});

test('host command search is debounced, grouped, aborts superseded queries and opens the chosen target',async()=>{
 const search=vi.fn<CommandSearch>(async(query)=>{return [{id:'p1',group:'Patients',label:'Fictional '+query,hint:'CG-1',target:{pageId:'items',query:'id=1'} as never}];});
 render(tree({commandSearch:search}));
 fireEvent.click(await screen.findByRole('button',{name:'Open palette'}));
 const input=await screen.findByRole('textbox');
 fireEvent.change(input,{target:{value:'Fi'}});fireEvent.change(input,{target:{value:'Fic'}});
 const group=await screen.findByRole('group',{name:'Patients'});
 expect(search).toHaveBeenCalledTimes(1);expect(search).toHaveBeenCalledWith('Fic',expect.any(AbortSignal));
 fireEvent.click(group.querySelector('button')!);
 await waitFor(()=>expect(navigation.open).toHaveBeenCalledWith({pageId:'items',query:'id=1'}));
});

test('failed or empty host searches leave page matches available',async()=>{
 const search=vi.fn<CommandSearch>(async()=>{throw new Error('offline');});
 render(tree({commandSearch:search}));
 fireEvent.click(await screen.findByRole('button',{name:'Open palette'}));
 fireEvent.change(await screen.findByRole('textbox'),{target:{value:'Ite'}});
 await waitFor(()=>expect(search).toHaveBeenCalled());
 await act(async()=>{await new Promise(resolve=>setTimeout(resolve,20));});
 expect(screen.queryByRole('group')).toBeNull();expect(within(screen.getByRole('dialog')).getByRole('button',{name:/Items/})).toBeInTheDocument();
});
