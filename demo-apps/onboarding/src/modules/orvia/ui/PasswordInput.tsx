'use client';
import React, {forwardRef, useState, type InputHTMLAttributes, type KeyboardEvent} from 'react';
import {ArrowBigUpDash, Check, Circle, Eye, EyeOff} from '@pepbits/icons';
import {useLocalization} from '@pepbits/i18n/react';
import {cn} from '@pepbits/ui';
import {evaluatePassword} from '../password';
import {Input} from './Field';

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {invalid?: boolean; hasHint?: boolean}
/** Password input with show/hide toggle and a caps-lock warning. The value never leaves mounted state. */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput({invalid, onKeyUp, onBlur, ...props}, ref) {
  const {t} = useLocalization();
  const [visible, setVisible] = useState(false), [caps, setCaps] = useState(false);
  function handleKey(event: KeyboardEvent<HTMLInputElement>) {setCaps(event.getModifierState?.('CapsLock') ?? false); onKeyUp?.(event);}
  return <div className="flex flex-col gap-1.5">
    <Input ref={ref} type={visible ? 'text' : 'password'} invalid={invalid} onKeyUp={handleKey} onBlur={event => {setCaps(false); onBlur?.(event);}} spellCheck={false} autoCapitalize="off"
      trailing={<button type="button" onClick={() => setVisible(value => !value)} className="grid h-8 w-9 place-items-center rounded-lg text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-800" aria-label={t(visible ? 'Hide password' : 'Show password')} aria-pressed={visible}>
        {visible ? <EyeOff className="h-4 w-4" aria-hidden="true"/> : <Eye className="h-4 w-4" aria-hidden="true"/>}
      </button>} {...props}/>
    {caps && <p className="flex animate-fade-in items-center gap-1.5 text-[length:calc(0.8rem*var(--fs-scale))] font-medium text-caution" role="status"><ArrowBigUpDash className="h-3.5 w-3.5" aria-hidden="true"/>{t('Caps Lock is on')}</p>}
  </div>;
});

const LEVELS = [
  {label: 'Too weak', bar: 'bg-signal', text: 'text-signal'},
  {label: 'Weak', bar: 'bg-signal', text: 'text-signal'},
  {label: 'Fair', bar: 'bg-caution', text: 'text-caution'},
  {label: 'Good', bar: 'bg-scrub-500', text: 'text-scrub-800'},
  {label: 'Strong', bar: 'bg-scrub-700', text: 'text-scrub-800'},
];
export function PasswordStrength({password, personal}: {password: string; personal: string[]}) {
  const {t} = useLocalization();
  const result = evaluatePassword(password, personal), level = LEVELS[result.score]!;
  return <div className="flex flex-col gap-2.5" aria-live="polite">
    <div className="flex items-center gap-3">
      <div className="grid flex-1 grid-cols-4 gap-1.5" aria-hidden="true">
        {[1, 2, 3, 4].map(i => <span key={i} className="h-1.5 overflow-hidden rounded-full bg-ink-100">
          <span className={cn('block h-full origin-left rounded-full transition-transform duration-300 ease-out rtl:origin-right', level.bar, password && result.score >= i ? 'scale-x-100' : 'scale-x-0')}/>
        </span>)}
      </div>
      <span className={cn('w-16 text-end text-xs font-semibold', password ? level.text : 'text-ink-500')}>{t(password ? level.label : 'Strength')}</span>
    </div>
    <ul className="grid gap-x-4 gap-y-1 text-[length:calc(0.8rem*var(--fs-scale))] sm:grid-cols-2">
      {result.checks.map(check => <li key={check.id} className={cn('flex items-center gap-1.5 transition-colors', check.met ? 'text-scrub-800' : 'text-ink-500')}>
        {check.met ? <Check className="h-3.5 w-3.5 animate-pop" strokeWidth={3} aria-hidden="true"/> : <Circle className="h-3 w-3" aria-hidden="true"/>}
        <span>{t(check.label)}<span className="sr-only">{check.met ? ` ${t('(done)')}` : check.required ? ` ${t('(required)')}` : ''}</span></span>
      </li>)}
    </ul>
    {result.containsPersonal && <p className="text-[length:calc(0.8rem*var(--fs-scale))] font-medium text-signal">{t('Avoid using your name, email or workspace address.')}</p>}
  </div>;
}
