"use client";
// Port of lumen-reports src/components/reports/dialogs.tsx.
import { ArrowDown, ArrowUp, Lock } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { DateInput, IconButton, TimeInput, useLocalization } from '@pepbits/ops-ui';
import { ReferenceLink } from '@pepbits/reference-host';
import { useReportsClient } from '../api/client';
import { COMMON_TIMEZONES, describeTiming, PRESET_LABELS, PRESETS } from '../lib/dates';
import type { Action, DatePreset, DateRangeValue, FilterValues, Frequency, OutputFormat, ReportDefinition, SortSpec } from '../types';
import { Button, Checkbox, Modal, Notice, SelectInput, TextInput } from '../ui/primitives';
import { useExportPreference } from '../ui/preferences';
import { useToast } from '../ui/Toast';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export const FORMAT_LABEL: Record<OutputFormat, string> = { xlsx: 'Excel (.xlsx)', csv: 'CSV', json: 'JSON' };
const FORMAT_ACTION: Record<OutputFormat, Action> = { csv: 'export_csv', xlsx: 'export_xlsx', json: 'export_json' };

export function allowedFormats(actions: Action[]): OutputFormat[] {
  return (['xlsx', 'csv', 'json'] as OutputFormat[]).filter((f) => actions.includes(FORMAT_ACTION[f]));
}

/** Formats the role may use (server actions) narrowed and ordered by the host export preference. */
export function useAllowedFormats(actions: Action[]): OutputFormat[] {
  const pref = useExportPreference();
  return pref.filter(allowedFormats(actions));
}

function parseEmails(s: string) {
  return s.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);
}

// ---------------------------------------------------------------------------

