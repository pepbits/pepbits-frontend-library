"use client";
// Port of lumen-reports src/components/admin/SettingsForm.tsx. These are the report service's organisation
// rules (limits, delivery, email-in). Display formatting of dates and amounts follows each user's preferences.
import React, { useEffect, useState } from 'react';
import { useLocalization } from '@pepbits/ops-ui';
import { useModuleRouter, useReportsClient } from '../api/client';
import type { Settings } from '../types';
import { Button, Card, CardHeader, SelectInput, TextInput, Toggle } from '../ui/primitives';
import { useToast } from '../ui/Toast';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export function SettingsForm({ initial, smtp, timezones }: { initial: Settings; smtp: boolean; timezones: string[] }) {
 const referenceT = useReferenceLocalization().t;

  const { api } = useReportsClient();
  const { t } = useLocalization();
  const [s, setS] = useState(initial);
  const [domains, setDomains] = useState(initial.allowedRecipientDomains.join(', '));
  const [busy, setBusy] = useState(false);
  const router = useModuleRouter();
  const toast = useToast();
  useEffect(() => { setS(initial); setDomains(initial.allowedRecipientDomains.join(', ')); }, [initial]);
  const num = (k: keyof Settings) => ({ type: 'number', value: String(s[k] as number), onChange: (e: React.ChangeEvent<HTMLInputElement>) => setS({ ...s, [k]: Number(e.target.value) }) });
  const save = async () => {
    setBusy(true);
    try {
      await api('/api/admin/settings', { method: 'PUT', body: { ...s, allowedRecipientDomains: domains.split(/[,\s]+/).map((d) => d.trim()).filter(Boolean) } });
      toast.success('Settings saved. Cached report results were cleared.');
      router.refresh();
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="lr-stack">
      <Card>
        <CardHeader title={referenceT("Organisation")} description={referenceT("Number and currency display on screen follows each person's preferences. Currency here labels exported files.")} />
        <div className="lr-grid-4 lr-pad">
          <TextInput label={referenceT("Organisation name")} value={s.orgName} onChange={(e) => setS({ ...s, orgName: e.target.value })} />
          <SelectInput label={referenceT("Reporting time zone")} value={s.timezone} onChange={(e) => setS({ ...s, timezone: e.target.value })} options={[...new Set([s.timezone, ...timezones])].map((z) => ({ value: z, label: z }))} hint={referenceT("Used to resolve periods such as yesterday.")} />
          <TextInput label={referenceT("Number format locale")} value={s.locale} onChange={(e) => setS({ ...s, locale: e.target.value })} hint={referenceT("For example en-IN, en-GB, en-US.")} />
          <TextInput label={referenceT("Currency")} value={s.currency} maxLength={3} onChange={(e) => setS({ ...s, currency: e.target.value.toUpperCase() })} />
        </div>
      </Card>

      <Card>
        <CardHeader title={referenceT("On-screen limits")} description={referenceT("Requests above these limits are not loaded in the browser. People are offered a background run that is emailed or saved to My reports. Individual reports can set tighter limits.")} />
        <div className="lr-grid-3 lr-pad">
          <TextInput label={referenceT("Longest period on screen (days)")} {...num('maxOnlineRangeDays')} hint={referenceT("1096 days is three years.")} />
          <TextInput label={referenceT("Most rows on screen")} {...num('maxOnlineRows')} hint={referenceT("Applies to row-detail reports.")} />
          <TextInput label={referenceT("Rows per page")} {...num('defaultPageSize')} hint={referenceT("Used by API pulls and as the service default. Screens follow each person's page-size preference.")} />
        </div>
      </Card>

      <Card>
        <CardHeader title={referenceT("Background reports")} description={referenceT("Large reports are split into monthly chunks and processed on the server.")} />
        <div className="lr-grid-3 lr-pad">
          <TextInput label={referenceT("Reports in progress per person")} {...num('maxActiveJobsPerUser')} hint={referenceT("Scheduled runs are not counted.")} />
          <TextInput label={referenceT("Reports processed at once (server)")} {...num('maxConcurrentJobs')} hint={referenceT("One per person at a time, for fairness.")} />
          <TextInput label={referenceT("Keep results for (hours)")} {...num('resultRetentionHours')} hint={referenceT("Files and saved results are deleted after this.")} />
        </div>
      </Card>

      <Card>
        <CardHeader title={referenceT("Email delivery")} description={smtp ? 'Outgoing email is configured.' : 'This demo never sends email: every message is recorded in the outbox as not sent.'} />
        <div className="lr-grid-2 lr-pad">
          <TextInput label={referenceT("Largest attachment (MB)")} {...num('maxAttachmentMb')} hint={referenceT("Bigger files, and any file with unmasked sensitive data, are sent as a sign-in link.")} />
          <TextInput label={referenceT("Allowed recipient domains")} value={domains} onChange={(e) => setDomains(e.target.value)} hint={referenceT("Registered users can always receive reports. Other addresses must be in these domains.")} />
        </div>
      </Card>

      <Card>
        <CardHeader title={referenceT("Email requests")} description={referenceT("Registered users can request reports by emailing the reports mailbox.")} />
        <div className="lr-grid-2 lr-pad">
          <Toggle checked={s.emailIn.enabled} onChange={(v) => setS({ ...s, emailIn: { ...s.emailIn, enabled: v } })} label={referenceT("Accept email requests")} />
          <Toggle checked={s.emailIn.requireAuthPass} onChange={(v) => setS({ ...s, emailIn: { ...s.emailIn, requireAuthPass: v } })} label={referenceT("Require sender authentication")} description={referenceT("Reject email unless DMARC, or both SPF and DKIM, pass. Keep this on in production.")} />
          <TextInput label={referenceT("Reports mailbox")} value={s.emailIn.mailbox} onChange={(e) => setS({ ...s, emailIn: { ...s.emailIn, mailbox: e.target.value } })} />
          <TextInput label={referenceT("Requests per person per hour")} type="number" value={String(s.emailIn.maxPerHour)} onChange={(e) => setS({ ...s, emailIn: { ...s.emailIn, maxPerHour: Number(e.target.value) } })} />
        </div>
      </Card>

      <Card>
        <CardHeader title={referenceT("API and BI tools")} />
        <div className="lr-grid-3 lr-pad">
          <TextInput label={referenceT("Most rows per API page")} {...num('apiMaxRows')} />
        </div>
      </Card>

      <div className="lr-save-bar">
        <span className="lr-xs lr-muted">{t('Changes apply to every report, schedule and API pull after saving.')}</span>
        <Button variant="primary" loading={busy} onClick={save}><ReferenceText message="Save settings" /></Button>
      </div>
    </div>
  );
}
