'use client';
import { useList, Select, WorkList, Card, Frame, type PageDef, type Row } from '@pepbits/reference-keystone-core';
import { useMemo, useState } from 'react';
import { nounOf } from '../../lib/registry';
import { QuickDialog } from '../record/QuickDialog';
import { LocalizedText as ReferenceText } from '@pepbits/ops-ui';
import { useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';



/** Child lookups filtered by a parent (states by country). The parent is a filter, not a second pane. */
export default function DependentTemplate({ def }: { def: PageDef }) {
 const referenceT = useReferenceLocalization().t;

  const p = def.parent!;
  const [parent, setParent] = useState('');
  const [dialog, setDialog] = useState<{ row: Row | null } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const parents = useList(p.entity, { size: 500 });
  const counts = useList(def.entity, { size: 1, facet: p.key, q: '' }, true);
  const options = useMemo(() => (parents.data?.rows ?? []).map((r) => ({ name: String(r.name), n: counts.data?.facets[String(r.name)] ?? 0 })).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)), [parents.data, counts.data]);
  return (
    <Frame>
      <Card className="flex-1">
        <WorkList
          key={parent || 'all'}
          def={def}
          reloadKey={reloadKey}
          fields={def.fields.filter((f) => !(parent && f.key === p.key))}
          fixedFilters={parent ? { [p.key]: [parent] } : undefined}
          onOpen={(r) => setDialog({ row: r })}
          onNew={() => setDialog({ row: null })}
          newLabel={`New ${nounOf(def)}`}
          toolbarExtra={
            <Select value={parent} onChange={(e) => setParent(e.target.value)} className="w-56" aria-label={p.label}>
              <option value="">{referenceT("Every {parent}", {parent: referenceT(p.label)})}</option>
              {options.map((o) => <option key={o.name} value={o.name}>{o.name} ({o.n})</option>)}
            </Select>
          }
        />
      </Card>
      <QuickDialog def={def} row={dialog?.row ?? null} defaults={parent ? { [p.key]: parent } : undefined} open={Boolean(dialog)} onClose={() => setDialog(null)} onSaved={() => setReloadKey((k) => k + 1)} />
    </Frame>
  );
}