export function ColumnPicker({ open, onClose, def, value, onApply, sensitive, unmask }: {
  open: boolean;
  onClose: () => void;
  def: ReportDefinition;
  value: string[];
  onApply: (cols: string[]) => void;
  sensitive: string[];
  unmask: boolean;
}) {
 const referenceT = useReferenceLocalization().t;

  const { t } = useLocalization();
  const [cols, setCols] = useState<string[]>(value);
  useEffect(() => { if (open) setCols(value); }, [open, value]);
  const byKey = new Map(def.columns.map((c) => [c.key, c]));
  const hidden = def.columns.filter((c) => !cols.includes(c.key));
  const move = (i: number, d: -1 | 1) => {
    const n = [...cols];
    const j = i + d;
    if (j < 0 || j >= n.length) return;
    [n[i], n[j]] = [n[j], n[i]];
    setCols(n);
  };
  return (
    <Modal open={open} onClose={onClose} title={referenceT("Columns")} description={referenceT("Add optional columns, remove ones you do not need and set their order. Save a view to keep the layout.")} wide
      footer={<>
        <Button variant="ghost" onClick={() => setCols(def.defaultColumns)}><ReferenceText message="Reset to report default" /></Button>
        <Button onClick={onClose}><ReferenceText message="Cancel" /></Button>
        <Button variant="primary" disabled={!cols.length} onClick={() => { onApply(cols); onClose(); }}><ReferenceText message="Apply columns" /></Button>
      </>}>
      <div className="lr-grid-2 lr-gap-lg">
        <div>
          <p className="lr-label">{t('Shown, in order')}</p>
          <ul className="lr-stack-xs">
            {cols.map((k, i) => {
              const c = byKey.get(k);
              if (!c) return null;
              const locked = def.groupBy.includes(k);
              return (
                <li key={k} className="lr-pick-row">
                  <Checkbox checked disabled={locked} onChange={() => setCols(cols.filter((x) => x !== k))} label={c.label} />
                  {sensitive.includes(k) && !unmask && <Lock className="lr-icon-xs lr-warn-ink" aria-label={t('masked for your role')} />}
                  {c.expression && <span className="lr-xs lr-muted">{t('computed')}</span>}
                  <span className="lr-ml-auto lr-row lr-gap-none">
                    <IconButton label={t('Move {label} up', { label: c.label })} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="lr-icon-sm" /></IconButton>
                    <IconButton label={t('Move {label} down', { label: c.label })} disabled={i === cols.length - 1} onClick={() => move(i, 1)}><ArrowDown className="lr-icon-sm" /></IconButton>
                  </span>
                </li>
              );
            })}
          </ul>
          {def.groupBy.length > 0 && <p className="lr-hint">{t('Grouping columns stay visible so each row is labelled.')}</p>}
        </div>
        <div>
          <p className="lr-label">{t('Available to add')}</p>
          {hidden.length === 0 ? <p className="lr-sm lr-muted">{t('All columns are shown.')}</p> : (
            <ul className="lr-stack-xs">
              {hidden.map((c) => (
                <li key={c.key} className="lr-pick-row lr-pick-row-available">
                  <Checkbox checked={false} onChange={() => setCols([...cols, c.key])} label={c.label} />
                  {sensitive.includes(c.key) && !unmask && <Lock className="lr-icon-xs lr-warn-ink" aria-label={t('masked for your role')} />}
                </li>
              ))}
            </ul>
          )}
          {!unmask && sensitive.length > 0 && <p className="lr-hint lr-mt">{t('Columns with a lock contain sensitive data and appear masked for your role.')}</p>}
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

export function SaveViewDialog({ open, onClose, reportId, columns, filters, sort, roles, canRoleViews, onSaved }: {
  open: boolean;
  onClose: () => void;
  reportId: string;
  columns: string[];
  filters: FilterValues;
  sort?: SortSpec;
  roles: { id: string; name: string }[];
  canRoleViews: boolean;
  onSaved: () => void;
}) {
 const referenceT = useReferenceLocalization().t;

  const { api } = useReportsClient();
  const { t } = useLocalization();
  const [name, setName] = useState('');
  const [scope, setScope] = useState<'user' | 'role'>('user');
  const [roleId, setRoleId] = useState(roles[0]?.id ?? '');
  const [isDefault, setDefault] = useState(true);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const save = async () => {
    setBusy(true);
    try {
      await api(`/api/reports/${reportId}/views`, { body: { name, columns, filters, sort, scope, roleId: scope === 'role' ? roleId : undefined, isDefault } });
      toast.success(scope === 'role' ? t('View saved for the {role} role.', { role: roles.find((r) => r.id === roleId)?.name ?? roleId }) : 'View saved.');
      onSaved();
      onClose();
      setName('');
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title={referenceT("Save view")} description={referenceT("Keeps the current columns, filters and sort order.")}
      footer={<><Button onClick={onClose}><ReferenceText message="Cancel" /></Button><Button variant="primary" loading={busy} disabled={!name.trim()} onClick={save}><ReferenceText message="Save view" /></Button></>}>
      <div className="lr-stack">
        <TextInput label={referenceT("View name")} value={name} onChange={(e) => setName(e.target.value)} placeholder={referenceT("For example: Month-end with discounts")} />
        {canRoleViews && (
          <SelectInput label={referenceT("Who is this view for?")} value={scope} onChange={(e) => setScope(e.target.value as 'user' | 'role')}
            options={[{ value: 'user', label: 'Just me' }, { value: 'role', label: 'Everyone in a role' }]} />
        )}
        {scope === 'role' && (
          <SelectInput label={referenceT("Role")} value={roleId} onChange={(e) => setRoleId(e.target.value)} options={roles.map((r) => ({ value: r.id, label: r.name }))}
            hint={referenceT("A role default applies to everyone in the role unless they set a personal default.")} />
        )}
        <Checkbox checked={isDefault} onChange={setDefault} label={scope === 'role' ? 'Open this report with this view for the role' : 'Open this report with this view'} />
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

export function BackgroundDialog({ open, onClose, def, actions, filters, columns, sort, userEmail, reason, mode }: {
  open: boolean;
  onClose: () => void;
  def: ReportDefinition;
  actions: Action[];
  filters: FilterValues;
  columns: string[];
  sort?: SortSpec;
  userEmail: string;
  reason?: string | null;
  mode: 'background' | 'email';
}) {
 const referenceT = useReferenceLocalization().t;

  const { api } = useReportsClient();
  const { t } = useLocalization();
  const formats = useAllowedFormats(actions);
  const canEmail = actions.includes('email');
  const [format, setFormat] = useState<OutputFormat>(formats[0] ?? 'xlsx');
  const [deliver, setDeliver] = useState<'email' | 'download'>(canEmail ? 'email' : 'download');
  const [recipients, setRecipients] = useState(userEmail);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const toast = useToast();
  useEffect(() => { if (open) { setDone(null); setDeliver(canEmail ? 'email' : 'download'); setRecipients(userEmail); } }, [open, canEmail, userEmail]);
  // A preference or policy change can remove the selected format.
  useEffect(() => { if (formats.length && !formats.includes(format)) setFormat(formats[0]); }, [formats, format]);

  const submit = async () => {
    setBusy(true);
    try {
      const job = await api<{ id: string }>('/api/jobs', { body: { reportId: def.id, filters, columns, sort, format, deliver, recipients: deliver === 'email' ? parseEmails(recipients) : [] } });
      setDone(job.id);
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  };
  if (!formats.length) {
    return (
      <Modal open={open} onClose={onClose} title={referenceT("Export not available")} footer={<Button onClick={onClose}><ReferenceText message="Close" /></Button>}>
        <p className="lr-sm">{t('Your role can view this report on screen but cannot export or email it. Ask an administrator for export access.')}</p>
      </Modal>
    );
  }
  return (
    <Modal open={open} onClose={onClose} title={mode === 'email' ? 'Email this report' : 'Run in the background'}
      description={mode === 'email' ? 'The report is prepared on the server with your current filters and emailed when ready.' : 'The report is processed month by month on the server. You can keep working and download it from My reports.'}
      footer={done ? <><ReferenceLink href="/jobs" className="lr-link lr-sm lr-medium" onClick={onClose}>{t('Open My reports')}</ReferenceLink><Button onClick={onClose}><ReferenceText message="Close" /></Button></> : <><Button onClick={onClose}><ReferenceText message="Cancel" /></Button><Button variant="primary" loading={busy} onClick={submit}>{deliver === 'email' ? 'Queue and email' : 'Queue report'}</Button></>}>
      {done ? (
        <p className="lr-sm">{t('Queued as')} <code className="lr-code">{done}</code>. {t('Progress shows in My reports.')}{deliver === 'email' ? ` ${t('The file is emailed when it is ready.')}` : ''}</p>
      ) : (
        <div className="lr-stack">
          {reason && <Notice tone="warning">{reason}</Notice>}
          <SelectInput label={referenceT("File format")} value={format} onChange={(e) => setFormat(e.target.value as OutputFormat)} options={formats.map((f) => ({ value: f, label: FORMAT_LABEL[f] }))} />
          <SelectInput label={referenceT("When it is ready")} value={deliver} onChange={(e) => setDeliver(e.target.value as 'email' | 'download')}
            options={[...(canEmail ? [{ value: 'email', label: 'Email it' }] : []), { value: 'download', label: 'Keep it in My reports for download' }]} />
          {deliver === 'email' && (
            <TextInput label={referenceT("Recipients")} value={recipients} onChange={(e) => setRecipients(e.target.value)}
              hint={referenceT("Separate addresses with commas. Only registered users and approved domains are allowed. Large or sensitive files are sent as a secure link.")} />
          )}
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function ScheduleDialog({ open, onClose, def, actions, filters, columns, userEmail, timezone }: {
  open: boolean;
  onClose: () => void;
  def: ReportDefinition;
  actions: Action[];
  filters: FilterValues;
  columns: string[];
  userEmail: string;
  timezone: string;
}) {
 const referenceT = useReferenceLocalization().t;

  const { api } = useReportsClient();
  const { t } = useLocalization();
  const formats = useAllowedFormats(actions);
  const dateKey = def.filters.find((f) => f.type === 'daterange')?.key;
  const current = (dateKey ? filters[dateKey] : undefined) as DateRangeValue | undefined;
  const [name, setName] = useState(`${def.title}`);
  const [preset, setPreset] = useState<DatePreset>(current && current.preset !== 'custom' ? current.preset : 'yesterday');
  const [format, setFormat] = useState<OutputFormat>(formats[0] ?? 'xlsx');
  const [frequency, setFrequency] = useState<Frequency>('daily');
  const [dayOfWeek, setDow] = useState(1);
  const [dayOfMonth, setDom] = useState(1);
  const [time, setTime] = useState('07:00');
  const [tz, setTz] = useState(timezone);
  const [recipients, setRecipients] = useState(userEmail);
  const [endDate, setEndDate] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const [hour, minute] = time.split(':').map(Number);
  useEffect(() => { if (formats.length && !formats.includes(format)) setFormat(formats[0]); }, [formats, format]);

  const submit = async () => {
    setBusy(true);
    try {
      await api('/api/schedules', {
        body: {
          name, reportId: def.id, columns, format, recipients: parseEmails(recipients), frequency, dayOfWeek, dayOfMonth, hour, minute, timezone: tz, endDate,
          filters: { ...filters, ...(dateKey ? { [dateKey]: { preset } } : {}) },
        },
      });
      toast.success('Schedule created. Manage it under Schedules.');
      onClose();
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title={referenceT("Schedule this report")} wide description={referenceT("Uses the current columns and filters. The period moves with each run.")}
      footer={<><Button onClick={onClose}><ReferenceText message="Cancel" /></Button><Button variant="primary" loading={busy} disabled={!name.trim() || !recipients.trim() || !formats.length} onClick={submit}><ReferenceText message="Create schedule" /></Button></>}>
      <div className="lr-grid-2">
        <TextInput label={referenceT("Schedule name")} value={name} onChange={(e) => setName(e.target.value)} />
        <SelectInput label={referenceT("Period in each run")} value={preset} onChange={(e) => setPreset(e.target.value as DatePreset)}
          options={PRESETS.filter((p) => p !== 'custom').map((p) => ({ value: p, label: PRESET_LABELS[p] }))}
          hint={current?.preset === 'custom' ? 'Fixed dates cannot repeat, so choose a relative period.' : undefined} />
        <SelectInput label={referenceT("Frequency")} value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)} options={[{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }]} />
        {frequency === 'weekly' && <SelectInput label={referenceT("Day")} value={String(dayOfWeek)} onChange={(e) => setDow(Number(e.target.value))} options={DAYS.map((d, i) => ({ value: String(i + 1), label: d }))} />}
        {frequency === 'monthly' && <SelectInput label={referenceT("Day of month")} value={String(dayOfMonth)} onChange={(e) => setDom(Number(e.target.value))} options={Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))} hint={referenceT("Shorter months run on their last day.")} />}
        <TimeInput label={referenceT("Time")} value={time} onChange={(e) => setTime(e.target.value)} />
        <SelectInput label={referenceT("Time zone")} value={tz} onChange={(e) => setTz(e.target.value)} options={[...new Set([timezone, ...COMMON_TIMEZONES])].map((z) => ({ value: z, label: z }))} />
        <SelectInput label={referenceT("Format")} value={format} onChange={(e) => setFormat(e.target.value as OutputFormat)} options={formats.map((f) => ({ value: f, label: FORMAT_LABEL[f] }))} />
        <DateInput label={referenceT("End date (optional)")} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        <div className="lr-span-full">
          <TextInput label={referenceT("Recipients")} value={recipients} onChange={(e) => setRecipients(e.target.value)} hint={referenceT("Comma-separated. Registered users and approved domains only.")} />
        </div>
      </div>
      <p className="lr-notice lr-notice-info lr-mt">
        {t('{timing}, covering {period}, as {format}.', { timing: describeTiming({ frequency, dayOfWeek, dayOfMonth, hour: hour || 0, minute: minute || 0, timezone: tz }), period: t(PRESET_LABELS[preset]).toLowerCase(), format: FORMAT_LABEL[format] })}
      </p>
    </Modal>
  );
}
