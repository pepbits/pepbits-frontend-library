import React from 'react';
import {fireEvent,screen,waitFor,within} from '@testing-library/react';
import {expect,it} from 'vitest';
import {render} from './render-test';
import {ReferenceRcmModule} from './module';
import {makeHost,sessionHandler} from './test-utils';
it('keeps an unsaved editor mounted while accepted presentation and shortcut preferences change',async()=>{
 const h=makeHost(sessionHandler());const view=render(<ReferenceRcmModule path="/w/coverages?new=1" host={h.host}/>);
 const dialog=await screen.findByRole('dialog',{name:'New coverage'}),member=within(dialog).getByLabelText(/Member ID/);fireEvent.change(member,{target:{value:'keep-me'}});
 view.rerender(<ReferenceRcmModule path="/w/coverages?new=1" host={{...h.host,preferences:{...h.host.preferences,language:'ar',density:'compact',pageSize:50,keyboardShortcuts:false,wrapCellText:true,zebraStripes:true,stickyTableHeader:false}}}/>);
 expect(member).toHaveValue('KEEP-ME');expect(document.querySelector('.reference-rcm')).toHaveAttribute('data-density','compact');
 await waitFor(()=>expect(h.calls.some(c=>c.url.pathname==='/records/coverages'&&c.url.searchParams.get('pageSize')==='50')).toBe(true));
 const table=document.querySelector('table');expect(table).toHaveAttribute('data-density','compact');expect(table).toHaveAttribute('data-wrap','true');expect(table).toHaveAttribute('data-striped','true');expect(table).toHaveAttribute('data-sticky','false');
 fireEvent.keyDown(window,{key:'k',ctrlKey:true});expect(screen.queryByRole('dialog',{name:'Jump to a page',hidden:true})).toBeNull();
});
it('restores source page size when a mounted host policy changes and keeps operational scope separate',async()=>{
 const h=makeHost(sessionHandler());const view=render(<ReferenceRcmModule path="/w/invoices" host={{...h.host,preferences:{...h.host.preferences,pageSize:100}}}/>);
 await waitFor(()=>expect(h.calls.some(c=>c.url.searchParams.get('pageSize')==='100')).toBe(true));
 view.rerender(<ReferenceRcmModule path="/w/invoices" host={{...h.host,preferences:{...h.host.preferences,pageSize:10,density:'compact'}}}/>);
 await waitFor(()=>expect(h.calls.some(c=>c.url.searchParams.get('pageSize')==='10')).toBe(true));
 expect(h.calls.filter(c=>c.url.pathname==='/records/invoices').every(c=>c.headers.get('x-rcm-scope')==='ALL:SAR')).toBe(true);
});
