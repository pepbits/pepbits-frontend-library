import React from 'react';
import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import {DocumentationArticle,DocumentationCenter,PageDocumentationNotice,useDocumentationRequest,type DocumentationGuide,type DocumentationChange} from './documentation';
import {DocumentationDrawer} from './layers';
import {useShell} from './shell-context';
import {ShellTestHost,port,session} from './test/host';
const releaseId='2026-10-23-example';
const guide:DocumentationGuide={pageId:'items',module:'operations',title:'Items guide',revision:1,status:'authored',language:'en',requestedLanguage:'en',reviewStatus:'reviewed',sections:[{id:'workflow',title:'Workflow',paragraphs:['Open a record.']}],fields:[{id:'name',label:'Name',type:'text',required:true,help:'Enter a name',rules:['Required']}],tour:[]};
const change:DocumentationChange={id:'change',revision:2,releaseId:'2026-10-22-previous',pageId:'items',sectionId:'workflow',category:'changed',title:'Changed behavior',summary:'Review the change',requiresAcknowledgment:true,readAt:null,dismissedAt:null,acknowledgedAt:null};
const index={releaseId,language:'en',pages:[guide],releases:[],changes:[change],unread:1,nextOffset:null,total:1};
const response=(body:unknown)=>Promise.resolve(new Response(JSON.stringify(body)));
test('article loads host content, release and language and retries a failed service',async()=>{
 const request=vi.fn().mockRejectedValueOnce(new Error('offline')).mockImplementation(()=>response({guide}));
 render(<ShellTestHost documentation={{request,releaseId}}><DocumentationArticle pageId="items"/></ShellTestHost>);
 expect(await screen.findByRole('alert')).toHaveTextContent('Could not load documentation.');fireEvent.click(screen.getByRole('button',{name:'Retry'}));expect(await screen.findByText('Open a record.')).toBeVisible();
 expect(request.mock.calls[1]![0]).toBe(`/documentation?releaseId=${releaseId}&language=en&pageId=items`);expect(new Headers(request.mock.calls[1]![1].headers).get('X-Product-Id')).toBe('example');
});
test('effective documentation disablement performs no transport and hides content',()=>{
 const request=vi.fn();render(<ShellTestHost documentation={{request,releaseId}} settings={{preferences:{documentationEnabled:true},preferencePolicy:{revision:1,rules:{documentationEnabled:{value:false,locked:true}}}}}><DocumentationArticle pageId="items"/><DocumentationCenter/><PageDocumentationNotice/></ShellTestHost>);
 expect(request).not.toHaveBeenCalled();expect(screen.queryByText('Documentation Center')).toBeNull();
});
test('request cache is session scoped and read-only offline fallback never masks HTTP rejection',async()=>{
 const request=vi.fn().mockImplementation(()=>response({guide}));let get!:ReturnType<typeof useDocumentationRequest>;
 function Probe(){get=useDocumentationRequest();return null;}
 const tree=(value=session)=><ShellTestHost session={value} documentation={{request,releaseId}}><Probe/></ShellTestHost>;
 const view=render(tree());await expect(get('/documentation')).resolves.toEqual({guide});
 request.mockRejectedValue(new Error('offline'));await expect(get('/documentation')).resolves.toMatchObject({offline:true,guide});
 await expect(get('/documentation',{method:'PUT'})).rejects.toThrow('offline');
 request.mockResolvedValue(new Response('{}',{status:403}));await expect(get('/documentation')).rejects.toThrow('Documentation request failed');
 request.mockRejectedValue(new Error('offline'));view.rerender(tree({...session,user:{...session.user!,id:'another'}}));await expect(get('/documentation')).rejects.toThrow('offline');
 expect(sessionStorage.length).toBe(0);
});
test('pending documentation cannot resolve into a changed session',async()=>{
 let resolve!:(value:Response)=>void;const request=vi.fn(()=>new Promise<Response>(done=>{resolve=done;}));let get!:ReturnType<typeof useDocumentationRequest>;
 function Probe(){get=useDocumentationRequest();return null;}
 const view=render(<ShellTestHost documentation={{request,releaseId}}><Probe/></ShellTestHost>);const pending=get('/documentation');
 view.rerender(<ShellTestHost session={{...session,status:'anonymous',user:null}} documentation={{request,releaseId}}><Probe/></ShellTestHost>);
 resolve(new Response(JSON.stringify({guide})));await expect(pending).rejects.toThrow('Documentation request failed');
});
test('aborted reads never fall back to cached content',async()=>{
 const request=vi.fn().mockImplementation(()=>response({guide}));let get!:ReturnType<typeof useDocumentationRequest>;
 function Probe(){get=useDocumentationRequest();return null;}render(<ShellTestHost documentation={{request,releaseId}}><Probe/></ShellTestHost>);await get('/documentation');
 const controller=new AbortController();controller.abort();await expect(get('/documentation',{signal:controller.signal})).rejects.toThrow('Documentation unavailable');expect(request).toHaveBeenCalledTimes(1);
});
test('drawer uses host center target and preference placement',async()=>{
 const open=vi.fn(),request=vi.fn(()=>response({guide}));function Open(){const shell=useShell();return <button onClick={()=>shell.setDocumentationOpen(true)}>Read docs</button>;}
 render(<ShellTestHost documentation={{request,releaseId,centerPageId:'guides'}} navigation={{...port,open}} settings={{preferences:{docsPosition:'left'}}}><Open/><DocumentationDrawer/></ShellTestHost>);
 fireEvent.click(screen.getByRole('button',{name:'Read docs'}));expect(await screen.findByText('Items guide')).toBeVisible();expect(screen.getByRole('dialog').querySelector('aside')).toHaveClass('left-0');
 fireEvent.click(screen.getByRole('button',{name:'Documentation Center'}));expect(open).toHaveBeenCalledWith({pageId:'guides'});expect(screen.queryByRole('dialog')).toBeNull();
});
test('center keeps guide navigation and records acknowledgment against the selected change release',async()=>{
 const request=vi.fn((path:string)=>response(path==='/documentation/state'?{}:path.includes('pageId=')?{guide}:index));
 render(<ShellTestHost documentation={{request,releaseId}}><DocumentationCenter/></ShellTestHost>);
 fireEvent.click(await screen.findByRole('button',{name:'Items guide'}));expect(await screen.findByText('Open a record.')).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:"What's new"}));fireEvent.click(screen.getByRole('button',{name:'I understand'}));
 await waitFor(()=>expect(request).toHaveBeenCalledWith('/documentation/state',expect.objectContaining({method:'PUT',body:JSON.stringify({releaseId:change.releaseId,changeId:'change',revision:2,action:'acknowledge'})})));
});
test('host-selected notices open their requested section and report a failed reading update',async()=>{
 const request=vi.fn((path:string)=>path==='/documentation/state'?Promise.reject(new Error('failed')):response(path.includes('pageId=')?{guide}:index));
 render(<ShellTestHost documentation={{request,releaseId,noticePageIds:['items']}}><PageDocumentationNotice/><DocumentationDrawer/></ShellTestHost>);
 fireEvent.click(await screen.findByRole('button',{name:'Read explanation'}));expect(await screen.findByRole('dialog')).toBeVisible();expect(await screen.findByText('Could not save reading status.')).toBeVisible();expect(request.mock.calls.some(([path])=>path.includes(`releaseId=${change.releaseId}`))).toBe(true);
});
