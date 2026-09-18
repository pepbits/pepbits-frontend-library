'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessDenied, Button, Card, ConfirmDialog, Input, LoadingState, Modal, PresentationProvider, RecoveryNotice, Tabs,
  failureFromError, useLocalization,
} from '@pepbits/ops-ui';
import { DEFAULT_PREFERENCES, effectivePreferences, type UserPreferences } from '@pepbits/erp-config';
import {
  LifecycleContractError, LifecycleRequestError, createLifecycleOperationKeys, emptyLifecycleDefinition, isLifecycleUnavailable,
  lifecycleActionState, lifecycleCatalogueTree, lifecycleKeyValid, nextLifecycleDraft, sameLifecycleDefinition,
  type LifecycleApi, type LifecycleCatalogueGroup, type LifecycleCatalogueNode, type LifecycleClassification, type LifecycleMetadata,
  type LifecycleMetadataResult, type LifecyclePermissions, type LifecycleReleaseDefinition, type LifecycleResolveResult,
  type LifecycleUnavailable, type LifecycleValidationReport, type LifecycleVersionDetail, type LifecycleVersionSummary,
  type LifecycleSourceApi,
} from '@pepbits/erp-config/lifecycle';
import type { PreferenceHost } from '../preference-choice';
import { LifecycleCatalogueTree, LifecycleStatusBadge, LifecycleWorklist, type LifecycleWorklistFilters } from './catalogue';
import { LifecycleDefinitionEditor, type LifecycleEditorFocus } from './editor';
import { LifecycleGovernancePanel } from './governance';
import { LifecycleHostPanel } from './host';
import { LifecycleResolvePreview, LifecycleValidationPanel, type LifecyclePreviewPolicy } from './preview';
import { LifecycleVersionsPanel } from './versions';
import { LifecycleSourceRegistryPanel, useLifecycleSourceCatalog } from './sources';
import styles from './lifecycle.module.css';

export interface LifecycleNotification {
  kind: 'success' | 'error' | 'info';
  /** Operation that produced the notification, e.g. `save`, `approve`, `activate`. */
  operation: string;
  /** Already localised text. */
  message: string;
}
export interface LifecycleConfigurationPageProps extends Partial<PreferenceHost> {
  /** Host API port. Use `createLifecycleHttpApi` or any implementation of the contract. */
  api: LifecycleApi;
  /** Remount key; include tenant, application and user so no state crosses scopes. */
  scopeKey: string;
  /** Application namespace from the verified host session, e.g. `{code:'healthcare', label:'Healthcare'}`. */
  application: LifecycleCatalogueGroup;
  /** Permission hints from the host session. The server authorises every request regardless. */
  permissions: LifecyclePermissions;
  /** Verified actor id, used only to explain that approval must be independent. */
  actorId?: string | null;
  /**
   * Optional definition-level module/domain projection for the catalogue tree. Lifecycles inside the
   * open definition are grouped by their own optional `module`/`domain` codes without this.
   */
  classify?: (summary: LifecycleVersionSummary) => LifecycleClassification | null | undefined;
  notify?: (notification: LifecycleNotification) => void;
  /** Reports unsaved editor changes so the host can guard its own navigation. */
  onDirtyChange?: (dirty: boolean) => void;
  /** Worklist page size (clamped to the server limit). */
  pageSize?: number;
  /** Show the advanced JSON editor section. Default true. */
  advancedJson?: boolean;
  /**
   * Change reason for create/save, passed decoded as `LifecycleMutation.reason` and part of the
   * operation fingerprint. The HTTP adapter sends it in its `reasonHeader`, verbatim (`reasonEncoding:
   * 'raw'`, Latin-1 only) or as `UTF-8''` percent-encoding (`'percent-utf8'`, any script, <= 1000
   * characters and <= 1500 UTF-8 bytes). Default `required`.
   */
  changeReason?: 'required' | 'optional' | 'hidden';
  /** Host limits on preview context, e.g. a single verified organisation selector and no subject id. */
  previewPolicy?: LifecyclePreviewPolicy;
  preferences?: UserPreferences;
  /**
   * Optional source registry port (source contract v1), e.g. `createLifecycleSourceHttpApi`. When supplied, the
   * page shows the host's registered sources and a Source mappings editor section; mappings are saved in the
   * draft definition and follow its approval, publication and activation. Omit it to keep the page unchanged.
   */
  sources?: LifecycleSourceApi;
  /** Source registry page size (1..100, default 25). */
  sourcePageSize?: number;
}

