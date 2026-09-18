'use client';
import React, { useState } from 'react';
import {
  Badge, Button, Card, DateInput, EmptyState, Input, Segmented, Select, Table, TableBody, TableCell, TableContainer, TableHead,
  TableHeader, TableRow, Textarea, useLocalization, type BadgeTone,
} from '@pepbits/ops-ui';
import {
  lifecycleIssueTarget, lifecycleMappedEvents, shortLifecycleChecksum,
  type LifecycleAttributeValue, type LifecycleIssue, type LifecycleOutcome, type LifecycleReleaseDefinition,
  type LifecycleResolveContext, type LifecycleResolveResult, type LifecycleTarget, type LifecycleValidationReport,
} from '@pepbits/erp-config/lifecycle';
import type { LifecycleEditorFocus, LifecycleEditorSection } from './editor';
import styles from './lifecycle.module.css';

const outcomeTone = (o: LifecycleOutcome): BadgeTone => (o === 'MATCH' ? 'success' : o === 'UNKNOWN' ? 'warning' : 'neutral');
function Outcome({ value }: { value: LifecycleOutcome }) {
  const { t } = useLocalization();
  return <Badge tone={outcomeTone(value)}>{t(`lifecycle.outcome.${value}`)}</Badge>;
}

/** Server validation issues. Nothing is scored or summarised beyond what the report contains. */
export function LifecycleValidationPanel({ report, source, definition, busy, canValidateStored, onValidate, onValidateStored, onFocus }: {
  report: LifecycleValidationReport | null;
  source: 'editor' | 'stored' | 'save' | null;
  definition: LifecycleReleaseDefinition;
  busy: boolean;
  canValidateStored: boolean;
  onValidate: () => void;
  onValidateStored: () => void;
  onFocus: (focus: LifecycleEditorFocus) => void;
}) {
  const { t } = useLocalization();
  const go = (issue: LifecycleIssue) => { const target = lifecycleIssueTarget(definition, issue.path); onFocus({ section: target.section as LifecycleEditorSection, key: target.key }); };
  return <Card className={styles.section} data-lifecycle-validation>
    <p className={styles.muted}>{t('lifecycle.validation.help')}</p>
    <div className={styles.actions}>
      <Button variant="primary" disabled={busy} onClick={onValidate}>{t('lifecycle.validation.editor')}</Button>
      {canValidateStored ? <Button disabled={busy} onClick={onValidateStored}>{t('lifecycle.validation.stored')}</Button> : null}
    </div>
    {report ? <>
      <div className={styles.actions} role="status">
        <span className={styles.status}>{t(`lifecycle.validation.source.${source ?? 'editor'}`)}</span>
        <Badge tone={report.valid ? 'success' : 'danger'}>{t(report.valid ? 'lifecycle.validation.valid' : 'lifecycle.validation.invalid')}</Badge>
        <Badge tone={report.activatable ? 'success' : 'warning'}>{t(report.activatable ? 'lifecycle.validation.activatable' : 'lifecycle.validation.notActivatable')}</Badge>
        {report.checksum ? <code className={styles.code} title={report.checksum}>{shortLifecycleChecksum(report.checksum)}</code> : null}
      </div>
      {report.issues.length ? <TableContainer><Table>
        <TableHeader><TableRow>{['severity', 'code', 'path', 'message', 'go'].map(k => <TableHead key={k}>{t(`lifecycle.validation.column.${k}`)}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{report.issues.map((issue, i) => <TableRow key={`${issue.path}:${issue.code}:${i}`}>
          <TableCell><Badge tone={issue.severity === 'ERROR' ? 'danger' : 'warning'}>{t(`lifecycle.severity.${issue.severity}`)}</Badge></TableCell>
          <TableCell><code className={styles.code}>{issue.code}</code></TableCell>
          <TableCell><code className={styles.code}>{issue.path}</code></TableCell>
          <TableCell>{issue.message}</TableCell>
          <TableCell><Button size="sm" variant="ghost" onClick={() => go(issue)}>{t('lifecycle.validation.show')}</Button></TableCell>
        </TableRow>)}</TableBody>
      </Table></TableContainer> : <p className={styles.muted}>{t('lifecycle.validation.noIssues')}</p>}
    </> : <p className={styles.muted}>{t('lifecycle.validation.notRun')}</p>}
  </Card>;
}

const targetText = (target: LifecycleTarget | null, t: (key: string, values?: Record<string, string | number>) => string) =>
  target ? `${t(`lifecycle.targetKind.${target.kind}`)} ${target.code} v${target.version}${target.handler ? ` · ${target.handler}` : ''}${target.states.length ? ` · ${target.states.join(', ')}` : ''}` : '—';

/**
 * Host limits on preview input. `selector` mode accepts one organisation unit whose ancestry the
 * server derives from verified data; `path` mode (default) accepts a self-first path for hosts that
 * verify it. `allowSubjectId:false` hides the subject reference and always sends null.
 */
export interface LifecyclePreviewPolicy {
  allowSubjectId?: boolean;
  organisationMode?: 'path' | 'selector';
  /** Selector unit types offered to the user, e.g. branch, business unit, legal entity. Free text when omitted. */
  organisationTypes?: { value: string; label: string }[];
}
interface PreviewForm {
  versionMode: 'active' | 'this';
  lifecycle: string;
  stage: string;
  event: string;
  purpose: string;
  subjectType: string;
  subjectId: string;
  organisation: string;
  unitType: string;
  unitId: string;
  attributes: Record<string, string>;
}
const DECIMAL = /^-?\d+(\.\d+)?$/, DATE = /^\d{4}-\d{2}-\d{2}$/;
const parts = (raw: string) => raw.split(',').map(v => v.trim()).filter(Boolean);
/** Typed-input errors (message keys) per dimension. Invalid values block the preview instead of being coerced. */
export function lifecyclePreviewErrors(definition: LifecycleReleaseDefinition, attributes: Record<string, string>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const d of definition.dimensions) {
    const values = parts(attributes[d.code] ?? '');
    const ok = d.type === 'NUMBER' ? values.every(v => DECIMAL.test(v)) : d.type === 'BOOLEAN' ? values.every(v => v === 'true' || v === 'false')
      : d.type === 'DATE' ? values.every(v => DATE.test(v)) : true;
    if (!ok) errors[d.code] = `lifecycle.preview.invalid.${d.type}`;
  }
  return errors;
}
/**
 * Converts validated dimension inputs. Empty values are omitted so the server reports them as missing (UNKNOWN).
 * Call `lifecyclePreviewErrors` first; this function does not coerce invalid text.
 */
export function lifecyclePreviewContext(definition: LifecycleReleaseDefinition, form: Pick<PreviewForm, 'subjectType' | 'subjectId' | 'organisation' | 'attributes'> & Partial<Pick<PreviewForm, 'unitType' | 'unitId'>>, policy: LifecyclePreviewPolicy = {}): LifecycleResolveContext {
  const attributes: Record<string, LifecycleAttributeValue> = {};
  for (const dimension of definition.dimensions) {
    const values = parts(form.attributes[dimension.code] ?? '');
    if (!values.length) continue;
    const typed = values.map(v => (dimension.type === 'NUMBER' ? Number(v) : dimension.type === 'BOOLEAN' ? v === 'true' : v));
    attributes[dimension.code] = typed.length === 1 ? typed[0] : typed;
  }
  const organisation = policy.organisationMode === 'selector'
    ? (form.unitType?.trim() && form.unitId?.trim() ? [{ type: form.unitType.trim(), id: form.unitId.trim() }] : [])
    : form.organisation.split('\n').map(line => line.trim()).filter(Boolean).map(line => {
      const at = line.indexOf(':');
      return at > 0 ? { type: line.slice(0, at).trim(), id: line.slice(at + 1).trim() } : { type: line, id: '' };
    });
  const subjectId = policy.allowSubjectId === false ? null : form.subjectId.trim() || null;
  return { subjectType: form.subjectType.trim() || null, subjectId, organisation, attributes };
}

/** Read-only resolution preview against the server. It never executes a handler or writes. */
export function LifecycleResolvePreview({ definition, storedVersion, active, busy, result, onResolve, policy = {} }: {
  policy?: LifecyclePreviewPolicy;
  definition: LifecycleReleaseDefinition;
  /** Stored version number for explicit preview; null for an unsaved new definition. */
  storedVersion: number | null;
  active: boolean;
  busy: boolean;
  result: LifecycleResolveResult | null;
  onResolve: (request: { version: number | null; lifecycle: string; stage: string; event: string | null; purpose: string | null; context: LifecycleResolveContext }) => void;
}) {
  const { t } = useLocalization();
  const first = definition.lifecycles[0];
  const [form, setForm] = useState<PreviewForm>({
    versionMode: storedVersion === null || !active ? 'this' : 'active', lifecycle: first?.key ?? '', stage: first?.stages[0] ?? '', event: '', purpose: '',
    subjectType: first?.subjectTypes[0] ?? '', subjectId: '', organisation: '', unitType: policy.organisationTypes?.[0]?.value ?? '', unitId: '', attributes: {},
  });
  const errors = lifecyclePreviewErrors(definition, form.attributes), selector = policy.organisationMode === 'selector';
  const unitIncomplete = selector && !!form.unitType.trim() !== !!form.unitId.trim();
  const lifecycle = definition.lifecycles.find(l => l.key === form.lifecycle);
  const purposes = [...new Set(definition.bindings.filter(b => b.lifecycle === form.lifecycle && b.stage === form.stage).map(b => b.purpose))];
  const set = (patch: Partial<PreviewForm>) => setForm(f => ({ ...f, ...patch }));
  if (storedVersion === null) return <Card className={styles.section}><p className={styles.muted}>{t('lifecycle.preview.saveFirst')}</p></Card>;
  return <div className={styles.main} data-lifecycle-preview>
    <Card className={styles.section}>
      <p className={styles.muted}>{t('lifecycle.preview.help')}</p>
      <Segmented label={t('lifecycle.preview.versionMode')} value={form.versionMode} onChange={v => set({ versionMode: v as PreviewForm['versionMode'] })}
        options={[{ value: 'this', label: t('lifecycle.preview.thisVersion', { version: storedVersion }) }, ...(active ? [{ value: 'active', label: t('lifecycle.preview.activeVersion') }] : [])]} />
      <div className={styles.fields}>
        <Select label={t('lifecycle.field.lifecycle')} value={form.lifecycle} placeholder=""
          options={definition.lifecycles.map(l => ({ value: l.key, label: `${l.label} (${l.key})` }))}
          onChange={e => { const l = definition.lifecycles.find(x => x.key === e.target.value); set({ lifecycle: e.target.value, stage: l?.stages[0] ?? '', event: '', purpose: '' }); }} />
        <Select label={t('lifecycle.field.stage')} value={form.stage} placeholder=""
          options={(lifecycle?.stages ?? []).map(k => ({ value: k, label: `${definition.stages.find(s => s.key === k)?.label ?? k} (${k})` }))}
          onChange={e => set({ stage: e.target.value, event: '', purpose: '' })} />
        <Select label={t('lifecycle.field.event')} value={form.event} placeholder={t('lifecycle.field.stageLevel')}
          options={lifecycleMappedEvents(definition, form.lifecycle, form.stage).map(k => ({ value: k, label: k }))} onChange={e => set({ event: e.target.value })} />
        <Select label={t('lifecycle.field.purpose')} value={form.purpose} placeholder={t('lifecycle.preview.allPurposes')}
          options={purposes.map(p => ({ value: p, label: p }))} onChange={e => set({ purpose: e.target.value })} />
      </div>
      <fieldset className={styles.fields}>
        <legend>{t('lifecycle.preview.context')}</legend>
        <Input label={t('lifecycle.preview.subjectType')} value={form.subjectType} onChange={e => set({ subjectType: e.target.value })} />
        {policy.allowSubjectId === false ? null
          : <Input label={t('lifecycle.preview.subjectId')} value={form.subjectId} hint={t('lifecycle.preview.subjectIdHint')} onChange={e => set({ subjectId: e.target.value })} />}
        {selector ? <>
          {policy.organisationTypes?.length
            ? <Select label={t('lifecycle.preview.unitType')} value={form.unitType} placeholder={t('lifecycle.preview.notProvided')}
              options={policy.organisationTypes} onChange={e => set({ unitType: e.target.value })} />
            : <Input label={t('lifecycle.preview.unitType')} value={form.unitType} spellCheck={false} onChange={e => set({ unitType: e.target.value })} />}
          <Input label={t('lifecycle.preview.unitId')} value={form.unitId} spellCheck={false} hint={t('lifecycle.preview.selectorHint')}
            error={unitIncomplete ? t('lifecycle.preview.unitIncomplete') : undefined} onChange={e => set({ unitId: e.target.value })} />
        </> : <Textarea label={t('lifecycle.preview.organisation')} value={form.organisation} hint={t('lifecycle.preview.organisationHint')} rows={3}
          onChange={e => set({ organisation: e.target.value })} />}
        {definition.dimensions.map(d => {
          const common = { label: `${d.label || d.code} (${d.code})`, value: form.attributes[d.code] ?? '',
            error: errors[d.code] ? t(errors[d.code]) : undefined,
            onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => set({ attributes: { ...form.attributes, [d.code]: e.target.value } }) };
          return d.type === 'BOOLEAN' ? <Select key={d.code} {...common} placeholder={t('lifecycle.preview.notProvided')} options={[{ value: 'true', label: t('lifecycle.preview.true') }, { value: 'false', label: t('lifecycle.preview.false') }]} />
            : d.type === 'DATE' ? <DateInput key={d.code} {...common} />
              : <Input key={d.code} {...common} inputMode={d.type === 'NUMBER' ? 'decimal' : undefined} hint={t('lifecycle.preview.listHint')} />;
        })}
      </fieldset>
      <p className={styles.muted}>{t('lifecycle.preview.missingHint')}</p>
      <div className={styles.actions}>
        <Button variant="primary" disabled={busy || !form.lifecycle || !form.stage || Object.keys(errors).length > 0 || unitIncomplete}
          onClick={() => onResolve({ version: form.versionMode === 'active' ? null : storedVersion, lifecycle: form.lifecycle, stage: form.stage,
            event: form.event || null, purpose: form.purpose || null, context: lifecyclePreviewContext(definition, form, policy) })}>
          {t('lifecycle.preview.run')}
        </Button>
      </div>
    </Card>
    {result ? <Card className={styles.section} role="region" aria-label={t('lifecycle.preview.result')}>
      <p className={styles.status}>{t(result.activationRevision ? 'lifecycle.preview.resultActive' : 'lifecycle.preview.resultExplicit',
        { version: result.version, revision: result.activationRevision, checksum: shortLifecycleChecksum(result.checksum) })}</p>
      {!result.slots.length ? <EmptyState title={t('lifecycle.preview.noSlots')} description={t('lifecycle.preview.noSlotsHelp')} /> :
        <TableContainer><Table>
          <TableHeader><TableRow>{['purpose', 'event', 'outcome', 'binding', 'target', 'missing', 'candidates'].map(k => <TableHead key={k}>{t(`lifecycle.preview.column.${k}`)}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{result.slots.map((slot, i) => <TableRow key={`${slot.purpose}:${slot.event ?? ''}:${i}`}>
            <TableCell>{slot.purpose}</TableCell>
            <TableCell>{slot.event ?? t('lifecycle.field.stageLevel')}</TableCell>
            <TableCell><Outcome value={slot.outcome} /></TableCell>
            <TableCell>{slot.bindingKey ?? '—'}</TableCell>
            <TableCell>{targetText(slot.target, t)}</TableCell>
            <TableCell>{slot.missing.join(', ') || '—'}</TableCell>
            <TableCell><ul className={styles.reasons}>{slot.candidates.map(c => <li key={c.bindingKey}>
              <strong>{c.bindingKey}</strong> · {t('lifecycle.preview.priority', { priority: c.priority })} · <Outcome value={c.outcome} />
              {c.reasons.length ? <> · <code className={styles.code}>{c.reasons.join('; ')}</code></> : null}
              {c.missing.length ? <> · {t('lifecycle.preview.missing', { values: c.missing.join(', ') })}</> : null}
            </li>)}</ul></TableCell>
          </TableRow>)}</TableBody>
        </Table></TableContainer>}
    </Card> : null}
  </div>;
}
