import {render,TestHost} from '../test';
import React from 'react';import {test,expect,vi} from 'vitest';import {screen,fireEvent,waitFor} from '@testing-library/react';import {type DesignerView} from '@pepbits/data/dcp-designer';import {DcpDesignerWorkspace} from './workspace';
const initial={title:'Example',sections:[{id:'s',title:'Details',fields:[{id:'f',label:'Name',type:'text' as const,required:true}]}]};const view:DesignerView={initial,canDesign:true,types:['text','number'],records:[],record:null};
test('visual edits reuse stable IDs; failed save retains edits and reuses operation on retry',async()=>{const command=vi.fn().mockResolvedValueOnce(view).mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce({...view,record:{id:'r',revision:1,updatedAt:'2026-09-11T12:00:00Z',definition:{...initial,title:'Updated'}}});render(<DcpDesignerWorkspace scopeKey="a" adapter={{command}}/>);const title=await screen.findByLabelText('Form title');fireEvent.change(title,{target:{value:'Updated'}});fireEvent.click(screen.getByRole('button',{name:'Save design draft'}));await screen.findByRole('button',{name:'Retry'});expect(title).toHaveValue('Updated');fireEvent.click(screen.getByRole('button',{name:'Retry'}));await waitFor(()=>expect(command).toHaveBeenCalledTimes(3));await waitFor(()=>{expect(command.mock.calls[1]![0]!).toEqual(command.mock.calls[2]![0]!);});await waitFor(()=>{expect(command.mock.calls[1]![0]!.definition.sections[0]!.fields[0]!.id).toBe('f');});});
test('read-only role disables design mutations and tenant density overrides local preference',async()=>{const {container}=render(<TestHost preferences={{density:'spacious'}} preferencePolicy={{revision:1,rules:{density:{locked:true,value:'compact'}}}}><DcpDesignerWorkspace scopeKey="b" adapter={{command:async()=>({...view,canDesign:false})}}/></TestHost>);expect(await screen.findByLabelText('Form title')).toBeDisabled();expect(container.querySelector('[data-designer]')).toHaveAttribute('data-density','compact');expect(screen.getByRole('button',{name:'Add section'})).toBeDisabled();});

test('preview uses unsaved design, hides authoring, validates and resets test answers without saving',async()=>{
 const command=vi.fn().mockResolvedValue(view);
 render(<DcpDesignerWorkspace scopeKey="preview" adapter={{command}}/>);
 fireEvent.change(await screen.findByLabelText('Form title'),{target:{value:'My draft form'}});
 fireEvent.click(screen.getByRole('button',{name:'Live preview'}));
 expect(screen.getByRole('heading',{name:'My draft form'})).toHaveFocus();
 expect(screen.queryByLabelText('Form title')).not.toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'Save design draft'})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Validate preview'}));
 expect(screen.getByLabelText(/Name/)).toHaveAttribute('aria-invalid','true');
 fireEvent.change(screen.getByLabelText(/Name/),{target:{value:'Synthetic answer'}});
 fireEvent.click(screen.getByRole('button',{name:'Design'}));
 expect(screen.getByLabelText('Form title')).toHaveValue('My draft form');
 fireEvent.click(screen.getByRole('button',{name:'Live preview'}));
 expect(screen.getByLabelText(/Name/)).toHaveValue('Synthetic answer');
 fireEvent.click(screen.getByRole('button',{name:'Reset preview'}));
 expect(screen.getByLabelText(/Name/)).toHaveValue('');
 await waitFor(()=>expect(command).toHaveBeenCalledTimes(1));
});
