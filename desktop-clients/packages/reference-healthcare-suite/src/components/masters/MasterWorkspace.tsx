'use client';
import {LocalizedText} from '@pepbits/ops-ui';
import { List, Plus } from 'lucide-react';
import { useReferencePathname, useReferenceRouter, useReferenceSearchParams } from '@pepbits/reference-host';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MASTERS } from '../../lib/masters';
import { useSession } from '../../lib/session';
import { Row } from '../../lib/types';
import { Tabs } from '../ui/Tabs';
import { MasterRecord, RecordMode } from './MasterRecord';
import { MasterWorklist } from './MasterWorklist';

interface OpenTab { key: string; id: string | null; mode: RecordMode; title: string; dirty: boolean; editSignal: number }
const MAX_TABS = 8;

/**
 * One screen per master. In "tabs" layout the worklist is the first tab and every opened record
 * gets its own tab (kept mounted so unsaved edits survive switching). In "pages" layout the
 * worklist navigates to /masters/:entity/:id and /masters/:entity/new.
 */
export function MasterWorkspace({ entity }: { entity: string }) {
  const def = MASTERS[entity];
  const { formLayout } = useSession();
  const router = useReferenceRouter();
  const pathname = useReferencePathname();
  const params = useReferenceSearchParams();
  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [active, setActive] = useState('list');
  const [refreshKey, setRefreshKey] = useState(0);
  const newCounter = useRef(0);

  // Any query param that is a real column acts as a scoped filter, e.g. ?planId=PL001 from a plan record.
  const scope: Record<string, string> = {};
  params.forEach((v, k) => { if (k !== 'open') scope[k] = v; });

  const openRecord = useCallback((row: Row | null, mode: RecordMode) => {
    if (formLayout === 'pages') {
      router.push(row ? `/masters/${entity}/${row.id}${mode === 'edit' ? '?mode=edit' : ''}` : `/masters/${entity}/new`);
      return;
    }
    if (!row) {
      const key = `new-${++newCounter.current}`;
      setTabs((t) => [...t, { key, id: null, mode: 'new' as RecordMode, title: `New ${def.singular.toLowerCase()}`, dirty: false, editSignal: 0 }].slice(-MAX_TABS));
      setActive(key);
      return;
    }
    setTabs((t) => {
      const existing = t.find((x) => x.id === row.id);
      if (existing) return t.map((x) => (x.id === row.id && mode === 'edit' ? { ...x, editSignal: x.editSignal + 1 } : x));
      return [...t, { key: row.id, id: row.id, mode, title: def.titleOf(row), dirty: false, editSignal: 0 }].slice(-MAX_TABS);
    });
    setActive(row.id);
  }, [formLayout, router, entity, def]);

  useEffect(() => {
    const id = params.get('open');
    if (id && formLayout === 'tabs') openRecord({ id } as Row, 'view');
  }, []); // eslint-disable-hc-line react-hooks/exhaustive-deps

  const close = (key: string) => {
    const t = tabs.find((x) => x.key === key);
    if (t?.dirty && !confirm(`Discard unsaved changes to ${t.title}?`)) return;
    setTabs((ts) => ts.filter((x) => x.key !== key));
    if (active === key) setActive('list');
  };
  const patch = (key: string, p: Partial<OpenTab>) => setTabs((ts) => ts.map((x) => (x.key === key ? { ...x, ...p } : x)));

  if (!def) return null;
  const showTabs = formLayout === 'tabs';

  return (
    <div className="hc-panel flex min-h-0 flex-1 flex-col overflow-hidden">
      {showTabs && (
        <Tabs
          items={[{ key: 'list', label: `${def.title}`, icon: <List className="h-3.5 w-3.5" /> }, ...tabs.map((t) => ({ key: t.key, label: t.title, closable: true, dirty: t.dirty, icon: t.mode === 'new' && !t.id ? <Plus className="h-3.5 w-3.5" /> : undefined }))]}
          active={active}
          onSelect={setActive}
          onClose={close}
          right={<span className="hidden text-hc-2xs text-hc-ink-mute xl:inline"><LocalizedText message={def.description}/></span>}
        />
      )}
      <div className={active === 'list' || !showTabs ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
        <MasterWorklist
          def={def}
          onOpen={openRecord}
          onNew={() => openRecord(null, 'new')}
          selectedId={showTabs && active !== 'list' ? tabs.find((t) => t.key === active)?.id : null}
          refreshKey={refreshKey}
          scope={scope}
          onClearScope={() => router.replace(pathname)}
        />
      </div>
      {showTabs && tabs.map((t) => (
        <div key={t.key} className={active === t.key ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
          <MasterRecord
            def={def}
            id={t.id}
            initialMode={t.mode}
            editSignal={t.editSignal}
            active={active === t.key}
            prefill={scope}
            onTitle={(title) => patch(t.key, { title })}
            onDirty={(dirty) => patch(t.key, { dirty })}
            onCancelNew={() => close(t.key)}
            onSaved={(row, created, again) => {
              setRefreshKey((k) => k + 1);
              if (created && !again) patch(t.key, { id: row.id, mode: 'view', title: def.titleOf(row) });
            }}
          />
        </div>
      ))}
    </div>
  );
}
