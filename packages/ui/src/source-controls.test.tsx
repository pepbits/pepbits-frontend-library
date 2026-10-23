import {LocalizationProvider} from '@pepbits/i18n/react';
import React,{createRef} from 'react';
import {render,screen,fireEvent} from '@testing-library/react';
import {it,expect,vi} from 'vitest';
import {SourceButton,SourceInput,SourceSelect,SourceDateInput,SourceTextarea} from './source-controls';
it('does not submit forms from a default action button',()=>{
 const submit=vi.fn((e:React.FormEvent)=>e.preventDefault());render(<form onSubmit={submit}><SourceButton>Open record</SourceButton></form>);
 fireEvent.click(screen.getByRole('button'));expect(submit).not.toHaveBeenCalled();
});
it('preserves input refs, controlled values and native labels',()=>{
 const ref=createRef<HTMLInputElement>(),change=vi.fn();render(<label>Reference<SourceInput ref={ref} value="ABC" onChange={change}/></label>);
 expect(screen.getByLabelText('Reference')).toBe(ref.current);fireEvent.change(ref.current!,{target:{value:'DEF'}});expect(change).toHaveBeenCalled();
});
it('keeps disabled select semantics for managed fields',()=>{
 render(<SourceSelect aria-label="Department" disabled value="lab" onChange={()=>{}}><option value="lab">Laboratory</option></SourceSelect>);
 expect(screen.getByRole('combobox',{name:'Department'})).toBeDisabled();
});
it('localizes placeholders and names without changing ISO date values or refs',()=>{
 const ref=createRef<HTMLInputElement>();
 render(<LocalizationProvider value={{language:'ar',direction:'rtl',dateTime:String,t:message=>(({'Name':'الاسم','Birth date':'الميلاد'} as Record<string,string>)[message]??message)}}>
   <SourceInput placeholder="Name" aria-label="Name"/><SourceDateInput ref={ref} aria-label="Birth date" value="1990-01-01" onChange={()=>{}}/>
 </LocalizationProvider>);
 expect(screen.getByPlaceholderText('الاسم')).toHaveAccessibleName('الاسم');expect(ref.current).toHaveValue('1990-01-01');expect(ref.current).toHaveAttribute('type','date');
});
it('preserves explicit form submission and disabled textarea semantics',()=>{
 const submit=vi.fn((e:React.FormEvent)=>e.preventDefault());render(<form onSubmit={submit}><SourceTextarea aria-label="Notes" disabled value="Draft"/><SourceButton type="submit">Save</SourceButton></form>);
 fireEvent.click(screen.getByRole('button'));expect(submit).toHaveBeenCalledOnce();expect(screen.getByRole('textbox',{name:'Notes'})).toBeDisabled();
});
