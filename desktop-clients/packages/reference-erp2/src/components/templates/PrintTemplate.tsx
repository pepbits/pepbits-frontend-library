'use client';
import { WorkList, Card, Frame, type PageDef } from '@pepbits/reference-keystone-core';

/** Pick a document from the full list; its print preview opens on its own page. */
export default function PrintTemplate({ def }: { def: PageDef }) {
  return (
    <Frame>
      <Card className="flex-1"><WorkList def={def} hideNew /></Card>
    </Frame>
  );
}
