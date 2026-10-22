import React from 'react';
import {it,expect} from 'vitest';
import {render,screen} from '@testing-library/react';
import {createTranslator,localizeFieldError,localizeImportError,localizeApprovalNotice,type LanguageKey} from '@pepbits/i18n';
import {LocalizedText} from '@pepbits/i18n/react';
const templates = ['Name','{field} cannot be empty.','Data row {row} has {actual} cells; expected {expected}.','Submitted for {stage}'];
const locale=(language:LanguageKey)=>({t:createTranslator({language,catalogs:{[language]:Object.fromEntries(templates.map(text=>[text,`${language}: ${text}`]))}})});
it('has readable English core fallbacks outside a host provider',()=>{
 render(<LocalizedText message="save"/>);expect(screen.getByText('Save')).toBeVisible();
});
 it.each(['ar','hi','ml'] as const)('localizes complete error templates in %s and preserves unknown service messages',language=>{
  const t=locale(language).t;
  expect(localizeFieldError('Name cannot be empty.','Name',t)).toBe(t('{field} cannot be empty.',{field:t('Name')}));
  expect(localizeImportError('Data row 7 has 2 cells; expected 4.',t)).toBe(t('Data row {row} has {actual} cells; expected {expected}.',{row:7,actual:2,expected:4}));
  expect(localizeImportError('Adapter-specific error ABC',t)).toBe('Adapter-specific error ABC');
  expect(localizeApprovalNotice('Submitted for My custom review',t)).toBe(t('Submitted for {stage}',{stage:'My custom review'}));
 });
