import React,{useState} from 'react';
import {test,expect,vi} from 'vitest';
import {screen,fireEvent} from '@testing-library/react';
import {render,TestHost} from '../test/render';
import type {FormNavigation} from '@pepbits/preferences';
import {RecordForm,RecordSectionCard} from './index';
const sections=[{id:'first',title:'First'},{id:'last',title:'Last'}];
const progress={first:{state:'in-progress' as const,requiredDone:1,requiredTotal:2,errorCount:0,optional:false},last:{state:'error' as const,requiredDone:0,requiredTotal:1,errorCount:1,optional:false}};
test('all five effective arrangements retain the exact mounted input; view hides writes and locks override personal layout',()=>{
 const save=vi.fn();
 function Host(){const [layout,setLayout]=useState<FormNavigation>('tabs'),[active,setActive]=useState('first'),[view,setView]=useState(false),[lock,setLock]=useState(false);
 return <><button onClick={()=>setView(true)}>Read only</button><button onClick={()=>setLock(true)}>Manage</button>{(['scroll','tabs','wizard','stepper','accordion'] as const).map(value=><button key={value} onClick={()=>setLayout(value)}>{value}</button>)}<TestHost preferences={{formNavigation:layout,formColumns:4,formValidateOn:'change',formKeepUnsaved:false,formShowSummary:false}} preferencePolicy={lock?{revision:1,rules:{formNavigation:{value:'stepper',locked:true}}}:undefined}><RecordForm mode={view?'view':'edit'} values={{}} sections={sections} active={active} onActive={setActive} progress={progress} onSave={save} summary="Hidden summary" renderSection={(section,ctx)=><RecordSectionCard id={section.id} title={section.title} index={0} progress={progress[section.id as keyof typeof progress]}><input aria-label={section.id} defaultValue="" readOnly={ctx.readOnly}/><span>{`${ctx.columns}/${ctx.validateOn}/${ctx.keepUnsaved}`}</span></RecordSectionCard>}/></TestHost></>;}
 const {container}=render(<Host/>);const input=screen.getByLabelText('first');expect(screen.getByRole('heading',{name:'First',level:2})).toBeVisible();fireEvent.change(input,{target:{value:'Keep this'}});
 for(const layout of ['scroll','wizard','stepper','accordion','tabs']){fireEvent.click(screen.getByRole('button',{name:layout}));expect(container.querySelector('[data-layout]')).toHaveAttribute('data-layout',layout);expect(screen.getByLabelText('first')).toBe(input);expect(input).toHaveValue('Keep this');}
 expect(screen.queryByText('Hidden summary')).toBeNull();expect(screen.getAllByText('4/change/false').length).toBe(2);
 fireEvent.click(screen.getByRole('button',{name:'Manage'}));fireEvent.click(screen.getByRole('button',{name:'tabs'}));expect(container.querySelector('[data-layout]')).toHaveAttribute('data-layout','stepper');
 fireEvent.click(screen.getByRole('button',{name:'Read only'}));expect(screen.queryByRole('button',{name:'Save'})).toBeNull();expect(input).toHaveAttribute('readonly');expect(save).not.toHaveBeenCalled();
});

test('scroll-following selection does not snap the form back to the section top',()=>{
 function Host(){const [active,setActive]=useState('first');return <TestHost preferences={{formNavigation:'scroll'}}><RecordForm mode="new" values={{}} sections={sections} active={active} onActive={setActive} progress={progress} renderSection={section=><p>{section.title}</p>}/></TestHost>;}
 const {container}=render(<Host/>),scroller=container.querySelector('[data-scroll-root]') as HTMLElement;
 scroller.style.overflowY='auto';Object.defineProperties(scroller,{scrollHeight:{value:1000},clientHeight:{value:400}});
 const scrollTo=vi.fn();scroller.scrollTo=scrollTo;
 const nodes=container.querySelectorAll<HTMLElement>('[data-record-section]');
 nodes.forEach((node,index)=>{node.getBoundingClientRect=()=>({top:index?50:-100,height:200} as DOMRect);});
 fireEvent.scroll(scroller);
 expect(container.querySelector('[data-section-list] [aria-current="step"]')).toHaveTextContent('Last');
 expect(scrollTo).not.toHaveBeenCalled();
});
