"use client";
/*
 * Client page composition shared by every route: loads the route's loader endpoint (replacing the Next
 * server component), then renders the ported page. Server redirects become host navigation:
 *   requirePagePerm -> "/?denied=1", report without view -> "/reports?denied=1", foreign builder -> "/builder".
 * Ports of src/app/(app)/error.tsx and not-found.tsx are the error and not-found states here.
 */
import React, { useEffect } from 'react';
import { DashboardSkeleton, ErrorState, LoadingState, SessionExpiredState, TableSkeleton } from '@pepbits/ops-ui';
import { useReferenceHost } from '@pepbits/reference-host';
import { usePageData, useModuleRouter, type ApiError } from '../api/client';
import { Card, EmptyState, LinkButton } from '../ui/primitives';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


const REDIRECTS: Record<string, string> = { PAGE_DENIED: '/?denied=1', REPORT_DENIED: '/reports?denied=1', BUILDER_REDIRECT: '/builder' };

export function NotFoundPage() {
 const referenceT = useReferenceLocalization().t;

  return (
    <Card className="lr-narrow-card">
      <EmptyState title={referenceT("This page does not exist or you cannot open it")} action={<LinkButton href="/reports" variant="primary"><ReferenceText message="Go to the report library" /></LinkButton>}><ReferenceText message="The link may be old, or the item may have been deleted or not shared with your role." /></EmptyState>
    </Card>
  );
}

export function PageError({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
 const referenceT = useReferenceLocalization().t;

  if (error.status === 401) return <SessionExpiredState />;
  if (error.code === 'INACTIVE') return <ErrorState severity="warning" title={referenceT("Reports access is turned off")} description={error.message} />;
  return <ErrorState title={referenceT("This page could not load")} description={referenceT("If it keeps happening, send the reference to your administrator.")} detail={error.message} referenceId={error.code} onRetry={onRetry} />;
}

export function PageLoader<T>({ path, skeleton = 'table', children }: { path: string; skeleton?: 'table' | 'dashboard'; children: (data: T) => React.ReactNode }) {
  const state = usePageData<T>(path);
  const router = useModuleRouter();
  const { preferences } = useReferenceHost();
  const redirect = state.error?.code ? REDIRECTS[state.error.code] : undefined;
  useEffect(() => { if (redirect) router.replace(redirect); }, [redirect, router]);
  if (state.error) {
    if (redirect) return <LoadingState />;
    if (state.error.status === 404) return <NotFoundPage />;
    return <PageError error={state.error} onRetry={state.reload} />;
  }
  if (!state.data) return preferences.loadingSkeletons ? (skeleton === 'dashboard' ? <DashboardSkeleton /> : <TableSkeleton />) : <LoadingState />;
  return <>{children(state.data)}</>;
}
