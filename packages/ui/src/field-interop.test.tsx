import {Fragment} from 'react';
import {expect,test} from 'vitest';
import {optionsFromChildren,splitFieldClasses} from './field-interop';
test('option conversion preserves numeric/implicit values and nested labels across fragments and groups',()=>{
 const Label=(_props:{message:string})=>null;
 expect(optionsFromChildren(<><option value="">Choose</option><Fragment><optgroup label="Group"><option value={0}>Zero</option><option><span>Nested </span>label</option></optgroup></Fragment>{[<option key="x" value="x"><Label message="Translated label"/></option>]}<div>ignored</div>{null}</>)).toEqual({placeholder:'Choose',options:[{value:'0',label:'Zero'},{value:'Nested label',label:'Nested label'},{value:'x',label:'Translated label'}]});
});
test('empty placeholder remains distinguishable and later empty values remain options',()=>{
 expect(optionsFromChildren(<><option value=""/><option value="a">A</option><option value="">None</option></>)).toEqual({placeholder:' ',options:[{value:'a',label:'A'},{value:'',label:'None'}]});
 expect(optionsFromChildren(null)).toEqual({placeholder:'',options:[]});
});
test('field class conversion uses logical padding and effective form scale without losing wrapper classes',()=>{
 expect(splitFieldClasses('w-full h-8 min-h-[40px] px-2 pl-3 py-1.5 text-right tnum font-mono text-[length:calc(13px*var(--fs-scale))] text-[12px] custom')).toEqual({wrapper:'w-full custom',style:{height:'2rem',minHeight:'40px',paddingInlineStart:'0.75rem',paddingInlineEnd:'0.5rem',paddingTop:'0.375rem',paddingBottom:'0.375rem',textAlign:'right',fontVariantNumeric:'tabular-nums',fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace',fontSize:'calc(13px * var(--fs-form))'}});
 expect(splitFieldClasses()).toEqual({wrapper:'',style:{}});
});
