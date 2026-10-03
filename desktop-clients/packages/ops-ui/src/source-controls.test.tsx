import React,{createRef} from 'react';
import {render,screen,fireEvent} from '@testing-library/react';
import {it,expect,vi} from 'vitest';
import {SourceButton,SourceInput,SourceSelect} from './source-controls';
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
