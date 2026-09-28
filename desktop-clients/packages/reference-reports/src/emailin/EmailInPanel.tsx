"use client";
// Port of lumen-reports src/components/emailin/EmailInPanel.tsx. The simulator runs the demo store's real
// processing; replies are recorded in the outbox and never sent.
import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow, useLocalization } from '@pepbits/ops-ui';
import { useModuleRouter, useReportsClient } from '../api/client';
import type { InboundLog } from '../types';
import { Button, Card, CardHeader, EmptyState, Notice, StatusBadge, TextInput, Toggle } from '../ui/primitives';
import { useReportFormat } from '../ui/preferences';
import { useToast } from '../ui/Toast';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export function EmailInPanel({ help, mailbox, enabled, logs, isAdmin, userEmail, examples, timezone }: {
  help: string;
  mailbox: string;
  enabled: boolean;
  logs: InboundLog[];
  isAdmin: boolean;
  userEmail: string;
  examples: string[];
  timezone: string;
}) {
 const referenceT = useReferenceLocalization().t;

  const { api } = useReportsClient();
  const { t } = useLocalization();
  const fmt = useReportFormat();
  const [subject, setSubject] = useState(examples[0] ?? 'HELP');
  const [from, setFrom] = useState(userEmail);
  const [authPass, setAuthPass] = useState(true);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<InboundLog | null>(null);
  const toast = useToast();
  const router = useModuleRouter();
  const send = async () => {
    setBusy(true);
    try {
      const r = await api<InboundLog>('/api/email-in/simulate', { body: { subject, from: isAdmin ? from : undefined, authPass } });
      setLast(r);
      router.refresh();
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="lr-two-col-xl">
      <Card>
        <CardHeader title={referenceT("How to request a report by email")} description={<>{t('Send an email to')} <strong>{mailbox}</strong> {t('from your registered address. Put the command in the subject.')}</>} />
        <pre className="lr-pre lr-pad">{help}</pre>
        <p className="lr-card-footnote">
          {t('Requests from unknown or unverified senders are dropped without a reply. Results are only ever sent back to the sender, with your role, branches and masking applied.')}
          {!enabled && ` ${t('Email requests are currently turned off by an administrator.')}`}
        </p>
      </Card>

      <Card>
        <CardHeader title={referenceT("Try it here")} description={referenceT("Simulates an incoming email and runs the real processing. Replies appear in the email outbox.")} />
        <div className="lr-stack lr-pad">
          {isAdmin && <TextInput label={referenceT("From")} value={from} onChange={(e) => setFrom(e.target.value)} hint={referenceT("Administrators can test other senders, including unregistered ones.")} />}
          <TextInput label={referenceT("Subject")} value={subject} onChange={(e) => setSubject(e.target.value)} />
          <div className="lr-row lr-gap-xs">
            {examples.map((x) => <button type="button" key={x} onClick={() => setSubject(x)} className="lr-chip">{x}</button>)}
          </div>
          <Toggle checked={authPass} onChange={setAuthPass} label={referenceT("Sender passes SPF, DKIM and DMARC")} description={referenceT("Turn off to see how a spoofed email is rejected.")} />
          <div><Button variant="primary" loading={busy} onClick={send}><ReferenceText message="Send test email" /></Button></div>
          {last && (
            <Notice tone={last.status === 'accepted' ? 'success' : 'danger'} role="status">
              {t(last.status === 'accepted' ? 'Accepted' : 'Rejected')}: {last.reason}{last.jobId ? ` ${t('Job {id}.', { id: last.jobId })}` : ''}
            </Notice>
          )}
        </div>
      </Card>

      <Card className="lr-span-full">
        <CardHeader title={isAdmin ? 'All email requests' : 'Your email requests'} />
        {logs.length === 0 ? <EmptyState title={referenceT("No email requests yet")} /> : (
          <TableContainer className="lr-table-scroll">
            <Table className="lr-table">
              <TableHeader><TableRow>
                <TableHead>{t('Received')}</TableHead><TableHead>{t('From')}</TableHead><TableHead>{t('Subject')}</TableHead><TableHead>{t('Result')}</TableHead><TableHead>{t('Reason')}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="lr-nowrap lr-xs lr-muted">{fmt.dateTime(l.at, timezone)}</TableCell>
                    <TableCell>{l.from}</TableCell>
                    <TableCell><code className="lr-xs">{l.subject}</code></TableCell>
                    <TableCell><StatusBadge status={l.status} /></TableCell>
                    <TableCell className="lr-xs">{l.reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>
    </div>
  );
}
