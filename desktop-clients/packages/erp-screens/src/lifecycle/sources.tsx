'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessDenied, Badge, Button, Card, DescriptionList, EmptyState, Input, LoadingState, MultiSelect, RecoveryNotice, Select, Table,
  TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow, Textarea, failureFromError, useLocalization, type BadgeTone,
} from '@pepbits/ops-ui';
import {
  LifecycleContractError, LifecycleRequestError, emptyLifecycleFieldMapping, emptyLifecycleSourceMapping, isLifecycleUnavailable,
  lifecyclePayloadTargetSuggestion, lifecyclePayloadType, lifecycleSourceCaptureModes, lifecycleSourceFields, lifecycleSourceMappingProblems,
  lifecycleSourceOperations, lifecycleSourcePinCurrent, lifecycleSourceSlotId, lifecycleSourceSlots, lifecycleTableCapture, lifecycleTableSuppliedFields,
  lifecycleTransformsFor,
  repinLifecycleSourceMapping, shortLifecycleChecksum,
  type LifecycleCaptureMode, type LifecycleCatalogueGroup, type LifecycleFieldMapping, type LifecycleMetadata, type LifecycleReleaseDefinition,
  type LifecycleSource, type LifecycleSourceApi, type LifecycleSourceCapabilities, type LifecycleSourceMapping, type LifecycleSourceOperation,
  type LifecycleSourceSummary, type LifecycleTransform, type LifecycleUnavailable,
} from '@pepbits/erp-config/lifecycle';
import { LifecycleApplicabilityEditor } from './bindings';
import { LifecycleItemSection, LifecycleKeyField, LifecycleRemove } from './fields';
import styles from './lifecycle.module.css';

type FailureKind = 'forbidden' | 'unavailable' | 'missing' | 'error';
function failureKind(error: unknown): FailureKind {
  if (isLifecycleUnavailable(error)) return 'unavailable';
  if (error instanceof LifecycleRequestError) {
    if (error.code === 'FORBIDDEN' || error.status === 403) return 'forbidden';
    if (error.code === 'NOT_FOUND' || error.status === 404) return 'missing';
  }
  return 'error';
}

export type LifecycleSourceDetailState =
  | { status: 'loading' } | { status: 'ready'; source: LifecycleSource }
  | { status: 'missing' | 'forbidden' | 'error'; error: unknown };
/**
 * Loaded view of the host's source registry. Everything comes from the `LifecycleSourceApi` port; nothing is
 * cached across scopes (the page remounts per `scopeKey`) and nothing is invented while a request is pending.
 */
export interface LifecycleSourceCatalog {
  status: 'loading' | 'ready' | 'unavailable' | 'forbidden' | 'error';
  capabilities: LifecycleSourceCapabilities | null;
  unavailable: LifecycleUnavailable | null;
  items: LifecycleSourceSummary[];
  nextCursor: string | null;
  busy: boolean;
  error: unknown;
  details: Record<string, LifecycleSourceDetailState>;
  loadMore(): void;
  load(code: string): void;
  retry(): void;
}

