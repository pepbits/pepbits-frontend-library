'use client';
import { WorkList, Card, Frame, type PageDef } from '@pepbits/reference-keystone-core';
import { nounOf } from '../../lib/registry';

/** Orders, invoices, receipts and vouchers: full worklist with totals. Documents open on their own page. */
export default function DocumentTemplate({ def }: { def: PageDef }) {
  return (
    <Frame>
      <Card className="flex-1"><WorkList def={def} newLabel={`New ${nounOf(def)}`} showTotals /></Card>
    </Frame>
  );
}
