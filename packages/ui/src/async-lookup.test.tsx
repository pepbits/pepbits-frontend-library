import React from 'react';
import {render,screen,fireEvent,waitFor,act} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import {AsyncLookup} from './async-lookup';
const row={id:'1',name:'Fictional product'};
const props={label:'Product search',getKey:(r:typeof row)=>r.id,renderOption:(r:typeof row)=>r.name,debounceMs:0,onPick:vi.fn()};
it('aborts obsolete queries and discards replies that arrive after the newer result',async()=>{
 const pending:{signal:AbortSignal;resolve:(rows:typeof row[])=>void}[]=[];
 const load=vi.fn((_query:string,signal:AbortSignal)=>new Promise<typeof row[]>(resolve=>pending.push({signal,resolve})));
 render(<AsyncLookup {...props} loadOptions={load}/>);const input=screen.getByRole('combobox');
 fireEvent.change(input,{target:{value:'old'}});await waitFor(()=>expect(load).toHaveBeenCalledTimes(1));
 fireEvent.change(input,{target:{value:'new'}});await waitFor(()=>expect(load).toHaveBeenCalledTimes(2));expect(pending[0]!.signal.aborted).toBe(true);
 await act(async()=>{pending[1]!.resolve([row]);pending[0]!.resolve([{id:'old',name:'Old reply'}]);});
 expect(await screen.findByRole('option',{name:'Fictional product'})).toBeInTheDocument();expect(screen.queryByText('Old reply')).toBeNull();
});
it('names the popup, supports keyboard choice and resets the query after selection',async()=>{
 const pick=vi.fn(),load=vi.fn(async()=>[row,{id:'2',name:'Second product'}]);render(<AsyncLookup {...props} onPick={pick} loadOptions={load}/>);
 const input=screen.getByRole('combobox');fireEvent.change(input,{target:{value:'pro'}});await screen.findByRole('listbox',{name:'Product search'});
 fireEvent.keyDown(input,{key:'ArrowDown'});expect(input.getAttribute('aria-activedescendant')).toBe(screen.getByRole('option',{name:'Second product'}).id);
 fireEvent.keyDown(input,{key:'Enter'});expect(pick).toHaveBeenCalledWith({id:'2',name:'Second product'});expect(input).toHaveValue('');expect(input).toHaveAttribute('aria-expanded','false');
});
it('keeps failed query input, reports failure and recovers on a new query',async()=>{
 const load=vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue([row]);render(<AsyncLookup {...props} loadOptions={load}/>);
 const input=screen.getByRole('combobox');fireEvent.change(input,{target:{value:'failed'}});await screen.findByRole('status');expect(input).toHaveValue('failed');
 fireEvent.change(input,{target:{value:'retry'}});await screen.findByRole('option');expect(screen.queryByRole('status')).toBeNull();
});
it('does not query short values, isolates Escape and aborts requests on unmount',async()=>{
 const outer=vi.fn(),load=vi.fn(async(_q:string,signal:AbortSignal)=>{expect(signal.aborted).toBe(false);return [row];});
 const view=render(<div onKeyDown={outer}><AsyncLookup {...props} minChars={2} loadOptions={load}/></div>);
 const input=screen.getByRole('combobox');fireEvent.change(input,{target:{value:'a'}});expect(load).not.toHaveBeenCalled();
 fireEvent.change(input,{target:{value:'ab'}});await screen.findByRole('option');fireEvent.keyDown(input,{key:'Escape'});expect(outer).not.toHaveBeenCalled();expect(screen.queryByRole('listbox')).toBeNull();
 view.unmount();expect(load.mock.calls[0]![1].aborted).toBe(true);
});

it('applies field identity/invalid state and cancels reads when a mounted field becomes disabled',async()=>{
 const load=vi.fn(async(_q:string,_signal:AbortSignal)=>[row]);const view=render(<AsyncLookup {...props} id="reference" invalid loadOptions={load}/>);
 const input=screen.getByRole('combobox');expect(input).toHaveAttribute('id','reference');expect(input).toHaveAttribute('aria-invalid','true');
 fireEvent.change(input,{target:{value:'reference'}});await screen.findByRole('option');
 view.rerender(<AsyncLookup {...props} id="reference" disabled loadOptions={load}/>);expect(input).toBeDisabled();expect(screen.queryByRole('listbox')).toBeNull();expect(load.mock.calls[0]![1].aborted).toBe(true);
});
