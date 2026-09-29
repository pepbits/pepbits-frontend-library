'use client';
import { useReferenceRouter } from '@pepbits/reference-host';
import { MasterRecord } from '../../../../components/masters/MasterRecord';
import { MASTERS } from '../../../../lib/masters';
import { usePageHeader } from '../../../../lib/session';

export default function NewMasterPage({ params }: { params: { entity: string } }) {
  const def = MASTERS[params.entity];
  const router = useReferenceRouter();
  usePageHeader(def ? `New ${def.singular.toLowerCase()}` : 'Not found', def?.title);
  if (!def) return null;
  const back = () => router.push(`/masters/${params.entity}`);
  return (
    <div className="hc-panel flex min-h-0 flex-1 flex-col overflow-hidden">
      <MasterRecord def={def} id={null} initialMode="new" onBack={back} onCancelNew={back} onSaved={(row, _c, again) => !again && router.replace(`/masters/${params.entity}/${row.id}`)} />
    </div>
  );
}
