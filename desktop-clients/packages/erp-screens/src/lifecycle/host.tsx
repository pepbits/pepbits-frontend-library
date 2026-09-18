'use client';
import React from 'react';
import { Card, Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow, useLocalization } from '@pepbits/ops-ui';
import { LIFECYCLE_TARGET_KINDS, type LifecycleHostInfo } from '@pepbits/erp-config/lifecycle';
import styles from './lifecycle.module.css';

/**
 * What the host reports as installed. Statuses, modes and messages are host facts shown verbatim;
 * nothing here is inferred or scored by the library.
 */
export function LifecycleHostPanel({ host }: { host: LifecycleHostInfo }) {
  const { t } = useLocalization();
  const kind = (value: string) => ((LIFECYCLE_TARGET_KINDS as readonly string[]).includes(value) ? t(`lifecycle.targetKind.${value}`) : value);
  return <Card className={styles.section} data-lifecycle-host>
    <h2>{t('lifecycle.host.title')}</h2>
    <p className={styles.muted}>{t('lifecycle.host.help')}</p>
    {host.execution?.message ? <p className={styles.status}>{host.execution.message}</p> : null}
    <TableContainer><Table>
      <TableHeader><TableRow>{['kind', 'status', 'mode', 'targets', 'message'].map(k => <TableHead key={k}>{t(`lifecycle.host.column.${k}`)}</TableHead>)}</TableRow></TableHeader>
      <TableBody>{host.capabilities.map(c => <TableRow key={`${c.kind}:${c.status}`}>
        <TableCell>{kind(c.kind)}</TableCell>
        <TableCell><code className={styles.code}>{c.status}</code></TableCell>
        <TableCell><code className={styles.code}>{c.mode ?? '—'}</code></TableCell>
        <TableCell>{c.targets.join(', ') || '—'}</TableCell>
        <TableCell>{c.message ?? '—'}</TableCell>
      </TableRow>)}</TableBody>
    </Table></TableContainer>
  </Card>;
}
