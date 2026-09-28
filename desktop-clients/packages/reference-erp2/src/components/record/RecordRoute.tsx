'use client';
import { Link, useParams, Button, Empty, type TemplateKey, ReadyPage } from '@pepbits/reference-keystone-core';
import { Suspense, type ComponentType } from 'react';
import { Compass } from 'lucide-react';
import { findPage, pagePath } from '../../lib/registry';
import { RecordLoading, type Mode, type RecordProps } from './RecordShell';
import ProfileRecord from './ProfileRecord';
import DocRecord from './DocRecord';
import { ChecklistRecord, RequestRecord } from './RequestRecord';
import { BookingRecord, CaseRecord, TreeRecord } from './MoreRecords';
import { InboxRecord, PrintRecord, ProcessRecord } from './SpecialRecords';
import { useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


/** Which full-page record screen each template uses. Pages without one only have a worklist. */
const RECORDS: Partial<Record<TemplateKey, ComponentType<RecordProps>>> = {
  profile: ProfileRecord,
  grid: ProfileRecord,
  dependent: ProfileRecord,
  rate: ProfileRecord,
  document: DocRecord,
  voucher: DocRecord,
  structure: DocRecord,
  request: RequestRecord,
  checklist: ChecklistRecord,
  case: CaseRecord,
  booking: BookingRecord,
  tree: TreeRecord,
  print: PrintRecord,
  inbox: InboxRecord,
  process: ProcessRecord,
};

function Resolve({ mode }: { mode: Mode }) {
 const referenceT = useReferenceLocalization().t;

  const { section, slug, id } = useParams<{ section: string; slug: string; id?: string }>();
  const def = findPage(section, slug);
  const R = def ? RECORDS[def.template] : undefined;
  const readOnly = def?.template === 'print' || def?.template === 'inbox';
  if (!def || !R || (readOnly && mode !== 'view') || (def.template === 'process' && mode === 'edit')) {
    return (
      <Empty
        icon={Compass}
        title={referenceT("This record page does not exist")}
        body={def ? `${def.title} does not have a separate ${mode} page.` : `There is no page at /${section}/${slug}.`}
        action={<Link href={def ? pagePath(def) : '/workspace/dashboard'}><Button variant="primary">{def ? `Back to ${def.title}` : referenceT("Go to dashboard")}</Button></Link>}
        className="h-full"
      />
    );
  }
  // Record screens render only once server lookups have hydrated the page definition.
  return <ReadyPage key={`${slug}/${id ?? 'new'}/${mode}`} def={def}>{(ready) => <R def={ready} id={id} mode={mode} />}</ReadyPage>;
}

export function RecordRoute({ mode }: { mode: Mode }) {
  return (
    <Suspense fallback={<RecordLoading />}>
      <Resolve mode={mode} />
    </Suspense>
  );
}
