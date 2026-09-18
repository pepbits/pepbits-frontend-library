'use client';
import React, { useEffect, useState } from 'react';
import { Button, Card, Checkbox, Input, Select, Tabs, Textarea, useLocalization } from '@pepbits/ops-ui';
import {
  LIFECYCLE_RESERVED_DIMENSIONS, LifecycleContractError, canonicalLifecycleJson, lifecycleEventTypeSuggestion,
  lifecycleEventTypeValid, lifecycleReferences, parseLifecycleReleaseDefinition, renameLifecycleKey,
  type LifecycleBinding, type LifecycleDimensionType, type LifecycleGraph, type LifecycleMetadata, type LifecycleReleaseDefinition,
} from '@pepbits/erp-config/lifecycle';
import { LifecycleBindingEditor } from './bindings';
import { LifecycleItemSection, LifecycleKeyField, LifecycleListField, LifecycleOptionalCodeField, LifecycleRemove } from './fields';
import styles from './lifecycle.module.css';

export type LifecycleEditorSection = 'overview' | 'dimensions' | 'stages' | 'events' | 'lifecycles' | 'bindings' | 'json';
export interface LifecycleEditorFocus { section: LifecycleEditorSection; key: string | null }

const unique = (prefix: string, taken: string[], upper = false) => {
  for (let i = 1; ; i++) { const key = upper ? `${prefix}_${i}` : `${prefix}-${i}`; if (!taken.includes(key)) return key; }
};

/**
 * Visual editor for one release definition. Pure: every change goes through `onChange`,
 * the owner decides dirty state and persistence. `readOnly` covers published versions and
 * missing edit permission; controls stay visible but disabled.
 */
