'use client';
import React from 'react';
import { Button, Card, Input, Select, useLocalization } from '@pepbits/ops-ui';
import { LIFECYCLE_STATUSES, type LifecycleActivation, type LifecycleReleaseDefinition, type LifecycleValidationReport, type LifecycleReleaseVersion, type LifecycleVersionSummary } from '@pepbits/erp-config/lifecycle';
import { LifecycleStatusBadge, type LifecycleWorklistFilters } from './catalogue';
import styles from './lifecycle.module.css';

/** The compact console consumes the same server cursor/filter contract as the tabular worklist. */
export function LifecycleConsoleWorklist({ items, application, filters, onFilters, onSearch, nextCursor, onMore, busy, canCreate, onCreate, selected, onOpen }: {
  items: LifecycleVersionSummary[]; application: string; filters: LifecycleWorklistFilters;
  onFilters: (value: LifecycleWorklistFilters) => void; onSearch: () => void; nextCursor: string | null;
  onMore: () => void; busy: boolean; canCreate: boolean; onCreate: () => void; selected: string | null;
  onOpen: (value: LifecycleVersionSummary) => void;
}) {
  const { t, dateTime } = useLocalization();
  return <div data-lifecycle-worklist className={styles.consoleWorklist}>
    <div className={styles.section}>
      <div className={styles.header}><h2>{t('lifecycle.console.worklist')}</h2>
        {canCreate ? <Button size="sm" onClick={onCreate} disabled={busy}>{t('lifecycle.newDefinition')}</Button> : null}</div>
      <form className={styles.worklistFilters} onSubmit={e => { e.preventDefault(); onSearch(); }}>
        <Input label={t('lifecycle.filter.code')} value={filters.code} maxLength={64} onChange={e => onFilters({ ...filters, code: e.target.value.trim() })} />
        <Select label={t('lifecycle.filter.status')} value={filters.status} placeholder={t('lifecycle.filter.allStatuses')}
          options={LIFECYCLE_STATUSES.map(status => ({ value: status, label: t(`lifecycle.status.${status}`) }))}
          onChange={e => onFilters({ ...filters, status: e.target.value as LifecycleWorklistFilters['status'] })} />
        <Button type="submit" size="sm" disabled={busy}>{t('lifecycle.search')}</Button>
      </form>
    </div>
    <div className={styles.worklistCards} aria-busy={busy}>
      {items.map(item => <button type="button" key={`${item.code}:${item.version}`} className={styles.lifeCard}
        aria-current={selected === `${item.code}:${item.version}`} disabled={busy}
        aria-label={t('lifecycle.openVersion', { code: item.code, version: item.version })} onClick={() => onOpen(item)}>
        <span className={styles.lifeLine}><span className={styles.lifeIcon} aria-hidden="true">{application.slice(0, 2).toUpperCase()}</span>
          <span className={styles.lifeName}><strong>{item.label}</strong><small>{application} · {item.code}</small></span></span>
        <span className={styles.lifeMeta}><span>v{item.version}</span><LifecycleStatusBadge status={item.status} active={item.active} /></span>
        <small className={styles.muted}>{dateTime(item.updatedAt)}</small>
      </button>)}
      {!items.length && !busy ? <p className={styles.section}>{t('lifecycle.emptyTitle')}</p> : null}
    </div>
    <div className={styles.section}>
      <p className={styles.status} role="status">{busy ? t('lifecycle.loading') : t('lifecycle.loadedCount', { count: items.length })}</p>
      {nextCursor ? <Button size="sm" onClick={onMore} disabled={busy}>{t('lifecycle.loadMore')}</Button> : null}
    </div>
  </div>;
}

export function LifecycleConsoleSummary({ definition: d, version, activation, report, dirty, onPreview, onValidate, busy, canPreview }: {
  definition: LifecycleReleaseDefinition | null; version: LifecycleReleaseVersion | null; activation: LifecycleActivation | null;
  report: LifecycleValidationReport | null; dirty: boolean; onPreview: () => void; onValidate: () => void; busy: boolean; canPreview: boolean;
}) {
  const { t, language } = useLocalization();
  const number = (value: number) => new Intl.NumberFormat(language).format(value);
  const metrics = d ? [ ['stages', d.stages.length], ['events', d.events.length], ['bindings', d.bindings.length], ['sourceMappings', d.sourceMappings?.length ?? 0] ] as const : [];
  return <aside className={styles.summaryPanel} data-lifecycle-summary aria-label={t('lifecycle.console.summary')}>
    <div className={styles.section}>
      <div className={styles.summaryHero}><small>{t('lifecycle.console.summary')}</small><h2>{d?.label || t('lifecycle.console.select')}</h2><p>{d?.application ?? '—'}</p></div>
      <div className={styles.metricGrid}>{metrics.map(([key, count]) => <Card key={key} className={styles.metric}><strong>{number(count)}</strong><span>{t(`lifecycle.section.${key}`)}</span></Card>)}</div>
      <Card className={styles.section}><small>{t('lifecycle.field.code')}</small><code className={styles.code}>{d?.code ?? '—'}</code></Card>
      <Card className={styles.section}><small>{t('lifecycle.console.release')}</small>
        {version ? <><strong>v{number(version.version)}</strong><LifecycleStatusBadge status={version.status} active={activation?.version === version.version} /></> : <span>{t('lifecycle.console.unsaved')}</span>}
        {dirty ? <small>{t('lifecycle.console.unsaved')}</small> : null}
      </Card>
      <Card className={styles.section}><small>{t('lifecycle.tab.validation')}</small><strong>{t(report ? (report.valid ? 'lifecycle.console.valid' : 'lifecycle.console.invalid') : 'lifecycle.console.notValidated')}</strong></Card>
      <p className={styles.muted}>{t('lifecycle.console.execution')}</p>
    </div>
    <div className={`${styles.section} ${styles.summaryFooter}`}>
      <Button disabled={busy || !canPreview} onClick={onPreview}>{t('lifecycle.tab.preview')}</Button>
      <Button disabled={busy || !d} onClick={onValidate}>{t('lifecycle.console.validate')}</Button>
    </div>
  </aside>;
}
