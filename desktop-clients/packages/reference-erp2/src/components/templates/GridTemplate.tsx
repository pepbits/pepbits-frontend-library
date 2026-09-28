'use client';
import { WorkList, Card, Frame, type PageDef, type Row } from '@pepbits/reference-keystone-core';
import { useState } from 'react';
import { nounOf } from '../../lib/registry';
import { QuickDialog } from '../record/QuickDialog';

/** Small lookup masters: full-width worklist, add and edit in a quick dialog. */
export default function GridTemplate({ def }: { def: PageDef }) {
  const [dialog, setDialog] = useState<{ row: Row | null } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  return (
    <Frame>
      <Card className="flex-1">
        <WorkList def={def} reloadKey={reloadKey} onOpen={(r) => setDialog({ row: r })} onNew={() => setDialog({ row: null })} newLabel={`New ${nounOf(def)}`} />
      </Card>
      <QuickDialog def={def} row={dialog?.row ?? null} open={Boolean(dialog)} onClose={() => setDialog(null)} onSaved={() => setReloadKey((k) => k + 1)} />
    </Frame>
  );
}