/** Loads source capabilities and the first registry page once, then pages and details on demand. */
export function useLifecycleSourceCatalog(api: LifecycleSourceApi | undefined, options: { enabled: boolean; pageSize?: number }): LifecycleSourceCatalog | null {
  const limit = Math.max(1, Math.min(options.pageSize ?? 25, 100)), enabled = !!api && options.enabled;
  const generation = useRef(0), mounted = useRef(true), requested = useRef(new Set<string>());
  /** Latest port without restarting: a host may build its adapter inline on every render. */
  const port = useRef(api);
  port.current = api;
  const [state, setState] = useState<Omit<LifecycleSourceCatalog, 'loadMore' | 'load' | 'retry'>>({
    status: 'loading', capabilities: null, unavailable: null, items: [], nextCursor: null, busy: false, error: null, details: {},
  });
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const current = (g: number) => mounted.current && g === generation.current;

  const start = useCallback(async () => {
    const api = port.current;
    if (!api || !enabled) return;
    const g = ++generation.current;
    requested.current.clear();
    setState({ status: 'loading', capabilities: null, unavailable: null, items: [], nextCursor: null, busy: true, error: null, details: {} });
    try {
      const capabilities = await api.capabilities();
      if (!current(g)) return;
      if (!capabilities.available) { setState(s => ({ ...s, status: 'unavailable', unavailable: capabilities, busy: false })); return; }
      const page = await api.list({ cursor: null, limit });
      if (!current(g)) return;
      setState(s => ({ ...s, status: 'ready', capabilities, items: page.items, nextCursor: page.nextCursor, busy: false }));
    } catch (error) {
      if (!current(g)) return;
      const kind = failureKind(error);
      setState(s => ({ ...s, busy: false, error,
        status: kind === 'forbidden' ? 'forbidden' : kind === 'error' ? 'error' : 'unavailable',
        unavailable: kind === 'unavailable' || kind === 'missing'
          ? { available: false, code: error instanceof LifecycleRequestError ? error.code : 'LIFECYCLE_SOURCES_UNAVAILABLE', message: null } : null }));
    }
  }, [enabled, limit]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void start(); }, [start]);

  const loadMore = useCallback(() => {
    const api = port.current;
    if (!api || !state.nextCursor || state.busy) return;
    const g = generation.current, cursor = state.nextCursor;
    setState(s => ({ ...s, busy: true, error: null }));
    api.list({ cursor, limit }).then(page => {
      if (current(g)) setState(s => ({ ...s, busy: false, items: [...s.items, ...page.items], nextCursor: page.nextCursor }));
    }, error => { if (current(g)) setState(s => ({ ...s, busy: false, error })); });
  }, [limit, state.nextCursor, state.busy]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback((code: string) => {
    const api = port.current;
    if (!api || requested.current.has(code)) return;
    requested.current.add(code);
    const g = generation.current;
    setState(s => ({ ...s, details: { ...s.details, [code]: { status: 'loading' } } }));
    api.source(code).then(source => {
      if (current(g)) setState(s => ({ ...s, details: { ...s.details, [code]: { status: 'ready', source } } }));
    }, error => {
      if (!current(g)) return;
      requested.current.delete(code);
      const kind = failureKind(error);
      setState(s => ({ ...s, details: { ...s.details, [code]: { status: kind === 'unavailable' ? 'error' : kind, error } } }));
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return enabled ? { ...state, loadMore, load, retry: () => void start() } : null;
}

const pinTone = (status: string): BadgeTone => (status === 'current' ? 'success' : status === 'outdated' ? 'warning' : status === 'missing' ? 'danger' : 'neutral');
const failureOf = (error: unknown) => failureFromError(error instanceof LifecycleContractError ? { status: 502 } : error);

/** Loading / not enabled / forbidden / failed states shared by the registry panel and the mapping editor. */
function CatalogState({ catalog }: { catalog: LifecycleSourceCatalog }) {
  const { t } = useLocalization();
  if (catalog.status === 'loading') return <LoadingState title={t('lifecycle.source.loading')} description={t('lifecycle.source.loadingHelp')} />;
  if (catalog.status === 'forbidden') return <AccessDenied title={t('lifecycle.source.denied')} description={t('lifecycle.source.deniedHelp')} />;
  if (catalog.status === 'unavailable') return <div role="status" data-lifecycle-sources-unavailable={catalog.unavailable?.code}>
    <p>{t('lifecycle.source.unavailable')}</p>
    {catalog.unavailable?.code ? <p className={styles.code}>{catalog.unavailable.code}</p> : null}
    <Button size="sm" onClick={catalog.retry}>{t('lifecycle.checkAgain')}</Button>
  </div>;
  if (catalog.status === 'error') return <div>
    <RecoveryNotice failure={failureOf(catalog.error)} busy={catalog.busy} onRetry={catalog.retry} />
    {catalog.error instanceof LifecycleContractError ? <p className={styles.status} role="note">{t('lifecycle.error.contract', { path: catalog.error.path })}</p> : null}
  </div>;
  return null;
}

const yesNo = (t: (k: string) => string, v: boolean) => t(v ? 'lifecycle.source.yes' : 'lifecycle.source.no');
const list = (values: string[], t: (k: string) => string, prefix?: string) => values.length ? values.map(v => (prefix ? t(`${prefix}.${v}`) : v)).join(', ') : t('lifecycle.none');

/** Read-only detail of one registered source: pinned provenance, capture facts and field metadata. */
export function LifecycleSourceDetail({ source }: { source: LifecycleSource }) {
  const { t } = useLocalization();
  return <div className={styles.section} data-lifecycle-source={source.code}>
    <h3>{source.name} <code className={styles.code}>{source.code}</code></h3>
    <p className={styles.muted}>{source.description}</p>
    <DescriptionList items={[
      { id: 'application', label: t('lifecycle.field.application'), value: <code className={styles.code}>{source.application}</code> },
      { id: 'release', label: t('lifecycle.source.release'), value: <code className={styles.code}>{source.provenance.release}</code> },
      { id: 'revision', label: t('lifecycle.source.pinRevision'), value: String(source.provenance.revision) },
      { id: 'fingerprint', label: t('lifecycle.source.fingerprint'), value: <code className={styles.code}>{source.provenance.fingerprint}</code> },
      { id: 'modes', label: t('lifecycle.source.captureModes'), value: list(source.captureModes, t, 'lifecycle.source.capture') },
      { id: 'operations', label: t('lifecycle.source.serviceOperations'), value: list(source.serviceOperations, t, 'lifecycle.source.operation') },
      { id: 'prefix', label: t('lifecycle.source.tableEventPrefix'), value: source.tableEventPrefix ? <code className={styles.code}>{source.tableEventPrefix}</code> : t('lifecycle.none') },
    ]} />
    {source.tableCaptures.length ? <TableContainer><Table aria-label={t('lifecycle.source.tableCaptures')}>
      <TableHeader><TableRow>{['operation', 'eventType', 'configuration', 'payloadFields'].map(k => <TableHead key={k}>{t(`lifecycle.source.tableColumn.${k}`)}</TableHead>)}</TableRow></TableHeader>
      <TableBody>{source.tableCaptures.map(c => <TableRow key={`${c.operation}:${c.configurationId}`}>
        <TableCell>{t(`lifecycle.source.operation.${c.operation}`)}</TableCell>
        <TableCell><code className={styles.code}>{`${c.eventType} v${c.schemaVersion}`}</code></TableCell>
        <TableCell><code className={styles.code}>{`${c.configurationId} · r${c.revision}`}</code></TableCell>
        <TableCell>{c.payloadFields.join(', ') || t('lifecycle.none')}</TableCell>
      </TableRow>)}</TableBody>
    </Table></TableContainer> : null}
    <TableContainer><Table aria-label={t('lifecycle.source.fields')}>
      <TableHeader><TableRow>{['name', 'type', 'sensitivity', 'selectable', 'disclosable', 'tableCapturable', 'required', 'description']
        .map(k => <TableHead key={k}>{t(`lifecycle.source.fieldColumn.${k}`)}</TableHead>)}</TableRow></TableHeader>
      <TableBody>{source.fields.map(f => <TableRow key={f.code} data-lifecycle-source-field={f.name}>
        <TableCell><code className={styles.code}>{f.name}</code></TableCell>
        <TableCell><code className={styles.code}>{f.type}{f.nullable ? '?' : ''}</code></TableCell>
        <TableCell>{f.sensitive ? <Badge tone="warning">{f.sensitivity}</Badge> : <code className={styles.code}>{f.sensitivity}</code>}</TableCell>
        <TableCell>{yesNo(t, f.selectable)}</TableCell>
        <TableCell>{yesNo(t, f.disclosable)}</TableCell>
        <TableCell>{yesNo(t, f.tableCapturable)}</TableCell>
        <TableCell>{yesNo(t, f.required)}</TableCell>
        <TableCell>{f.description}</TableCell>
      </TableRow>)}</TableBody>
    </Table></TableContainer>
  </div>;
}

/** Host-owned source registry: bounded list with cursor paging and a read-only detail. */
export function LifecycleSourceRegistryPanel({ catalog, application }: { catalog: LifecycleSourceCatalog; application: LifecycleCatalogueGroup }) {
  const { t } = useLocalization(), [selected, setSelected] = useState<string | null>(null);
  const detail = selected ? catalog.details[selected] : undefined, caps = catalog.capabilities;
  return <Card className={styles.section} data-lifecycle-source-registry>
    <h2>{t('lifecycle.source.registry.title')}</h2>
    <p className={styles.muted}>{t('lifecycle.source.registry.help', { application: application.label })}</p>
    <CatalogState catalog={catalog} />
    {catalog.status === 'ready' && caps ? <>
      <DescriptionList items={[
        { id: 'modes', label: t('lifecycle.source.captureModes'), value: list(caps.captureModes, t, 'lifecycle.source.capture') },
        { id: 'operations', label: t('lifecycle.source.operations'), value: list(caps.operations, t, 'lifecycle.source.operation') },
        { id: 'transforms', label: t('lifecycle.source.transforms'), value: list(caps.transforms, t, 'lifecycle.source.transform') },
        { id: 'limits', label: t('lifecycle.source.limits'), value: t('lifecycle.source.limitsValue', { mappings: caps.mappingLimit, fields: caps.fieldLimit, values: caps.mapValueLimit }) },
      ]} />
      {catalog.items.length ? <TableContainer><Table aria-label={t('lifecycle.source.registry.title')}>
        <TableHeader><TableRow>{['name', 'code', 'release', 'modes', 'fields', 'open'].map(k => <TableHead key={k}>{t(`lifecycle.source.column.${k}`)}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{catalog.items.map(s => <TableRow key={s.code} data-selected={selected === s.code || undefined}>
          <TableCell>{s.name}</TableCell>
          <TableCell><code className={styles.code}>{s.code}</code></TableCell>
          <TableCell><code className={styles.code} title={s.provenance.fingerprint}>{`${s.provenance.release} · r${s.provenance.revision}`}</code></TableCell>
          <TableCell>{list(s.captureModes, t, 'lifecycle.source.capture')}</TableCell>
          <TableCell>{s.fieldCount}</TableCell>
          <TableCell><Button size="sm" variant="ghost" aria-label={t('lifecycle.source.openSource', { code: s.code })}
            onClick={() => { setSelected(s.code); catalog.load(s.code); }}>{t('lifecycle.source.open')}</Button></TableCell>
        </TableRow>)}</TableBody>
      </Table></TableContainer> : <EmptyState title={t('lifecycle.source.empty')} description={t('lifecycle.source.emptyHelp')} />}
      {catalog.nextCursor ? <div className={styles.actions}><Button size="sm" disabled={catalog.busy} onClick={catalog.loadMore}>{t('lifecycle.loadMore')}</Button></div> : null}
      {catalog.error && catalog.items.length ? <RecoveryNotice failure={failureOf(catalog.error)} busy={catalog.busy} onRetry={catalog.loadMore} /> : null}
      {detail?.status === 'loading' ? <LoadingState title={t('lifecycle.source.loadingDetail')} /> : null}
      {detail?.status === 'ready' ? <LifecycleSourceDetail source={detail.source} /> : null}
      {detail && detail.status !== 'loading' && detail.status !== 'ready' ? <SourceDetailFailure state={detail} onRetry={() => selected && catalog.load(selected)} /> : null}
    </> : null}
  </Card>;
}

function SourceDetailFailure({ state, onRetry }: { state: Extract<LifecycleSourceDetailState, { error: unknown }>; onRetry: () => void }) {
  const { t } = useLocalization();
  if (state.status === 'missing') return <p role="status" className={styles.status}>{t('lifecycle.source.notRegistered')}</p>;
  if (state.status === 'forbidden') return <AccessDenied title={t('lifecycle.source.denied')} description={t('lifecycle.source.deniedHelp')} />;
  return <RecoveryNotice failure={failureOf(state.error)} onRetry={onRetry} />;
}

const unique = (taken: string[]) => { for (let i = 1; ; i++) if (!taken.includes(`mapping-${i}`)) return `mapping-${i}`; };

/**
 * Source mappings section of the definition editor. Mappings are stored in `definition.sourceMappings` and saved,
 * approved, published and activated with the release itself; nothing here persists or activates on its own.
 */
export function LifecycleSourceMappingsSection({ definition, metadata, catalog, readOnly, selected, onSelect, onChange }: {
  definition: LifecycleReleaseDefinition;
  metadata: LifecycleMetadata;
  /** Null when the host supplied no source port: existing mappings are shown read-only. */
  catalog: LifecycleSourceCatalog | null;
  readOnly: boolean;
  selected: string | null;
  onSelect: (key: string | null) => void;
  onChange: (next: LifecycleReleaseDefinition) => void;
}) {
  const { t } = useLocalization(), mappings = definition.sourceMappings ?? [];
  const locked = readOnly || !catalog || catalog.status !== 'ready';
  const index = mappings.findIndex(m => m.key === selected), item = mappings[index];
  const limit = catalog?.capabilities?.mappingLimit ?? 256;
  const set = (next: LifecycleSourceMapping[]) => {
    const { sourceMappings: _previous, ...rest } = definition;
    onChange(next.length ? { ...rest, sourceMappings: next } : rest);
  };
  return <LifecycleItemSection title={t('lifecycle.section.sourceMappings')} help={t('lifecycle.help.sourceMappings')} items={mappings} id={m => m.key}
    describe={m => ({ label: `${m.source.source} · ${t(`lifecycle.source.operation.${m.operation}`)} → ${m.event}`, code: `${m.key} · ${t(`lifecycle.source.capture.${m.capture}`)} · ${m.lifecycle}/${m.stage}/${m.event}` })}
    selected={selected} onSelect={onSelect} addDisabled={locked || mappings.length >= limit} onAdd={locked ? undefined : () => onSelect(null)}>
    {!catalog ? <p role="note" className={styles.status}>{t('lifecycle.source.notConnected')}</p> : <CatalogState catalog={catalog} />}
    {item ? <>
      <LifecycleSourceMappingEditor mapping={item} definition={definition} metadata={metadata} catalog={catalog} disabled={readOnly || !catalog}
        onChange={(next, renamedFrom) => { set(mappings.map((m, i) => (i === index ? next : m))); if (renamedFrom) onSelect(next.key); }} />
      <LifecycleRemove references={[]} disabled={readOnly} onRemove={() => { set(mappings.filter((_, i) => i !== index)); onSelect(null); }} />
    </> : catalog?.status === 'ready' && !readOnly ? <NewMapping definition={definition} catalog={catalog} full={mappings.length >= limit}
      onCreate={mapping => { set([...mappings, mapping]); onSelect(mapping.key); }} /> : mappings.length ? <p className={styles.muted}>{t('lifecycle.selectItem')}</p> : null}
  </LifecycleItemSection>;
}

/** Choose a registered source; the mapping is created only from its loaded registry detail and pin. */
function NewMapping({ definition, catalog, full, onCreate }: {
  definition: LifecycleReleaseDefinition;
  catalog: LifecycleSourceCatalog;
  full: boolean;
  onCreate: (mapping: LifecycleSourceMapping) => void;
}) {
  const { t } = useLocalization(), [code, setCode] = useState('');
  const detail = code ? catalog.details[code] : undefined, caps = catalog.capabilities!;
  const source = detail?.status === 'ready' ? detail.source : null;
  const draft = source ? emptyLifecycleSourceMapping(definition, source, caps, unique((definition.sourceMappings ?? []).map(m => m.key))) : null;
  const blocked = !draft ? null : !lifecycleSourceCaptureModes(source!, caps).length || !lifecycleSourceOperations(source!, draft.capture, caps).length
    ? 'lifecycle.source.noOperations' : !draft.event ? 'lifecycle.source.noSlots' : null;
  return <div className={styles.section} data-lifecycle-source-new>
    <h3>{t('lifecycle.source.newMapping')}</h3>
    <p className={styles.muted}>{t('lifecycle.source.newHelp')}</p>
    <Select label={t('lifecycle.source.source')} value={code} required placeholder={t('lifecycle.source.chooseSource')}
      hint={catalog.items.length ? undefined : t('lifecycle.source.empty')}
      options={catalog.items.map(s => ({ value: s.code, label: `${s.name} (${s.code})` }))}
      onChange={e => { setCode(e.target.value); if (e.target.value) catalog.load(e.target.value); }} />
    {catalog.nextCursor ? <div className={styles.actions}><Button size="sm" disabled={catalog.busy} onClick={catalog.loadMore}>{t('lifecycle.source.moreSources')}</Button></div> : null}
    {detail?.status === 'loading' ? <p role="status" className={styles.status}>{t('lifecycle.source.loadingDetail')}</p> : null}
    {detail && detail.status !== 'loading' && detail.status !== 'ready' ? <SourceDetailFailure state={detail} onRetry={() => catalog.load(code)} /> : null}
    {blocked ? <p role="note" className={styles.status}>{t(blocked)}</p> : null}
    <div className={styles.actions}>
      <Button variant="primary" size="sm" disabled={!draft || !!blocked || full} onClick={() => draft && onCreate(draft)}>{t('lifecycle.source.addMapping')}</Button>
    </div>
  </div>;
}

/** Inspector for one mapping. Every choice is restricted to registry facts and the definition's declared slots. */
export function LifecycleSourceMappingEditor({ mapping: m, definition, metadata, catalog, disabled, onChange }: {
  mapping: LifecycleSourceMapping;
  definition: LifecycleReleaseDefinition;
  metadata: LifecycleMetadata;
  catalog: LifecycleSourceCatalog | null;
  disabled: boolean;
  onChange: (next: LifecycleSourceMapping, renamedFrom?: string) => void;
}) {
  const { t } = useLocalization();
  const ready = catalog?.status === 'ready';
  useEffect(() => { if (ready) catalog!.load(m.source.source); }, [ready, m.source.source]); // eslint-disable-line react-hooks/exhaustive-deps
  const detail = catalog?.details[m.source.source], caps = ready ? catalog!.capabilities : null;
  const source = detail?.status === 'ready' ? detail.source : null;
  const editable = !disabled && !!source && !!caps;
  const table = source && m.capture === 'TABLE' ? lifecycleTableCapture(source, m.operation) : null;
  const problems = useMemo(() => lifecycleSourceMappingProblems({ definition, mapping: m, source, capabilities: caps }), [definition, m, source, caps]);
  const error = (path: string) => { const p = problems.find(x => x.path === path); return p ? t(`lifecycle.source.issue.${p.code}`) : undefined; };
  const set = (patch: Partial<LifecycleSourceMapping>) => onChange({ ...m, ...patch });
  const pin = !catalog ? 'unverified' : !detail || detail.status === 'loading' ? 'loading' : detail.status === 'missing' ? 'missing'
    : detail.status !== 'ready' ? 'unverified' : lifecycleSourcePinCurrent(m.source, detail.source) ? 'current' : 'outdated';

  const modes = source && caps ? lifecycleSourceCaptureModes(source, caps) : [m.capture];
  const operations = source && caps ? lifecycleSourceOperations(source, m.capture, caps) : [m.operation];
  const slots = lifecycleSourceSlots(definition, m.capture, table);
  const slotId = lifecycleSourceSlotId(m), slotKnown = slots.some(s => lifecycleSourceSlotId(s) === slotId);
  const slotLabel = (s: { lifecycle: string; stage: string; event: string }) => {
    const l = definition.lifecycles.find(x => x.key === s.lifecycle), st = definition.stages.find(x => x.key === s.stage), ev = definition.events.find(x => x.key === s.event);
    return `${l?.label || s.lifecycle} › ${st?.label || s.stage} › ${ev?.label || s.event} (${s.event})`;
  };
  const fields = source ? lifecycleSourceFields(source, m.capture, table, caps) : [];
  const supplied = m.capture === 'TABLE' ? lifecycleTableSuppliedFields(table, caps) : [];
  const withOperation = (operation: LifecycleSourceOperation, capture: LifecycleCaptureMode = m.capture) => {
    const nextTable = source && capture === 'TABLE' ? lifecycleTableCapture(source, operation) : null;
    const nextSlots = lifecycleSourceSlots(definition, capture, nextTable);
    const keep = nextSlots.some(s => lifecycleSourceSlotId(s) === slotId), slot = keep ? m : nextSlots[0];
    set({ capture, operation, watch: operation === 'UPDATED' ? m.watch : [],
      lifecycle: slot?.lifecycle ?? m.lifecycle, stage: slot?.stage ?? m.stage, event: slot?.event ?? m.event });
  };
  const setField = (i: number, next: LifecycleFieldMapping) => set({ fields: m.fields.map((f, j) => (j === i ? next : f)) });
  const [adding, setAdding] = useState('');
  const fieldLimit = caps?.fieldLimit ?? 128;

  return <div className={styles.section} data-lifecycle-source-mapping={m.key}>
    <div className={styles.fields}>
      <LifecycleKeyField label={t('lifecycle.source.mappingKey')} value={m.key} format="code" disabled={disabled}
        taken={(definition.sourceMappings ?? []).map(x => x.key).filter(k => k !== m.key)} onRename={key => onChange({ ...m, key }, m.key)} />
      <Input label={t('lifecycle.source.source')} value={source ? `${source.name} (${m.source.source})` : m.source.source} readOnly disabled
        hint={t('lifecycle.source.sourceFixed')} error={error('source.application')} />
    </div>
    <fieldset className={styles.matrix} data-lifecycle-source-pin={pin}>
      <legend>{t('lifecycle.source.pin')}</legend>
      <div className={styles.actions}>
        <Badge tone={pinTone(pin)}>{t(`lifecycle.source.pinStatus.${pin}`)}</Badge>
        <code className={styles.code} title={m.source.fingerprint}>{`${m.source.release} · r${m.source.revision} · ${shortLifecycleChecksum(m.source.fingerprint)}`}</code>
      </div>
      {pin === 'outdated' && source ? <>
        <p className={styles.status}>{t('lifecycle.source.pinOutdated', { release: source.provenance.release, revision: source.provenance.revision })}</p>
        <div className={styles.actions}><Button size="sm" disabled={disabled} onClick={() => onChange(repinLifecycleSourceMapping(m, source))}>{t('lifecycle.source.repin')}</Button></div>
      </> : null}
      {pin === 'missing' ? <p role="note" className={styles.status}>{t('lifecycle.source.notRegistered')}</p> : null}
      {detail && (detail.status === 'error' || detail.status === 'forbidden') ? <SourceDetailFailure state={detail} onRetry={() => catalog?.load(m.source.source)} /> : null}
    </fieldset>
    <div className={styles.fields}>
      <Select label={t('lifecycle.source.captureMode')} value={m.capture} disabled={!editable} placeholder="" error={error('capture')}
        hint={t(`lifecycle.source.captureHelp.${m.capture}`)}
        options={[...new Set([...modes, m.capture])].map(v => ({ value: v, label: t(`lifecycle.source.capture.${v}`) }))}
        onChange={e => { const capture = e.target.value as LifecycleCaptureMode; withOperation(source && caps ? lifecycleSourceOperations(source, capture, caps)[0] ?? m.operation : m.operation, capture); }} />
      <Select label={t('lifecycle.source.operationLabel')} value={m.operation} disabled={!editable} placeholder="" error={error('operation')}
        options={[...new Set([...operations, m.operation])].map(v => ({ value: v, label: t(`lifecycle.source.operation.${v}`) }))}
        onChange={e => withOperation(e.target.value as LifecycleSourceOperation)} />
      <Select label={t('lifecycle.source.slot')} value={m.event ? slotId : ''} required disabled={disabled} placeholder={t('lifecycle.source.chooseSlot')}
        error={error('event') ?? error('stage') ?? error('lifecycle')} hint={t('lifecycle.source.slotHelp')}
        options={[...slots.map(s => ({ value: lifecycleSourceSlotId(s), label: slotLabel(s) })),
          ...(m.event && !slotKnown ? [{ value: slotId, label: `${slotLabel(m)} — ${t('lifecycle.source.slotInvalid')}` }] : [])]}
        onChange={e => { const s = slots.find(x => lifecycleSourceSlotId(x) === e.target.value); if (s) set({ lifecycle: s.lifecycle, stage: s.stage, event: s.event }); }} />
    </div>
    {!slots.length ? <p className={styles.status} role="note">{t(m.capture === 'TABLE' ? 'lifecycle.source.noTableSlots' : 'lifecycle.source.noSlots')}</p> : null}
    {m.operation === 'UPDATED' ? <MultiSelect label={t('lifecycle.source.watch')} hint={t('lifecycle.source.watchHelp')} value={m.watch} disabled={!editable}
      error={problems.find(p => p.path.startsWith('watch')) ? t(`lifecycle.source.issue.${problems.find(p => p.path.startsWith('watch'))!.code}`) : undefined}
      options={(source?.fields.filter(f => f.selectable) ?? []).map(f => ({ value: f.name, label: f.name }))} onChange={watch => set({ watch })} /> : null}

    <fieldset className={styles.matrix} data-lifecycle-field-mappings>
      <legend>{t('lifecycle.source.fieldsTitle')}</legend>
      <p className={styles.muted}>{t(m.capture === 'TABLE' ? 'lifecycle.source.fieldsHelpTable' : 'lifecycle.source.fieldsHelp')}</p>
      {error('fields') ? <p className={styles.status} role="note">{error('fields')}</p> : null}
      {supplied.length ? <p className={styles.status} role="note" data-lifecycle-supplied>{t('lifecycle.source.suppliedByCapture', { fields: supplied.join(', ') })}</p> : null}
      {m.fields.map((f, i) => <FieldMappingRow key={i} index={i} mapping={f} capture={m.capture} source={source} caps={caps} allowed={fields} disabled={!editable}
        error={error} onChange={next => setField(i, next)} onRemove={() => set({ fields: m.fields.filter((_, j) => j !== i) })} />)}
      {editable ? <div className={styles.constraint}>
        <Select label={t('lifecycle.source.addFieldLabel')} value={adding} placeholder={t('lifecycle.source.chooseField')}
          options={fields.map(f => ({ value: f.name, label: `${f.name} · ${f.type} · ${f.sensitivity}` }))} onChange={e => setAdding(e.target.value)} />
        <Button size="sm" disabled={!adding || m.fields.length >= fieldLimit} onClick={() => {
          const field = fields.find(f => f.name === adding);
          if (!field || !caps) return;
          set({ fields: [...m.fields, emptyLifecycleFieldMapping(field, caps, lifecyclePayloadTargetSuggestion(field.name, m.fields.map(x => x.target)), m.capture)] });
          setAdding('');
        }}>{t('lifecycle.source.addField')}</Button>
      </div> : null}
      {source && !fields.length ? <p className={styles.status} role="note">{t('lifecycle.source.noFields')}</p> : null}
    </fieldset>

    <fieldset className={styles.matrix}>
      <legend>{t('lifecycle.source.conditions')}</legend>
      <LifecycleApplicabilityEditor applicability={m.applicability} definition={definition} disabled={disabled} limits={metadata.limits}
        onChange={applicability => set({ applicability })} />
    </fieldset>

    <LifecycleSourcePayloadPreview mapping={m} definition={definition} source={source} />
    {problems.length ? <div role="note" data-lifecycle-source-problems={problems.length}>
      <p className={styles.status}>{t('lifecycle.source.problems', { count: problems.length })}</p>
      <ul className={styles.reasons}>{problems.map((p, i) => <li key={`${p.path}:${p.code}:${i}`}><code className={styles.code}>{p.path}</code> {t(`lifecycle.source.issue.${p.code}`)}</li>)}</ul>
    </div> : null}
  </div>;
}

function FieldMappingRow({ index, mapping: f, capture, source, caps, allowed, disabled, error, onChange, onRemove }: {
  index: number;
  mapping: LifecycleFieldMapping;
  capture: LifecycleCaptureMode;
  source: LifecycleSource | null;
  caps: LifecycleSourceCapabilities | null;
  allowed: LifecycleSource['fields'];
  disabled: boolean;
  error: (path: string) => string | undefined;
  onChange: (next: LifecycleFieldMapping) => void;
  onRemove: () => void;
}) {
  const { t } = useLocalization(), field = source?.fields.find(x => x.name === f.source);
  const transforms = field && caps ? lifecycleTransformsFor(field, caps, capture) : [];
  const table = capture === 'TABLE';
  const withTransform = (transform: LifecycleTransform) => onChange({ ...f, transform, values: transform === 'MAP' ? f.values : {} });
  const at = (k: string) => error(`fields[${index}].${k}`);
  return <div className={styles.constraint} data-lifecycle-field-mapping={f.target || index}>
    <Input label={t('lifecycle.source.target')} value={f.target} disabled={disabled} readOnly={table} required spellCheck={false} autoComplete="off" maxLength={64}
      hint={t(table ? 'lifecycle.source.targetTableHint' : 'lifecycle.source.targetHint')} error={at('target')} onChange={e => onChange({ ...f, target: e.target.value.trim() })} />
    <Select label={t('lifecycle.source.sourceField')} value={f.source} disabled={disabled} placeholder="" error={at('source')}
      options={[...allowed.map(x => ({ value: x.name, label: `${x.name} · ${x.type} · ${x.sensitivity}` })),
        ...(allowed.some(x => x.name === f.source) ? [] : [{ value: f.source, label: `${f.source} — ${t('lifecycle.source.fieldNotPermitted')}` }])]}
      onChange={e => {
        const next = source?.fields.find(x => x.name === e.target.value);
        const options = next && caps ? lifecycleTransformsFor(next, caps, capture) : [];
        const transform = options.includes(f.transform) ? f.transform : options[0] ?? f.transform;
        onChange({ ...f, source: e.target.value, target: table ? e.target.value : f.target, transform, values: transform === 'MAP' ? f.values : {} });
      }} />
    <Select label={t('lifecycle.source.transform')} value={f.transform} disabled={disabled} placeholder="" error={at('transform')}
      hint={t(`lifecycle.source.transformHelp.${f.transform}`)}
      options={[...new Set([...transforms, f.transform])].map(v => ({ value: v, label: t(`lifecycle.source.transform.${v}`) }))}
      onChange={e => withTransform(e.target.value as LifecycleTransform)} />
    <Button size="sm" variant="ghost" disabled={disabled} onClick={onRemove}
      aria-label={t('lifecycle.source.removeFieldNamed', { target: f.target || f.source })}>{t('lifecycle.source.removeField')}</Button>
    {!table && (field?.sensitive || (field && !field.disclosable)) ? <p className={styles.status} role="note">
      <Badge tone="warning">{field.sensitivity}</Badge> {t(field.disclosable ? 'lifecycle.source.sensitiveApproved' : 'lifecycle.source.presenceOnly')}
    </p> : null}
    {f.transform === 'MAP' ? <MapValuesField value={f.values} disabled={disabled} max={caps?.mapValueLimit ?? 64} error={at('values')}
      onChange={values => onChange({ ...f, values })} /> : null}
  </div>;
}

/** MAP table as `source value=payload value` lines. Only well-formed, duplicate-free text is committed. */
function MapValuesField({ value, disabled, max, error, onChange }: {
  value: Record<string, string>;
  disabled: boolean;
  max: number;
  error?: string;
  onChange: (next: Record<string, string>) => void;
}) {
  const { t } = useLocalization();
  const format = (v: Record<string, string>) => Object.entries(v).map(([k, x]) => `${k}=${x}`).join('\n');
  const [text, setText] = useState(format(value));
  const parse = (raw: string): Record<string, string> | 'format' | 'duplicate' | 'limit' => {
    const out: Record<string, string> = {}, lines = raw.split('\n').filter(l => l.trim());
    for (const line of lines) {
      const at = line.indexOf('=');
      if (at <= 0) return 'format';
      const from = line.slice(0, at).trim();
      if (!from) return 'format';
      if (Object.prototype.hasOwnProperty.call(out, from)) return 'duplicate';
      Object.defineProperty(out, from, { value: line.slice(at + 1).trim(), enumerable: true, writable: true, configurable: true });
    }
    return lines.length > max ? 'limit' : out;
  };
  useEffect(() => { setText(current => { const p = parse(current); return typeof p === 'object' && format(p) === format(value) ? current : format(value); }); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const parsed = parse(text), local = typeof parsed === 'string' ? t(`lifecycle.source.mapValues.${parsed}`, { max }) : undefined;
  return <Textarea label={t('lifecycle.source.mapValues.label')} value={text} disabled={disabled} spellCheck={false} rows={4}
    hint={t('lifecycle.source.mapValues.hint', { max })} error={local ?? error}
    onChange={e => { setText(e.target.value); const p = parse(e.target.value); if (typeof p === 'object') onChange(p); }} />;
}

/**
 * Payload shape derived from the mapping definition: destination, produced type and source field only.
 * No row values, sample values or activation results are shown.
 */
export function LifecycleSourcePayloadPreview({ mapping: m, definition, source }: { mapping: LifecycleSourceMapping; definition: LifecycleReleaseDefinition; source: LifecycleSource | null }) {
  const { t } = useLocalization(), event = definition.events.find(e => e.key === m.event);
  return <fieldset className={styles.matrix} data-lifecycle-source-preview>
    <legend>{t('lifecycle.source.preview')}</legend>
    <p className={styles.muted}>{t(m.capture === 'TABLE' ? 'lifecycle.source.previewTable' : 'lifecycle.source.previewHelp')}</p>
    <DescriptionList items={[
      { id: 'event', label: t('lifecycle.field.eventType'), value: event ? <code className={styles.code}>{`${event.eventType} v${event.schemaVersion}`}</code> : t('lifecycle.none') },
      { id: 'slot', label: t('lifecycle.source.slot'), value: <code className={styles.code}>{m.lifecycle}/{m.stage}/{m.event}</code> },
      { id: 'provenance', label: t('lifecycle.source.provenance'), value: t('lifecycle.source.provenanceValue', { mapping: m.key, source: m.source.source, release: m.source.release, revision: m.source.revision }) },
    ]} />
    {m.fields.length ? <TableContainer><Table aria-label={t('lifecycle.source.preview')}>
      <TableHeader><TableRow>{['target', 'type', 'source', 'transform', 'sensitivity'].map(k => <TableHead key={k}>{t(`lifecycle.source.previewColumn.${k}`)}</TableHead>)}</TableRow></TableHeader>
      <TableBody>{m.fields.map((f, i) => { const field = source?.fields.find(x => x.name === f.source);
        return <TableRow key={`${f.target}:${i}`}>
          <TableCell><code className={styles.code}>{`data.${f.target}`}</code></TableCell>
          <TableCell><code className={styles.code}>{lifecyclePayloadType(field, f.transform)}</code></TableCell>
          <TableCell><code className={styles.code}>{f.source}</code></TableCell>
          <TableCell>{t(`lifecycle.source.transform.${f.transform}`)}</TableCell>
          <TableCell>{field ? field.sensitivity : t('lifecycle.source.unknown')}</TableCell>
        </TableRow>; })}</TableBody>
    </Table></TableContainer> : <p className={styles.muted}>{t('lifecycle.source.previewEmpty')}</p>}
  </fieldset>;
}
