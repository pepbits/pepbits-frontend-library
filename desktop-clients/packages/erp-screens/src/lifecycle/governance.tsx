'use client';
import React, { useState } from 'react';
import { Button, Card, ConfirmDialog, DescriptionList, Textarea, useLocalization } from '@pepbits/ops-ui';
import type { LifecycleActionState, LifecycleActivation, LifecycleReleaseVersion } from '@pepbits/erp-config/lifecycle';
import { LifecycleStatusBadge } from './catalogue';
import styles from './lifecycle.module.css';

type Governed = 'approve' | 'publish' | 'activate' | 'createNext';
/** Stored governance facts and the next permitted transitions. All values come from the server record. */
export function LifecycleGovernancePanel({ version, activation, states, busy, onApprove, onPublish, onActivate, onCreateNext }: {
  version: LifecycleReleaseVersion;
  activation: LifecycleActivation | null;
  states: Record<Governed, LifecycleActionState>;
  busy: boolean;
  onApprove: (comment: string | null) => void;
  onPublish: (comment: string | null) => void;
  onActivate: (reason: string) => void;
  onCreateNext: () => void;
}) {
  const { t, dateTime } = useLocalization(), [comment, setComment] = useState(''), [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState<'publish' | 'activate' | null>(null);
  const who = (actor: string | null, at: string | null) => (actor && at ? t('lifecycle.byAt', { actor, at: dateTime(at) }) : t('lifecycle.notYet'));
  const rollback = activation && activation.version > version.version;
  const reasons = (Object.entries(states) as [Governed, LifecycleActionState][]).filter(([, s]) => !s.allowed && s.reason);
  return <div className={styles.main} data-lifecycle-governance>
    <Card className={styles.section}>
      <h2>{t('lifecycle.governance.record')}</h2>
      <DescriptionList items={[
        { id: 'lifecycle.column.status', label: t('lifecycle.column.status'), value: <LifecycleStatusBadge status={version.status} active={activation?.version === version.version} /> },
        { id: 'lifecycle.column.revision', label: t('lifecycle.column.revision'), value: String(version.revision) },
        { id: 'lifecycle.column.checksum', label: t('lifecycle.column.checksum'), value: <code className={styles.code}>{version.checksum}</code> },
        { id: 'lifecycle.governance.approvedChecksum', label: t('lifecycle.governance.approvedChecksum'), value: version.approvedChecksum ? <code className={styles.code}>{version.approvedChecksum}</code> : t('lifecycle.notYet') },
        { id: 'lifecycle.governance.editors', label: t('lifecycle.governance.editors'), value: version.editors.join(', ') || t('lifecycle.none') },
        { id: 'lifecycle.governance.created', label: t('lifecycle.governance.created'), value: who(version.createdBy, version.createdAt) },
        { id: 'lifecycle.governance.updated', label: t('lifecycle.governance.updated'), value: who(version.updatedBy, version.updatedAt) },
        { id: 'lifecycle.governance.approved', label: t('lifecycle.governance.approved'), value: who(version.approvedBy, version.approvedAt) },
        { id: 'lifecycle.governance.approvalComment', label: t('lifecycle.governance.approvalComment'), value: version.approvalComment ?? t('lifecycle.none') },
        { id: 'lifecycle.governance.published', label: t('lifecycle.governance.published'), value: who(version.publishedBy, version.publishedAt) },
      ]} />
    </Card>
    <Card className={styles.section}>
      <h2>{t('lifecycle.governance.activation')}</h2>
      {activation ? <DescriptionList items={[
        { id: 'lifecycle.governance.activeVersion', label: t('lifecycle.governance.activeVersion'), value: String(activation.version) },
        { id: 'lifecycle.governance.activationRevision', label: t('lifecycle.governance.activationRevision'), value: String(activation.revision) },
        { id: 'lifecycle.column.checksum', label: t('lifecycle.column.checksum'), value: <code className={styles.code}>{activation.checksum}</code> },
        { id: 'lifecycle.governance.activated', label: t('lifecycle.governance.activated'), value: who(activation.activatedBy, activation.activatedAt) },
        { id: 'lifecycle.governance.reason', label: t('lifecycle.governance.reason'), value: activation.reason },
      ]} /> : <p className={styles.muted}>{t('lifecycle.governance.notActive')}</p>}
      <p className={styles.muted}>{t('lifecycle.governance.activationHelp')}</p>
    </Card>
    <Card className={styles.section}>
      <h2>{t('lifecycle.governance.actions')}</h2>
      <Textarea label={t('lifecycle.governance.comment')} value={comment} maxLength={2000} disabled={busy} hint={t('lifecycle.governance.commentHint')}
        onChange={e => setComment(e.target.value)} />
      <div className={styles.actions}>
        <Button variant="primary" disabled={busy || !states.approve.allowed} onClick={() => onApprove(comment.trim() || null)}>{t('lifecycle.action.approve')}</Button>
        <Button variant="primary" disabled={busy || !states.publish.allowed} onClick={() => setConfirm('publish')}>{t('lifecycle.action.publish')}</Button>
        <Button disabled={busy || !states.createNext.allowed} onClick={onCreateNext}>{t('lifecycle.action.createNext')}</Button>
      </div>
      <Textarea label={t('lifecycle.governance.reason')} value={reason} required maxLength={500} disabled={busy || !states.activate.allowed}
        hint={t('lifecycle.governance.reasonHint')} onChange={e => setReason(e.target.value)} />
      <div className={styles.actions}>
        <Button variant="primary" disabled={busy || !states.activate.allowed || !reason.trim()} onClick={() => setConfirm('activate')}>
          {t(rollback ? 'lifecycle.action.rollback' : 'lifecycle.action.activate')}
        </Button>
      </div>
      {reasons.length ? <ul className={styles.reasons} aria-label={t('lifecycle.governance.unavailable')}>
        {reasons.map(([action, s]) => <li key={action}>{t(`lifecycle.action.${action}`)}: {t(s.reason!)}</li>)}
      </ul> : null}
    </Card>
    <ConfirmDialog open={confirm === 'publish'} title={t('lifecycle.confirm.publishTitle')}
      message={t('lifecycle.confirm.publish', { code: version.code, version: version.version })} confirmLabel={t('lifecycle.action.publish')}
      onCancel={() => setConfirm(null)} onConfirm={() => { setConfirm(null); onPublish(comment.trim() || null); }} />
    <ConfirmDialog open={confirm === 'activate'} title={t('lifecycle.confirm.activateTitle')} tone={rollback ? 'danger' : 'primary'}
      message={t(activation ? 'lifecycle.confirm.activateReplace' : 'lifecycle.confirm.activate', { code: version.code, version: version.version, current: activation?.version ?? '' })}
      confirmLabel={t(rollback ? 'lifecycle.action.rollback' : 'lifecycle.action.activate')}
      onCancel={() => setConfirm(null)} onConfirm={() => { setConfirm(null); onActivate(reason.trim()); }} />
  </div>;
}
