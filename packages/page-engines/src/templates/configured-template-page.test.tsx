import {createTemplateSample} from '../test/templates';
import {render,TestHost} from '../test/render';
import React from 'react';
import {screen,fireEvent,waitFor} from '@testing-library/react';
import {test,expect,vi} from 'vitest';
import {DEFAULT_PREFERENCES} from "@pepbits/preferences";
import {TEMPLATE_BY_ID} from "../test/templates";
import type {PageDefinition} from "../types";

import {ConfiguredTemplatePage} from './configured-template-page';

const page={id:'items',kind:'template',title:'Items',subtitle:'',module:'records',templateId:'template-master-table'} satisfies PageDefinition;
test('business templates require an explicitly configured adapter',()=>{
 render(<ConfiguredTemplatePage definitions={TEMPLATE_BY_ID} identity={{tenantId:"tenant",applicationId:"app",userId:"user"}} page={page} target={{pageId:'items',recordId:'RECORD-001'}}/>);expect(screen.getByText('Application integration')).toBeVisible();expect(screen.queryByRole('button',{name:'Save changes'})).toBeNull();
});
test('loads with authenticated scope and enforces application edit permissions',async()=>{
 const initial=createTemplateSample(TEMPLATE_BY_ID['template-master-table']!);const load=vi.fn().mockResolvedValue(initial),save=vi.fn();render(<ConfiguredTemplatePage adapter={{load,save}} definitions={TEMPLATE_BY_ID} identity={{tenantId:"tenant",applicationId:"app",userId:"user"}} page={page} target={{pageId:'items',recordId:'RECORD-001'}}/>);
 await screen.findByRole('textbox',{name:'Name'});expect(load).toHaveBeenCalledWith({tenantId:'tenant',applicationId:'app',userId:'user',pageId:'items',recordId:'RECORD-001'},'template-master-table');expect(screen.getByRole('button',{name:'Save changes'})).toBeDisabled();expect(save).not.toHaveBeenCalled();
});
test('refuses a loader response for another record',async()=>{
 const initial=createTemplateSample(TEMPLATE_BY_ID['template-master-table']!);const load=vi.fn().mockResolvedValue({...initial,id:'ANOTHER'});render(<ConfiguredTemplatePage adapter={{load,save:vi.fn()}} definitions={TEMPLATE_BY_ID} identity={{tenantId:"tenant",applicationId:"app",userId:"user"}} page={page} target={{pageId:'items',recordId:'RECORD-001'}}/>);
 await screen.findByRole('alert');expect(screen.queryByRole('textbox',{name:'Name'})).toBeNull();
});
