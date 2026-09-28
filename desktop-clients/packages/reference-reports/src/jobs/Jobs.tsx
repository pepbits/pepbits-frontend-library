"use client";
// Ports of lumen-reports src/components/jobs/JobsTable.tsx and JobResults.tsx.
import { Download, FolderDown, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow, useLocalization } from '@pepbits/ops-ui';
import { ReferenceLink } from '@pepbits/reference-host';
import { useReportsClient } from '../api/client';
import type { Job, ResultColumn, Row } from '../types';
import { DataTable, Pagination } from '../ui/DataTable';
import { Button, Card, EmptyState, StatusBadge, Toggle } from '../ui/primitives';
import { useManagedPageSize, useReportFormat } from '../ui/preferences';
import { useToast } from '../ui/Toast';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


const ORIGIN: Record<Job['origin'], string> = { screen: 'From screen', schedule: 'Schedule', email_in: 'Email request', api: 'API' };

export function JobsTable({ initial, isAdmin, timezone, userId }: { initial: Job[]; isAdmin: boolean; timezone: string; userId: string }) {
 const referenceT = useReferenceLocalization().t;

  const { api, download, canDownload } = useReportsClient();
  const { t } = useLocalization();
  const fmt = useReportFormat();
  const [jobs, setJobs] = useState(initial);
  const [all, setAll] = useState(false);
  const toast = useToast();
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const next = await api<Job[]>(`/api/jobs${all ? '?all=1' : ''}`, { signal });
      if (!signal?.aborted) setJobs(next);
    } catch (e) {
      if ((e as { name?: string })?.name !== 'AbortError') toast.error(e);
    }
  }, [api, all, toast]);
  const active = jobs.some((j) => j.status === 'queued' || j.status === 'running');
  useEffect(() => { const c = new AbortController(); void load(c.signal); return () => c.abort(); }, [load]);
  useEffect(() => {
    if (!active) return;
    const c = new AbortController();
    const timer = setInterval(() => void load(c.signal), 2500);
    return () => { clearInterval(timer); c.abort(); };
  }, [active, load]);

  const cancel = async (id: string) => {
    try {
      await api(`/api/jobs/${id}`, { method: 'DELETE' });
      toast.success('Cancellation requested.');
      void load();
    } catch (e) {
      toast.error(e);
    }
  };

  return (
    <Card>
      <div className="lr-row lr-row-between lr-card-bar">
        <p className="lr-sm lr-muted">{t('Files are kept for a limited time, then removed automatically.')}</p>
        {isAdmin && <Toggle checked={all} onChange={setAll} label={referenceT("Show everyone's reports")} />}
      </div>
      {jobs.length === 0 ? (
        <EmptyState icon={<FolderDown className="lr-icon-lg" />} title={referenceT("No background reports yet")}><ReferenceText message="When a period is too long for the screen, choose Run in background on the report. Scheduled and emailed reports also appear here." /></EmptyState>
      ) : (
        <TableContainer className="lr-table-scroll">
          <Table className="lr-table">
            <TableHeader>
              <TableRow>
                <TableHead>{t('Report')}</TableHead>
                <TableHead>{t('Status')}</TableHead>
                <TableHead>{t('Progress')}</TableHead>
                <TableHead className="lr-end">{t('Rows')}</TableHead>
                <TableHead>{t('Delivery')}</TableHead>
                <TableHead>{t('Requested')}</TableHead>
                <TableHead><span className="lr-sr-only">{t('Actions')}</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((j) => (
                <TableRow key={j.id} className="lr-top">
                  <TableCell>
                    <ReferenceLink href={`/jobs/${j.id}`} className="lr-medium lr-plain-link lr-hover-underline">{j.reportTitle}</ReferenceLink>
                    <p className="lr-xs lr-muted">{t(ORIGIN[j.origin])}, {j.format.toUpperCase()}{j.userId !== userId ? `, ${t('user {id}', { id: j.userId })}` : ''}</p>
                  </TableCell>
                  <TableCell><StatusBadge status={j.status} />{j.error && <p className="lr-xs lr-danger-ink lr-w-220">{j.error}</p>}</TableCell>
                  <TableCell>
                    <div className="lr-progress" role="progressbar" aria-valuenow={j.progress} aria-valuemin={0} aria-valuemax={100} aria-label={t('Progress')}>
                      <div className={`lr-progress-fill lr-progress-${j.status}`} style={{ width: `${j.progress}%` }} />
                    </div>
                    <p className="lr-num lr-xs lr-muted lr-mt-xs">{j.chunksTotal ? t('{done} of {total} months', { done: j.chunksDone, total: j.chunksTotal }) : j.status === 'queued' ? t('Waiting') : ''}</p>
                  </TableCell>
                  <TableCell className="lr-num lr-end">{j.rowCount ? fmt.count(j.rowCount) : '–'}<p className="lr-xs lr-muted">{j.resultBytes ? fmt.bytes(j.resultBytes) : ''}</p></TableCell>
                  <TableCell className="lr-xs lr-w-240">{j.deliver === 'email' ? t('Email to {to}', { to: j.recipients.join(', ') }) : t('Download')}{j.deliveryNote && <p className="lr-muted">{j.deliveryNote}</p>}</TableCell>
                  <TableCell className="lr-nowrap lr-xs lr-muted">{fmt.dateTime(j.createdAt, timezone)}</TableCell>
                  <TableCell className="lr-nowrap lr-end">
                    {j.status === 'completed' && (
                      <Button size="sm" icon={<Download className="lr-icon-xs" />} disabled={!canDownload} title={canDownload ? undefined : t('Downloads are not available in this host.')} onClick={() => download(`/api/jobs/${j.id}/download`).catch(toast.error)}><ReferenceText message="Download" /></Button>
                    )}
                    {(j.status === 'queued' || j.status === 'running') && (
                      <Button size="sm" variant="ghost" icon={<X className="lr-icon-xs" />} onClick={() => cancel(j.id)}><ReferenceText message="Cancel" /></Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Card>
  );
}

interface ResultPage {
  columns: ResultColumn[];
  rows: Row[];
  total: number;
  page: number;
  pageSize: number;
  maskedColumns: string[];
}

/** Pages through the job's stored result copy; the source data is not queried again. */
export function JobResults({ job }: { job: Job }) {
  const { api, download, canDownload } = useReportsClient();
  const { t } = useLocalization();
  const managed = useManagedPageSize();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ResultPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const pageSize = managed.pageSize;
  useEffect(() => { setPage(1); }, [pageSize]);
  useEffect(() => {
    if (job.status !== 'completed') return;
    const controller = new AbortController();
    setLoading(true);
    api<ResultPage>(`/api/jobs/${job.id}/results?page=${page}&pageSize=${Math.max(10, pageSize)}`, { signal: controller.signal })
      .then((d) => { setData(d); setError(null); })
      .catch((e) => { if (e?.name !== 'AbortError') setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [api, job.id, job.status, page, pageSize]);

  if (job.status !== 'completed') {
    return <Card className="lr-pad-lg lr-sm lr-muted">{t('Results appear here when the report has finished. Current status: {status}.', { status: job.status })}</Card>;
  }
  return (
    <Card>
      <div className="lr-row lr-row-between lr-card-bar">
        <p className="lr-sm lr-muted">{t('Browsing the saved result. Changing pages does not re-run the report.')}</p>
        <Button size="sm" variant="primary" icon={<Download className="lr-icon-xs" />} disabled={!canDownload} onClick={() => download(`/api/jobs/${job.id}/download`).catch(toast.error)}>
          {t('Download {format}', { format: job.format.toUpperCase() })}
        </Button>
      </div>
      {error ? <p role="alert" className="lr-pad lr-sm lr-danger-ink">{error}</p> : (
        <>
          <DataTable columns={data?.columns ?? []} rows={data?.rows ?? []} loading={loading} maxHeight="tall" caption={job.reportTitle} />
          {data && <Pagination page={page} pageSize={pageSize} total={data.total} onPage={setPage} onPageSize={managed.setPageSize} pageSizeLocked={managed.locked} />}
        </>
      )}
    </Card>
  );
}
