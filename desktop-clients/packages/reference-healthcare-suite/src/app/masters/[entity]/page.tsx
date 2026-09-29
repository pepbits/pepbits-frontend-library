'use client';
import { Suspense } from 'react';
import { MasterWorkspace } from '../../../components/masters/MasterWorkspace';
import { EmptyState } from '../../../components/ui/display';
import { MASTERS } from '../../../lib/masters';
import { usePageHeader } from '../../../lib/session';

export default function MasterPage({ params }: { params: { entity: string } }) {
  const def = MASTERS[params.entity];
  usePageHeader(def?.title ?? 'Not found', def?.description);
  if (!def) return <div className="hc-panel"><EmptyState title="This master does not exist" /></div>;
  return <Suspense><MasterWorkspace key={params.entity} entity={params.entity} /></Suspense>;
}
