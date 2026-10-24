import {useMemo, useRef, useState} from 'react';
import {ColumnManager, useColumnLayout} from '@pepbits/page-engines/worklist';
import type {DataColumn} from '@pepbits/page-engines/types';
import {Button} from '@pepbits/ui';
import {RecoveryNotice, failureFromError} from '@pepbits/components';
import {usePreferences} from '@pepbits/preferences/react';
import {useLocalization} from '@pepbits/i18n/react';
import {useApi} from './client';
import {useKeystone} from './context';
import {defaultHidden, listFields} from './registry';
import type {PageDef} from './types';

/** Reports use the same hidden-key wire contract and public column controller as worklists. */
export function useReportColumns(def: PageDef) {
  const {preferences} = usePreferences(), {scopeKey} = useKeystone(), request = useApi(), {t} = useLocalization();
  const enabled = def.template === 'report', [open, setOpen] = useState(false), [failure, setFailure] = useState<unknown>(), [revision, setRevision] = useState(0), failed = useRef<RequestInit|undefined>(undefined), readFailed = useRef(false);
  const columns = useMemo<DataColumn[]>(() => listFields(def).map(field => ({key:field.key,label:field.label,type:field.type === 'currency' ? 'money' : 'text',classification:'unclassified'})), [def]);
  const defaults = useMemo(() => columns.filter(column => !defaultHidden(def).includes(column.key)).map(column => column.key), [columns, def]);
  const identity = scopeKey + ':report:' + def.slug;
  const adapter = useMemo(() => ({identity, request: async (_path: string, init?: RequestInit) => {
    if (!enabled) return Response.json({layouts:{}});
    try {
      const key = 'keystone.cols.' + def.slug;
      if (init?.method === 'PUT') {
        // The shared controller can emit a hydration write; never replace an unread account layout.
        if (readFailed.current) return Response.json({error:'Reload the layout first'}, {status:503});
        const body = JSON.parse(String(init.body));
        await request('/api/view-state', {method:'PUT',body:JSON.stringify({key,value:columns.map(column => column.key).filter(key => !body.layout.columns.includes(key))})});
        setFailure(undefined);return Response.json({});
      }
      const result = await request<{value:string[]|null}>('/api/view-state?key=' + key);
      readFailed.current=false;setFailure(undefined);return Response.json({layouts:result.value ? {[identity]:{columns:columns.map(column => column.key).filter(key => !result.value!.includes(key)),sort:null}} : {}});
    } catch (error) {if(init?.method!=='PUT')readFailed.current=true;failed.current = init;setFailure(error);return Response.json({error:'Layout request failed'}, {status:502});}
  }}), [identity, request, def.slug, columns, enabled, revision]);
  const layout = useColumnLayout(identity, enabled ? preferences.columnLayoutScope : 'account', columns, defaults, adapter);
  return {...layout, controls: enabled ? <>
    <Button onClick={() => setOpen(true)}>{t('Columns')}</Button>
    <ColumnManager open={open} onClose={() => setOpen(false)} columns={columns} visibleKeys={layout.visibleKeys} onChange={layout.setVisibleKeys} onReset={layout.reset}/>
    {!!failure && <RecoveryNotice failure={failureFromError(failure)} onRetry={() => {if (failed.current) void adapter.request('/layouts',failed.current);else setRevision(value => value + 1);}}/>}
  </> : null};
}
