'use client';
import {ReferenceLink as Link} from '@pepbits/reference-host';
import { useMemo } from 'react';
import { useResource } from '../../../lib/hooks';
import { ErrorBanner, Loading, PageHeader } from '../../../components/ui';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export default function MastersIndex() {
 const referenceT = useReferenceLocalization().t;

  const { data, error, reload } = useResource<any[]>('/masters/meta');
  const groups = useMemo(() => {
    const m = new Map<string, any[]>();
    (data || []).forEach((e) => m.set(e.group, [...(m.get(e.group) || []), e]));
    return [...m.entries()];
  }, [data]);
  if (error) return <ErrorBanner error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  return (
    <>
      <PageHeader title={referenceT("Master data")} subtitle={referenceT("Catalogue, reference ranges, specimen definitions, analyzers, interfaces and reporting. Changes apply immediately to new work.")} />
      <div className="columns-1 gap-4 lg:columns-2 2xl:columns-3">
        {groups.map(([g, list]) => (
          <section key={g} className="panel mb-4 break-inside-avoid">
            <h2 className="border-b border-line px-4 py-2.5 text-sm font-semibold">{g}</h2>
            <ul className="divide-y divide-line">
              {list.map((e) => (
                <li key={e.key}><Link href={`/masters/${e.key}`} className="block px-4 py-2.5 hover:bg-hema-50/50">
                  <div className="text-sm font-medium text-hema-700"><ReferenceText message={e.label} /></div>
                  <div className="text-xs text-ink-soft">{e.description}</div>
                </Link></li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
