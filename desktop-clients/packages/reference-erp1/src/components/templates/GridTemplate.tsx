'use client';
import { WorkList, Card, Frame, type PageDef } from '@pepbits/reference-keystone-core';

/** Simple lookups: edit in place, add a row at the top, no extra screens. */
export default function GridTemplate({ def }: { def: PageDef }) {
  return (
    <Frame>
      <Card className="flex-1">
        <WorkList def={def} inlineEdit newLabel="Add row" />
      </Card>
    </Frame>
  );
}
