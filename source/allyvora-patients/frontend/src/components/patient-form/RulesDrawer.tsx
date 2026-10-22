'use client';

import { CheckCircle2, CircleDashed, CircleSlash, XCircle } from 'lucide-react';
import {
  SECTIONS,
  describeFieldRule,
  isEmptyValue,
  isVisible,
  ruleFields,
  type FieldErrors,
  type FormValues,
  type Lookups,
  type SectionId,
  type SectionProgress,
} from '@allyvora/shared';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { StatusGlyph, StatusPill } from './parts';

export function RulesDrawer({
  open,
  onClose,
  values,
  errors,
  lookups,
  progress,
  onJump,
  onRevealAll,
}: {
  open: boolean;
  onClose: () => void;
  values: FormValues;
  errors: FieldErrors;
  lookups: Lookups;
  progress: Record<SectionId, SectionProgress>;
  onJump: (s: SectionId, fieldId: string) => void;
  onRevealAll: () => void;
}) {
  const problems = Object.keys(errors).length;
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Form rules"
      description={
        problems ? (
          <span className="text-danger">
            {problems} {problems === 1 ? 'field needs' : 'fields need'} attention before you can save.
          </span>
        ) : (
          <span className="text-ok">Every rule passes. This patient is ready to save.</span>
        )
      }
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          {problems > 0 && (
            <Button
              variant="primary"
              onClick={() => {
                onRevealAll();
                onClose();
              }}
            >
              Highlight problems in the form
            </Button>
          )}
        </div>
      }
    >
      <div className="divide-y divide-line">
        {SECTIONS.map((s) => {
          const fields = ruleFields(s.id);
          return (
            <section key={s.id} className="px-5 py-4" aria-labelledby={`rule-${s.id}`}>
              <div className="mb-2 flex items-center gap-2.5">
                <StatusGlyph index={s.index} progress={progress[s.id]} size="sm" />
                <h3 id={`rule-${s.id}`} className="flex-1 font-semibold text-ink">
                  {s.title}
                </h3>
                <StatusPill progress={progress[s.id]} />
              </div>
              {fields.length === 0 ? (
                <p className="pl-[34px] text-[13px] text-ink-3">Every field here is optional.</p>
              ) : (
                <ul className="space-y-0.5 pl-6">
                  {fields.map((f) => {
                    const visible = isVisible(f, values);
                    const err = errors[f.id];
                    const filled = f.type === 'switch' ? values[f.id] === true : !isEmptyValue(values[f.id]);
                    const Icon = !visible ? CircleSlash : err ? XCircle : filled ? CheckCircle2 : CircleDashed;
                    return (
                      <li key={f.id}>
                        <button
                          type="button"
                          disabled={!visible}
                          onClick={() => {
                            onJump(s.id, f.id);
                            onClose();
                          }}
                          className="flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left enabled:hover:bg-sunken disabled:cursor-default"
                        >
                          <Icon
                            className={cn('mt-0.5 size-4 shrink-0', !visible ? 'text-ink-3/60' : err ? 'text-danger' : filled ? 'text-ok' : 'text-ink-3')}
                            aria-hidden
                          />
                          <span className="min-w-0 flex-1">
                            <span className={cn('block text-[13.5px]', visible ? 'text-ink' : 'text-ink-3')}>{f.label}</span>
                            <span className="block text-xs text-ink-3">
                              {visible ? describeFieldRule(f, lookups) : `Not needed now: ${describeFieldRule(f, lookups).split(', shown when ')[1] ? 'shown when ' + describeFieldRule(f, lookups).split(', shown when ')[1] : 'hidden'}`}
                            </span>
                            {err && visible && <span className="mt-0.5 block text-xs font-medium text-danger">{err}</span>}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </Drawer>
  );
}
