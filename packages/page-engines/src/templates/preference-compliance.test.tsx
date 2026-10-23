import {createTemplateSample} from '../test/templates';
import {render,TestHost} from '../test/render';
import React from 'react';
import {screen,fireEvent,cleanup} from '@testing-library/react';
import {test,expect,vi} from 'vitest';
import {DEFAULT_PREFERENCES, type PreferencePolicy} from "@pepbits/preferences";
import {PAGE_TEMPLATES,TEMPLATE_BY_ID} from "../test/templates";
import {TemplateUnderTest as PageTemplateWorkspace} from '../test/template-host';

import {usePreference} from '@pepbits/preferences/react';
const scope={tenantId:'t',applicationId:'a',userId:'u',pageId:'p',recordId:'r'};
// This case renders two workspaces per template; allow for slower hosts and concurrent builds.
test('all registered templates inherit managed table preferences in both density profiles',()=>{
  for(const density of ['compact','spacious'] as const)for(const definition of PAGE_TEMPLATES){
    const preferences={...DEFAULT_PREFERENCES,density,zebraStripes:false,stickyTableHeader:false,wrapCellText:true};
    const {container}=render(<PageTemplateWorkspace definition={definition} preferences={preferences} scope={scope} initialDocument={createTemplateSample(definition)}/>);
    for(const table of container.querySelectorAll('table')){
      expect(table,definition.id).toHaveAttribute('data-managed-table','true');
      expect(table,definition.id).toHaveAttribute('data-density',density);
      expect(table,definition.id).toHaveAttribute('data-striped','false');
      expect(table,definition.id).toHaveAttribute('data-sticky','false');
      expect(table,definition.id).toHaveAttribute('data-wrap','true');
    }
    cleanup();
  }
}, 15000);
test('locked policy resolves conflicting input preferences and explicit layout overrides',()=>{
  const definition=TEMPLATE_BY_ID['template-master-table']!;
  const preferencePolicy:PreferencePolicy={revision:1,rules:{formNavigation:{locked:true,value:'rail'}}};
  const {rerender}=render(<PageTemplateWorkspace definition={definition} scope={scope} initialDocument={createTemplateSample(definition)} preferences={{...DEFAULT_PREFERENCES,formNavigation:'wizard'}} preferencePolicy={preferencePolicy} layout="tabs"/>);
  expect(screen.getByRole('tablist')).toHaveAttribute('aria-orientation','vertical');
  rerender(<PageTemplateWorkspace definition={definition} scope={scope} initialDocument={createTemplateSample(definition)} preferences={{...DEFAULT_PREFERENCES,formNavigation:'wizard'}} preferencePolicy={{revision:2,rules:{formNavigation:{locked:true,value:'tabs'}}}} layout="rail"/>);
  expect(screen.getByRole('tablist')).toHaveAttribute('aria-orientation','horizontal');
});
function Choice(){const {value,update,locked}=usePreference('resultView');return <button disabled={locked} onClick={()=>update({resultView:'cards'})}>{value}</button>;}
// The controlled host owns the accepted snapshot; there is no local preference override.
test('live policy and unavailable settings guard the single host update path',()=>{
 const update=vi.fn();
 const view=(preferences={},preferencePolicy:PreferencePolicy={revision:0,rules:{}},preferencesAvailable=true)=><TestHost preferences={preferences} preferencePolicy={preferencePolicy} preferencesAvailable={preferencesAvailable} update={update}><Choice/></TestHost>;
 const {rerender}=render(view());fireEvent.click(screen.getByRole('button'));expect(update).toHaveBeenCalledWith({resultView:'cards'});expect(screen.getByRole('button')).toHaveTextContent('table');
 rerender(view({resultView:'cards'}));expect(screen.getByRole('button')).toHaveTextContent('cards');
 rerender(view({resultView:'cards'},{revision:1,rules:{resultView:{locked:true,value:'table'}}}));expect(screen.getByRole('button')).toHaveTextContent('table');expect(screen.getByRole('button')).toBeDisabled();
 fireEvent.click(screen.getByRole('button'));expect(update).toHaveBeenCalledTimes(1);
 rerender(view({resultView:'table'}));expect(screen.getByRole('button')).toHaveTextContent('table');expect(screen.getByRole('button')).not.toBeDisabled();
 rerender(view({},undefined,false));expect(screen.getByRole('button')).toBeDisabled();
});
test('locked list page size is resolved from policy and cannot be changed',()=>{
  const definition=TEMPLATE_BY_ID['template-list-table']!;
  render(<PageTemplateWorkspace definition={definition} scope={scope} initialDocument={createTemplateSample(definition)} preferences={{...DEFAULT_PREFERENCES,pageSize:50}} preferencePolicy={{revision:1,rules:{pageSize:{locked:true,value:10}}}}/>);
  expect(screen.getByRole('combobox',{name:'Rows per page'})).toHaveValue('10');expect(screen.getByRole('combobox',{name:'Rows per page'})).toBeDisabled();
});
