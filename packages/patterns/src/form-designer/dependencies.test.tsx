import {render,TestHost} from '../test';
import React from 'react';
import {test,expect,vi} from 'vitest';
import {screen,fireEvent,waitFor,act} from '@testing-library/react';
import {designerOptions,changeDesignerValue,type DesignerDefinition,type DesignerView} from '@pepbits/data/dcp-designer';
import {DcpDesignerWorkspace} from './workspace';
const definition:DesignerDefinition={title:'Locations',sections:[{id:'s',title:'Location',fields:[
{id:'country',type:'select',label:'Country',options:[{value:'IN',label:'India'},{value:'AE',label:'UAE'}]},
{id:'state',type:'select',label:'State',dependsOn:'country',options:[{value:'KL',label:'Kerala',parentValue:'IN'},{value:'AZ',label:'Abu Dhabi',parentValue:'AE'}]},
{id:'city',type:'select',label:'City',dependsOn:'state',options:[{value:'01',label:'Kochi',parentValue:'KL'}]}
]}]};
const view:DesignerView={initial:definition,canDesign:true,types:['select'],records:[],record:null};
test('parent change clears all descendants and late API responses cannot restore old options',async()=>{
 const pending:Record<string,(v:DesignerView)=>void>={};
 const command=vi.fn(async(input)=>input.action==='options'&&input.fieldId==='state'?new Promise<DesignerView>(resolve=>{pending[String(input.values.country)]=resolve;}):input.action==='options'?{...view,lookup:designerOptions(definition,input.fieldId,input.values)}:view);
 render(<DcpDesignerWorkspace scopeKey="cascade" adapter={{command}}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Live preview'}));
 await waitFor(()=>expect(screen.getByLabelText('Country')).not.toBeDisabled());
 expect(screen.getByLabelText('State')).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Country'),{target:{value:'IN'}});await waitFor(()=>expect(pending.IN).toBeDefined());
 fireEvent.change(screen.getByLabelText('Country'),{target:{value:'AE'}});await waitFor(()=>expect(pending.AE).toBeDefined());
 await act(async()=>pending.AE!({...view,lookup:designerOptions(definition,'state',{country:'AE'})}));
 expect(screen.getByRole('option',{name:'Abu Dhabi'})).toBeInTheDocument();
 await act(async()=>pending.IN!({...view,lookup:designerOptions(definition,'state',{country:'IN'})}));
 expect(screen.queryByRole('option',{name:'Kerala'})).not.toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('State'),{target:{value:'AZ'}});
 fireEvent.change(screen.getByLabelText('Country'),{target:{value:'IN'}});
 expect(screen.getByLabelText('State')).toHaveValue('');expect(screen.getByLabelText('State')).toBeDisabled();
 expect(changeDesignerValue(definition,{country:'IN',state:'KL',city:'01'},'country','AE')).toEqual({country:'AE'});
 await act(async()=>{await Promise.resolve();pending.IN!({...view,lookup:designerOptions(definition,'state',{country:'IN'})});});
 await waitFor(()=>expect(screen.getByLabelText('State')).not.toBeDisabled());
});
test('lookup failure retains the parent and retry reloads the options',async()=>{
 let failed=false;
 const command=vi.fn(async input=>{if(input.action==='options'){if(input.fieldId==='state'&&!failed){failed=true;throw new TypeError('Failed to fetch');}return {...view,lookup:designerOptions(definition,input.fieldId,input.values)};}return view;});
 render(<DcpDesignerWorkspace scopeKey="retry" adapter={{command}}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Live preview'}));await waitFor(()=>expect(screen.getByLabelText('Country')).not.toBeDisabled());
 fireEvent.change(screen.getByLabelText('Country'),{target:{value:'IN'}});
 fireEvent.click(await screen.findByRole('button',{name:'Retry'}));
 await waitFor(()=>expect(screen.getByLabelText('State')).not.toBeDisabled());
 expect(screen.getByLabelText('Country')).toHaveValue('IN');expect(screen.getByRole('option',{name:'Kerala'})).toBeInTheDocument();
});

test('inserting an API example remaps every dependency to fresh IDs',async()=>{
 const command=vi.fn(async(_input:unknown)=>({...view,examples:[definition]}));
 render(<DcpDesignerWorkspace scopeKey="example" adapter={{command}}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Locations'}));
 fireEvent.click(screen.getByRole('button',{name:'Save design draft'}));
 await waitFor(()=>expect(command).toHaveBeenCalledTimes(2));
 const input=(command.mock.calls[1]! as unknown as [{definition:DesignerDefinition}])[0]!;
 const fields=input.definition.sections[1]!.fields;
 expect(fields[0]!.id).not.toBe('country');expect(fields[1]!.dependsOn).toBe(fields[0]!.id);expect(fields[2]!.dependsOn).toBe(fields[1]!.id);
});
