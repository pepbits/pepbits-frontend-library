import React from 'react';
import {screen} from '@testing-library/react';
import {test,expect} from 'vitest';
import {render} from '../test/render';
import {createPageRenderer,createEngineRenderers} from './index';
import type {PageDefinition} from '../types';
const page:PageDefinition={id:'items',title:'Items',subtitle:'',kind:'custom',module:'records'};
test('a registered kind receives its definition and explicit navigation target',()=>{
 const Renderer=createPageRenderer({renderers:{custom:({page,target})=><p>{page.title}: {target.recordId}</p>}});
 render(<Renderer page={page} target={{pageId:page.id,recordId:'A'}}/>);
 expect(screen.getByText('Items: A')).toBeVisible();
});
test('template ID registration precedes the kind registration',()=>{
 const Renderer=createPageRenderer({renderers:{custom:()=><p>Kind</p>},templates:{'layout-a':()=><p>Template</p>}});
 render(<Renderer page={{...page,templateId:'layout-a'}}/>);expect(screen.getByText('Template')).toBeVisible();
});
test.each(['unknown','toString','constructor'])('unregistered kind %s uses the shared unsupported state',kind=>{
 const Renderer=createPageRenderer({renderers:{}});render(<Renderer page={{...page,kind}}/>);
 expect(screen.getByText('Unsupported page')).toBeVisible();expect(screen.getByText('No renderer is registered for this page.')).toBeVisible();
});
test('built-in registrations require host configuration and include only package engines',()=>{
 expect(Object.keys(createEngineRenderers({}))).toEqual([]);
 expect(Object.keys(createEngineRenderers({template:()=>({identity:null})}))).toEqual(['template']);
});
