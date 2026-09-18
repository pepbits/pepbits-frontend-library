'use client';
import React from 'react';
import { Badge, Button, DateInput, Input, Select, useLocalization } from '@pepbits/ops-ui';
import {
  LIFECYCLE_RESERVED_DIMENSIONS, emptyLifecycleConstraint, lifecycleKeyValid, lifecycleMappedEvents, lifecycleOperatorsFor,
  type LifecycleApplicability, type LifecycleBinding, type LifecycleConstraint, type LifecycleMetadata, type LifecycleOperator,
  type LifecycleReleaseDefinition, type LifecycleTargetKind,
} from '@pepbits/erp-config/lifecycle';
import { LifecycleKeyField, LifecycleListField } from './fields';
import styles from './lifecycle.module.css';

function ConstraintEditor({ constraint, definition, disabled, taken, limits, onChange, onRemove }: {
  constraint: LifecycleConstraint;
  definition: LifecycleReleaseDefinition;
  disabled: boolean;
  taken: string[];
  limits: LifecycleMetadata['limits'];
  onChange: (next: LifecycleConstraint) => void;
  onRemove: () => void;
}) {
  const { t } = useLocalization();
  const dimension = definition.dimensions.find(d => d.code === constraint.dimension);
  const operators = lifecycleOperatorsFor(constraint.dimension, dimension?.type ?? null);
  const options = [
    ...LIFECYCLE_RESERVED_DIMENSIONS.map(code => ({ value: code, label: t(`lifecycle.reserved.${code}`) })),
    ...definition.dimensions.map(d => ({ value: d.code, label: `${d.label} (${d.code})` })),
  ].filter(o => o.value === constraint.dimension || !taken.includes(o.value));
  const bound = (key: 'min' | 'max') => {
    const props = { label: t(`lifecycle.constraint.${key}`), value: constraint[key] ?? '', disabled,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...constraint, [key]: e.target.value.trim() || null }) };
    return dimension?.type === 'DATE' ? <DateInput {...props} /> : <Input {...props} inputMode="decimal" />;
  };
  return <div className={styles.constraint} data-lifecycle-constraint>
    <Select label={t('lifecycle.constraint.dimension')} value={constraint.dimension} disabled={disabled} options={options}
      onChange={e => onChange(emptyLifecycleConstraint(e.target.value, lifecycleOperatorsFor(e.target.value, definition.dimensions.find(d => d.code === e.target.value)?.type ?? null)[0]))} />
    <Select label={t('lifecycle.constraint.operator')} value={constraint.operator} disabled={disabled} placeholder=""
      options={operators.map(o => ({ value: o, label: t(`lifecycle.operator.${o}`) }))}
      onChange={e => onChange({ ...emptyLifecycleConstraint(constraint.dimension, e.target.value as LifecycleOperator) })} />
    {constraint.operator === 'RANGE' ? <>{bound('min')}{bound('max')}</> :
      <LifecycleListField label={t('lifecycle.constraint.values')} value={constraint.values} disabled={disabled}
        hint={t(constraint.dimension === 'organisation' ? 'lifecycle.constraint.organisationHint' : `lifecycle.constraint.valueHint.${dimension?.type ?? 'STRING'}`, { max: limits.values })}
        onChange={values => onChange({ ...constraint, values })} />}
    <Button size="sm" variant="ghost" disabled={disabled} onClick={onRemove}>{t('lifecycle.constraint.remove')}</Button>
  </div>;
}

function ConstraintList({ kind, applicability, definition, disabled, limits, onChange }: {
  kind: 'include' | 'exclude';
  applicability: LifecycleApplicability;
  definition: LifecycleReleaseDefinition;
  disabled: boolean;
  limits: LifecycleMetadata['limits'];
  onChange: (next: LifecycleConstraint[]) => void;
}) {
  const { t } = useLocalization(), list = applicability[kind], taken = list.map(c => c.dimension);
  const free = [...LIFECYCLE_RESERVED_DIMENSIONS, ...definition.dimensions.map(d => d.code)].find(code => !taken.includes(code));
  return <fieldset className={styles.matrix}>
    <legend>{t(`lifecycle.applicability.${kind}`)}</legend>
    <p className={styles.muted}>{t(`lifecycle.applicability.${kind}Help`)}</p>
    {list.map((c, i) => <ConstraintEditor key={`${c.dimension}:${i}`} constraint={c} definition={definition} disabled={disabled} limits={limits}
      taken={taken.filter((_, j) => j !== i)}
      onChange={next => onChange(list.map((x, j) => (j === i ? next : x)))} onRemove={() => onChange(list.filter((_, j) => j !== i))} />)}
    <div className={styles.actions}>
      <Button size="sm" disabled={disabled || !free || list.length >= limits.constraints}
        onClick={() => free && onChange([...list, emptyLifecycleConstraint(free, lifecycleOperatorsFor(free, definition.dimensions.find(d => d.code === free)?.type ?? null)[0])])}>
        {t('lifecycle.constraint.add')}
      </Button>
    </div>
  </fieldset>;
}