/** Shared lifecycle administration: catalogue, worklist, editor, validation, preview, governance and versions. */
export function LifecycleConfigurationPage(props: LifecycleConfigurationPageProps) {
  const base = props.preferences ?? DEFAULT_PREFERENCES;
  const preferences = props.preferencePolicy ? effectivePreferences(base, props.preferencePolicy) : base;
  return <PresentationProvider value={preferences}><Controller key={props.scopeKey} {...props} preferences={preferences} /></PresentationProvider>;
}

type DetailTab = 'definition' | 'validation' | 'preview' | 'governance' | 'versions';
interface OpenState {
  /** Stored record; null while a new definition has not been saved. */
  detail: LifecycleVersionDetail | null;
  baseline: LifecycleReleaseDefinition | null;
  definition: LifecycleReleaseDefinition;
}
interface Failure { error: unknown; operation: string; retry?: () => void }

function Controller({ api, application, permissions, actorId = null, classify, notify, onDirtyChange, pageSize = 25, advancedJson = true,
  changeReason: changeReasonMode = 'required', previewPolicy, preferences = DEFAULT_PREFERENCES, sources, sourcePageSize }: LifecycleConfigurationPageProps) {
  const { t } = useLocalization();
  const keys = useRef(createLifecycleOperationKeys()).current, locked = useRef(false), mounted = useRef(true);
  const sequence = useRef(new Map<string, number>()), [inFlight, setInFlight] = useState(0), [mutating, setMutating] = useState(false);
  const [metadata, setMetadata] = useState<LifecycleMetadataResult | null>(null);
  const [unavailable, setUnavailable] = useState<LifecycleUnavailable | null>(null);
  const [filters, setFilters] = useState<LifecycleWorklistFilters>({ code: '', status: '' });
  const [applied, setApplied] = useState<LifecycleWorklistFilters>({ code: '', status: '' });
  const [items, setItems] = useState<LifecycleVersionSummary[]>([]), [cursor, setCursor] = useState<string | null>(null);
  const [open, setOpen] = useState<OpenState | null>(null), [tab, setTab] = useState<DetailTab>('definition');
  const [focus, setFocus] = useState<LifecycleEditorFocus>({ section: 'overview', key: null });
  const [versions, setVersions] = useState<LifecycleVersionSummary[]>([]), [versionCursor, setVersionCursor] = useState<string | null>(null);
  const [report, setReport] = useState<{ value: LifecycleValidationReport; source: 'editor' | 'stored' | 'save' } | null>(null);
  const [resolution, setResolution] = useState<LifecycleResolveResult | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null), [message, setMessage] = useState('');
  const [pending, setPending] = useState<(() => void) | null>(null), [creating, setCreating] = useState<{ code: string; label: string } | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [changeReason, setChangeReason] = useState(''), [showHost, setShowHost] = useState(false), [showSources, setShowSources] = useState(false);

  const busy = inFlight > 0;
  const sourceCatalog = useLifecycleSourceCatalog(sources, { enabled: permissions.read && (permissions.sources ?? true) && metadata?.available === true, pageSize: sourcePageSize });
  const meta: LifecycleMetadata | null = metadata?.available ? metadata : null;
  const limit = Math.max(1, Math.min(pageSize, meta?.limits.pageSize ?? 100));
  const dirty = !!open && (open.baseline === null || !sameLifecycleDefinition(open.definition, open.baseline));
  const version = open?.detail?.version ?? null, activation = open?.detail?.activation ?? null;
  const readOnly = !permissions.edit || version?.status === 'PUBLISHED' || mutating;

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const say = useCallback((kind: LifecycleNotification['kind'], operation: string, key: string, values?: Record<string, string | number>) => {
    const text = t(key, values);
    setMessage(text);
    notify?.({ kind, operation, message: text });
  }, [notify, t]);

  /**
   * Runs one request. Mutations are exclusive and get a stable operation key per payload
   * (retries reuse it). Reads may overlap; a superseded response of the same kind is ignored.
   */
  const run = useCallback(async <T,>(operation: string, work: () => Promise<T>, apply: (value: T) => void, retry?: () => void) => {
    const mutation = MUTATIONS.includes(operation);
    if (mutation && locked.current) return false;
    if (mutation) { locked.current = true; setMutating(true); }
    const ticket = (sequence.current.get(operation) ?? 0) + 1;
    sequence.current.set(operation, ticket);
    setInFlight(n => n + 1); setFailure(null); if (mutation) setMessage('');
    try {
      const value = await work();
      if (!mounted.current || sequence.current.get(operation) !== ticket) return false;
      apply(value);
      keys.complete(operation);
      return true;
    } catch (error) {
      if (!mounted.current || sequence.current.get(operation) !== ticket) return false;
      if (isLifecycleUnavailable(error)) {
        const e = error as LifecycleRequestError;
        setUnavailable({ available: false, code: e.code, message: e.message });
      } else {
        setFailure({ error, operation, retry });
        if (error instanceof LifecycleRequestError && error.issues.length)
          setReport({ value: { valid: false, activatable: false, checksum: '', issues: error.issues }, source: 'save' });
        notify?.({ kind: 'error', operation, message: t('lifecycle.failed', { operation: t(`lifecycle.operation.${operation}`) }) });
      }
      return false;
    } finally {
      if (mutation) locked.current = false;
      if (mounted.current) { setInFlight(n => n - 1); if (mutation) setMutating(false); }
    }
  }, [keys, notify, t]);

  const search = useCallback((next: LifecycleWorklistFilters, after: string | null = null) => {
    void run('list', () => api.list({ code: next.code || null, status: next.status || null, cursor: after, limit }), page => {
      setApplied(next);
      setItems(current => (after ? [...current, ...page.items] : page.items));
      setCursor(page.nextCursor);
    }, () => search(next, after));
  }, [api, limit, run]);

  const loadMetadata = useCallback(() => {
    void run('metadata', () => api.metadata(), value => {
      setMetadata(value);
      if (!value.available) setUnavailable(value);
    }, loadMetadata);
  }, [api, run]);
  useEffect(() => { if (permissions.read) loadMetadata(); }, [loadMetadata, permissions.read]);
  useEffect(() => { if (meta) search({ code: '', status: '' }); }, [meta?.schemaVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadVersions = useCallback((code: string, after: string | null = null) => {
    void run('versions', () => api.list({ code, status: null, cursor: after, limit: meta?.limits.pageSize ?? 100 }), page => {
      setVersions(current => (after ? [...current, ...page.items] : page.items));
      setVersionCursor(page.nextCursor);
    }, () => loadVersions(code, after));
  }, [api, meta, run]);

  const show = useCallback((detail: LifecycleVersionDetail, keepTab = false) => {
    setOpen({ detail, baseline: detail.version.definition, definition: detail.version.definition });
    setResolution(null);
    if (!keepTab) { setTab('definition'); setFocus({ section: 'overview', key: null }); setReport(null); }
  }, []);
  const openVersion = useCallback((code: string, v: number) => {
    void run('open', () => api.detail(code, v), detail => { show(detail); loadVersions(code); }, () => openVersion(code, v));
  }, [api, loadVersions, run, show]);

  /** Unsaved-change protection for every in-page navigation. */
  const guard = (action: () => void) => { if (dirty) setPending(() => action); else action(); };
  const refreshLists = (code: string) => { search(applied); loadVersions(code); };

  /** Create/save carry the change reason outside the body; it is part of the operation fingerprint. */
  const contentMutation = (operation: 'create' | 'save', payload: unknown) => {
    const reason = changeReason.trim() || undefined;
    return { operationKey: keys.key(operation, { payload, reason: reason ?? null }), ...(reason ? { reason } : {}) };
  };
  const saved = (operation: 'create' | 'save', detail: LifecycleVersionDetail, keepTab: boolean) => {
    show(detail, keepTab); setChangeReason('');
    say('success', operation, 'lifecycle.saved', { code: detail.version.code, version: detail.version.version }); refreshLists(detail.version.code);
  };
  function save() {
    if (!open) return;
    const definition = open.definition;
    if (!open.detail) {
      const payload = { definition }, mutation = contentMutation('create', payload);
      const attempt = () => void run('create', () => api.createDraft(payload, mutation), detail => saved('create', detail, true), attempt);
      attempt();
      return;
    }
    const v = open.detail.version;
    const payload = { code: v.code, version: v.version, expectedRevision: v.revision, definition }, mutation = contentMutation('save', payload);
    const attempt = () => void run('save', () => api.saveDraft(payload, mutation), detail => saved('save', detail, true), attempt);
    attempt();
  }
  /** Approve/publish carry their comment in the request body; no separate change reason is sent. */
  function transition(operation: 'approve' | 'publish', comment: string | null) {
    if (!version) return;
    const payload = { code: version.code, version: version.version, expectedRevision: version.revision, comment };
    const attempt = () => void run(operation, () => api[operation](payload, { operationKey: keys.key(operation, payload) }), detail => {
      show(detail, true); say('success', operation, `lifecycle.done.${operation}`, { code: version.code, version: version.version }); refreshLists(version.code);
    }, attempt);
    attempt();
  }
  function activate(reason: string) {
    if (!version) return;
    const body = { code: version.code, version: version.version, expectedRevision: activation?.revision ?? 0, reason };
    const operationKey = keys.key('activate', body), payload = { ...body, idempotencyKey: operationKey };
    const attempt = () => void run('activate', () => api.activate(payload, { operationKey }), next => {
      setOpen(current => (current?.detail ? { ...current, detail: { ...current.detail, activation: next } } : current));
      say('success', 'activate', 'lifecycle.done.activate', { code: next.code, version: next.version }); refreshLists(version.code);
    }, attempt);
    attempt();
  }
  function createNext() {
    if (!version) return;
    const payload = { definition: nextLifecycleDraft(version.definition) }, mutation = contentMutation('create', payload);
    const attempt = () => void run('create', () => api.createDraft(payload, mutation), detail => saved('create', detail, false), attempt);
    attempt();
  }
  function validate(stored: boolean) {
    if (!open) return;
    const definition = open.definition;
    void run('validate', () => (stored && version ? api.validateVersion(version.code, version.version) : api.validate(definition)),
      value => setReport({ value, source: stored ? 'stored' : 'editor' }), () => validate(stored));
  }

  const tree = useMemo(() => lifecycleCatalogueTree({
    application, summaries: items, classify, open: open?.definition ?? null,
  }), [application, items, classify, open?.definition]);
  function selectNode(node: LifecycleCatalogueNode) {
    setSelectedNode(node.id);
    if (node.kind === 'definition' && node.summary) {
      const s = node.summary;
      if (open?.detail?.version.code === s.code) { setTab('definition'); setFocus({ section: 'overview', key: null }); return; }
      guard(() => openVersion(s.code, s.version));
    } else if (node.definition) {
      setTab('definition'); setFocus({ section: 'lifecycles', key: null });
    } else if (node.kind === 'lifecycle' || node.kind === 'stage' || node.kind === 'event') {
      setTab('definition');
      setFocus({ section: node.kind === 'lifecycle' ? 'lifecycles' : node.kind === 'stage' ? 'stages' : 'events', key: node.code });
    } else if (node.kind === 'application') guard(() => setOpen(null));
  }

  if (!permissions.read) return <AccessDenied title={t('lifecycle.denied')} description={t('lifecycle.deniedHelp')} />;
  const failureView = failure ? <div>
    <RecoveryNotice failure={failureFromError(failure.error instanceof LifecycleContractError ? { status: 502 } : failure.error)} busy={busy} preservesValues={dirty && failure.operation !== 'open'}
      onRetry={failure.retry} onReload={version ? () => guard(() => openVersion(version.code, version.version)) : undefined} />
    <p className={styles.status} role="note">{failure.error instanceof LifecycleContractError
      ? t('lifecycle.error.contract', { path: failure.error.path })
      : failure.error instanceof LifecycleRequestError ? t(`lifecycle.error.${knownError(failure.error.code)}`, { code: failure.error.code }) : ''}</p>
  </div> : null;

  const host = metadata?.available ? metadata.host : null;
  const header = <header className={styles.header}>
    <div>
      <h1>{t('lifecycle.title')}</h1>
      <p className={styles.muted}>{t('lifecycle.boundary', { application: application.label })}</p>
      {host?.execution && (host.execution.triggerExecution === false || host.execution.eventWorkersEnabled === false)
        ? <p className={styles.status} role="note" data-lifecycle-execution="off">{t('lifecycle.host.executionOff')}</p> : null}
    </div>
    <div className={styles.actions}>
      {sourceCatalog ? <Button size="sm" aria-expanded={showSources} onClick={() => setShowSources(v => !v)}>{t(showSources ? 'lifecycle.source.hideRegistry' : 'lifecycle.source.showRegistry')}</Button> : null}
      {host?.capabilities.length ? <Button size="sm" aria-expanded={showHost} onClick={() => setShowHost(v => !v)}>{t(showHost ? 'lifecycle.host.hide' : 'lifecycle.host.show')}</Button> : null}
    </div>
  </header>;
  const hostPanel = <>
    {showHost && host ? <LifecycleHostPanel host={host} /> : null}
    {showSources && sourceCatalog ? <LifecycleSourceRegistryPanel catalog={sourceCatalog} application={application} /> : null}
  </>;

  if (unavailable) return <div className={styles.page} data-lifecycle-page data-density={preferences.density}>{header}
    <Card className={styles.section} role="status" data-lifecycle-unavailable={unavailable.code}>
      <h2>{t('lifecycle.unavailable')}</h2>
      <p>{t(unavailable.code === 'LIFECYCLE_SCHEMA_NOT_READY' ? 'lifecycle.unavailableSchema' : 'lifecycle.unavailableHelp')}</p>
      <p className={styles.code}>{unavailable.code}</p>
      <div className={styles.actions}><Button onClick={() => { setUnavailable(null); setMetadata(null); loadMetadata(); }}>{t('lifecycle.checkAgain')}</Button></div>
    </Card>
  </div>;
  if (!meta) return <div className={styles.page} data-lifecycle-page>{header}{failureView ?? <LoadingState title={t('lifecycle.loading')} description={t('lifecycle.loadingHelp')} />}</div>;

  const states = {
    approve: lifecycleActionState('approve', { version, permissions, dirty, actorId }),
    publish: lifecycleActionState('publish', { version, permissions, dirty, actorId }),
    activate: lifecycleActionState('activate', { version, permissions, dirty, actorId, activation }),
    createNext: lifecycleActionState('createNext', { version, permissions, dirty, actorId }),
  };
  const saveState = lifecycleActionState('save', { version, permissions, dirty, actorId });
  const reasonMissing = changeReasonMode === 'required' && !changeReason.trim();
  const reasonField = changeReasonMode !== 'hidden' && permissions.edit && (saveState.allowed || states.createNext.allowed)
    ? <Input label={t('lifecycle.changeReason')} value={changeReason} maxLength={1000} required={changeReasonMode === 'required'}
      hint={t('lifecycle.changeReasonHint')} disabled={mutating} onChange={e => setChangeReason(e.target.value)} /> : null;
  const governanceStates = reasonMissing && states.createNext.allowed
    ? { ...states, createNext: { allowed: false, reason: 'lifecycle.reason.changeReason' } } : states;
  const createInvalid = creating && (!lifecycleKeyValid('code', creating.code) || !creating.label.trim());

  return <div className={styles.page} data-lifecycle-page data-density={preferences.density}>
    {header}
    {hostPanel}
    <div className={styles.layout}>
      <Card className={`${styles.section} ${styles.rail}`}>
        <LifecycleCatalogueTree root={tree} selected={selectedNode} onSelect={selectNode} />
        {cursor ? <p className={styles.muted}>{t('lifecycle.catalogueMore')}</p> : null}
      </Card>
      <main className={styles.main}>
        {failureView}
        {!open ? <Card>
          <LifecycleWorklist items={items} filters={filters} onFilters={setFilters} onSearch={() => search(filters)} nextCursor={cursor}
            onMore={() => search(applied, cursor)} busy={busy} canCreate={permissions.edit}
            onCreate={() => setCreating({ code: '', label: '' })} onOpen={s => openVersion(s.code, s.version)} />
        </Card> : <>
          <Card className={styles.section} data-lifecycle-detail>
            <div className={styles.header}>
              <div>
                <h2>{open.definition.label || open.definition.code}</h2>
                <p className={styles.code}>{version ? t('lifecycle.versionTitle', { code: version.code, version: version.version, revision: version.revision }) : t('lifecycle.unsavedNew', { code: open.definition.code })}</p>
              </div>
              <div className={styles.actions}>
                {version ? <LifecycleStatusBadge status={version.status} active={activation?.version === version.version} /> : null}
                <Button onClick={() => guard(() => setOpen(null))}>{t('lifecycle.backToCatalogue')}</Button>
                <Button disabled={!dirty || busy || !open.baseline} onClick={() => setOpen(o => (o && o.baseline ? { ...o, definition: o.baseline } : o))}>{t('lifecycle.discardChanges')}</Button>
                <Button variant="primary" disabled={busy || !saveState.allowed || reasonMissing} onClick={save}>{t('lifecycle.save')}</Button>
              </div>
            </div>
            {reasonField}
            <p className={styles.status} role="status">{message || (dirty ? t('lifecycle.unsaved') : '')}</p>
            {dirty && version?.status === 'APPROVED' ? <p role="note" className={styles.status}>{t('lifecycle.approvedEditWarning')}</p> : null}
            {!saveState.allowed && saveState.reason && saveState.reason !== 'lifecycle.reason.noChanges' ? <p className={styles.status}>{t(saveState.reason)}</p> : null}
            {saveState.allowed && reasonMissing ? <p className={styles.status}>{t('lifecycle.reason.changeReason')}</p> : null}
          </Card>
          <Tabs value={tab} onChange={v => setTab(v as DetailTab)} items={(['definition', 'validation', 'preview', 'governance', 'versions'] as DetailTab[])
            .map(id => ({ id, label: t(`lifecycle.tab.${id}`), disabled: !version && (id === 'governance' || id === 'versions') }))} />
          {tab === 'definition' ? <LifecycleDefinitionEditor definition={open.definition} metadata={meta} readOnly={readOnly} focus={focus} onFocus={setFocus}
            advancedJson={advancedJson} sources={sourceCatalog} onChange={definition => setOpen(o => (o ? { ...o, definition } : o))} /> : null}
          {tab === 'validation' ? <LifecycleValidationPanel report={report?.value ?? null} source={report?.source ?? null} definition={open.definition} busy={busy}
            canValidateStored={!!version && !dirty} onValidate={() => validate(false)} onValidateStored={() => validate(true)}
            onFocus={f => { setFocus(f); setTab('definition'); }} /> : null}
          {tab === 'preview' ? (permissions.resolve ? <LifecycleResolvePreview key={`${version?.version}:${version?.revision}`} definition={version?.definition ?? open.definition}
            storedVersion={version?.version ?? null} active={!!activation} busy={busy} result={resolution} policy={previewPolicy}
            onResolve={request => { if (!version) return; void run('resolve', () => api.resolve({ code: version.code, ...request }), setResolution); }} />
            : <AccessDenied title={t('lifecycle.previewDenied')} />) : null}
          {tab === 'governance' && version ? <LifecycleGovernancePanel version={version} activation={activation} states={governanceStates} busy={busy}
            onApprove={c => transition('approve', c)} onPublish={c => transition('publish', c)} onActivate={activate} onCreateNext={() => guard(createNext)} /> : null}
          {tab === 'versions' && version ? <LifecycleVersionsPanel versions={versions} current={version.version} editor={open.definition} dirty={dirty}
            nextCursor={versionCursor} busy={busy} onMore={() => loadVersions(version.code, versionCursor)}
            onOpen={v => guard(() => openVersion(version.code, v))} load={async v => (await api.detail(version.code, v)).version.definition} /> : null}
        </>}
      </main>
    </div>
    <ConfirmDialog open={pending !== null} title={t('lifecycle.discardTitle')} message={t('lifecycle.discardMessage')} tone="danger"
      confirmLabel={t('lifecycle.discardConfirm')} onCancel={() => setPending(null)}
      onConfirm={() => { const action = pending; setPending(null); setOpen(o => (o?.baseline ? { ...o, definition: o.baseline } : null)); action?.(); }} />
    <Modal open={creating !== null} onClose={() => setCreating(null)} title={t('lifecycle.newDefinition')} size="md" footer={<>
      <Button variant="ghost" onClick={() => setCreating(null)}>{t('lifecycle.cancel')}</Button>
      <Button variant="primary" disabled={!!createInvalid} onClick={() => {
        if (!creating) return;
        const definition = emptyLifecycleDefinition(application.code, creating.code, creating.label.trim());
        setCreating(null);
        guard(() => { setOpen({ detail: null, baseline: null, definition }); setTab('definition'); setFocus({ section: 'overview', key: null }); setReport(null); setVersions([]); });
      }}>{t('lifecycle.createDraft')}</Button>
    </>}>
      <div className={styles.section}>
        <p className={styles.muted}>{t('lifecycle.newHelp', { application: application.code })}</p>
        <Input label={t('lifecycle.field.code')} value={creating?.code ?? ''} required spellCheck={false} hint={t('lifecycle.keyFormat.code')}
          error={creating?.code && !lifecycleKeyValid('code', creating.code) ? t('lifecycle.keyFormat.code') : undefined}
          onChange={e => setCreating(c => (c ? { ...c, code: e.target.value.trim() } : c))} />
        <Input label={t('lifecycle.field.label')} value={creating?.label ?? ''} required maxLength={200} onChange={e => setCreating(c => (c ? { ...c, label: e.target.value } : c))} />
      </div>
    </Modal>
  </div>;
}

const MUTATIONS = ['create', 'save', 'approve', 'publish', 'activate'];
const KNOWN_ERRORS = ['INVALID_REQUEST', 'INVALID_DEFINITION', 'NOT_FOUND', 'NOT_ACTIVE', 'CONFLICT', 'IMMUTABLE', 'INDEPENDENT_APPROVAL_REQUIRED',
  'UNSUPPORTED_CAPABILITY', 'FORBIDDEN', 'LIMIT_EXCEEDED', 'STORAGE_FAILURE', 'INTEGRITY_FAILURE', 'REASON_REQUIRED', 'REASON_NOT_TRANSMITTABLE', 'REASON_TOO_LONG', 'REASON_INVALID_CHARACTERS'];
const knownError = (code: string) => (KNOWN_ERRORS.includes(code) ? code : 'other');
