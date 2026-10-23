import {render,TestHost} from '../test';
import React from 'react';
import {test,expect,vi} from 'vitest';
import {screen,fireEvent,waitFor} from '@testing-library/react';
import type {DesignerCatalog,DesignerView,DesignerCommand} from '@pepbits/data/dcp-designer';
import {CatalogManager} from './catalog-manager';
const catalog:DesignerCatalog={sets:[],relationships:[]};
const view:DesignerView={initial:{title:'Form',sections:[{id:'s',title:'Section',fields:[]}]},canDesign:true,records:[],record:null,types:['select'],catalog};
test('catalog save failure preserves edits and retries the identical revision command',async()=>{
 const command=vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(view),update=vi.fn();
 render(<CatalogManager open close={()=>{}} catalog={catalog} canDesign adapter={{command}} update={update}/>);
 fireEvent.change(screen.getByLabelText('Catalog name'),{target:{value:'Teams'}});fireEvent.change(screen.getByLabelText('Options: one value|label per line'),{target:{value:'001|Accounts\n002|Sales'}});
 fireEvent.click(screen.getByRole('button',{name:'Save new revision'}));fireEvent.click(await screen.findByRole('button',{name:'Retry'}));
 await waitFor(()=>expect(update).toHaveBeenCalledOnce());await waitFor(()=>{expect(command.mock.calls[0]![0]!).toEqual(command.mock.calls[1]![0]!);});await waitFor(()=>{expect(command.mock.calls[0]![0]!.catalogSet.options[0]!.value).toBe('001');});
});
test('catalog dismissal asks before discarding edits and a read-only user cannot change sets',async()=>{
 const close=vi.fn();const {rerender}=render(<CatalogManager open close={close} catalog={catalog} canDesign adapter={{command:async()=>view}} update={()=>{}}/>);
 fireEvent.change(screen.getByLabelText('Catalog name'),{target:{value:'Unfinished'}});fireEvent.click(screen.getByRole('button',{name:'Close catalog'}));expect(close).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Keep editing'}));expect(screen.getByLabelText('Catalog name')).toHaveValue('Unfinished');
 rerender(<CatalogManager open close={close} catalog={catalog} canDesign={false} adapter={{command:async()=>view}} update={()=>{}}/>);expect(screen.getByLabelText('Catalog name')).toBeDisabled();expect(screen.getByRole('button',{name:'Save new revision'})).toBeDisabled();
});
test('refreshing catalog preserves unsaved editor values',async()=>{
 const update=vi.fn(),command=vi.fn(async()=>view);
 render(<CatalogManager open close={()=>{}} catalog={catalog} canDesign adapter={{command}} update={update}/>);
 fireEvent.change(screen.getByLabelText('Catalog name'),{target:{value:'Unsaved teams'}});fireEvent.click(screen.getByRole('button',{name:'Refresh catalog'}));
 await waitFor(()=>expect(update).toHaveBeenCalledWith(catalog));expect(screen.getByLabelText('Catalog name')).toHaveValue('Unsaved teams');await waitFor(()=>{expect(command).toHaveBeenCalledWith({action:'load'});});
});
test('CSV staging blocks saving until complete review and preserves text IDs in the API command',async()=>{
 const command=vi.fn(async(_input:DesignerCommand)=>view);render(<CatalogManager open close={()=>{}} catalog={catalog} canDesign adapter={{command}} update={()=>{}}/>);
 fireEvent.change(screen.getByLabelText('Catalog name'),{target:{value:'CSV teams'}});
 const file={name:'teams.csv',size:40,arrayBuffer:async()=>new TextEncoder().encode('code,name\n001,Accounts\n002,Sales').buffer};
 fireEvent.change(screen.getByLabelText('Import CSV / XLSX options',{selector:'input'}),{target:{files:[file]}});
 await screen.findByLabelText('ID column');expect(screen.getByRole('button',{name:'Save new revision'})).toBeDisabled();
 fireEvent.change(screen.getByLabelText('ID column'),{target:{value:'0'}});fireEvent.change(screen.getByLabelText('Label column'),{target:{value:'1'}});
 fireEvent.click(screen.getByRole('button',{name:'Replace editor with reviewed rows'}));await waitFor(()=>expect(command).not.toHaveBeenCalled());
 fireEvent.click(screen.getByRole('button',{name:'Save new revision'}));await waitFor(()=>expect(command).toHaveBeenCalledOnce());await waitFor(()=>{expect(command.mock.calls[0]![0]!.catalogSet?.options).toEqual([{value:'001',label:'Accounts'},{value:'002',label:'Sales'}]);});
});