export function LifecycleDefinitionEditor({ definition, metadata, readOnly, focus, onFocus, onChange, advancedJson = true }: {
  definition: LifecycleReleaseDefinition;
  metadata: LifecycleMetadata;
  readOnly: boolean;
  focus: LifecycleEditorFocus;
  onFocus: (focus: LifecycleEditorFocus) => void;
  onChange: (next: LifecycleReleaseDefinition) => void;
  advancedJson?: boolean;
}) {
  const { t } = useLocalization(), limits = metadata.limits, d = definition;
  const sections: LifecycleEditorSection[] = ['overview', 'dimensions', 'stages', 'events', 'lifecycles', 'bindings', ...(advancedJson ? ['json' as const] : [])];
  const select = (key: string | null) => onFocus({ section: focus.section, key });
  const counts: Partial<Record<LifecycleEditorSection, number>> = { dimensions: d.dimensions.length, stages: d.stages.length, events: d.events.length, lifecycles: d.lifecycles.length, bindings: d.bindings.length };
  const rename = (kind: 'stages' | 'events' | 'lifecycles' | 'dimensions', from: string, to: string) => { onChange(renameLifecycleKey(d, kind, from, to)); select(to); };
  const replace = <K extends 'dimensions' | 'stages' | 'events' | 'lifecycles' | 'bindings'>(kind: K, index: number, item: LifecycleReleaseDefinition[K][number]) =>
    onChange({ ...d, [kind]: d[kind].map((x, i) => (i === index ? item : x)) });
  const remove = (kind: 'dimensions' | 'stages' | 'events' | 'lifecycles' | 'bindings', index: number) => {
    onChange({ ...d, [kind]: (d[kind] as unknown[]).filter((_, i) => i !== index) });
    select(null);
  };

  let body: React.ReactNode = null;
  if (focus.section === 'overview') body = <Card className={styles.section}>
    <div className={styles.fields}>
      <Input label={t('lifecycle.field.application')} value={d.application} readOnly disabled />
      <Input label={t('lifecycle.field.code')} value={d.code} readOnly disabled hint={t('lifecycle.field.codeImmutable')} />
      <Input label={t('lifecycle.field.version')} value={d.version} readOnly disabled hint={t('lifecycle.field.versionAssigned')} />
    </div>
    <Input label={t('lifecycle.field.label')} value={d.label} disabled={readOnly} required maxLength={200} onChange={e => onChange({ ...d, label: e.target.value })} />
    <Textarea label={t('lifecycle.field.description')} value={d.description ?? ''} disabled={readOnly} maxLength={2000}
      onChange={e => onChange({ ...d, description: e.target.value ? e.target.value : null })} />
  </Card>;

  if (focus.section === 'dimensions') {
    const index = d.dimensions.findIndex(x => x.code === focus.key), item = d.dimensions[index];
    body = <LifecycleItemSection title={t('lifecycle.section.dimensions')} help={t('lifecycle.help.dimensions')} items={d.dimensions} id={x => x.code}
      describe={x => ({ label: x.label, code: `${x.code} · ${t(`lifecycle.dimensionType.${x.type}`)}` })} selected={focus.key} onSelect={select}
      addDisabled={readOnly || d.dimensions.length >= limits.dimensions}
      onAdd={readOnly ? undefined : () => { const code = unique('dimension', d.dimensions.map(x => x.code)); onChange({ ...d, dimensions: [...d.dimensions, { code, label: '', type: 'STRING' }] }); select(code); }}>
      {item ? <>
        <div className={styles.fields}>
          <LifecycleKeyField label={t('lifecycle.field.dimensionCode')} value={item.code} format="code" disabled={readOnly}
            taken={[...LIFECYCLE_RESERVED_DIMENSIONS, ...d.dimensions.map(x => x.code).filter(c => c !== item.code)]} onRename={to => rename('dimensions', item.code, to)} />
          <Input label={t('lifecycle.field.label')} value={item.label} disabled={readOnly} onChange={e => replace('dimensions', index, { ...item, label: e.target.value })} />
          <Select label={t('lifecycle.field.dimensionType')} value={item.type} disabled={readOnly} placeholder=""
            options={metadata.dimensionTypes.map(v => ({ value: v, label: t(`lifecycle.dimensionType.${v}`) }))}
            onChange={e => replace('dimensions', index, { ...item, type: e.target.value as LifecycleDimensionType })} />
        </div>
        <p className={styles.muted}>{t('lifecycle.help.reservedDimensions')}</p>
        <LifecycleRemove references={lifecycleReferences(d, 'dimensions', item.code)} disabled={readOnly} onRemove={() => remove('dimensions', index)} />
      </> : <p className={styles.muted}>{t('lifecycle.selectItem')}</p>}
    </LifecycleItemSection>;
  }

  if (focus.section === 'stages') {
    const index = d.stages.findIndex(x => x.key === focus.key), item = d.stages[index];
    body = <LifecycleItemSection title={t('lifecycle.section.stages')} help={t('lifecycle.help.stages')} items={d.stages} id={x => x.key}
      describe={x => ({ label: x.label, code: x.key })} selected={focus.key} onSelect={select} addDisabled={readOnly || d.stages.length >= limits.stages}
      onAdd={readOnly ? undefined : () => { const key = unique('STAGE', d.stages.map(x => x.key), true); onChange({ ...d, stages: [...d.stages, { key, label: '', description: null }] }); select(key); }}>
      {item ? <>
        <div className={styles.fields}>
          <LifecycleKeyField label={t('lifecycle.field.stageKey')} value={item.key} format="key" disabled={readOnly}
            taken={d.stages.map(x => x.key).filter(k => k !== item.key)} onRename={to => rename('stages', item.key, to)} />
          <Input label={t('lifecycle.field.label')} value={item.label} disabled={readOnly} onChange={e => replace('stages', index, { ...item, label: e.target.value })} />
        </div>
        <Textarea label={t('lifecycle.field.description')} value={item.description ?? ''} disabled={readOnly}
          onChange={e => replace('stages', index, { ...item, description: e.target.value ? e.target.value : null })} />
        <LifecycleRemove references={lifecycleReferences(d, 'stages', item.key)} disabled={readOnly} onRemove={() => remove('stages', index)} />
      </> : <p className={styles.muted}>{t('lifecycle.selectItem')}</p>}
    </LifecycleItemSection>;
  }

  if (focus.section === 'events') {
    const index = d.events.findIndex(x => x.key === focus.key), item = d.events[index];
    const typeError = item && item.eventType && !lifecycleEventTypeValid(d.application, item.eventType) ? t('lifecycle.eventTypeFormat', { application: d.application }) : undefined;
    body = <LifecycleItemSection title={t('lifecycle.section.events')} help={t('lifecycle.help.events')} items={d.events} id={x => x.key}
      describe={x => ({ label: x.label, code: `${x.key} · ${x.eventType} v${x.schemaVersion}` })} selected={focus.key} onSelect={select}
      addDisabled={readOnly || d.events.length >= limits.events}
      onAdd={readOnly ? undefined : () => {
        const key = unique('EVENT', d.events.map(x => x.key), true);
        onChange({ ...d, events: [...d.events, { key, label: '', schemaVersion: 1, eventType: lifecycleEventTypeSuggestion(d.application, d.code, key) }] }); select(key);
      }}>
      {item ? <>
        <div className={styles.fields}>
          <LifecycleKeyField label={t('lifecycle.field.eventKey')} value={item.key} format="key" disabled={readOnly}
            taken={d.events.map(x => x.key).filter(k => k !== item.key)} onRename={to => rename('events', item.key, to)} />
          <Input label={t('lifecycle.field.label')} value={item.label} disabled={readOnly} onChange={e => replace('events', index, { ...item, label: e.target.value })} />
          <Input label={t('lifecycle.field.schemaVersion')} type="number" min={1} step={1} value={item.schemaVersion} disabled={readOnly}
            onChange={e => replace('events', index, { ...item, schemaVersion: Number.parseInt(e.target.value || '0', 10) })} />
        </div>
        <Input label={t('lifecycle.field.eventType')} value={item.eventType} disabled={readOnly} error={typeError} spellCheck={false}
          hint={t('lifecycle.eventTypeFormat', { application: d.application })} onChange={e => replace('events', index, { ...item, eventType: e.target.value.trim() })} />
        <p className={styles.muted}>{t('lifecycle.help.eventIdentity')}</p>
        <LifecycleRemove references={lifecycleReferences(d, 'events', item.key)} disabled={readOnly} onRemove={() => remove('events', index)} />
      </> : <p className={styles.muted}>{t('lifecycle.selectItem')}</p>}
    </LifecycleItemSection>;
  }

  if (focus.section === 'lifecycles') {
    const index = d.lifecycles.findIndex(x => x.key === focus.key), item = d.lifecycles[index];
    body = <LifecycleItemSection title={t('lifecycle.section.lifecycles')} help={t('lifecycle.help.lifecycles')} items={d.lifecycles} id={x => x.key}
      describe={x => ({ label: x.label, code: x.key })} selected={focus.key} onSelect={select} addDisabled={readOnly || d.lifecycles.length >= limits.lifecycles}
      onAdd={readOnly ? undefined : () => { const key = unique('lifecycle', d.lifecycles.map(x => x.key)); onChange({ ...d, lifecycles: [...d.lifecycles, { key, label: '', subjectTypes: [], stages: [], stageEvents: [] }] }); select(key); }}>
      {item ? <GraphEditor graph={item} definition={d} readOnly={readOnly}
        onRename={to => rename('lifecycles', item.key, to)} onChange={next => replace('lifecycles', index, next)} onRemove={() => remove('lifecycles', index)} />
        : <p className={styles.muted}>{t('lifecycle.selectItem')}</p>}
    </LifecycleItemSection>;
  }

  if (focus.section === 'bindings') {
    const index = d.bindings.findIndex(x => x.key === focus.key), item = d.bindings[index];
    const first = d.lifecycles[0];
    body = <LifecycleItemSection title={t('lifecycle.section.bindings')} help={t('lifecycle.help.bindings')} items={d.bindings} id={x => x.key}
      describe={x => ({ label: `${x.purpose} → ${t(`lifecycle.targetKind.${x.target.kind}`)} ${x.target.code} v${x.target.version}`, code: `${x.key} · ${x.lifecycle}/${x.stage}${x.event ? '/' + x.event : ''} · P${x.priority}` })}
      selected={focus.key} onSelect={select} addDisabled={readOnly || !first || !first.stages.length || d.bindings.length >= limits.bindings}
      onAdd={readOnly ? undefined : () => {
        const key = unique('binding', d.bindings.map(x => x.key));
        const binding: LifecycleBinding = { key, lifecycle: first.key, stage: first.stages[0], event: null, purpose: '', priority: 0,
          target: { kind: metadata.supportedTargetKinds[0] ?? metadata.targetKinds[0] ?? 'FORM', code: '', version: 1, handler: null, states: [] },
          applicability: { include: [], exclude: [] } };
        onChange({ ...d, bindings: [...d.bindings, binding] }); select(key);
      }}>
      {!first?.stages.length ? <p className={styles.muted}>{t('lifecycle.help.bindingsNeedStages')}</p> : null}
      {item ? <>
        <LifecycleBindingEditor binding={item} definition={d} metadata={metadata} disabled={readOnly}
          onChange={(next, renamedFrom) => { replace('bindings', index, next); if (renamedFrom) select(next.key); }} />
        <LifecycleRemove references={[]} disabled={readOnly} onRemove={() => remove('bindings', index)} />
      </> : <p className={styles.muted}>{t('lifecycle.selectItem')}</p>}
    </LifecycleItemSection>;
  }

  if (focus.section === 'json') body = <JsonEditor definition={d} readOnly={readOnly} onChange={onChange} />;

  return <div className={styles.section} data-lifecycle-editor data-readonly={readOnly}>
    {readOnly ? <p className={styles.status} role="note">{t('lifecycle.readOnly')}</p> : null}
    <Tabs value={focus.section} onChange={section => onFocus({ section: section as LifecycleEditorSection, key: null })}
      items={sections.map(id => ({ id, label: t(`lifecycle.section.${id}`), badge: counts[id] }))} />
    {body}
  </div>;
}

