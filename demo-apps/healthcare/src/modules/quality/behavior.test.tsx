import React from 'react';
import {act,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {describe,expect,it,vi} from 'vitest';
import {PreferenceHost,usePreferences} from '@pepbits/preferences/react';
import {DEFAULT_PREFERENCES,type PreferencePolicy,type UserPreferences} from '@pepbits/preferences';
import {ReferenceQualityModule} from './module';
import {makeHost,chain,sessionHandler,json,type Handler} from './test-utils';
import {qualityHandler} from './test-fixtures';
import {createQualityClient} from './lib/api';
import {hrefFor,targetFromPath,qualityPages,product,healthcareProductForRole} from '../../navigation';
import {qualityNavigation} from './routes';
function Effective({host,path}:{host:ReturnType<typeof makeHost>['host'];path:string}){const {preferences}=usePreferences();return <ReferenceQualityModule host={{...host,preferences}} path={path}/>;}
describe('Quality host composition',()=>{
 it.each(qualityPages)('round trips $kind through the app route registry',page=>{const path='/quality'+(page.path==='/'?'':page.path.replace('[id]','7')),target=targetFromPath(path,'from=2026-01');expect(target.pageId).toBe(page.id);expect(hrefFor(target)).toBe(path+'?from=2026-01');});
 it('keeps twelve original sidebar items and limits module, administration and designer grants',()=>{
  const menu=product.modules['reference-quality']!;expect(menu.navigation.flatMap(g=>g.items)).toHaveLength(12);expect(qualityNavigation).toHaveLength(12);
  expect(healthcareProductForRole('quality-viewer').modules['reference-quality']).toBeTruthy();expect(healthcareProductForRole('operations').modules['reference-quality']).toBeUndefined();
  for(const path of ['/quality/nope','/quality/reports/7/extra','/quality/indicators/%2f','/quality/reports/%2e%2e'])expect(targetFromPath(path).pageId).toBe('not-found');
 });
 it('applies mounted tenant locks without discarding the Authority editor',async()=>{
  const h=makeHost(qualityHandler()),initial:Partial<UserPreferences>={density:'spacious'};
  const view=(policy:PreferencePolicy)=><PreferenceHost preferences={{...DEFAULT_PREFERENCES,...initial}} preferencePolicy={policy} update={vi.fn()}><Effective host={h.host} path="/authorities"/></PreferenceHost>;
  const {rerender}=render(view({revision:1,rules:{}}));const trigger=await screen.findByRole('button',{name:'Add authority'});trigger.focus();fireEvent.click(trigger);const dialog=await screen.findByRole('dialog');fireEvent.change(within(dialog).getByRole('textbox',{name:'Name'}),{target:{value:'Retained fictional authority'}});
  rerender(view({revision:2,rules:{density:{locked:true,value:'compact'},reducedMotion:{locked:true,value:true}}}));
  await waitFor(()=>expect(document.querySelector('[data-reference-module=quality]')).toHaveAttribute('data-density','compact'));expect(within(dialog).getByRole('textbox',{name:'Name'})).toHaveValue('Retained fictional authority');
  fireEvent.keyDown(window,{key:'Escape'});await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());expect(screen.getByRole('button',{name:'Add authority'})).toHaveFocus();
 });
 it('uses effective page size, table presentation and supported export controls after a mounted update',async()=>{
  const h=makeHost(qualityHandler(),{preferences:{pageSize:20}});const {rerender,container}=render(<ReferenceQualityModule path="/audit" host={h.host}/>);
  await waitFor(()=>expect(h.calls.some(c=>c.url.pathname==='/audit'&&c.url.searchParams.get('limit')==='20')).toBe(true));
  rerender(<ReferenceQualityModule path="/audit" host={{...h.host,preferences:{...h.host.preferences,pageSize:50,density:'compact',wrapCellText:true,stickyTableHeader:false,zebraStripes:false,exportFormat:'xlsx'}}}/>);
  await waitFor(()=>expect(h.calls.some(c=>c.url.pathname==='/audit'&&c.url.searchParams.get('limit')==='50')).toBe(true));
  const table=container.querySelector('table')!;expect(table).toHaveAttribute('data-density','compact');expect(table).toHaveAttribute('data-wrap','true');expect(table).toHaveAttribute('data-sticky','false');expect(table).toHaveAttribute('data-striped','false');expect(screen.getByRole('button',{name:/Export CSV/})).toBeDisabled();
 });
 it('retains replay identity after unknown outcomes but releases definitive failures',async()=>{
  const request=vi.fn().mockRejectedValueOnce(new TypeError('offline')).mockResolvedValueOnce({id:1}).mockRejectedValueOnce(Object.assign(new Error('invalid'),{status:422})).mockResolvedValueOnce({id:2}),api=createQualityClient({request}).api;
  await expect(api('/authorities',{body:{name:'Demo'}})).rejects.toMatchObject({status:0});await api('/authorities',{body:{name:'Demo'}});await expect(api('/authorities',{body:{name:'Demo'}})).rejects.toMatchObject({status:422});await api('/authorities',{body:{name:'Demo'}});
  const keys=request.mock.calls.map(([,init])=>new Headers(init.headers).get('Idempotency-Key'));expect(keys[0]).toBe(keys[1]);expect(keys[2]).not.toBe(keys[1]);expect(keys[3]).not.toBe(keys[2]);
 });
 it('aborts authentication when its mounted scope closes',async()=>{
  let signal:AbortSignal|null|undefined;const h=makeHost(r=>{signal=r.signal;return new Promise(()=>{});});const view=render(<ReferenceQualityModule path="/" host={h.host}/>);await waitFor(()=>expect(signal).toBeTruthy());view.unmount();expect(signal?.aborted).toBe(true);
 });
 it('denies restricted direct pages using server permissions without making their data request',async()=>{
  const h=makeHost(sessionHandler({permissions:[],user:{role:'viewer'}}));const view=render(<ReferenceQualityModule path="/users" host={h.host}/>);await screen.findByText('Only administrators can manage users and roles.');view.rerender(<ReferenceQualityModule path="/audit" host={h.host}/>);await screen.findByText('Your role does not allow this action (audit.view).');view.rerender(<ReferenceQualityModule path="/reports/designer" host={h.host}/>);await screen.findByText('Your role can view reports but not design them. Ask a quality manager for access.');expect(h.calls.some(c=>['/users','/audit','/reports/preview'].includes(c.url.pathname))).toBe(false);
 });
});
