'use client';
import React from 'react';

import {Drawer} from '@pepbits/components';
import {Button, cn} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import {Ban, CheckCircle2, Circle, XCircle} from '@pepbits/icons';
import {StatusGlyph, StatusPill} from './status';

export interface FormRule {id: string; label: string; description: string; visible: boolean; filled: boolean; error?: string}
export interface FormRuleSection {id: string; title: string; progress: import('./status').RecordSectionProgress; rules: FormRule[]}
export interface FormRulesDrawerProps {
 open: boolean; onClose: () => void; sections: FormRuleSection[];
 onJump: (section: string, fieldId: string) => void; onRevealAll: () => void;
 title?: string; readyMessage?: string;
}
export function FormRulesDrawer({open, onClose, sections, onJump, onRevealAll, title='Form rules', readyMessage='Every rule passes. This record is ready to save.'}: FormRulesDrawerProps) {
 const {t}=useLocalization(); const uid=React.useId();
 const problems=sections.flatMap(section=>section.rules).filter(rule=>rule.visible && rule.error).length;
  return <Drawer open={open} onClose={onClose} title={title} width="md"
    subtitle={problems ? t(problems === 1 ? '{count} field needs attention before you can save.' : '{count} fields need attention before you can save.', {count: problems}) : t(readyMessage)}
    footer={<>
      <Button variant="ghost" onClick={onClose}>{t('Close')}</Button>
      {problems > 0 ? <Button variant="primary" onClick={() => {onRevealAll(); onClose();}}>{t('Highlight problems in the form')}</Button> : null}
    </>}>
    <div className="divide-y divide-[var(--border)]" data-rules-drawer="">
      {sections.map((section, index) => {
        const fields = section.rules;
        return <section key={section.id} className="px-5 py-4" aria-labelledby={`${uid}-rule-${section.id}`}>
          <div className="mb-2 flex items-center gap-2.5">
            <StatusGlyph index={index+1} progress={section.progress} size="sm"/>
            <h3 id={`${uid}-rule-${section.id}`} className="flex-1 text-[length:calc(12.5px*var(--fs-scale))] font-bold text-[var(--text)]">{t(section.title)}</h3>
            <StatusPill progress={section.progress}/>
          </div>
          {fields.length === 0 ? <p className="ps-[34px] text-[length:calc(11.5px*var(--fs-scale))] text-[var(--text-muted)]">{t('Every field here is optional.')}</p> : <ul className="space-y-0.5 ps-6">
            {fields.map(field => {
              const {visible, filled, error, description: rule} = field;
              const Icon = !visible ? Ban : error ? XCircle : filled ? CheckCircle2 : Circle;
              return <li key={field.id}>
                <button type="button" disabled={!visible} onClick={() => {onJump(section.id, field.id); onClose();}}
                  className="focus-ring flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-start enabled:hover:bg-[var(--surface-2)] disabled:cursor-default" data-rule={field.id}>
                  <Icon className={cn('mt-0.5 size-4 shrink-0', !visible ? 'text-[var(--text-subtle)]' : error ? 'text-[var(--danger-ink)]' : filled ? 'text-[var(--success-ink)]' : 'text-[var(--text-muted)]')} aria-hidden="true"/>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-[length:calc(12px*var(--fs-scale))]', visible ? 'text-[var(--text)]' : 'text-[var(--text-muted)]')}>{t(field.label)}</span>
                    <span className="block text-[length:calc(10.5px*var(--fs-scale))] text-[var(--text-muted)]">{t(rule)}</span>
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