function GraphEditor({ graph, definition, readOnly, onRename, onChange, onRemove }: {
  graph: LifecycleGraph;
  definition: LifecycleReleaseDefinition;
  readOnly: boolean;
  onRename: (to: string) => void;
  onChange: (next: LifecycleGraph) => void;
  onRemove: () => void;
}) {
  const { t } = useLocalization();
  const toggleStage = (key: string, on: boolean) => onChange(on ? { ...graph, stages: [...graph.stages, key] }
    : { ...graph, stages: graph.stages.filter(s => s !== key), stageEvents: graph.stageEvents.filter(m => m.stage !== key) });
  const toggleEvent = (stage: string, event: string, on: boolean) => onChange({ ...graph,
    stageEvents: on ? [...graph.stageEvents, { stage, event }] : graph.stageEvents.filter(m => !(m.stage === stage && m.event === event)) });
  const move = (i: number, by: number) => { const stages = [...graph.stages]; [stages[i], stages[i + by]] = [stages[i + by], stages[i]]; onChange({ ...graph, stages }); };
  const bound = (stage: string, event: string) => definition.bindings.some(b => b.lifecycle === graph.key && b.stage === stage && b.event === event);
  return <>
    <div className={styles.fields}>
      <LifecycleKeyField label={t('lifecycle.field.lifecycleKey')} value={graph.key} format="code" disabled={readOnly}
        taken={definition.lifecycles.map(l => l.key).filter(k => k !== graph.key)} onRename={onRename} />
      <Input label={t('lifecycle.field.label')} value={graph.label} disabled={readOnly} onChange={e => onChange({ ...graph, label: e.target.value })} />
      <LifecycleListField label={t('lifecycle.field.subjectTypes')} value={graph.subjectTypes} disabled={readOnly} hint={t('lifecycle.field.subjectTypesHint')}
        onChange={subjectTypes => onChange({ ...graph, subjectTypes })} />
    </div>
    <div className={styles.fields} data-lifecycle-taxonomy>
      <LifecycleOptionalCodeField label={t('lifecycle.field.module')} hint={t('lifecycle.field.taxonomyHint')} value={graph.module} format="code"
        disabled={readOnly} onChange={module => onChange({ ...graph, module })} />
      <LifecycleOptionalCodeField label={t('lifecycle.field.domain')} hint={t('lifecycle.field.taxonomyHint')} value={graph.domain} format="code"
        disabled={readOnly} onChange={domain => onChange({ ...graph, domain })} />
    </div>
    <fieldset className={styles.matrix} data-lifecycle-stages>
      <legend>{t('lifecycle.field.stages')}</legend>
      <p className={styles.muted}>{t('lifecycle.help.graphStages')}</p>
      {definition.stages.map(stage => {
        const on = graph.stages.includes(stage.key), i = graph.stages.indexOf(stage.key);
        const used = definition.bindings.some(b => b.lifecycle === graph.key && b.stage === stage.key);
        return <div key={stage.key} className={styles.constraint}>
          <Checkbox label={`${stage.label || stage.key} (${stage.key})`} checked={on} disabled={readOnly || (on && used)} onChange={e => toggleStage(stage.key, e.target.checked)} />
          {on ? <div className={styles.actions}>
            <Button size="xs" variant="ghost" disabled={readOnly || i === 0} onClick={() => move(i, -1)} aria-label={t('lifecycle.moveUp', { key: stage.key })}>{t('lifecycle.up')}</Button>
            <Button size="xs" variant="ghost" disabled={readOnly || i === graph.stages.length - 1} onClick={() => move(i, 1)} aria-label={t('lifecycle.moveDown', { key: stage.key })}>{t('lifecycle.down')}</Button>
          </div> : null}
          {on ? <fieldset>
            <legend className={styles.status}>{t('lifecycle.field.stageEvents')}</legend>
            {definition.events.map(ev => { const mapped = graph.stageEvents.some(m => m.stage === stage.key && m.event === ev.key);
              return <Checkbox key={ev.key} label={`${ev.label || ev.key} (${ev.key})`} checked={mapped} disabled={readOnly || (mapped && bound(stage.key, ev.key))}
                onChange={e => toggleEvent(stage.key, ev.key, e.target.checked)} />; })}
            {!definition.events.length ? <p className={styles.muted}>{t('lifecycle.help.noEvents')}</p> : null}
          </fieldset> : null}
        </div>;
      })}
      {!definition.stages.length ? <p className={styles.muted}>{t('lifecycle.help.noStages')}</p> : null}
    </fieldset>
    <LifecycleRemove references={lifecycleReferences(definition, 'lifecycles', graph.key)} disabled={readOnly} onRemove={onRemove} />
  </>;
}

