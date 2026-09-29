'use client';
import { useReferenceRouter, useReferenceSearchParams } from '@pepbits/reference-host';
import { Suspense } from 'react';
import { MasterRecord } from '../../../../components/masters/MasterRecord';
import { MASTERS } from '../../../../lib/masters';
import { usePageHeader } from '../../../../lib/session';

function Record({ entity, id }: { entity: string; id: string }) {
  const def = MASTERS[entity];
  const router = useReferenceRouter();
  const mode = useReferenceSearchParams().get('mode') === 'edit' ? 'edit' : 'view';
  usePageHeader(def ? def.singular : 'Not found', def?.title);
  if (!def) return null;
  return (
    <div className="hc-panel flex min-h-0 flex-1 flex-col overflow-hidden">
      <MasterRecord def={def} id={id} initialMode={mode} editSignal={mode === 'edit' ? 1 : 0} onBack={() => router.push(`/masters/${entity}`)} />
    </div>
  );
}

export default function MasterRecordPage({ params }: { params: { entity: string; id: string } }) {
  return <Suspense><Record entity={params.entity} id={params.id} /></Suspense>;
}
