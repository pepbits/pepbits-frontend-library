'use client';
import React, { useState } from 'react';
import {
  Badge, Button, Card, Select, Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow, useLocalization,
} from '@pepbits/ops-ui';
import {
  diffLifecycleDefinitions, shortLifecycleChecksum,
  type LifecycleDifference, type LifecycleReleaseDefinition, type LifecycleVersionSummary,
} from '@pepbits/erp-config/lifecycle';
import { LifecycleStatusBadge } from './catalogue';
import styles from './lifecycle.module.css';

const EDITOR = 'editor';
/** Stored versions of one code plus a structural comparison between any two (or the unsaved editor). */
export function LifecycleVersionsPanel({ versions, current, editor, dirty, nextCursor, busy, onMore, onOpen, load }: {
  versions: LifecycleVersionSummary[];
  current: number | null;
  editor: LifecycleReleaseDefinition;
  dirty: boolean;
  nextCursor: string | null;
  busy: boolean;
  onMore: () => void;
  onOpen: (version: number) => void;
  /** Loads a stored definition through the host API (detail endpoint). */
  load: (version: number) => Promise<LifecycleReleaseDefinition>;
}) {
  const { t, dateTime } = useLocalization();
  const sorted = [...versions].sort((a, b) => b.version - a.version);
  const [from, setFrom] = useState(() => String(sorted.find(v => v.version !== current)?.version ?? sorted[0]?.version ?? ''));
  const [to, setTo] = useState(dirty || current === null ? EDITOR : String(current));
  const [changes, setChanges] = useState<LifecycleDifference[] | null>(null), [loading, setLoading] = useState(false), [failed, setFailed] = useState(false);
  const options = [...(dirty || current === null ? [{ value: EDITOR, label: t('lifecycle.versions.editor') }] : []),
    ...sorted.map(v => ({ value: String(v.version), label: t('lifecycle.versions.option', { version: v.version, status: t(`lifecycle.status.${v.status}`) }) }))];
  async function compare() {
    setLoading(true); setFailed(false);
    try {
      const get = (value: string) => (value === EDITOR ? Promise.resolve(editor) : load(Number(value)));
      const [a, b] = await Promise.all([get(from), get(to)]);
      setChanges(diffLifecycleDefinitions(a, b));
    } catch { setFailed(true); setChanges(null); } finally { setLoading(false); }
  }
  return <div className={styles.main} data-lifecycle-versions>
    <Card className={styles.section}>
      <TableContainer><Table>
        <TableHeader><TableRow>{['version', 'status', 'revision', 'checksum', 'updatedAt', 'open'].map(k => <TableHead key={k}>{t(`lifecycle.column.${k}`)}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{sorted.map(v => <TableRow key={v.version} aria-current={v.version === current || undefined}>
          <TableCell>{v.version}</TableCell>
          <TableCell><LifecycleStatusBadge status={v.status} active={v.active} /></TableCell>
          <TableCell>{v.revision}</TableCell>
          <TableCell><code className={styles.code} title={v.checksum}>{shortLifecycleChecksum(v.checksum)}</code></TableCell>
          <TableCell>{dateTime(v.updatedAt)}</TableCell>
          <TableCell><Button size="sm" variant="ghost" disabled={v.version === current} onClick={() => onOpen(v.version)}>{t('lifecycle.versions.open')}</Button></TableCell>
        </TableRow>)}</TableBody>
      </Table></TableContainer>
      {nextCursor ? <Button onClick={onMore} disabled={busy}>{t('lifecycle.loadMore')}</Button> : null}
    </Card>
    <Card className={styles.section}>
      <h2>{t('lifecycle.versions.compare')}</h2>
      <div className={styles.filters}>
        <Select label={t('lifecycle.versions.from')} value={from} placeholder="" options={options} onChange={e => { setFrom(e.target.value); setChanges(null); }} />
        <Select label={t('lifecycle.versions.to')} value={to} placeholder="" options={options} onChange={e => { setTo(e.target.value); setChanges(null); }} />
        <Button variant="primary" disabled={loading || !from || !to || from === to} onClick={() => void compare()}>{t('lifecycle.versions.compareAction')}</Button>
      </div>
      {failed ? <p role="alert">{t('lifecycle.versions.compareFailed')}</p> : null}
      {changes && !changes.length ? <p className={styles.muted} role="status">{t('lifecycle.versions.noChanges')}</p> : null}
      {changes?.length ? <TableContainer><Table>
        <TableHeader><TableRow>{['section', 'key', 'change', 'fields', 'before', 'after'].map(k => <TableHead key={k}>{t(`lifecycle.versions.column.${k}`)}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{changes.map(c => <TableRow key={`${c.section}:${c.key}`}>
          <TableCell>{t(`lifecycle.section.${c.section === 'definition' ? 'overview' : c.section}`)}</TableCell>
          <TableCell><code className={styles.code}>{c.key}</code></TableCell>
          <TableCell><Badge tone={c.kind === 'added' ? 'success' : c.kind === 'removed' ? 'danger' : 'info'}>{t(`lifecycle.versions.${c.kind}`)}</Badge></TableCell>
          <TableCell>{c.fields.join(', ') || '—'}</TableCell>
          <TableCell><pre className={styles.pre}>{c.before === undefined ? '—' : JSON.stringify(c.before, null, 2)}</pre></TableCell>
          <TableCell><pre className={styles.pre}>{c.after === undefined ? '—' : JSON.stringify(c.after, null, 2)}</pre></TableCell>
        </TableRow>)}</TableBody>
      </Table></TableContainer> : null}
    </Card>
  </div>;
}