/** Advanced JSON: parsed with JSON.parse and the contract guard only; nothing is evaluated. */
function JsonEditor({ definition, readOnly, onChange }: { definition: LifecycleReleaseDefinition; readOnly: boolean; onChange: (next: LifecycleReleaseDefinition) => void }) {
  const { t } = useLocalization(), formatted = JSON.stringify(definition, null, 2);
  const [text, setText] = useState(formatted), [error, setError] = useState<string | null>(null);
  useEffect(() => { setText(formatted); setError(null); }, [formatted]);
  function apply() {
    try {
      const next = parseLifecycleReleaseDefinition(JSON.parse(text));
      if (next.application !== definition.application || next.code !== definition.code) { setError(t('lifecycle.json.identity')); return; }
      setError(null);
      if (canonicalLifecycleJson(next) !== canonicalLifecycleJson(definition)) onChange({ ...next, version: definition.version });
    } catch (e) {
      setError(e instanceof LifecycleContractError ? t('lifecycle.json.contract', { path: e.path }) : t('lifecycle.json.syntax'));
    }
  }
  return <Card className={`${styles.section} ${styles.json}`}>
    <p className={styles.muted}>{t('lifecycle.json.help')}</p>
    <Textarea label={t('lifecycle.section.json')} value={text} readOnly={readOnly} spellCheck={false} error={error ?? undefined}
      onChange={e => setText(e.target.value)} />
    {!readOnly ? <div className={styles.actions}>
      <Button variant="primary" disabled={text === formatted} onClick={apply}>{t('lifecycle.json.apply')}</Button>
      <Button disabled={text === formatted} onClick={() => { setText(formatted); setError(null); }}>{t('lifecycle.json.revert')}</Button>
    </div> : null}
  </Card>;
}
