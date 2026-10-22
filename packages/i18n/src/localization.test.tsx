import React from 'react';
import {render,screen} from '@testing-library/react';
import {it,expect} from 'vitest';
import {LocalizationProvider,LocalizationAliasProvider,LocalizedText,useLocalization} from '@pepbits/i18n/react';
it('an unavailable host key keeps its readable source fallback',()=>{
 render(<LocalizationAliasProvider aliases={{'Unknown source label':'host.absent'}}><LocalizedText message="Unknown source label"/></LocalizationAliasProvider>);expect(screen.getByText('Unknown source label')).toBeVisible();expect(screen.queryByText('host.absent')).toBeNull();
});

it('uses the English core then the literal message with original placeholder substitution',()=>{
 render(<><span><LocalizedText message="save"/></span><span><LocalizedText message="Hello {name}: {count} / {unknown}" values={{name:'Sam',count:0}}/></span><LocalizedText/></>);
 expect(screen.getByText('Save')).toBeVisible();
 expect(screen.getByText('Hello Sam: 0 / {unknown}')).toBeVisible();
});
it('provides host language, direction, translation and formatter without changing the default dateTime',()=>{
 function Probe(){const value=useLocalization();return <output dir={value.direction}>{value.language}|{value.t('hello',{name:'Sam'})}|{value.dateTime('2026-10-22T12:00:00Z')}</output>;}
 const view=render(<Probe/>);
 expect(screen.getByRole('status')).toHaveTextContent(new Date('2026-10-22T12:00:00Z').toLocaleString('en-US'));
 view.rerender(<LocalizationProvider value={{language:'ar',direction:'rtl',t:(_,values)=>`مرحبا ${values?.name}`,dateTime:()=> 'host date'}}><Probe/></LocalizationProvider>);
 expect(screen.getByRole('status')).toHaveAttribute('dir','rtl');
 expect(screen.getByRole('status')).toHaveTextContent('ar|مرحبا Sam|host date');
});
it('aliases forward values and scope fallback to their parent provider',()=>{
 const t=(key:string,values?:Record<string,string|number>)=>key==='host.greeting'?`Hello ${values?.name}`:key==='Missing'?'Readable fallback':key;
 render(<LocalizationProvider value={{language:'en',direction:'ltr',t,dateTime:String}}><LocalizationAliasProvider aliases={{Greeting:'host.greeting',Missing:'host.absent'}}><span><LocalizedText message="Greeting" values={{name:'Sam'}}/></span><span><LocalizedText message="Missing"/></span></LocalizationAliasProvider><span><LocalizedText message="Greeting"/></span></LocalizationProvider>);
 expect(screen.getByText('Hello Sam')).toBeVisible();expect(screen.getByText('Readable fallback')).toBeVisible();expect(screen.getByText('Greeting')).toBeVisible();
});
