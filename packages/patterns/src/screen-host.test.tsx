import React from 'react';
import {renderHook, act} from '@testing-library/react';
import {expect, test, vi} from 'vitest';
import {ScreenHostProvider, useScreenHost, useScreenDraftState, useFormatters, type ScreenHostValue} from './screen-host';
import {createTestDocument} from './test/document';
import {TestHost} from './test/render';
import {EMPTY_PREFERENCE_POLICY, type PreferencePolicy} from '@pepbits/preferences';
import {usePreference} from '@pepbits/preferences/react';

test('standalone host defaults deny actions and document callbacks are safe no-ops', () => {
  const {result} = renderHook(useScreenHost);
  expect(result.current.can('edit', {id: 'sample'})).toBe(false);
  expect(result.current.scope).toEqual({});
  expect(result.current.document.id).toBeNull();
  expect(result.current.document.focused).toBe(true);
  expect(result.current.document.draftState).toEqual({});
  act(() => {
    result.current.notify('Saved', {tone: 'success'});
    result.current.document.reportDirty(true);
    result.current.document.setDraftState('editor', {value: 'Unpersisted'});
  });
  expect(result.current.document.draftState).toEqual({});
  expect(result.current.renderInlineAction).toBeUndefined();
  expect(result.current.publishSources).toBeUndefined();
  expect(result.current.document.subscribeClose).toBeUndefined();
});

test('transient document state survives suspension and changing identity starts with clean state',()=>{
  const document=createTestDocument('a');let value:ScreenHostValue={document:document.document};
  const wrapper=({children}:{children:React.ReactNode})=><ScreenHostProvider value={value}>{children}</ScreenHostProvider>;
  const first=renderHook(()=>useScreenDraftState('note',''),{wrapper});
  act(()=>first.result.current[1]('Retained'));first.unmount();
  const second=renderHook(()=>useScreenDraftState('note',''),{wrapper});
  expect(second.result.current[0]).toBe('Retained');
  value={document:{id:'b'}};second.rerender();expect(second.result.current[0]).toBe('');
  expect(document.metadata()).toEqual({id:'a',dirty:false});
});

test('standalone transient state updates locally with no persistence callback',()=>{
 const {result}=renderHook(()=>useScreenDraftState('count',0));
 act(()=>{result.current[1](previous=>previous+1);result.current[1](previous=>previous+1);});
 expect(result.current[0]).toBe(2);
});

test('explicit closure is distinct from suspension and respects the document dirty guard',()=>{
 const owner=createTestDocument('a'),closed=vi.fn();
 const {result,unmount}=renderHook(useScreenHost,{wrapper:({children})=><ScreenHostProvider value={{document:owner.document}}>{children}</ScreenHostProvider>});
 result.current.document.subscribeClose?.(closed);result.current.document.reportDirty(true);
 unmount();expect(closed).not.toHaveBeenCalled();expect(owner.close()).toBe(false);
 expect(owner.close(true)).toBe(true);expect(closed).toHaveBeenCalledOnce();
});

test('empty and partial providers retain safe document defaults', () => {
  let value: ScreenHostValue | undefined;
  const {result, rerender} = renderHook(useScreenHost, {
    wrapper: ({children}) => <ScreenHostProvider value={value}>{children}</ScreenHostProvider>,
  });
  expect(result.current.can('read')).toBe(false);
  value = {document: {focused: false}};
  rerender();
  expect(result.current.document.focused).toBe(false);
  expect(result.current.document.id).toBeNull();
  expect(() => result.current.document.reportDirty(true)).not.toThrow();
  expect(result.current.renderInlineAction).toBeUndefined();
  expect(result.current.publishSources).toBeUndefined();
});

test('host callbacks and opaque extension slots receive the original values', () => {
  const notify = vi.fn(), can = vi.fn(() => true), dirty = vi.fn(), write = vi.fn(), cleanup = vi.fn();
  const renderInlineAction = vi.fn(() => null), publishSources = vi.fn(() => cleanup);
  const value: ScreenHostValue = {notify, can, scope: {module: 'scope-a', branch: 'scope-b'},
    document: {id: 'document-a', focused: false, draftState: {editor: 'retained'}, reportDirty: dirty, setDraftState: write},
    renderInlineAction, publishSources};
  const {result} = renderHook(useScreenHost, {wrapper: ({children}) => <ScreenHostProvider value={value}>{children}</ScreenHostProvider>});
  act(() => {
    result.current.notify('Saved', {tone: 'info'});
    expect(result.current.can('edit', {id: 'record-a'})).toBe(true);
    result.current.document.reportDirty(true);
    result.current.document.setDraftState('editor', 'next');
    result.current.renderInlineAction?.({action: 'summarize'});
    const dispose = result.current.publishSources?.([{id: 'source-a'}]);
    dispose?.();
  });
  expect(notify).toHaveBeenCalledWith('Saved', {tone: 'info'});
  expect(can).toHaveBeenCalledWith('edit', {id: 'record-a'});
  expect(dirty).toHaveBeenCalledWith(true);
  expect(write).toHaveBeenCalledWith('editor', 'next');
  expect(result.current.document.draftState).toEqual({editor: 'retained'});
  expect(renderInlineAction).toHaveBeenCalledWith({action: 'summarize'});
  expect(publishSources).toHaveBeenCalledWith([{id: 'source-a'}]);
  expect(cleanup).toHaveBeenCalledOnce();
});

test('changing document scope replaces host state without leaking it to another provider', () => {
  let value: ScreenHostValue = {document: {id: 'a', draftState: {editor: 'a'}}};
  const a = renderHook(useScreenHost, {
    wrapper: ({children}) => <ScreenHostProvider value={value}>{children}</ScreenHostProvider>});
  const b = renderHook(useScreenHost, {wrapper: ({children}) => <ScreenHostProvider>{children}</ScreenHostProvider>});
  value = {document: {id: 'b'}};
  a.rerender();
  expect(a.result.current.document.draftState).toEqual({});
  expect(a.result.current.document.id).toBe('b');
  expect(b.result.current.document.id).toBeNull();
});

test('formatters stay memoized and follow effective locked settings without another store', () => {
  const update = vi.fn();
  let policy: PreferencePolicy = EMPTY_PREFERENCE_POLICY;
  let decimalPlaces: 2 | 3 = 2;
  const {result, rerender} = renderHook(() => ({format: useFormatters(), preference: usePreference('decimalPlaces')}), {
    wrapper: ({children}) => <TestHost preferences={{numberLocale: 'en-US', decimalPlaces}}
      preferencePolicy={policy} update={update}>{children}</TestHost>,
  });
  const previous = result.current.format;
  rerender();
  expect(result.current.format).toBe(previous);
  expect(result.current.format.number(12.3456)).toBe('12.35');
  act(() => result.current.preference.update({decimalPlaces: 3}));
  expect(update).toHaveBeenCalledWith({decimalPlaces: 3});
  expect(result.current.format).toBe(previous);
  decimalPlaces = 3;
  policy = {...EMPTY_PREFERENCE_POLICY, rules: {decimalPlaces: {locked: true, value: 0}}};
  rerender();
  expect(result.current.format.number(12.3456)).toBe('12');
  expect(result.current.preference.locked).toBe(true);
  act(() => result.current.preference.update({decimalPlaces: 3}));
  expect(update).toHaveBeenCalledTimes(1);
});
