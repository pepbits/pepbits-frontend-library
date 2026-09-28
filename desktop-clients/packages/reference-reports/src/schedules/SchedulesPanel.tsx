"use client";
// Port of lumen-reports src/components/schedules/SchedulesPanel.tsx.
import { CalendarClock, Pause, Play, Plus, RefreshCw, Send, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { ConfirmDialog, useLocalization } from '@pepbits/ops-ui';
import { useModuleRouter, useReportsClient } from '../api/client';
import { describeRange, describeTiming } from '../lib/dates';
import type { Action, DateRangeValue, Occurrence, ReportDefinition, Schedule } from '../types';
import { Badge, Button, Card, EmptyState, Modal, SelectInput, StatusBadge } from '../ui/primitives';
import { useReportFormat } from '../ui/preferences';
import { useToast } from '../ui/Toast';
import { ScheduleDialog } from '../reports/dialogs';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export function SchedulesPanel({ schedules, occurrences, reports, owners, isAdmin, userEmail, userId, timezone }: {
  schedules: Schedule[];
  occurrences: Occurrence[];
  reports: { def: ReportDefinition; actions: Action[] }[];
  owners: Record<string, string>;
  isAdmin: boolean;
  userEmail: string;
  userId: string;
  timezone: string;
}) {
 const referenceT = useReferenceLocalization().t;

  const router = useModuleRouter();
  const { api } = useReportsClient();
  const { t } = useLocalization();
  const fmt = useReportFormat();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [pick, setPick] = useState(reports[0]?.def.id ?? '');
  const [create, setCreate] = useState<{ def: ReportDefinition; actions: Action[] } | null>(null);
  const [deleting, setDeleting] = useState<Schedule | null>(null);
  const titles = new Map(reports.map((r) => [r.def.id, r.def.title]));

  const act = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(ok);
      router.refresh();
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className="lr-row lr-mb">
        <Button variant="primary" icon={<Plus className="lr-icon-sm" />} onClick={() => setPicker(true)} disabled={!reports.length}><ReferenceText message="New schedule" /></Button>
        {isAdmin && (
          <Button icon={<RefreshCw className="lr-icon-sm" />} loading={busy === 'cron'} onClick={() => act('cron', () => api('/api/cron', { method: 'POST' }), 'Scheduler ran. Due schedules were queued.')}><ReferenceText message="Process due schedules now" /></Button>
        )}
      </div>

      <Card>
        {schedules.length === 0 ? (
          <EmptyState icon={<CalendarClock className="lr-icon-lg" />} title={referenceT("No schedules yet")}><ReferenceText message="Create one here, or open any report and choose Schedule." /></EmptyState>
        ) : (
          <ul className="lr-list">
            {schedules.map((s) => {
              const occ = occurrences.filter((o) => o.scheduleId === s.id).slice(-5).reverse();
              const range = Object.values(s.filters).find((v) => v && typeof v === 'object' && !Array.isArray(v)) as DateRangeValue | undefined;
              return (
                <li key={s.id} className="lr-schedule">
                  <div className="lr-grow">
                    <div className="lr-row lr-gap-xs">
                      <p className="lr-medium">{s.name}</p>
                      <StatusBadge status={s.active ? 'active' : 'paused'} />
                      <Badge>{s.format.toUpperCase()}</Badge>
                      {s.ownerId !== userId && <Badge tone="ink">{t('Owner: {name}', { name: owners[s.ownerId] ?? s.ownerId })}</Badge>}
                    </div>
                    <p className="lr-sm lr-mt-xs">{titles.get(s.reportId) ?? s.reportId}, {t(describeRange(range)).toLowerCase()}</p>
                    <p className="lr-sm lr-muted">{describeTiming(s)}{s.endDate ? `, ${t('until {date}', { date: fmt.value(s.endDate, 'date') })}` : ''}</p>
                    <p className="lr-sm lr-muted lr-mt-xs">{t('To {to}', { to: s.recipients.join(', ') })}</p>
                    <p className="lr-xs lr-muted lr-mt-sm">
                      {t('Next run {next}. Last run {last}', { next: s.active ? fmt.dateTime(s.nextRunAt, s.timezone) : t('paused'), last: fmt.dateTime(s.lastRunAt, s.timezone) })}{s.lastStatus ? ` (${s.lastStatus})` : ''}.
                    </p>
                    {occ.length > 0 && (
                      <ul className="lr-row lr-gap-xs lr-mt-sm">
                        {occ.map((o) => (
                          <li key={o.id} title={o.note ?? o.status} className="lr-inline">
                            <StatusBadge status={o.status} /> <span className="lr-xs lr-muted">{fmt.dateTime(o.scheduledAt, timezone)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="lr-row lr-row-start">
                    <Button size="sm" icon={<Send className="lr-icon-xs" />} loading={busy === `run${s.id}`} onClick={() => act(`run${s.id}`, () => api(`/api/schedules/${s.id}/run`, { method: 'POST' }), 'Queued now. Check My reports for progress.')}><ReferenceText message="Run now" /></Button>
                    <Button size="sm" icon={s.active ? <Pause className="lr-icon-xs" /> : <Play className="lr-icon-xs" />} loading={busy === `t${s.id}`} onClick={() => act(`t${s.id}`, () => api(`/api/schedules/${s.id}`, { method: 'PATCH', body: { active: !s.active } }), s.active ? 'Schedule paused.' : 'Schedule resumed.')}>
                      {s.active ? 'Pause' : 'Resume'}
                    </Button>
                    <Button size="sm" variant="danger" icon={<Trash2 className="lr-icon-xs" />} loading={busy === `d${s.id}`} onClick={() => setDeleting(s)}><ReferenceText message="Delete" /></Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <ConfirmDialog open={!!deleting} tone="danger" title={referenceT("Delete schedule")} confirmLabel={referenceT("Delete")} message={t('Delete "{name}"?', { name: deleting?.name ?? '' })}
        onCancel={() => setDeleting(null)} onConfirm={() => { const s = deleting!; setDeleting(null); void act(`d${s.id}`, () => api(`/api/schedules/${s.id}`, { method: 'DELETE' }), 'Schedule deleted.'); }} />

      <Modal open={picker} onClose={() => setPicker(false)} title={referenceT("Choose a report to schedule")}
        footer={<><Button onClick={() => setPicker(false)}><ReferenceText message="Cancel" /></Button><Button variant="primary" onClick={() => { setCreate(reports.find((r) => r.def.id === pick) ?? null); setPicker(false); }}><ReferenceText message="Continue" /></Button></>}>
        <SelectInput label={referenceT("Report")} value={pick} onChange={(e) => setPick(e.target.value)} options={reports.map((r) => ({ value: r.def.id, label: `${r.def.title} (${r.def.category})` }))} hint={referenceT("Only reports your role may schedule are listed.")} />
      </Modal>
      {create && (
        <ScheduleDialog open onClose={() => { setCreate(null); router.refresh(); }} def={create.def} actions={create.actions}
          filters={Object.fromEntries(create.def.filters.filter((f) => f.default !== undefined).map((f) => [f.key, f.default]))}
          columns={create.def.defaultColumns} userEmail={userEmail} timezone={timezone} />
      )}
    </>
  );
}