/** Binding inspector: exact lifecycle/stage/event slot, immutable target reference and typed applicability. */
export function LifecycleBindingEditor({ binding, definition, metadata, disabled, onChange }: {
  binding: LifecycleBinding;
  definition: LifecycleReleaseDefinition;
  metadata: LifecycleMetadata;
  disabled: boolean;
  onChange: (next: LifecycleBinding, renamedFrom?: string) => void;
}) {
  const { t } = useLocalization();
  const lifecycle = definition.lifecycles.find(l => l.key === binding.lifecycle);
  const events = lifecycleMappedEvents(definition, binding.lifecycle, binding.stage);
  const supported = metadata.supportedTargetKinds.includes(binding.target.kind);
  const set = (patch: Partial<LifecycleBinding>) => onChange({ ...binding, ...patch });
  const setTarget = (patch: Partial<LifecycleBinding['target']>) => set({ target: { ...binding.target, ...patch } });
  const targetError = (value: string) => (value && !lifecycleKeyValid('target', value) ? t('lifecycle.keyFormat.target') : undefined);
  return <div className={styles.section} data-lifecycle-binding={binding.key}>
    <div className={styles.fields}>
      <LifecycleKeyField label={t('lifecycle.field.bindingKey')} value={binding.key} format="code" disabled={disabled}
        taken={definition.bindings.map(b => b.key).filter(k => k !== binding.key)} onRename={key => onChange({ ...binding, key }, binding.key)} />
      <Input label={t('lifecycle.field.purpose')} value={binding.purpose} disabled={disabled} hint={t('lifecycle.field.purposeHint')}
        error={binding.purpose && !lifecycleKeyValid('code', binding.purpose) ? t('lifecycle.keyFormat.code') : undefined}
        onChange={e => set({ purpose: e.target.value.trim() })} />
      <Input label={t('lifecycle.field.priority')} type="number" min={0} max={1000} step={1} value={binding.priority} disabled={disabled}
        hint={t('lifecycle.field.priorityHint')} onChange={e => set({ priority: Number.parseInt(e.target.value || '0', 10) })} />
    </div>
    <div className={styles.fields}>
      <Select label={t('lifecycle.field.lifecycle')} value={binding.lifecycle} disabled={disabled}
        options={definition.lifecycles.map(l => ({ value: l.key, label: `${l.label} (${l.key})` }))}
        onChange={e => { const next = definition.lifecycles.find(l => l.key === e.target.value); set({ lifecycle: e.target.value, stage: next?.stages[0] ?? '', event: null }); }} />
      <Select label={t('lifecycle.field.stage')} value={binding.stage} disabled={disabled || !lifecycle}
        options={(lifecycle?.stages ?? []).map(k => ({ value: k, label: `${definition.stages.find(s => s.key === k)?.label ?? k} (${k})` }))}
        onChange={e => set({ stage: e.target.value, event: null })} />
      <Select label={t('lifecycle.field.event')} value={binding.event ?? ''} disabled={disabled} placeholder={t('lifecycle.field.stageLevel')}
        hint={t('lifecycle.field.eventHint')}
        options={events.map(k => ({ value: k, label: `${definition.events.find(ev => ev.key === k)?.label ?? k} (${k})` }))}
        onChange={e => set({ event: e.target.value || null })} />
    </div>
    <fieldset className={styles.fields}>
      <legend>{t('lifecycle.target')}</legend>
      <Select label={t('lifecycle.field.targetKind')} value={binding.target.kind} disabled={disabled} placeholder=""
        options={metadata.targetKinds.map(k => ({ value: k, label: t(`lifecycle.targetKind.${k}`) }))}
        onChange={e => setTarget({ kind: e.target.value as LifecycleTargetKind, states: e.target.value === 'WORKFLOW' ? binding.target.states : [] })} />
      <Input label={t('lifecycle.field.targetCode')} value={binding.target.code} disabled={disabled} error={targetError(binding.target.code)}
        spellCheck={false} onChange={e => setTarget({ code: e.target.value.trim() })} />
      <Input label={t('lifecycle.field.targetVersion')} type="number" min={1} step={1} value={binding.target.version} disabled={disabled}
        hint={t('lifecycle.field.targetVersionHint')} onChange={e => setTarget({ version: Number.parseInt(e.target.value || '0', 10) })} />
      <Input label={t('lifecycle.field.handler')} value={binding.target.handler ?? ''} disabled={disabled} error={targetError(binding.target.handler ?? '')}
        hint={t('lifecycle.field.handlerHint')} spellCheck={false} onChange={e => setTarget({ handler: e.target.value.trim() || null })} />
      {binding.target.kind === 'WORKFLOW' ? <LifecycleListField label={t('lifecycle.field.states')} value={binding.target.states} disabled={disabled}
        hint={t('lifecycle.field.statesHint')} onChange={states => setTarget({ states })} /> : null}
    </fieldset>
    {!supported ? <p role="note" className={styles.status}><Badge tone="warning">{t('lifecycle.capability.unsupported')}</Badge> {t('lifecycle.capability.unsupportedHelp')}</p> : null}
    <LifecycleApplicabilityEditor applicability={binding.applicability} definition={definition} disabled={disabled} limits={metadata.limits}
      onChange={applicability => set({ applicability })} />
  </div>;
}

/** Typed include/exclude conditions shared by bindings and source mappings (same contract rules). */
export function LifecycleApplicabilityEditor({ applicability, definition, disabled, limits, onChange }: {
  applicability: LifecycleApplicability;
  definition: LifecycleReleaseDefinition;
  disabled: boolean;
  limits: LifecycleMetadata['limits'];
  onChange: (next: LifecycleApplicability) => void;
}) {
  return <>
    <ConstraintList kind="include" applicability={applicability} definition={definition} disabled={disabled} limits={limits}
      onChange={include => onChange({ ...applicability, include })} />
    <ConstraintList kind="exclude" applicability={applicability} definition={definition} disabled={disabled} limits={limits}
      onChange={exclude => onChange({ ...applicability, exclude })} />
  </>;
}
