'use client';
/*
 * Boundary between a sanitized PageDef and its renderer: waits for server lookups,
 * shows the shared skeleton while loading and a recoverable error with retry. It never
 * renders a page with empty stand-in value lists.
 */
import type { ReactNode } from 'react';
import { useReferenceHost } from '@pepbits/reference-host';
import { TableSkeleton } from '@pepbits/ops-ui';
import type { PageDef } from '../lib/types';
import { usePageDefinition } from '../lib/api';
import { ErrorNote } from './ui';
import { LocalizedText as ReferenceText } from '@pepbits/ops-ui';
import { useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';



export function ReadyPage({ def, children }: { def: PageDef; children: (def: PageDef) => ReactNode }) {
 const referenceT = useReferenceLocalization().t;

  const page = usePageDefinition(def);
  const { preferences } = useReferenceHost();
  if (page.status === 'error') return <ErrorNote message={`${def.title} could not load its field values. ${page.error ?? ''}`.trim()} onRetry={page.retry} />;
  if (!page.def) return <div aria-busy="true" className="h-full">{preferences.loadingSkeletons === false ? <p role="status"><ReferenceText message="Loading field values…" /></p> : <TableSkeleton />}</div>;
  return <>{children(page.def)}</>;
}
