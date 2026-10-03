import React,{useState} from 'react';
import {render,screen,fireEvent} from '@testing-library/react';
import {it,expect} from 'vitest';
import {LocalizationProvider,LocalizationAliasProvider,LocalizedText,type Localization} from './localization';
import {Input,Select} from './form-controls';
import {Button} from './button';
const locale=(language:string):Localization=>({language,direction:language==='ar'?'rtl':'ltr',t:key=>language==='ar'?({Name:'الاسم',Save:'حفظ',Active:'نشط',Status:'الحالة'}[key]??key):key,dateTime:String});
function Form(){const[value,setValue]=useState('');return <><Input label="Name" value={value} onChange={e=>setValue(e.target.value)}/><Select label="Status" defaultValue="active" options={[{label:'Active',value:'active'}]}/><Button>Save</Button><LocalizedText message="Unknown extension"/></>;}
it('switches displayed labels without remounting drafts or changing option values',()=>{
 const {rerender}=render(<LocalizationProvider value={locale('en')}><Form/></LocalizationProvider>);
 fireEvent.change(screen.getByLabelText('Name'),{target:{value:'Save CUS-001'}});
 rerender(<LocalizationProvider value={locale('ar')}><Form/></LocalizationProvider>);
 expect(screen.getByLabelText('الاسم')).toHaveValue('Save CUS-001');
 expect(screen.getByLabelText('الحالة')).toHaveValue('active');
 expect(screen.getByRole('option',{name:'نشط'})).toHaveAttribute('value','active');
 expect(screen.getByRole('button',{name:'حفظ'})).toBeVisible();
 expect(screen.getByText('Unknown extension')).toBeVisible();
});

it('maps imported labels through canonical host keys without changing input values or sibling labels',()=>{
 const labels:Record<string,string>={'module.name':'اسم الوحدة','module.save':'حفظ الوحدة'};const host={...locale('ar'),t:(key:string)=>labels[key]??key};
 render(<LocalizationProvider value={host}><LocalizationAliasProvider aliases={{Name:'module.name',Save:'module.save'}}><Input label="Name" defaultValue="Save"/><Button>Save</Button></LocalizationAliasProvider><Button>Save</Button></LocalizationProvider>);
 expect(screen.getByLabelText('اسم الوحدة')).toHaveValue('Save');expect(screen.getByRole('button',{name:'حفظ الوحدة'})).toBeVisible();expect(screen.getByRole('button',{name:'Save'})).toBeVisible();
});
it('an unavailable module key keeps its readable source fallback',()=>{
 render(<LocalizationAliasProvider aliases={{'Unknown source label':'module.absent'}}><LocalizedText message="Unknown source label"/></LocalizationAliasProvider>);expect(screen.getByText('Unknown source label')).toBeVisible();expect(screen.queryByText('module.absent')).toBeNull();
});
it('updates aliased language without discarding a mounted form draft',()=>{
 const aliases={Name:'module.name',Save:'module.save',Status:'module.status',Active:'module.active'};const labels:Record<string,string>={'module.name':'الاسم','module.save':'حفظ','module.status':'الحالة','module.active':'نشط'};
 const translated={...locale('ar'),t:(key:string)=>labels[key]??key};
 const view=render(<LocalizationProvider value={locale('en')}><LocalizationAliasProvider aliases={aliases}><Form/></LocalizationAliasProvider></LocalizationProvider>);fireEvent.change(screen.getByLabelText('Name'),{target:{value:'CUS-001'}});
 view.rerender(<LocalizationProvider value={translated}><LocalizationAliasProvider aliases={aliases}><Form/></LocalizationAliasProvider></LocalizationProvider>);expect(screen.getByLabelText('الاسم')).toHaveValue('CUS-001');expect(screen.getByLabelText('الحالة')).toHaveValue('active');
});
