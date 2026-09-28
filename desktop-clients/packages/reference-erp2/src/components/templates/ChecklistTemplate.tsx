'use client';
import { WorkList, Card, Frame, type PageDef } from '@pepbits/reference-keystone-core';
import { nounOf } from '../../lib/registry';

/** Inspections: full worklist, each inspection sheet has its own page. */
export default function ChecklistTemplate({ def }: { def: PageDef }) {
  return (
    <Frame>
      <Card className="flex-1"><WorkList def={def} newLabel={`New ${nounOf(def)}`} /></Card>
    </Frame>
  );
}
