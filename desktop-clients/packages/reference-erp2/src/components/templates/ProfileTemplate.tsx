'use client';
import { WorkList, Card, Frame, type PageDef } from '@pepbits/reference-keystone-core';
import { nounOf } from '../../lib/registry';

/** Rich masters: the worklist is the whole page. Rows open /<id>, New opens /new. */
export default function ProfileTemplate({ def }: { def: PageDef }) {
  return (
    <Frame>
      <Card className="flex-1"><WorkList def={def} newLabel={`New ${nounOf(def)}`} /></Card>
    </Frame>
  );
}
