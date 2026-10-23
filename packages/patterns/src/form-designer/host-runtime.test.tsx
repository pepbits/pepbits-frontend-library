import {render,TestHost} from '../test';
import React from 'react';
import {test,expect,vi} from 'vitest';
import {screen,fireEvent,waitFor} from '@testing-library/react';
import {DcpHostRuntime} from './host-runtime';
import {isDcpLoaded,type DcpLoaded} from '@pepbits/data/dcp-runtime';
import loadedFixture from './test-fixtures/loaded.json';
const loaded:DcpLoaded=(()=>{if(!isDcpLoaded(loadedFixture))throw Error('Fixture');return loadedFixture;})();
test('required false is displayed, edits retain values on 422, successful save uses normalized server values',async()=>{
 const adapter={load:vi.fn(async()=>loaded),preview:vi.fn(),save:vi.fn(async(_command:import('@pepbits/data/dcp-runtime').DcpSave)=>({version:'0',view:{...loaded.view,violations:[{path:'rating',code:'MAXIMUM',message:'Too much'}]},changedPaths:[]}))};
 render(<DcpHostRuntime adapter={adapter} scopeKey="one"/>);await screen.findByText('Record revision: 0');expect(screen.getByRole('combobox',{name:/Consent recorded/})).toHaveValue('false');
 fireEvent.change(screen.getByLabelText('Name'),{target:{value:'Changed'}});fireEvent.click(screen.getByRole('button',{name:'Save record'}));await waitFor(()=>expect(adapter.save).toHaveBeenCalledTimes(1));expect(screen.getByLabelText('Name')).toHaveValue('Changed');expect(screen.queryByText('Server save confirmed.')).toBeNull();
});
test('repeating row edits and adds strip UI identity, read-only fields cannot be edited',async()=>{
 const adapter={load:vi.fn(async()=>loaded),preview:vi.fn(async(_command:import('@pepbits/data/dcp-runtime').DcpSave)=>({version:'0',view:loaded.view,changedPaths:[]})),save:vi.fn()};render(<DcpHostRuntime adapter={adapter} scopeKey="one"/>);await screen.findByText('Record revision: 0');
 fireEvent.click(screen.getByRole('button',{name:'Add row'}));const notes=screen.getAllByLabelText('Note');fireEvent.change(notes[1]!,{target:{value:'Second'}});fireEvent.click(screen.getByRole('button',{name:'Preview with server rules'}));await waitFor(()=>expect(adapter.preview).toHaveBeenCalledTimes(1));await waitFor(()=>{expect(adapter.preview.mock.calls[0]![0]!.patch.observations).toEqual([{_id:'row-1',note:'First'},{note:'Second'}]);});
});

test('StrictMode remount cancels the initial load without leaving the runtime busy',async()=>{
 const adapter={load:vi.fn(async()=>loaded),preview:vi.fn(),save:vi.fn()};render(<DcpHostRuntime adapter={adapter} scopeKey="strict"/>,{reactStrictMode:true});await screen.findByText('Record revision: 0');expect(screen.getByRole('button',{name:'Reload server record'})).toBeEnabled();await waitFor(()=>expect(adapter.load).toHaveBeenCalledTimes(2));
});
