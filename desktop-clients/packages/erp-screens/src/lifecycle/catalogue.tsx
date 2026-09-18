'use client';
import React from 'react';
import {
  Badge, Button, EmptyState, Input, Select, Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow,
  useLocalization, type BadgeTone,
} from '@pepbits/ops-ui';
import {
  LIFECYCLE_STATUSES, shortLifecycleChecksum,
  type LifecycleCatalogueNode, type LifecycleStatus, type LifecycleVersionSummary,
} from '@pepbits/erp-config/lifecycle';
import styles from './lifecycle.module.css';

export const lifecycleStatusTone = (status: LifecycleStatus): BadgeTone =>
  status === 'PUBLISHED' ? 'success' : status === 'APPROVED' ? 'info' : 'warning';
export function LifecycleStatusBadge({ status, active }: { status: LifecycleStatus; active?: boolean }) {
  const { t } = useLocalization();
  return <span className={styles.actions}>
    <Badge tone={lifecycleStatusTone(status)}>{t(`lifecycle.status.${status}`)}</Badge>
    {active ? <Badge tone="brand">{t('lifecycle.active')}</Badge> : null}
  </span>;
}

/** Catalogue navigation. Lifecycle module/domain/lifecycle/stage/event levels appear for the open definition only. */
export function LifecycleCatalogueTree({ root, selected, onSelect }: {
  root: LifecycleCatalogueNode;
  selected: string | null;
  onSelect: (node: LifecycleCatalogueNode) => void;
}) {
  const { t } = useLocalization();
  const render = (node: LifecycleCatalogueNode): React.ReactNode => <li key={node.id}>
    <button type="button" className={styles.treeLabel} aria-current={selected === node.id} onClick={() => onSelect(node)}
      data-lifecycle-node={node.kind}>
      <span className={styles.treeKind}>{t(`lifecycle.level.${node.kind}`)}</span>
      <span>{node.label}</span>
      {node.code !== node.label ? <code className={styles.code}>{node.code}</code> : null}
      {node.summary ? <Badge tone={lifecycleStatusTone(node.summary.status)}>{t(`lifecycle.status.${node.summary.status}`)}</Badge> : null}
    </button>
    {node.children.length ? <ul>{node.children.map(render)}</ul> : null}
  </li>;
  return <nav aria-label={t('lifecycle.catalogue')}>
    <ul className={styles.tree} role="list">{render(root)}</ul>
    {!root.children.length ? <p className={styles.muted}>{t('lifecycle.catalogueEmpty')}</p> : null}
  </nav>;
}

export interface LifecycleWorklistFilters { code: string; status: LifecycleStatus | '' }
/** Versions from the real list endpoint, with cursor continuation. Nothing is synthesised. */
export function LifecycleWorklist({ items, filters, onFilters, onSearch, onOpen, nextCursor, onMore, busy, canCreate, onCreate }: {
  items: LifecycleVersionSummary[];
  filters: LifecycleWorklistFilters;
  onFilters: (filters: LifecycleWorklistFilters) => void;
  onSearch: () => void;
  onOpen: (summary: LifecycleVersionSummary) => void;
  nextCursor: string | null;
  onMore: () => void;
  busy: boolean;
  canCreate: boolean;
  onCreate: () => void;
}) {
  const { t, dateTime } = useLocalization();
  return <div className={styles.section} data-lifecycle-worklist>
    <form className={styles.filters} onSubmit={e => { e.preventDefault(); onSearch(); }}>
      <Input label={t('lifecycle.filter.code')} value={filters.code} maxLength={64} onChange={e => onFilters({ ...filters, code: e.target.value.trim() })} />
      <Select label={t('lifecycle.filter.status')} value={filters.status} placeholder={t('lifecycle.filter.allStatuses')}
        options={LIFECYCLE_STATUSES.map(s => ({ value: s, label: t(`lifecycle.status.${s}`) }))}
        onChange={e => onFilters({ ...filters, status: e.target.value as LifecycleStatus | '' })} />
      <div className={styles.actions}>
        <Button type="submit" variant="primary" disabled={busy}>{t('lifecycle.search')}</Button>
        {canCreate ? <Button onClick={onCreate} disabled={busy}>{t('lifecycle.newDefinition')}</Button> : null}
      </div>
    </form>
    {!items.length && !busy ? <EmptyState title={t('lifecycle.emptyTitle')} description={t('lifecycle.emptyDescription')} /> :
      <TableContainer>
        <Table>
          <TableHeader><TableRow>
            {['code', 'label', 'version', 'status', 'revision', 'checksum', 'updatedAt'].map(k => <TableHead key={k}>{t(`lifecycle.column.${k}`)}</TableHead>)}
          </TableRow></TableHeader>
          <TableBody>{items.map(item => <TableRow key={`${item.code}:${item.version}`}>
            <TableCell><Button variant="ghost" size="sm" onClick={() => onOpen(item)}
              aria-label={t('lifecycle.openVersion', { code: item.code, version: item.version })}>{item.code}</Button></TableCell>
            <TableCell>{item.label}</TableCell>
            <TableCell>{item.version}</TableCell>
            <TableCell><LifecycleStatusBadge status={item.status} active={item.active} /></TableCell>
            <TableCell>{item.revision}</TableCell>
            <TableCell><code className={styles.code} title={item.checksum}>{shortLifecycleChecksum(item.checksum)}</code></TableCell>
            <TableCell>{dateTime(item.updatedAt)}</TableCell>
          </TableRow>)}</TableBody>
        </Table>
      </TableContainer>}
    <div className={styles.actions}>
      <p className={styles.status} role="status">{busy ? t('lifecycle.loading') : t('lifecycle.loadedCount', { count: items.length })}</p>
      {nextCursor ? <Button onClick={onMore} disabled={busy}>{t('lifecycle.loadMore')}</Button> : null}
    </div>
  </div>;
}
