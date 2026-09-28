'use client';
import type { ReactNode } from 'react';
import { useReferenceHost } from '@pepbits/reference-host';
import { useCompanyProfile, type CompanyProfile } from '../lib/api';
import { Skeleton, ErrorNote } from './ui';
import { LocalizedText as ReferenceText } from '@pepbits/ops-ui';
import { useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';



/**
 * Renders print content only once the company profile has loaded. While loading it shows a
 * placeholder, on failure a retryable error; the print action should use `ready`.
 */
export function CompanyGate({ children }: { children: (company: CompanyProfile) => ReactNode }) {
 const referenceT = useReferenceLocalization().t;

  const profile = useCompanyProfile();
  const { preferences } = useReferenceHost();
  if (profile.status === 'error') return <ErrorNote message={`Company details could not be loaded. ${profile.error ?? ''}`.trim()} onRetry={profile.retry} />;
  if (!profile.data) return <div aria-busy="true" className="w-[794px] space-y-3 bg-surface p-12">{preferences.loadingSkeletons === false && <p role="status"><ReferenceText message="Loading company details…" /></p>}<Skeleton className="h-6 w-64" /><Skeleton className="h-4 w-96" /><Skeleton className="h-40 w-full" /></div>;
  return <>{children(profile.data)}</>;
}
