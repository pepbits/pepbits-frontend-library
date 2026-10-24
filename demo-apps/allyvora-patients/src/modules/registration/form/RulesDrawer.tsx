'use client';
import React from 'react';
import {SECTIONS, describeFieldRule, isEmptyValue, isVisible, ruleFields, type FieldErrors, type FormValues, type Lookups, type SectionId, type SectionProgress} from '@allyvora/shared';
import {Drawer} from '@pepbits/components';
import {Button, cn} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import {Ban, CheckCircle2, Circle, XCircle} from '@pepbits/icons';
import {StatusGlyph, StatusPill} from './parts';

/** "Check form rules": every rule from the shared definition, what passes, what is missing, with jumps to fields. */
export function RulesDrawer({open, onClose, values, errors, lookups, progress, onJump, onRevealAll}: {
  open: boolean; onClose: () => void; values: FormValues; errors: FieldErrors; lookups: Lookups;
  progress: Record<SectionId, SectionProgress>; onJump: (section: SectionId, fieldId: string) => void; onRevealAll: () => void;
}) {
  const {t} = useLocalization();
  const problems = Object.keys(errors).length;
  return <Drawer open={open} onClose={onClose} title="Form rules" width="md"
    subtitle={problems ? t(problems === 1 ? '{count} field needs attention before you can save.' : '{count} fields need attention before you can save.', {count: problems}) : t('Every rule passes. This patient is ready to save.')}
    footer={<>
      <Button variant="ghost" onClick={onClose}>{t('Close')}</Button>
      {problems > 0 ? <Button variant="primary" onClick={() => {onRevealAll(); onClose();}}>{t('Highlight problems in the form')}</Button> : null}
    </>}>
    <div className="divide-y divide-[var(--border)]" data-rules-drawer="">
      {SECTIONS.map(section => {
        const fields = ruleFields(section.id);
        return <section key={section.id} className="px-5 py-4" aria-labelledby={`rule-${section.id}`}>
          <div className="mb-2 flex items-center gap-2.5">
            <StatusGlyph index={section.index} progress={progress[section.id]} size="sm"/>
            <h3 id={`rule-${section.id}`} className="flex-1 text-[length:calc(12.5px*var(--fs-scale))] font-bold text-[var(--text)]">{t(section.title)}</h3>
            <StatusPill progress={progress[section.id]}/>
          </div>
          {fields.length === 0 ? <p className="ps-[34px] text-[length:calc(11.5px*var(--fs-scale))] text-[var(--text-muted)]">{t('Every field here is optional.')}</p> : <ul className="space-y-0.5 ps-6">
            {fields.map(field => {
              const visible = isVisible(field, values), error = errors[field.id];
              const filled = field.type === 'switch' ? values[field.id] === true : !isEmptyValue(values[field.id]);
              const Icon = !visible ? Ban : error ? XCircle : filled ? CheckCircle2 : Circle;
              const rule = describeFieldRule(field, lookups), shown = rule.split(', shown when ')[1];
              return <li key={field.id}>
                <button type="button" disabled={!visible} onClick={() => {onJump(section.id, field.id); onClose();}}
                  className="focus-ring flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-start enabled:hover:bg-[var(--surface-2)] disabled:cursor-default" data-rule={field.id}>
                  <Icon className={cn('mt-0.5 size-4 shrink-0', !visible ? 'text-[var(--text-subtle)]' : error ? 'text-[var(--danger-ink)]' : filled ? 'text-[var(--success-ink)]' : 'text-[var(--text-muted)]')} aria-hidden="true"/>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-[length:calc(12px*var(--fs-scale))]', visible ? 'text-[var(--text)]' : 'text-[var(--text-muted)]')}>{t(field.label)}</span>
                    <span className="block text-[length:calc(10.5px*var(--fs-scale))] text-[var(--text-muted)]">{visible ? rule : t('Not needed now: {reason}', {reason: shown ? 'shown when ' + shown : t('hidden')})}</span>
                    {error && visible ? <span className="mt-0.5 block text-[length:calc(10.5px*var(--fs-scale))] font-semibold text-[var(--danger-ink)]">{t(error)}</span> : null}
                  </span>
                </button>
              </li>;
            })}
          </ul>}
        </section>;
      })}
    </div>
  </Drawer>;
}
